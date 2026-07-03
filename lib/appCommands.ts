// Tiny event bus so the chatbot (in the app shell) can drive the Viewer (a separate tree).
export type AppCommand = { name: string; args?: any };
const EVT = "aura-app-command";

export function dispatchAppCommand(name: string, args?: any) {
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: { name, args } })); } catch {}
}
export function onAppCommand(handler: (c: AppCommand) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent).detail as AppCommand);
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
