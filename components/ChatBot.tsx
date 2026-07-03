"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { X, Send, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { getChatSettings, setChatSettings } from "@/lib/chatSettings";
import { setReportPrefs } from "@/lib/reportPrefs";
import { dispatchAppCommand } from "@/lib/appCommands";

type Msg = { role: "user" | "assistant"; text: string; images?: string[] };

// Heuristic: does this text-only message look like a request to change a setting or drive the viewer?
const SETTINGS_HINT = /\b(set|change|update|make|rename|call me|my name|i am|i'?m|name is|role|radiologist|cardiologist|pathologist|clinician|resident|technologist|organization|organisation|company|clinic|centre|center|hospital|doctor|dr\.?|letterhead|signature|qualification|registration|reg\.?\s*no|model|gemini|medgemma|profile|window|level|preset|lung|bone|brain|soft tissue|angio|wheel|zoom|scroll|overlay|invert|full ?screen|reset|next|previous|prev|first|last|slice|analy[sz]e|report|open)\b/i;

// Change assistant settings by chatting (text-only). Returns a reply, or null to fall through to the model.
function handleSettingsCommand(text: string): string | null {
  const t = text.toLowerCase().trim();
  const keyMatch = text.match(/AIza[\w-]{20,}/);
  if (keyMatch && /(gemini|api\s*key|\bkey\b)/i.test(t)) {
    setChatSettings({ geminiKey: keyMatch[0], provider: "gemini" });
    return "Saved your Gemini API key and switched me to Gemini. ✅ Ask me anything now.";
  }
  if (/\b(use|switch to|change to|set|talk in)\b.*\bgemini\b/.test(t) || t === "gemini") {
    const s = setChatSettings({ provider: "gemini" });
    return s.geminiKey ? "Switched to Gemini. ✅" : "Switched to Gemini — I still need a key. Paste it like “my gemini key is AIza…”, or add it in Settings → AI Assistant.";
  }
  if (/\b(use|switch to|change to|set)\b.*\b(medgemma|med gemma|colab)\b/.test(t) || t === "medgemma") {
    setChatSettings({ provider: "medgemma" });
    return "Switched to MedGemma (via Colab). ✅ Best when you attach a medical image.";
  }
  if ((/\b(what|which)\b.*\bmodel\b/.test(t) && /\b(you|using|now|current)\b/.test(t)) || /current model/.test(t)) {
    const s = getChatSettings();
    return `I'm currently using ${s.provider === "gemini" ? `Gemini (${s.geminiModel})` : "MedGemma (via Colab)"}. Say “use gemini” or “use medgemma” to switch.`;
  }
  if (/\b(open|go to|show)\b.*\bsettings\b/.test(t)) { try { window.location.href = "/settings"; } catch {} return "Opening Settings…"; }
  return null;
}

// A Siri-like animated orb: layered rotating conic gradients + a pulsing core.
function SiriOrb() {
  const g1 = "conic-gradient(from 0deg,#22d3ee,#6366f1,#ec4899,#f59e0b,#10b981,#22d3ee)";
  const g2 = "conic-gradient(from 90deg,#a78bfa,#22d3ee,#f472b6,#a78bfa)";
  return (
    <span className="relative block h-full w-full">
      <span className="absolute inset-0 rounded-full animate-spin [animation-duration:3.2s]" style={{ background: g1 }} />
      <span className="absolute inset-[14%] rounded-full animate-spin blur-[2px] [animation-duration:2.1s] [animation-direction:reverse]" style={{ background: g2 }} />
      <span className="absolute inset-[34%] rounded-full bg-white/85 blur-[3px] animate-pulse" />
    </span>
  );
}

async function fileToDataUrl(file: File, max = 896): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}

