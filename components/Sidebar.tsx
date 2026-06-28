"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/nav";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { ShieldCheck } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-navy-900/60 px-3 py-5 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-7 flex-1 space-y-1">
        <p className="px-3 pb-2 label-tiny">Workspace</p>
        {navLinks.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn("nav-item", active && "nav-item-active")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
          <div className="flex items-center gap-2 text-teal-300">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-semibold">HIPAA · GDPR Ready</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Files are processed in your browser. PHI is anonymized before any AI analysis.
          </p>
        </div>
      </div>
    </aside>
  );
}
