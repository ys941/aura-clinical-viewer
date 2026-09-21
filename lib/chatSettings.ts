// Client-side settings for the Aura Assistant chatbot. Stored in localStorage (no DB);
// keys never leave the user's browser except to their own /api routes.
import { DEFAULT_GROQ_MODEL, resolveGroqModel } from "@/lib/groqModels";

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
  groqKey: "", groqModel: DEFAULT_GROQ_MODEL,
};
export const CHAT_SETTINGS_EVENT = "aura-chat-settings-changed";

export function getChatSettings(): ChatSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    // A model saved before Groq retired it would fail every message.
    return { ...saved, groqModel: resolveGroqModel(saved.groqModel) };
  } catch { return { ...DEFAULTS }; }
}

export function setChatSettings(patch: Partial<ChatSettings>): ChatSettings {
  const next = { ...getChatSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHAT_SETTINGS_EVENT));
  } catch {}
  return next;
}
