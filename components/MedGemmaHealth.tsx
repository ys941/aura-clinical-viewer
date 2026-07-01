"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, RefreshCw, X, ExternalLink } from "lucide-react";

type Status = "live" | "waking" | "offline" | "no-endpoint" | "no-key" | "checking";

type Health = {
  ok: boolean;
  status: Status;
  name?: string;
  model?: string;
  host?: string;
  detail?: string;
};

const COLAB_URL =
  "https://colab.research.google.com/gist/ys941/5d09f9d6abd2e8422baa7a072cd061b6/medgemma_aura_colab.ipynb";

// visual theme per status
const THEME: Record<Status, { dot: string; ring: string; pill: string; text: string; label: string; word: string }> = {
  live:         { dot: "bg-emerald-400", ring: "bg-emerald-400", pill: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15", text: "text-emerald-300", label: "Live",     word: "Online" },
  waking:       { dot: "bg-amber-400",   ring: "bg-amber-400",   pill: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",   text: "text-amber-300",   label: "Warming", word: "Warming up" },
  offline:      { dot: "bg-rose-400",    ring: "bg-rose-400",    pill: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",     text: "text-rose-300",    label: "Error",   word: "Error" },
  "no-endpoint":{ dot: "bg-rose-400",    ring: "bg-rose-400",    pill: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",     text: "text-rose-300",    label: "Offline", word: "Offline" },
  "no-key":     { dot: "bg-rose-400",    ring: "bg-rose-400",    pill: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",     text: "text-rose-300",    label: "No key",  word: "Not configured" },
  checking:     { dot: "bg-slate-400",   ring: "bg-slate-400",   pill: "border-white/10 bg-white/5 hover:bg-white/10",               text: "text-slate-300",   label: "Checking", word: "Checking…" },
};

export function MedGemmaHealth() {
  const [health, setHealth] = useState<Health>({ ok: false, status: "checking", name: "MedGemma" });
  const [open, setOpen] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setSpinning(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const data = (await r.json()) as Health;
      setHealth(data);
    } catch {
      setHealth({ ok: false, status: "offline", name: "MedGemma", detail: "Could not reach the app's health endpoint." });
    } finally {
      setCheckedAt(Date.now());
      // brief spin for feedback
      setTimeout(() => setSpinning(false), 400);
    }
  }, []);

  useEffect(() => {
    check();
    timer.current = setInterval(check, 20_000); // poll every 20s
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const t = THEME[health.status] ?? THEME.checking;
  const name = health.name || "MedGemma";
  const isLive = health.status === "live";
  const needsColab = health.status === "no-endpoint" || health.status === "waking" || health.status === "offline";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${name}: ${t.word}`}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${t.pill} ${t.text}`}
      >
        {/* animated status dot */}
        <span className="relative flex h-2.5 w-2.5">
          {isLive && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${t.ring} opacity-70`} />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot} ${
              health.status === "waking" || health.status === "checking" ? "animate-pulse" : ""
            }`}
          />
        </span>
        <Cpu className="h-4 w-4 opacity-90" />
        <span className="hidden sm:inline">{name}</span>
        <span className="hidden text-[11px] font-semibold opacity-80 md:inline">· {t.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-72 panel p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-white">AI Model Health</span>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* status headline */}
            <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${t.pill}`}>
              <span className="relative flex h-2.5 w-2.5">
                {isLive && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${t.ring} opacity-70`} />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot}`} />
              </span>
              <div className="leading-tight">
                <div className={`text-sm font-semibold ${t.text}`}>{name} · {t.word}</div>
                {health.model && <div className="text-[11px] text-slate-400">{health.model}{health.host ? ` · ${health.host}` : ""}</div>}
              </div>
            </div>

            {health.detail && <p className="mt-2 px-1 text-xs text-slate-400">{health.detail}</p>}

            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[11px] text-slate-500">
                {checkedAt ? `Checked ${secondsAgo(checkedAt)}s ago` : "Checking…"}
              </span>
              <button
                onClick={check}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
              >
                <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            {needsColab && (
              <a
                href={COLAB_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-300 transition hover:bg-teal-500/15"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Colab &amp; Run all
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function secondsAgo(ts: number): number {
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}
