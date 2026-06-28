import { cn } from "@/lib/cn";
import { type Severity, severityStyles } from "@/lib/clinical";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("panel p-5", className)}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-medical-600/15 text-medical-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SeverityChip({ level }: { level: Severity }) {
  const s = severityStyles[level];
  return (
    <span className={cn("chip", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  delta,
  trend,
  tone = "medical",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
  tone?: "medical" | "teal" | "warn" | "good";
  icon?: LucideIcon;
}) {
  const toneRing = {
    medical: "from-medical-500/20 text-medical-300",
    teal: "from-teal-500/20 text-teal-300",
    warn: "from-warn/20 text-warn",
    good: "from-good/20 text-good",
  }[tone];

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "down" ? "text-good" : trend === "up" ? "text-warn" : "text-slate-500";

  return (
    <div className="panel relative overflow-hidden p-4">
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl",
          toneRing
        )}
      />
      <div className="flex items-center justify-between">
        <span className="label-tiny">{label}</span>
        {Icon && <Icon className={cn("h-4 w-4", toneRing.split(" ")[1])} />}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        {delta && (
          <span className={cn("flex items-center gap-1 text-xs font-semibold", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function Progress({
  value,
  className,
  tone = "medical",
}: {
  value: number;
  className?: string;
  tone?: "medical" | "teal" | "good" | "warn" | "critical";
}) {
  const bar = {
    medical: "bg-medical-500",
    teal: "bg-teal-400",
    good: "bg-good",
    warn: "bg-warn",
    critical: "bg-critical",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className={cn("h-full rounded-full", bar)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function ModalityBadge({ modality }: { modality: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-300 ring-1 ring-white/10">
      {modality}
    </span>
  );
}

export function Avatar({
  initials,
  color,
  online,
  size = "md",
}: {
  initials: string;
  color: string;
  online?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className="relative">
      <div
        className={cn(
          "grid place-items-center rounded-full font-bold text-white ring-2 ring-navy-900",
          dim,
          color
        )}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-navy-900",
            online ? "bg-good" : "bg-slate-600"
          )}
        />
      )}
    </div>
  );
}
