"use client";

import { cn } from "@/lib/cn";

export type ScanKind = "ct-chest" | "ct-head" | "mri-brain" | "xray-chest" | "ctca" | "cag" | "oct" | "fundus";

interface Overlay {
  // percentages
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence: number;
  tone?: "critical" | "warn" | "good";
}

/**
 * Synthetic medical-image viewport. Renders a stylized, anatomically-suggestive
 * grayscale scan via SVG/gradients (no external assets) plus optional AI overlays.
 */
export function ScanViewport({
  kind,
  overlays = [],
  showAi = true,
  heatmap = false,
  className,
}: {
  kind: ScanKind;
  overlays?: Overlay[];
  showAi?: boolean;
  heatmap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10",
        className
      )}
    >
      <SyntheticScan kind={kind} />

      {/* Heatmap layer */}
      {showAi && heatmap && (
        <div className="pointer-events-none absolute inset-0 mix-blend-screen">
          <div className="absolute left-[58%] top-[60%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,77,94,0.7),rgba(255,176,32,0.35)_45%,transparent_70%)] blur-[2px]" />
          <div className="absolute left-[40%] top-[55%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.5),transparent_70%)] blur-[2px]" />
        </div>
      )}

      {/* AI bounding boxes */}
      {showAi &&
        overlays.map((o, i) => {
          const tone = o.tone ?? "critical";
          const color =
            tone === "critical" ? "#ff4d5e" : tone === "warn" ? "#ffb020" : "#1fcf8e";
          return (
            <div
              key={i}
              className="pointer-events-none absolute"
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                width: `${o.w}%`,
                height: `${o.h}%`,
              }}
            >
              <div
                className="h-full w-full rounded-md"
                style={{ boxShadow: `0 0 0 2px ${color}, 0 0 18px ${color}66` }}
              />
              <span
                className="absolute -top-6 left-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-black"
                style={{ background: color }}
              >
                {o.label} · {o.confidence}%
              </span>
              {/* corner ticks */}
              {["-top-px -left-px", "-top-px -right-px", "-bottom-px -left-px", "-bottom-px -right-px"].map(
                (pos) => (
                  <span
                    key={pos}
                    className={cn("absolute h-2 w-2", pos)}
                    style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
                  />
                )
              )}
            </div>
          );
        })}

      {/* Corner DICOM annotations */}
      <ScanHud kind={kind} />
    </div>
  );
}

