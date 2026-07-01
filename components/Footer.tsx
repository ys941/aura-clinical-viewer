import Link from "next/link";
import { Heart } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 bg-navy-950/60 px-4 py-2 text-[11px] text-slate-500 lg:px-8">
      <div className="flex items-center gap-3">
        <span>© 2026 {BRAND.name}</span>
        <span className="hidden text-slate-600 sm:inline">·</span>
        <span className="hidden text-slate-600 sm:inline">Decision support, not a diagnosis</span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/terms" className="transition hover:text-slate-300">Terms</Link>
        <span className="text-slate-700">·</span>
        <Link href="/privacy" className="transition hover:text-slate-300">Privacy</Link>
        <span className="text-slate-700">·</span>
        <span className="flex items-center gap-1">
          Designed with
          <Heart className="h-3 w-3 animate-pulse fill-critical text-critical" />
          by
          <a href="https://github.com/ys941" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-400 transition hover:text-teal-300">
            Yati Bhardwaj
          </a>
        </span>
      </div>
    </footer>
  );
}
