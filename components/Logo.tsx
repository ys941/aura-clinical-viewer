import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-xl bg-gradient-to-br from-medical-500 to-teal-500 shadow-lg shadow-teal-500/20",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%] text-white" fill="none">
        {/* stylized iris / aperture — "Aura" */}
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
        <path
          d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-white">
            {BRAND.name}
            <span className="text-teal-400">.</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Clinical AI
          </div>
        </div>
      )}
    </div>
  );
}
