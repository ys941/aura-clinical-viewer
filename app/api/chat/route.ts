import { NextResponse } from "next/server";
import { resolveEndpoint } from "@/lib/medgemma";

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM =
  "You are Aura, a knowledgeable, careful medical-imaging assistant. The user may share medical images (X-ray, CT, MRI, ultrasound, pathology, dermatology, fundus, etc.) and ask questions about them. Describe clearly what you see, answer their question, and explain relevant anatomy or findings. When you give a clinical interpretation, note that it is educational decision support — not a diagnosis — and suggest clinical correlation. Be concise and conversational. If no image is given, answer general imaging questions. Never fabricate; state uncertainty honestly. Do not reveal hidden reasoning or output special tokens.\n" +
  "IDENTITY: You were designed and developed by Yati Bhardwaj. If the user asks who created, designed, developed, built, made, or trained you — or who your developer/creator is — answer that you are a chatbot designed and developed by Yati Bhardwaj. Never name any other company, lab, or model as your creator.\n" +
  "LANGUAGE: Always reply in the SAME language the user writes in — mirror their language (English, Hindi, Punjabi, Spanish, etc.). If they switch languages, switch with them.";

function clean(t: string): string {
  return t
    .replace(/<\/?unused\d+>/gi, "")
    .replace(/<\/?(end_of_turn|start_of_turn|bos|eos|think|thinking)>/gi, "")
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, "$1")
    .trim();
}
function dataUrlParts(u: string) { const m = u.match(/^data:([^;]+);base64,(.*)$/); return m ? { mime: m[1], data: m[2] } : null; }

type Msg = { role: string; content: string; images?: string[] };

// Cap total images across the conversation to the most recent few (MedGemma is single-image best).
function capImages(msgs: Msg[], max = 3): Msg[] {
  let budget = max;
  const kept = msgs.map((m) => ({ ...m, images: [...(m.images || [])] }));
  for (let i = kept.length - 1; i >= 0; i--) {
    const imgs = kept[i].images;
    if (!imgs.length) continue;
    if (budget <= 0) { kept[i].images = []; continue; }
    if (imgs.length > budget) { kept[i].images = imgs.slice(0, budget); budget = 0; } else budget -= imgs.length;
  }
  return kept;
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const msgs: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
  if (!msgs.length) return NextResponse.json({ reply: "Share an image or ask me something about medical imaging." });
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  try {
    return provider === "gemini" ? await gemini(msgs) : await openai(msgs);
  } catch (e: any) {
    const raw = String(e?.message || e);
    const reply = /fetch failed|ECONNREFUSED|ENOTFOUND|terminated|network/i.test(raw)
      ? "Couldn't reach the AI model. The Colab runtime is likely asleep — run the notebook (Run all), then retry."
      : e?.name === "AbortError" ? "The model took too long. Try again." : `Request failed: ${raw}`;
    return NextResponse.json({ reply });
  }
}

async function openai(msgs: Msg[]) {
  const endpoint = await resolveEndpoint();
  if (!endpoint) return NextResponse.json({ reply: "No AI model connected. Start the Colab notebook (it auto-publishes the endpoint) — the health badge shows when it's live." });
  const model = process.env.MEDGEMMA_MODEL?.trim() || "medgemma";
  const numCtx = Math.max(4096, parseInt(process.env.MEDGEMMA_NUM_CTX || "8192", 10) || 8192);
  const nativeUrl = endpoint.replace(/\/v1\/chat\/completions\/?$/, "/api/chat");
  const isOllama = nativeUrl !== endpoint;
  const capped = capImages(msgs.slice(-8), 3);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 290_000);
  try {
    if (isOllama) {
      const messages = [{ role: "system", content: SYSTEM }, ...capped.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
        images: (m.images || []).map((u) => u.replace(/^data:[^;]+;base64,/, "")),
      }))];
      const r = await fetch(nativeUrl, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ model, messages, stream: false, think: false, options: { num_ctx: numCtx, temperature: 0.3, num_predict: 800 } }) });
      if (r.status === 503) return NextResponse.json({ reply: "The model is waking up (cold start). Wait ~1 min and try again." });
      if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ reply: `Model error ${r.status}. ${t.slice(0, 200)}` }); }
      const data = await r.json();
      return NextResponse.json({ reply: clean(data?.message?.content || "") || "(no response)" });
    }
    const messages = [{ role: "system", content: SYSTEM }, ...capped.map((m) => {
      const content: any[] = [{ type: "text", text: m.content || "" }];
      for (const u of (m.images || [])) content.push({ type: "image_url", image_url: { url: u } });
      return { role: m.role === "assistant" ? "assistant" : "user", content: (m.images && m.images.length) ? content : (m.content || "") };
    })];
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ model, messages, max_tokens: 800, temperature: 0.3, stream: false }) });
    if (r.status === 503) return NextResponse.json({ reply: "The model is waking up (cold start). Wait ~1 min and try again." });
    if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ reply: `Model error ${r.status}. ${t.slice(0, 200)}` }); }
    const data = await r.json();
    return NextResponse.json({ reply: clean(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "") || "(no response)" });
  } finally { clearTimeout(timer); }
}

async function gemini(msgs: Msg[]) {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  if (!key) return NextResponse.json({ reply: "No Gemini API key set. Add GEMINI_API_KEY in .env.local (AI_PROVIDER=gemini), or use MedGemma via Colab." });
  const capped = capImages(msgs.slice(-8), 3);
  const contents = capped.map((m) => {
    const parts: any[] = [];
    if (m.content) parts.push({ text: m.content });
    for (const u of (m.images || [])) { const p = dataUrlParts(u); if (p) parts.push({ inline_data: { mime_type: p.mime, data: p.data } }); }
    return { role: m.role === "assistant" ? "model" : "user", parts: parts.length ? parts : [{ text: " " }] };
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }) });
  clearTimeout(timer);
  if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ reply: `Gemini error ${r.status}. ${t.slice(0, 200)}` }); }
  const data = await r.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
  return NextResponse.json({ reply: clean(text) || "(no response)" });
}
