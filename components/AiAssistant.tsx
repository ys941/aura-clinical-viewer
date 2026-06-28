"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Sparkles, Send, FileText, ImageIcon, Stethoscope, PlugZap } from "lucide-react";
import { BRAND } from "@/lib/brand";
import Link from "next/link";

interface Msg {
  role: "user" | "ai";
  text: string;
  notConnected?: boolean;
}

const suggestions = [
  { icon: FileText, label: "Summarize findings" },
  { icon: Stethoscope, label: "Differential diagnoses?" },
  { icon: ImageIcon, label: "Compare with previous study" },
  { icon: Sparkles, label: "Patient-friendly summary" },
];

export function AiAssistant({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: `Hi, I'm ${BRAND.ai}. No analysis model is connected yet — once a provider is configured in Settings, I'll answer grounded on the active study and linked reports.`,
      notConnected: true,
    },
  ]);
  const [input, setInput] = useState("");

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "ai",
        notConnected: true,
        text: "No AI model is connected. Configure an analysis provider in Settings → AI & Models to enable grounded responses. Nothing is fabricated here.",
      },
    ]);
    setInput("");
  }

  return (
    <div className={cn("panel flex h-full flex-col p-0", className)}>
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-medical-500 to-teal-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{BRAND.ai} Assistant</div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Model not connected
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-medical-600 text-white"
                  : "border border-white/10 bg-navy-850 text-slate-300"
              )}
            >
              {m.text}
              {m.notConnected && m.role === "ai" && (
                <Link
                  href="/settings"
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-teal-300 hover:underline"
                >
                  <PlugZap className="h-3 w-3" /> Connect a model
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => send(s.label)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-3 w-3 text-teal-300" />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-navy-850 px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about this study…"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
          <button
            onClick={() => send(input)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-medical-600 text-white transition hover:bg-medical-500"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
