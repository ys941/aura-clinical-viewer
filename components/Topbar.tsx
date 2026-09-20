"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { AUTH_ENABLED } from "@/lib/auth-mode";
import { useOptionalUser } from "@/lib/use-optional-user";
import {
  Search,
  Bell,
  Sparkles,
  Command,
  X,
} from "lucide-react";
import { MedGemmaHealth } from "@/components/MedGemmaHealth";

export function Topbar() {
  const [showNotif, setShowNotif] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { user } = useOptionalUser();

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-navy-950/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Search */}
      <div className="relative flex max-w-xl flex-1 items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
        <input
          placeholder="Search patients, studies, reports…"
          className="h-10 w-full rounded-xl border border-white/10 bg-navy-850/80 pl-10 pr-16 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-medical-500/50 focus:ring-2 focus:ring-medical-500/20"
        />
        <kbd className="absolute right-3 hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:flex">
          <Command className="h-3 w-3" /> K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* MedGemma health */}
        <MedGemmaHealth />

        {/* AI Activity */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAi((v) => !v);
              setShowNotif(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-300 transition hover:bg-teal-500/15"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Activity</span>
          </button>
          {showAi && (
            <Dropdown onClose={() => setShowAi(false)} title="AI Activity Center">
              <div className="px-2 py-4 text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-teal-500/15 text-teal-300"><Sparkles className="h-4.5 w-4.5" /></div>
                <p className="text-sm font-medium text-white">MedGemma (via Colab)</p>
                <p className="mt-1 text-xs text-slate-400">Open a study in the <span className="text-teal-300">Viewer</span> and click the <span className="text-teal-300">AI</span> button to analyze the whole study.</p>
              </div>
            </Dropdown>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotif((v) => !v);
              setShowAi(false);
            }}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {showNotif && (
            <Dropdown onClose={() => setShowNotif(false)} title="Notifications">
              <EmptyState text="You're all caught up — no notifications." />
            </Dropdown>
          )}
        </div>

        {/* Profile — real Clerk user */}
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-1.5">
          <div className="hidden text-right leading-tight sm:block">
            <div className="max-w-[160px] truncate text-sm font-semibold text-white">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500">Clinician</div>
          </div>
          {mounted && AUTH_ENABLED ? (
            <UserButton
              afterSignOutUrl="/login"
              appearance={{ elements: { avatarBox: "h-8 w-8" } }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/10" />
          )}
        </div>
      </div>
    </header>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-2 py-6 text-center text-xs text-slate-500">{text}</p>;
}

function Dropdown({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-12 z-20 w-80 panel p-3">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-white">{title}</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-0.5">{children}</div>
      </div>
    </>
  );
}
