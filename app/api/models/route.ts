import { NextResponse } from "next/server";

export const runtime = "nodejs";

// List available chat models for a provider using the user's key (key stays server-side per request).
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const provider = String(body?.provider || "").toLowerCase();
  const key = String(body?.key || "").trim();
  if (!key) return NextResponse.json({ models: [], error: "No API key." });

  try {
    if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ models: [], error: `Gemini ${r.status}: ${t.slice(0, 120)}` }); }
      const d = await r.json();
      const models = (d?.models || [])
        .filter((m: any) => (m?.supportedGenerationMethods || []).includes("generateContent") && !/embedding|aqa|imagen|veo/i.test(m?.name || ""))
        .map((m: any) => String(m.name).replace(/^models\//, ""))
        .sort();
      return NextResponse.json({ models });
    }
    if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { const t = await r.text().catch(() => ""); return NextResponse.json({ models: [], error: `Groq ${r.status}: ${t.slice(0, 120)}` }); }
      const d = await r.json();
      const models = (d?.data || [])
        .map((m: any) => String(m?.id || ""))
        .filter((id: string) => id && !/whisper|tts|guard|embed/i.test(id))
        .sort();
      return NextResponse.json({ models });
    }
    return NextResponse.json({ models: [], error: "Unknown provider." });
  } catch (e: any) {
    return NextResponse.json({ models: [], error: e?.name === "TimeoutError" ? "Timed out fetching models." : String(e?.message || e) });
  }
}
