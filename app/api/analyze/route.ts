import { NextResponse } from "next/server";

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
  "You are a medical-imaging assistant. Based ONLY on the supplied representative images and metadata, produce a concise structured radiology read with two sections — 'Findings:' (bulleted) and 'Impression:'. Be cautious, note limitations of sampled images, and state clearly this is clinical decision support, not a diagnosis.";

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 8) : [];
  const study = { name: body?.name ?? "study", modality: body?.modality ?? "—", imageCount: body?.imageCount ?? 0, sampled: images.length };
  const userText =
    `Modality: ${study.modality}. Study: ${study.name}. ${images.length} representative image(s) sampled from ${study.imageCount} total. Give Findings and Impression.`;

  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  try {
    if (provider === "gemini") return await gemini(study, userText, images);
    return await openai(study, userText, images);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Timed out waiting for the model. Try again or use fewer images." : `Request failed: ${e?.message || e}`;
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
  return NextResponse.json({ connected: true, study, model, text });
}

async function openai(study: any, userText: string, images: string[]) {
  const endpoint = process.env.MEDGEMMA_ENDPOINT?.trim();
  const model = process.env.MEDGEMMA_MODEL?.trim() || "medgemma";
  const token = process.env.HF_TOKEN?.trim();
  if (!endpoint) {
    return NextResponse.json({ connected: false, study, message: "No endpoint configured. Set MEDGEMMA_ENDPOINT (OpenAI-compatible) in .env.local, or use AI_PROVIDER=gemini." });
  }
  // Free CPU is slow — cap images so the request doesn't time out.
  const capped = images.slice(0, 2);
  const content: any[] = [{ type: "text", text: userText }];
  for (const u of capped) content.push({ type: "image_url", image_url: { url: u } });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 290_000);
  const r = await fetch(endpoint, {
    method: "POST", headers, signal: controller.signal,
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: images.length ? content : userText }], max_tokens: 768, temperature: 0.2, stream: false }),
  });
  clearTimeout(timer);
  if (r.status === 503) return NextResponse.json({ connected: false, study, message: "Endpoint waking up (cold start). Wait ~1 min and retry." });
  if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ connected: false, study, message: `Endpoint error ${r.status}. ${t.slice(0, 240)}` }); }
  const data = await r.json();
  const text = (data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "").trim();
  return NextResponse.json({ connected: !!text, study, text: text || "(empty response)" });
}
