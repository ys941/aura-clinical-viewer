import { NextResponse } from "next/server";
import { resolveEndpoint } from "@/lib/medgemma";

export const runtime = "nodejs";
export const maxDuration = 300;

// Whole-study AI analysis. Provider-agnostic:
//   AI_PROVIDER=gemini  → Google AI Studio (Gemini OR Gemma models, free tier, vision)
//       GEMINI_API_KEY=...                (https://aistudio.google.com/apikey)
//       GEMINI_MODEL=gemini-2.5-flash     (or gemma-3-27b-it, gemini-2.0-flash, …)
//   AI_PROVIDER=openai  → any OpenAI-compatible vision endpoint (local llama.cpp / HF Space / MedGemma)
//       MEDGEMMA_ENDPOINT=https://…/v1/chat/completions
//       MEDGEMMA_MODEL=medgemma     HF_TOKEN=hf_… (if private)

// Shared style rules — the output must read like a radiologist wrote it, with zero meta-talk.
const STYLE =
  "STYLE RULES (mandatory): Write in formal radiology-report language. NEVER mention montages, tiles, grids, banners, batches, notes, sampling, views provided, image quality of the montage, or that you are an AI. Never describe HOW the images were given to you. Never output a Technique section, headers other than those requested, disclaimers, or 'Note:' lines. Refer to a location as (image N) only where a citation genuinely helps. No reasoning, no special tokens.";

const SYSTEM =
  "You are a radiologist reviewing part of an imaging study.\n" +
  "Input: montage images — each is a grid of slices from one plane (the banner names the plane; the small cyan number on a tile is that slice's image number in the study).\n\n" +
  "Record your observations the way a radiologist drafts them: grouped by ANATOMICAL STRUCTURE / organ system (not by plane), each as '**Structure:** finding (image N).' Include pertinent normals briefly. Identify the plane/projection yourself from the images when needed. End with a line 'Key candidates: image N (reason), …' listing the slices that best show any abnormality (or 'Key candidates: none').\n\n" +
  STYLE;

// Used by the synthesis pass: merge several partial notes into ONE final report.
const SYSTEM_SYNTH =
  "You are a radiologist writing the FINAL report for an imaging study by consolidating draft observations (each draft covered a different portion of the study). Merge them into ONE definitive report in clean Markdown with EXACTLY these sections:\n\n" +
  "## Findings\nOrganized by ANATOMICAL STRUCTURE / organ system, exactly like a formal radiology report — one line or short paragraph per structure, in this style:\n**Lungs:** No focal consolidation. …\n**Heart:** Normal in size. …\nCover every structure mentioned in the drafts, merge duplicates keeping the most specific wording, include pertinent normals, and cite (image N) only where it helps.\n\n" +
  "## Impression\n1. Numbered, concise clinical conclusions — most significant first.\n\n" +
  "## Recommendations\n- 1–3 short, actionable next steps. Write '- Clinical correlation.' if nothing specific.\n\n" +
  "## Key Images\n- Slice <number>: <what it shows> — the most representative images from the drafts. Write '- None' if unremarkable.\n\n" +
  "Do NOT invent findings that are not in the drafts. If clinical history is provided, address it in the Impression. " + STYLE;

