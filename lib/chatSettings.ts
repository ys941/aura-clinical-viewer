// Client-side settings for the Aura Assistant chatbot. Stored in localStorage (no DB);
// keys never leave the user's browser except to their own /api routes.
export type ChatProvider = "medgemma" | "gemini" | "groq";
export interface ChatSettings {
  provider: ChatProvider;
  geminiKey: string; geminiModel: string;
  groqKey: string; groqModel: string;
}

const KEY = "aura-chat-settings";
const DEFAULTS: ChatSettings = {
  provider: "medgemma",
  geminiKey: "", geminiModel: "gemini-2.5-flash",
  groqKey: "", groqModel: "llama-3.3-70b-versatile",
};
export const CHAT_SETTINGS_EVENT = "aura-chat-settings-changed";

export function getChatSettings(): ChatSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; }
}

export function setChatSettings(patch: Partial<ChatSettings>): ChatSettings {
  const next = { ...getChatSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHAT_SETTINGS_EVENT));
  } catch {}
  return next;
}
