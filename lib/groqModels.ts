// Groq model defaults, shared by the settings UI and the API routes.
//
// Groq shut down llama-3.3-70b-versatile (the old default) and several other
// models in 2026. A key or model saved before then would fail every request,
// so retired IDs are swapped for the current default wherever they turn up.

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const RETIRED_GROQ_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
  "qwen/qwen3.6-27b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "moonshotai/kimi-k2-instruct",
  "gemma2-9b-it",
]);

/** The model to call: the one asked for, unless it is empty or retired. */
export function resolveGroqModel(model?: string | null): string {
  const m = (model || "").trim();
  return m && !RETIRED_GROQ_MODELS.has(m) ? m : DEFAULT_GROQ_MODEL;
}

/**
 * gpt-oss reasons before answering, and that counts against max_tokens. Low
 * effort keeps replies fast and leaves the budget for the answer itself.
 */
export function groqReasoningOpts(model: string): { reasoning_effort?: "low" } {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}
