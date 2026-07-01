import { NextResponse } from "next/server";
import { resolveEndpoint } from "@/lib/medgemma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight health probe for the AI model, polled by the Topbar badge.
// Returns a small status the UI maps to a colored pill:
//   live | waking | offline | no-endpoint | no-key
type Status = "live" | "waking" | "offline" | "no-endpoint" | "no-key";

export async function GET() {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const name = provider === "gemini" ? "Gemini" : "MedGemma";

  // ── Gemini/Gemma: "healthy" == an API key is configured ──
  if (provider === "gemini") {
    const ok = !!process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    return json(ok ? "live" : "no-key", { provider, name, model,
      detail: ok ? "API key configured · ready" : "No GEMINI_API_KEY set" });
  }

  // ── MedGemma (OpenAI-compatible, via Colab tunnel) ──
  const model = process.env.MEDGEMMA_MODEL?.trim() || "medgemma";
  const token = process.env.HF_TOKEN?.trim();
  const endpoint = await resolveEndpoint().catch(() => "");
  if (!endpoint) {
    return json("no-endpoint", { provider, name, model,
      detail: "No endpoint published — start the Colab notebook (Run all)." });
  }

  // Probe the model list (Ollama/llama.cpp expose /v1/models). Cheap + fast.
  const probe = endpoint.replace(/\/chat\/completions\/?$/, "/models");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(probe, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (r.ok) {
      return json("live", { provider, name, model, host: hostOf(endpoint),
        detail: "Model online · ready to analyze" });
    }
    if (r.status === 503 || r.status === 502 || r.status === 530) {
      return json("waking", { provider, name, model, host: hostOf(endpoint),
        detail: "Runtime warming up — try again shortly." });
    }
    return json("offline", { provider, name, model, host: hostOf(endpoint),
      detail: `Endpoint responded ${r.status}.` });
  } catch {
    // Tunnel published but not reachable → Colab runtime asleep/stopped.
    return json("waking", { provider, name, model, host: hostOf(endpoint),
      detail: "Endpoint unreachable — the Colab runtime may be asleep." });
  }
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ""; }
}

function json(status: Status, extra: Record<string, unknown>) {
  const ok = status === "live";
  return NextResponse.json({ ok, status, ...extra }, {
    headers: { "Cache-Control": "no-store" },
  });
}
