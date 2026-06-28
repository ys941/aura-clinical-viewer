import { ShieldCheck, Lock } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
  compliance,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  compliance?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
          {compliance && (
            <span className="chip bg-good/10 text-good ring-1 ring-good/20">
              <ShieldCheck className="h-3.5 w-3.5" /> HIPAA
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function ComplianceBar() {
  const items = [
    "PHI Auto-Removed",
    "DICOM Anonymized",
    "AES-256 Encrypted",
    "Audit Logged",
    "Role-Based Access",
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-good/15 bg-good/[0.04] px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-good">
        <Lock className="h-3.5 w-3.5" /> Compliance Active
      </span>
      {items.map((i) => (
        <span key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          {i}
        </span>
      ))}
    </div>
  );
}
