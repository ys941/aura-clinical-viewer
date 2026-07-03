// Client-side settings for the Aura Assistant chatbot. Stored in localStorage (no DB);
// the key never leaves the user's browser except to their own /api/chat.
export type ChatProvider = "medgemma" | "gemini";
export interface ChatSettings { provider: ChatProvider; geminiKey: string; geminiModel: string; }

const KEY = "aura-chat-settings";
const DEFAULTS: ChatSettings = { provider: "medgemma", geminiKey: "", geminiModel: "gemini-2.5-flash" };
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
