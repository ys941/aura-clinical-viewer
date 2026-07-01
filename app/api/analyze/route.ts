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

const SYSTEM =
  "You are a radiologist producing a structured report from an imaging study.\n" +
  "You are given montage images — EACH montage is ONE view/plane of the study, and its top banner names the view (e.g. AXIAL, CORONAL, SAGITTAL, or 'VIEW N' when the plane is not encoded in the data). Each tile inside a montage is a slice sampled across that view; the small cyan number on a tile is that slice's index in the study.\n\n" +
  "Read every tile of every view. Do NOT rely on or invent series names — identify each view from its banner (and for 'VIEW N', identify the projection/plane yourself from the image, e.g. frontal/PA, lateral, oblique). Then write a concise, professional report in clean Markdown with EXACTLY these sections:\n\n" +
  "## Technique\n- One line: the modality and the views/planes provided.\n\n" +
  "## Findings\nOrganize findings BY VIEW. For each view present, use a bold sub-label and describe what that view shows, citing slice numbers where relevant:\n- **Axial:** …\n- **Coronal:** …\n- **Sagittal:** …\n(For radiographs/other, use the projection you identify, e.g. **Frontal:**, **Lateral:**.) Be systematic; note normal structures and any abnormality with its location and slice number.\n\n" +
  "## Impression\n- 1–3 numbered, concise clinical takeaways.\n\n" +
  "## Key Images\nList ONLY the slice numbers that best demonstrate the findings/impression, one per line, as:\n- Slice <number> (<view>): <what it shows>\nUse the exact slice numbers printed on the tiles. If the study is unremarkable, write '- None'.\n\n" +
  "Rules: only sampled slices were reviewed — say so. This is clinical decision support, not a diagnosis. Output ONLY these sections — no reasoning, no special tokens.";

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

  const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 8) : [];
  const views: string[] = Array.isArray(body?.views) ? body.views.map((v: any) => String(v)) : [];
  const study = { name: body?.name ?? "study", modality: body?.modality ?? "—", imageCount: body?.imageCount ?? 0, sampled: images.length };
  const viewList = views.length
    ? views.map((v, i) => `montage ${i + 1} = ${v} view`).join("; ")
    : `${images.length} montage(s)`;
  const userText =
    `Modality: ${study.modality}. There are ${images.length} montage image(s), one per view (${viewList}). Each tile is a slice sampled across that view (${study.imageCount} images total). Read every view, then produce the report with Findings grouped per view, an Impression, and a Key Images list of the slice numbers that show the findings.`;

  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  try {
    if (provider === "gemini") return await gemini(study, userText, images);
    return await openai(study, userText, images);
  } catch (e: any) {
    const raw = String(e?.message || e);
    let msg: string;
    if (e?.name === "AbortError") {
      msg = "Timed out waiting for the model. Try again or use fewer images.";
    } else if (/fetch failed|ECONNREFUSED|ENOTFOUND|terminated|network/i.test(raw)) {
      msg = "Couldn't reach the AI model. The Colab runtime is likely asleep or not started — run the notebook (Run all), then retry.";
    } else {
      msg = `Request failed: ${raw}`;
    }
    return NextResponse.json({ connected: false, study, message: msg });
  }
}

function dataUrlParts(u: string) {
  const m = u.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { mime: m[1], data: m[2] } : null;
}

async function gemini(study: any, userText: string, images: string[]) {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  if (!key) {
    return NextResponse.json({
      connected: false, study,
      message: "No Gemini API key. Get a free key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in .env.local (AI_PROVIDER=gemini). Nothing is fabricated.",
    });
  }
  // Gemma models have no system role — fold instructions into the user turn (works for Gemini too).
  const parts: any[] = [{ text: `${SYSTEM}\n\n${userText}` }];
  for (const u of images) { const p = dataUrlParts(u); if (p) parts.push({ inline_data: { mime_type: p.mime, data: p.data } }); }

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

async function openai(study: any, userText: string, images: string[]) {
  const endpoint = await resolveEndpoint();
  const model = process.env.MEDGEMMA_MODEL?.trim() || "medgemma";
  const token = process.env.HF_TOKEN?.trim();
  if (!endpoint) {
    return NextResponse.json({ connected: false, study, message: "MedGemma endpoint not found. Start the Colab notebook (it auto-publishes the endpoint), or set MEDGEMMA_ENDPOINT in .env.local." });
  }
  // Cap images so requests stay responsive (GPU Colab handles a handful easily).
  // One montage per view — allow up to 6 so axial+coronal+sagittal (+extras) all go.
  const capped = images.slice(0, 6);
  const content: any[] = [{ type: "text", text: userText }];
  for (const u of capped) content.push({ type: "image_url", image_url: { url: u } });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 290_000);
  const r = await fetch(endpoint, {
    method: "POST", headers, signal: controller.signal,
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: images.length ? content : userText }], max_tokens: 1200, temperature: 0.2, stream: false }),
  });
  clearTimeout(timer);
  if (r.status === 503) return NextResponse.json({ connected: false, study, message: "Endpoint waking up (cold start). Wait ~1 min and retry." });
  if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ connected: false, study, message: `Endpoint error ${r.status}. ${t.slice(0, 240)}` }); }
  const data = await r.json();
  const text = clean((data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "").trim());
  return NextResponse.json({ connected: !!text, study, text: text || "(empty response)" });
}
