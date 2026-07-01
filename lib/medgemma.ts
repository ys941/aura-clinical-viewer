// Shared MedGemma endpoint discovery. Prefer an explicit MEDGEMMA_ENDPOINT;
// otherwise auto-discover the latest URL the Colab notebook published to a free
// ntfy.sh topic (the per-session Colab URL updates automatically — no .env edits).

let epCache = { url: "", at: 0 };

export async function resolveEndpoint(): Promise<string> {
  const direct = process.env.MEDGEMMA_ENDPOINT?.trim();
  if (direct) return direct;
  const topic = process.env.MEDGEMMA_NTFY_TOPIC?.trim();
  if (!topic) return "";
  if (epCache.url && Date.now() - epCache.at < 15_000) return epCache.url;
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=12h`, {
      signal: AbortSignal.timeout(8000),
    });
    const txt = await r.text();
    let url = "";
    for (const line of txt.trim().split("\n")) {
      try {
        const o = JSON.parse(line);
        const msg = (o?.message || "").trim();
        if (o?.event === "message" && /^https?:\/\/\S+\/v1\/chat\/completions$/.test(msg)) url = msg;
      } catch {}
    }
    if (url) { epCache = { url, at: Date.now() }; return url; }
  } catch {}
  return epCache.url || "";
}
