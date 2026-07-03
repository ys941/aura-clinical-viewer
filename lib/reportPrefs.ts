// Report letterhead / signature prefs — stored in the browser (same key the report modal uses).
const KEY = "aura-report-prefs";
export type ReportPrefs = { clinicName?: string; clinicAddress?: string; doctorName?: string; doctorCreds?: string };

export function getReportPrefs(): ReportPrefs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function setReportPrefs(patch: ReportPrefs): ReportPrefs {
  const next = { ...getReportPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}
