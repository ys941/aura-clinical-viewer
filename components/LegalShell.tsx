import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-navy-950/80 px-4 backdrop-blur lg:px-8">
        <Logo />
        <Link href="/viewer" className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 lg:px-0">
        <div className="mb-8">
          <span className="chip bg-good/10 text-good ring-1 ring-good/20"><ShieldCheck className="h-3.5 w-3.5" /> Legal</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">Last updated {updated}</p>
        </div>

        <div
          className="text-sm leading-relaxed text-slate-400
            [&_a]:text-teal-300 [&_a:hover]:underline
            [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white
            [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-1.5
            [&_p]:mt-3
            [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
            [&_strong]:text-slate-200"
        >
          {children}
        </div>

        <div className="mt-10 rounded-xl border border-warn/20 bg-warn/5 p-4 text-xs text-warn">
          ⚠️ Aura is <strong>not a certified medical device</strong>. It is provided for research, education,
          and workflow purposes only. AI output is decision support and must be verified by a qualified clinician.
        </div>
      </main>
      <Footer />
    </div>
  );
}