// Strip model control / chain-of-thought tokens (e.g. MedGemma's <unused94> thought …).
function clean(text: string): string {
  let t = text.replace(/<\/?unused\d+>/gi, "").replace(/<\/?(end_of_turn|start_of_turn|bos|eos)>/gi, "");
  // drop a leading "thought" reasoning preamble before the first real heading/section
  const cut = t.search(/(^|\n)\s*(#+\s*(Technique|Findings)|\*{0,2}(Technique|Findings)\b)/i);
  if (cut > 0 && /thought/i.test(t.slice(0, cut))) t = t.slice(cut);
  return t.trim();
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const study = { name: body?.name ?? "study", modality: body?.modality ?? "—", imageCount: body?.imageCount ?? 0, sampled: 0 };
  const history = String(body?.history || "").trim().slice(0, 600);
  const historyLine = history ? `Clinical history: ${history}\n` : "";

  try {
    // ── Synthesis pass: merge partial per-batch drafts into ONE final report (text only) ──
    if (body?.mode === "synthesize") {
      const notes: string[] = Array.isArray(body?.notes) ? body.notes.map((n: any) => String(n)).filter(Boolean) : [];
      if (!notes.length) return NextResponse.json({ connected: false, study, message: "Nothing to synthesize — no batch notes were produced." });
      const userText =
        `${historyLine}Consolidate these ${notes.length} draft observation set(s) from ONE ${study.modality} study (${study.imageCount} images) into the single final report.\n\n` +
        notes.map((n, i) => `[Draft ${i + 1}]\n${n}`).join("\n\n");
      return provider === "gemini" ? await gemini(study, userText, [], SYSTEM_SYNTH) : await openai(study, userText, [], SYSTEM_SYNTH);
    }

    // ── Batch pass: analyse ONE batch of full-resolution montages (a portion of the study) ──
    const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 12) : [];
    study.sampled = images.length;
    const userText =
      `${historyLine}Modality: ${study.modality}. These ${images.length} montage image(s) show a portion of the study; each tile is one full-resolution slice and the small number on a tile is its image number. Record your draft observations by anatomical structure with image numbers, then the 'Key candidates:' line.`;
    return provider === "gemini" ? await gemini(study, userText, images) : await openai(study, userText, images);
  } catch (e: any) {
    const raw = String(e?.message || e);
    let msg: string;
    if (e?.name === "AbortError") msg = "Timed out waiting for the model. Try again.";
    else if (/fetch failed|ECONNREFUSED|ENOTFOUND|terminated|network/i.test(raw)) msg = "Couldn't reach the AI model. The Colab runtime is likely asleep or not started — run the notebook (Run all), then retry.";
    else msg = `Request failed: ${raw}`;
    return NextResponse.json({ connected: false, study, message: msg });
  }
}

function dataUrlParts(u: string) {
  const m = u.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { mime: m[1], data: m[2] } : null;
}

async function gemini(study: any, userText: string, images: string[], system: string = SYSTEM) {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  if (!key) {
    return NextResponse.json({
      connected: false, study,
      message: "No Gemini API key. Get a free key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in .env.local (AI_PROVIDER=gemini). Nothing is fabricated.",
    });
  }
  // Gemma models have no system role — fold instructions into the user turn (works for Gemini too).
  const parts: any[] = [{ text: `${system}\n\n${userText}` }];
  for (const u of images.slice(0, 16)) { const p = dataUrlParts(u); if (p) parts.push({ inline_data: { mime_type: p.mime, data: p.data } }); }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
  });
  clearTimeout(timer);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ connected: false, study, message: `Gemini error ${r.status}. ${t.slice(0, 260)}` });
  }
  const data = await r.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
  if (!text) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    return NextResponse.json({ connected: false, study, message: `No text returned${reason ? ` (${reason})` : ""}. Try a different model or fewer images.` });
  }
  return NextResponse.json({ connected: true, study, model, text: clean(text) });
}

function friendlyErr(t: string): string {
  if (/context size|exceed_context/i.test(t)) return "The study was too large for the model's context window. Re-run the Colab notebook to reload the model, then retry — the app now requests a larger context automatically.";
  return t.slice(0, 240);
}

async function openai(study: any, userText: string, images: string[], system: string = SYSTEM) {
  const endpoint = await resolveEndpoint();
  const model = process.env.MEDGEMMA_MODEL?.trim() || "medgemma";
  const token = process.env.HF_TOKEN?.trim();
  // Whole-study montages need a bigger context than the model's 4096 default.
  const numCtx = Math.max(4096, parseInt(process.env.MEDGEMMA_NUM_CTX || "8192", 10) || 8192);
  if (!endpoint) {
    return NextResponse.json({ connected: false, study, message: "MedGemma endpoint not found. Start the Colab notebook (it auto-publishes the endpoint), or set MEDGEMMA_ENDPOINT in .env.local." });
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 290_000);

  // Ollama's native /api/chat lets us raise num_ctx so the whole study fits (the OpenAI-compat
  // /v1 path is pinned to the model's default context). Fall back to /v1 for other servers.
  const nativeUrl = endpoint.replace(/\/v1\/chat\/completions\/?$/, "/api/chat");
  const isOllama = nativeUrl !== endpoint;
  try {
    if (isOllama) {
      const imgs = images.map((u) => u.replace(/^data:[^;]+;base64,/, ""));
      const r = await fetch(nativeUrl, {
        method: "POST", headers, signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: userText, images: imgs }],
          stream: false,
          options: { num_ctx: numCtx, temperature: 0.2, num_predict: 1200 },
        }),
      });
      if (r.status === 503) return NextResponse.json({ connected: false, study, message: "Endpoint waking up (cold start). Wait ~1 min and retry." });
      if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ connected: false, study, message: `Endpoint error ${r.status}. ${friendlyErr(t)}` }); }
      const data = await r.json();
      const text = clean((data?.message?.content || "").trim());
      return NextResponse.json({ connected: !!text, study, text: text || "(empty response)" });
    }

    // Generic OpenAI-compatible vision endpoint (e.g. HF Space).
    const content: any[] = [{ type: "text", text: userText }];
    for (const u of images) content.push({ type: "image_url", image_url: { url: u } });
    const r = await fetch(endpoint, {
      method: "POST", headers, signal: controller.signal,
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: images.length ? content : userText }], max_tokens: 1200, temperature: 0.2, stream: false }),
    });
    if (r.status === 503) return NextResponse.json({ connected: false, study, message: "Endpoint waking up (cold start). Wait ~1 min and retry." });
    if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ connected: false, study, message: `Endpoint error ${r.status}. ${friendlyErr(t)}` }); }
    const data = await r.json();
    const text = clean((data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "").trim());
    return NextResponse.json({ connected: !!text, study, text: text || "(empty response)" });
  } finally { clearTimeout(timer); }
}