function ScanHud({ kind }: { kind: ScanKind }) {
  const meta: Record<ScanKind, { tl: string[]; tr: string[] }> = {
    "ct-chest": { tl: ["Anonymized #A7F3", "CT CHEST / CTPA"], tr: ["120 kVp · 180 mAs", "Se 3 · Im 142/284"] },
    "ct-head": { tl: ["Anonymized #C9D1", "CT BRAIN NON-CON"], tr: ["W 80 · L 40", "Se 2 · Im 18/32"] },
    "mri-brain": { tl: ["Anonymized #D4E7", "MRI BRAIN T2 FLAIR"], tr: ["TR 9000 · TE 120", "Se 5 · Im 22/40"] },
    "xray-chest": { tl: ["Anonymized #E1F4", "CR CHEST PA"], tr: ["DR · upright", "Im 1/2"] },
    ctca: { tl: ["Anonymized #B2K8", "CT CORONARY ANGIO"], tr: ["Curved MPR · LAD", "Phase 75%"] },
    cag: { tl: ["Anonymized #H6C0", "CORONARY ANGIO RCA"], tr: ["15 fps · RAO 30", "Run 4"] },
    oct: { tl: ["Anonymized #F8A2", "MACULAR OCT — OD"], tr: ["6mm · HD", "B-scan 49/97"] },
    fundus: { tl: ["Anonymized #F8A2", "FUNDUS — OD"], tr: ["45° · color", "Im 1/3"] },
  };
  const m = meta[kind];
  return (
    <div className="pointer-events-none absolute inset-0 p-2.5 font-mono text-[10px] leading-snug text-teal-300/80">
      <div className="absolute left-2.5 top-2.5">
        {m.tl.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>
      <div className="absolute right-2.5 top-2.5 text-right">
        {m.tr.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>
      <div className="absolute bottom-2.5 left-2.5 opacity-70">L</div>
      <div className="absolute bottom-2.5 right-2.5 opacity-70">R</div>
    </div>
  );
}

/** Stylized grayscale anatomy via layered radial/linear gradients + SVG. */
function SyntheticScan({ kind }: { kind: ScanKind }) {
  if (kind === "oct") {
    return (
      <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="none">
        <rect width="400" height="400" fill="#05060a" />
        <g opacity="0.9">
          {Array.from({ length: 7 }).map((_, i) => (
            <path
              key={i}
              d={`M0 ${150 + i * 14} Q200 ${120 + i * 14 + (i === 3 ? 26 : 0)} 400 ${150 + i * 14}`}
              fill="none"
              stroke={i === 3 ? "#9fb6c9" : "#5b6b7a"}
              strokeWidth={i === 3 ? 5 : 2.5}
              opacity={0.7}
            />
          ))}
        </g>
      </svg>
    );
  }

  if (kind === "fundus") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#7a4416,#3a1f0a_60%,#0a0603)]" />
        <div className="absolute left-[62%] top-[48%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#ffd98a,#caa14e)]" />
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 9 }).map((_, i) => (
            <path
              key={i}
              d={`M248 192 Q${200 - i * 18} ${200 + (i - 4) * 26} ${40} ${120 + i * 26}`}
              fill="none"
              stroke="#8a2f22"
              strokeWidth={2.2}
              opacity={0.8}
            />
          ))}
        </svg>
      </div>
    );
  }

  if (kind === "cag") {
    return (
      <svg viewBox="0 0 400 400" className="h-full w-full">
        <rect width="400" height="400" fill="#080808" />
        <g fill="none" stroke="#cfd6dd" strokeWidth="3" opacity="0.85" strokeLinecap="round">
          <path d="M120 60 C160 120 150 180 200 220 C250 260 270 320 250 360" />
          <path d="M200 220 C240 210 280 240 320 230" strokeWidth="2.2" />
          <path d="M200 220 C170 250 150 300 120 320" strokeWidth="2" />
          <path d="M150 180 C110 190 90 230 70 260" strokeWidth="2" />
        </g>
        {/* occlusion marker */}
        <circle cx="250" cy="260" r="9" fill="none" stroke="#ff4d5e" strokeWidth="2.5" />
      </svg>
    );
  }

  if (kind === "xray-chest") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,#3a4654,#161b22_60%,#080a0e)]" />
        {/* rib cage suggestion */}
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" opacity={0.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <g key={i} stroke="#aeb9c4" strokeWidth="2" fill="none" opacity={0.5}>
              <path d={`M70 ${110 + i * 38} Q200 ${90 + i * 38} 330 ${110 + i * 38}`} />
            </g>
          ))}
          {/* mediastinum / heart */}
          <ellipse cx="175" cy="250" rx="78" ry="92" fill="#4a5563" opacity="0.55" />
          <rect x="190" y="60" width="22" height="300" fill="#5a6573" opacity="0.5" />
        </svg>
      </div>
    );
  }

  // CT / MRI axial slices share an oval cross-section look
  const bg =
    kind === "mri-brain"
      ? "radial-gradient(circle at 50% 45%, #4a5563, #20262e 62%, #0a0d12)"
      : "radial-gradient(circle at 50% 50%, #3c4651, #1a1f26 60%, #0a0d12)";
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: bg }} />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        {kind === "ct-head" || kind === "mri-brain" ? (
          <>
            <ellipse cx="200" cy="200" rx="135" ry="160" fill="#4d5864" opacity="0.5" />
            <ellipse cx="200" cy="200" rx="118" ry="142" fill="#2b333c" opacity="0.7" />
            <path
              d="M200 80 C140 120 150 200 200 230 C250 200 260 120 200 80Z"
              fill="#5a6573"
              opacity="0.55"
            />
            <ellipse cx="170" cy="190" rx="14" ry="26" fill="#10151b" />
            <ellipse cx="230" cy="190" rx="14" ry="26" fill="#10151b" />
          </>
        ) : (
          <>
            <ellipse cx="200" cy="210" rx="160" ry="135" fill="#4d5864" opacity="0.5" />
            {/* lungs */}
            <ellipse cx="135" cy="200" rx="62" ry="88" fill="#11161c" />
            <ellipse cx="265" cy="200" rx="62" ry="88" fill="#11161c" />
            {/* mediastinum / heart */}
            <ellipse cx="200" cy="235" rx="48" ry="60" fill="#5a6573" opacity="0.7" />
            <circle cx="160" cy="120" r="10" fill="#3a434d" />
          </>
        )}
      </svg>
      {/* faint scanline texture */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_3px)]" />
    </div>
  );
}
