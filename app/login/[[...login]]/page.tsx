import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { ShieldCheck, ScanLine, Sparkles, FileText, Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — brand / value prop */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-navy-900 p-12 lg:flex">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-medical-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            One platform for imaging, reports, and clinical AI.
          </h2>
          <p className="mt-4 text-slate-400">
            {BRAND.name} unifies a Universal DICOM Viewer, clinical analysis, structured
            reporting, and privacy-first workflows — built for hospitals, diagnostic
            centers, and teleradiology.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: ScanLine, t: "Universal DICOM Viewer", d: "CT · MRI · X-Ray · OCT · CAG" },
              { icon: Sparkles, t: "AI Analysis", d: "Findings, segmentation, risk" },
              { icon: FileText, t: "Report Analysis", d: "OCR + auto PHI removal" },
              { icon: ShieldCheck, t: "HIPAA / GDPR Ready", d: "Audit-grade compliance" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.t} className="panel-tight p-3.5">
                  <Icon className="h-5 w-5 text-teal-300" />
                  <div className="mt-2 text-sm font-semibold text-white">{f.t}</div>
                  <div className="text-[11px] text-slate-500">{f.d}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-good" /> AES-256 encrypted
          </span>
          <span>·</span>
          <span>SOC 2 Type II</span>
          <span>·</span>
          <span>Authentication by Clerk</span>
        </div>
      </div>

      {/* Right — real Clerk sign-in (email/password + forgot-password reset flow) */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <SignIn />
        </div>
      </div>
    </div>
  );
}
