"use client";

import { create } from "zustand";

// ───────────────────────────────────────────────────────────────────
// In-session data store. No database, no persistence layer.
// Everything lives in client memory for the current session and is
// derived directly from what the user uploads. Closing/refreshing the
// tab clears it (object URLs are session-scoped). This is intentional:
// "direct", no backend storage.
// ───────────────────────────────────────────────────────────────────

export type StudyType = "dicom" | "image";

export interface Study {
  id: string;
  fileName: string;
  fileType: StudyType;
  modality: string; // real DICOM tag (0008,0060) or "—" for plain images
  bodyPart: string; // (0018,0015) or "—"
  studyDescription: string; // (0008,1030) or filename
  patientLabel: string; // anonymized, derived locally — never the real PHI
  url: string; // blob: object URL for rendering
  sizeBytes: number;
  uploadedAt: number; // epoch ms
  tags: Record<string, string>; // selected DICOM tags actually read from the file
}

export interface ReportDoc {
  id: string;
  fileName: string;
  fileType: string; // "pdf" | "docx" | "txt" | "image" | …
  url: string;
  sizeBytes: number;
  uploadedAt: number;
  extractedText?: string; // populated only if text was actually extracted client-side
  pages?: number;
}

interface AuraStore {
  studies: Study[];
  reports: ReportDoc[];
  addStudy: (s: Study) => void;
  addReport: (r: ReportDoc) => void;
  removeStudy: (id: string) => void;
  removeReport: (id: string) => void;
  clearAll: () => void;
}

export const useAuraStore = create<AuraStore>((set) => ({
  studies: [],
  reports: [],
  addStudy: (s) => set((st) => ({ studies: [s, ...st.studies] })),
  addReport: (r) => set((st) => ({ reports: [r, ...st.reports] })),
  removeStudy: (id) =>
    set((st) => ({ studies: st.studies.filter((x) => x.id !== id) })),
  removeReport: (id) =>
    set((st) => ({ reports: st.reports.filter((x) => x.id !== id) })),
  clearAll: () => set({ studies: [], reports: [] }),
}));

// ── helpers ──────────────────────────────────────────────────────────

export function genId(prefix = "ID"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Anonymized, non-PHI label derived purely from a local hash of the filename. */
export function anonLabel(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return `Anonymized #${h.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
