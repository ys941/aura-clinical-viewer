"use client";

import { useEffect, useRef, useState } from "react";
import { useOptionalUser } from "@/lib/use-optional-user";
import { X, Send, ImagePlus, Loader2, Trash2, Monitor, Mic } from "lucide-react";
import { cn } from "@/lib/cn";
import { getChatSettings, setChatSettings } from "@/lib/chatSettings";
import { setReportPrefs } from "@/lib/reportPrefs";
import { dispatchAppCommand } from "@/lib/appCommands";

type Msg = { role: "user" | "assistant"; text: string; images?: string[] };

// Heuristic: does this text-only message look like a request to change a setting or drive the viewer?
const SETTINGS_HINT = /\b(set|change|update|make|rename|call me|my name|i am|i'?m|name is|role|radiologist|cardiologist|pathologist|clinician|resident|technologist|organization|organisation|company|clinic|centre|center|hospital|doctor|dr\.?|letterhead|signature|qualification|registration|reg\.?\s*no|model|gemini|medgemma|groq|profile|window|level|preset|lung|bone|brain|soft tissue|angio|brightness|contrast|brighter|darker|lighter|dim|wheel|zoom|scroll|overlay|invert|full ?screen|reset|clear|copy|rotate|flip|cine|play|pause|fps|tool|pan|magnify|length|angle|rectangle|ellipse|probe|annotate|freehand|next|previous|prev|first|last|slice|series|panel|tags|pin|analy[sz]e|report|findings?|impression|diagnosis|recommendation|advice|download|print|save pdf|upload|open|load|new study)\b/i;

// Change assistant settings by chatting (text-only). Returns a reply, or null to fall through to the model.
function handleSettingsCommand(text: string): string | null {
  const t = text.toLowerCase().trim();
  const geminiKeyMatch = text.match(/AIza[\w-]{20,}/);
  if (geminiKeyMatch && /(gemini|api\s*key|\bkey\b)/i.test(t)) {
    setChatSettings({ geminiKey: geminiKeyMatch[0], provider: "gemini" });
    return "Saved your Gemini API key and switched me to Gemini. ✅ Ask me anything now.";
  }
  const groqKeyMatch = text.match(/gsk_[\w-]{20,}/);
  if (groqKeyMatch) {
    setChatSettings({ groqKey: groqKeyMatch[0], provider: "groq" });
    return "Saved your Groq API key and switched me to Groq. ✅";
  }
  if (/\b(use|switch to|change to|set|talk in)\b.*\bgemini\b/.test(t) || t === "gemini") {
    const s = setChatSettings({ provider: "gemini" });
    return s.geminiKey ? "Switched to Gemini. ✅" : "Switched to Gemini — I still need a key. Paste it like “my gemini key is AIza…”, or add it in Settings → AI Assistant.";
  }
  if (/\b(use|switch to|change to|set)\b.*\bgroq\b/.test(t) || t === "groq") {
    const s = setChatSettings({ provider: "groq" });
    return s.groqKey ? "Switched to Groq. ✅" : "Switched to Groq — I still need a key. Paste it like “my groq key is gsk_…”, or add it in Settings → AI Assistant.";
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

async function dataUrlResize(src: string, max = 896): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    if (scale >= 1) return src;
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9);
  } catch { return src; }
}
// The slice currently shown in the viewer (with its live window/brightness).
function captureViewer(): string | null { try { return (window as any).__auraCaptureViewer?.() || null; } catch { return null; } }
// Phrases that mean "look at what's on my screen" — but NOT the whole-study/pinned run commands.
const REFERS_TO_VIEW = /\b(what('?s| is| do you| are you)?\s*(you\s*)?(see|seeing|showing)|what is this|what'?s this|this (image|slice|scan|x-?ray|film|ct|mri|study)|current (image|slice|view)|on[- ]?screen|read (this|it)|describe (this|it)|diagnos)/i;

export function ChatBot() {
  const { user } = useOptionalUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [agentReady, setAgentReady] = useState(false); // a Gemini/Groq key exists server-side → config-by-chat works
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const baseRef = useRef("");
  const handsFreeRef = useRef(false);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef<() => void>(() => {});
  useEffect(() => { sendRef.current = () => send(); });

  useEffect(() => { setMicOk(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);
  useEffect(() => () => { handsFreeRef.current = false; if (silenceRef.current) clearTimeout(silenceRef.current); try { recRef.current?.stop(); } catch {} }, []);

  // Hands-free voice: one click keeps listening across pauses; auto-sends each spoken phrase.
  function startRec() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = ""; baseRef.current = input ? input + " " : "";
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t + " "; else interim += t;
      }
      setInput((baseRef.current + finalRef.current + interim).replace(/\s+/g, " ").trimStart());
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => {
        if (finalRef.current.trim()) { sendRef.current(); finalRef.current = ""; baseRef.current = ""; }
      }, 1400);
    };
    rec.onerror = () => {};
    rec.onend = () => { if (handsFreeRef.current) setTimeout(() => { try { startRec(); } catch {} }, 200); else setListening(false); };
    recRef.current = rec;
    try { rec.start(); } catch {}
  }
  function toggleMic() {
    if (listening || handsFreeRef.current) {
      handsFreeRef.current = false;
      if (silenceRef.current) clearTimeout(silenceRef.current);
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    handsFreeRef.current = true;
    startRec();
  }

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading, open]);
  useEffect(() => { fetch("/api/settings-keys").then((r) => r.json()).then((d) => setAgentReady(!!d?.gemini || !!d?.groq)).catch(() => {}); }, [open]);

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
        dispatchAppCommand("viewer", p);
      } else if (action === "report_edit") {
        dispatchAppCommand("viewer", { command: "report_edit", section: p.section, text: p.text, mode: p.mode });
      } else if (action === "report_download") {
        dispatchAppCommand("viewer", { command: "report_download" });
      } else if (action === "report_print") {
        dispatchAppCommand("viewer", { command: "report_print" });
      }
      return reply;
    } catch (e: any) {
      return `${reply} (but I couldn't save it: ${e?.errors?.[0]?.message || e?.message || e})`;
    }
  }

  async function useCurrentView() {
    const raw = captureViewer();
    if (!raw) { setMessages((m) => [...m, { role: "assistant", text: "No image is open in the viewer — open a study first, then I can look at the current slice." }]); return; }
    try { const d = await dataUrlResize(raw); setStaged((s) => [...s, d].slice(0, 4)); } catch {}
  }

  async function send() {
    if (!handsFreeRef.current) { try { recRef.current?.stop(); } catch {} }
    const text = input.trim();
    if ((!text && !staged.length) || loading) return;
    let imgs = staged;
    // "what's on my screen?" → automatically grab the slice currently shown in the viewer.
    if (!imgs.length && text && REFERS_TO_VIEW.test(text) && !/\b(whole|entire|full)\s+study\b|\bpinned\b/i.test(text)) {
      const raw = captureViewer();
      if (raw) { try { imgs = [await dataUrlResize(raw)]; } catch {} }
    }
    const userMsg: Msg = { role: "user", text: text || "What can you tell me about this image?", images: imgs };
    const history = [...messages, userMsg];
    setMessages(history); setInput(""); setStaged([]);

    // Text-only settings commands are handled locally (switch model, set key, etc.).
    if (!imgs.length && text) {
      const cmd = handleSettingsCommand(text);
      if (cmd) { setMessages((m) => [...m, { role: "assistant", text: cmd }]); return; }
    }

    const s0 = getChatSettings();
    // "Configure by chat": profile / letterhead / model / viewer from natural language.
    // Works whenever a capable key exists (server env or browser) — even while chatting with MedGemma.
    const canConfig = agentReady || !!(s0.geminiKey || s0.groqKey) || s0.provider === "gemini" || s0.provider === "groq";
    if (!imgs.length && text && canConfig && SETTINGS_HINT.test(text)) {
      setLoading(true);
      try {
        const res = await fetch("/api/assistant-action", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, provider: s0.provider, geminiKey: s0.geminiKey, geminiModel: s0.geminiModel, groqKey: s0.groqKey, groqModel: s0.groqModel }) });
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
          provider: s.provider, geminiKey: s.geminiKey, geminiModel: s.geminiModel, groqKey: s.groqKey, groqModel: s.groqModel,
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
                <p className="text-sm text-slate-300">Drop, paste, or upload an image — or tap <Monitor className="inline h-3.5 w-3.5" /> to grab the slice on screen — and ask me about it.</p>
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
            <button onClick={useCurrentView} title="Attach the slice currently on screen" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"><Monitor className="h-4 w-4" /></button>
            <button onClick={() => fileRef.current?.click()} title="Attach image" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"><ImagePlus className="h-4 w-4" /></button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onPaste={onPaste}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Ask about the image…"
              className="max-h-24 flex-1 resize-none rounded-lg border border-white/10 bg-navy-850 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-500/50" />
            {micOk && (
              <button onClick={toggleMic} title={listening ? "Listening — click to stop" : "Hands-free voice: click once, speak your commands"} className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition", listening ? "border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}><Mic className="h-4 w-4" /></button>
            )}
            <button onClick={send} disabled={loading || (!input.trim() && !staged.length)} title="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-500 disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
