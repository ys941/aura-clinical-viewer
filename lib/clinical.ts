// Clinical UI vocabulary (severity scale + styling). Not mock data —
// these are shared, stable presentation tokens used across the app.

export type Severity = "critical" | "urgent" | "routine" | "normal";

export const severityStyles: Record<
  Severity,
  { dot: string; chip: string; label: string }
> = {
  critical: { dot: "bg-critical", chip: "bg-critical/15 text-critical", label: "Critical" },
  urgent: { dot: "bg-warn", chip: "bg-warn/15 text-warn", label: "Urgent" },
  routine: { dot: "bg-medical-400", chip: "bg-medical-500/15 text-medical-300", label: "Routine" },
  normal: { dot: "bg-good", chip: "bg-good/15 text-good", label: "Normal" },
};