export function ChatBot() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading, open]);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 4);
    for (const f of files) { try { const d = await fileToDataUrl(f); setStaged((s) => [...s, d].slice(0, 4)); } catch {} }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items; if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) files.push(f); } }
    if (files.length) { e.preventDefault(); addFiles(files); }
  }

  // Apply a settings action returned by the Gemini agent, then return the confirmation text.
  async function applyAction(act: any): Promise<string> {
    const action = act?.action, p = act?.params || {}, reply = typeof act?.reply === "string" ? act.reply : "Done.";
    try {
      if (action === "set_profile" && user) {
        const update: any = {};
        if (typeof p.firstName === "string") update.firstName = p.firstName;
        if (typeof p.lastName === "string") update.lastName = p.lastName;
        if (p.role !== undefined || p.organization !== undefined) {
          update.unsafeMetadata = { ...(user.unsafeMetadata || {}) };
          if (p.role !== undefined) update.unsafeMetadata.role = p.role;
          if (p.organization !== undefined) update.unsafeMetadata.organization = p.organization;
        }
        if (Object.keys(update).length) await user.update(update);
      } else if (action === "set_letterhead") {
        const patch: any = {};
        for (const k of ["clinicName", "clinicAddress", "doctorName", "doctorCreds"]) if (p[k] !== undefined) patch[k] = p[k];
        setReportPrefs(patch);
      } else if (action === "set_chat_model") {
        const patch: any = {};
        if (p.provider) patch.provider = p.provider;
        if (p.geminiModel) patch.geminiModel = p.geminiModel;
        setChatSettings(patch);
      } else if (action === "viewer" && p.command) {
        dispatchAppCommand("viewer", { command: p.command, value: p.value });
      }
      return reply;
    } catch (e: any) {
      return `${reply} (but I couldn't save it: ${e?.errors?.[0]?.message || e?.message || e})`;
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !staged.length) || loading) return;
    const imgs = staged;
    const userMsg: Msg = { role: "user", text: text || "What can you tell me about this image?", images: imgs };
    const history = [...messages, userMsg];
    setMessages(history); setInput(""); setStaged([]);

    // Text-only settings commands are handled locally (switch model, set key, etc.).
    if (!imgs.length && text) {
      const cmd = handleSettingsCommand(text);
      if (cmd) { setMessages((m) => [...m, { role: "assistant", text: cmd }]); return; }
    }

    const s0 = getChatSettings();
    // Gemini-powered "configure by chat": profile / letterhead / model from natural language.
    if (!imgs.length && text && s0.provider === "gemini" && SETTINGS_HINT.test(text)) {
      setLoading(true);
      try {
        const res = await fetch("/api/assistant-action", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, geminiKey: s0.geminiKey, geminiModel: s0.geminiModel }) });
        const act = await res.json();
        const applied = await applyAction(act);
        setMessages((m) => [...m, { role: "assistant", text: applied }]);
      } catch (e: any) {
        setMessages((m) => [...m, { role: "assistant", text: `Couldn't apply that: ${e?.message || e}` }]);
      } finally { setLoading(false); }
      return;
    }

    setLoading(true);
    try {
      const s = getChatSettings();
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text, images: m.images || [] })),
          provider: s.provider, geminiKey: s.geminiKey, geminiModel: s.geminiModel,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data?.reply || "Sorry, I couldn't get a response." }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Request failed: ${e?.message || e}` }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} title="Ask Aura about an image" aria-label="Open Aura assistant"
          className="fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full p-0 shadow-[0_0_34px_-4px_rgba(99,102,241,0.75)] ring-1 ring-white/15 transition hover:scale-105">
          <span className="relative block h-full w-full overflow-hidden rounded-full"><SiriOrb /></span>
        </button>
      )}

      {open && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className="fixed bottom-5 right-5 z-[60] flex h-[560px] max-h-[82vh] w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-900/95 shadow-2xl backdrop-blur-xl">
          {/* header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2"><span className="h-6 w-6"><SiriOrb /></span><span className="text-sm font-semibold text-white">Aura Assistant</span></div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && <button onClick={() => setMessages([])} title="Clear chat" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white"><Trash2 className="h-4 w-4" /></button>}
              <button onClick={() => setOpen(false)} title="Close" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="relative flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="mt-8 flex flex-col items-center text-center">
                <span className="mb-3 h-16 w-16"><SiriOrb /></span>
                <p className="text-sm text-slate-300">Drop, paste, or upload a medical image and ask me anything about it.</p>
                <p className="mt-1 text-[11px] text-slate-500">Educational decision support — not a diagnosis.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[86%] rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "bg-medical-600 text-white" : "border border-white/10 bg-white/5 text-slate-200")}>
                  {m.images && m.images.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">{m.images.map((im, j) => <img key={j} src={im} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
            {drag && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-teal-500/10 backdrop-blur-sm"><div className="rounded-xl border-2 border-dashed border-teal-400/60 px-6 py-4 text-sm font-medium text-teal-200">Drop image here</div></div>}
          </div>

          {/* staged images */}
          {staged.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 pt-2">
              {staged.map((im, i) => (
                <div key={i} className="relative">
                  <img src={im} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button onClick={() => setStaged((s) => s.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-navy-950 text-slate-300 ring-1 ring-white/20 hover:text-white"><X className="h-2.5 w-2.5" /></button>
                </div>
              ))}
            </div>
          )}

          {/* input */}
          <div className="flex items-end gap-2 border-t border-white/10 p-3">
            <button onClick={() => fileRef.current?.click()} title="Attach image" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"><ImagePlus className="h-4 w-4" /></button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onPaste={onPaste}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Ask about the image…"
              className="max-h-24 flex-1 resize-none rounded-lg border border-white/10 bg-navy-850 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-500/50" />
            <button onClick={send} disabled={loading || (!input.trim() && !staged.length)} title="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-500 disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
