"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initCornerstone, type CornerstoneApi } from "@/lib/cornerstoneSetup";
import { loadStudy, readImageTags, type LoadedStudy, type LoadedSeries } from "@/lib/loadStudy";
import { Dropzone } from "@/components/Dropzone";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";
import { onAppCommand } from "@/lib/appCommands";
import {
  Contrast, Move, ZoomIn, Search, Ruler, Triangle, Square, Circle, Crosshair,
  MessageSquare, PenTool, RotateCw, FlipHorizontal, FlipVertical, SunMedium,
  RefreshCw, Play, Pause, Copy, Sparkles, FileText, Trash2, Upload, X,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, Plug, Download, Film, Layers, Tag,
  Maximize2, Minimize2, Rows3, PanelLeft, PanelRight, Keyboard, Eye, EyeOff, Activity,
  Plus, ListChecks,
} from "lucide-react";

const ACCEPT = ".dcm,.dicom,.ima,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tif,.tiff,.zip,application/dicom,image/*,application/zip";

// Derive the anatomical plane (view) from a DICOM image's ImageOrientationPatient.
// Returns "Axial" | "Coronal" | "Sagittal", or "" when orientation is unavailable
// (plain images / projection radiographs — those stay grouped as distinct views).
function planeOfImage(cs: any, imageId: string): string {
  try {
    const m = cs?.metaData?.get?.("imagePlaneModule", imageId);
    if (!m) return "";
    let r = m.rowCosines, c = m.columnCosines;
    const iop = m.imageOrientationPatient;
    if ((!r || !c) && Array.isArray(iop) && iop.length >= 6) { r = iop.slice(0, 3); c = iop.slice(3, 6); }
    const rv = vec3(r), cv = vec3(c);
    if (!rv || !cv) return "";
    const n = [rv[1] * cv[2] - rv[2] * cv[1], rv[2] * cv[0] - rv[0] * cv[2], rv[0] * cv[1] - rv[1] * cv[0]];
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    if (az >= ax && az >= ay) return "Axial";
    if (ay >= ax && ay >= az) return "Coronal";
    return "Sagittal";
  } catch { return ""; }
}
function vec3(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.length >= 3 ? [+v[0], +v[1], +v[2]] : null;
  if (typeof v === "object" && "x" in v) return [+v.x, +v.y, +v.z];
  return null;
}

const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));

// Render a slice (grayscale, DICOM window) into a size×size canvas.
async function renderSlice(cs: any, off: HTMLElement, imageId: string, size: number, mainVp: any): Promise<HTMLCanvasElement> {
  const img = await cs.loadAndCacheImage(imageId);
  cs.displayImage(off, img);
  if (mainVp) { const vp = cs.getViewport(off); vp.voi = { ...mainVp.voi }; vp.invert = mainVp.invert; cs.setViewport(off, vp); }
  try { cs.fitToWindow(off); } catch {}
  cs.updateImage(off);
  await raf();
  const src = off.querySelector("canvas") as HTMLCanvasElement;
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, size, size);
  return c;
}

// Render a CT slice using MedGemma's official 3-window→RGB preprocessing:
// R = bone/lung (WW 2250 / WL -100), G = soft tissue (WW 350 / WL 40), B = brain (WW 80 / WL 40).
async function renderCtRgb(cs: any, off: HTMLElement, imageId: string, size: number): Promise<HTMLCanvasElement> {
  const img = await cs.loadAndCacheImage(imageId);
  cs.displayImage(off, img);
  const windows: [number, number][] = [[2250, -100], [350, 40], [80, 40]];
  const lumas: Uint8ClampedArray[] = [];
  for (const [ww, wc] of windows) {
    const vp = cs.getViewport(off); vp.voi = { windowWidth: ww, windowCenter: wc }; vp.invert = false; cs.setViewport(off, vp);
    try { cs.fitToWindow(off); } catch {}
    cs.updateImage(off);
    await raf();
    const src = off.querySelector("canvas") as HTMLCanvasElement;
    const tmp = document.createElement("canvas"); tmp.width = size; tmp.height = size;
    const tctx = tmp.getContext("2d")!; tctx.fillStyle = "#000"; tctx.fillRect(0, 0, size, size);
    tctx.drawImage(src, 0, 0, size, size);
    lumas.push(tctx.getImageData(0, 0, size, size).data);
  }
  const out = document.createElement("canvas"); out.width = size; out.height = size;
  const octx = out.getContext("2d")!; const od = octx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { od.data[i * 4] = lumas[0][i * 4]; od.data[i * 4 + 1] = lumas[1][i * 4]; od.data[i * 4 + 2] = lumas[2][i * 4]; od.data[i * 4 + 3] = 255; }
  octx.putImageData(od, 0, 0);
  return out;
}

function stampNum(canvas: HTMLCanvasElement, n: number) {
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, 42, 18);
  ctx.fillStyle = "#7ce0ff"; ctx.font = "12px monospace"; ctx.fillText(String(n), 4, 13);
}

type KeyImage = { slice: number; view: string; caption: string; url: string };

// Split the model's markdown into Technique / Findings / Impression by locating the
// section headings and slicing between them (tolerant of "## H" or "**H**"). The Key
// Images section is dropped from the prose — it is rendered as a thumbnail gallery.
// Extract ONLY real report sections. Any heading that sits alone on its line and is a known
// junk section (Discussion / Sample Report / Notes / reasoning …) acts as a boundary and its
// content is dropped, so teaching text and chain-of-thought can never leak into the report.
// Anatomical sub-labels like "**Lungs:** …" are inline (content follows), so they stay as text.
const KEEP_SECTIONS: Record<string, string> = {
  technique: "technique", findings: "findings",
  impression: "impression", diagnosis: "impression", conclusion: "impression", opinion: "impression",
  recommendation: "recommendations", recommendations: "recommendations", advice: "recommendations",
  "key images": "key images", "key image": "key images", "key candidates": "key images",
};
const JUNK_SECTIONS = new Set(["discussion", "sample report", "teaching", "teaching point", "teaching points", "education", "educational", "notes", "note", "differential", "differential diagnosis", "comment", "comments", "reasoning", "thought", "thoughts", "analysis", "draft", "plan", "review", "explanation", "questions", "question"]);

// Pull the "Questions" section the model asked for clarification.
function parseQuestions(text: string): string[] {
  const m = /(?:^|\n)[ \t]*#{0,4}[ \t]*\**[ \t]*questions?\b[ \t]*\**[ \t]*:?[ \t]*/i.exec(text);
  if (!m) return [];
  const scope = text.slice(m.index + m[0].length); // content after the heading line
  const out: string[] = [];
  for (const raw of scope.split(/\n/)) {
    if (/^[ \t]*#{1,4}[ \t]/.test(raw) || /^[ \t]*\*\*[A-Z]/.test(raw)) break; // next heading
    const l = raw.replace(/^[ \t]*[-*\d.)]+[ \t]*/, "").replace(/\*\*/g, "").trim();
    if (!l) { if (out.length) break; else continue; }
    if (/^none\b/i.test(l)) continue;
    if (l.length > 3) out.push(l);
    if (out.length >= 3) break;
  }
  return out;
}
function splitAiReport(text: string): { technique: string; findings: string; impression: string; recommendations: string } {
  const re = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?(?:\*\*)?[ \t]*([A-Za-z][A-Za-z /&]{1,26}?)[ \t]*(?:\*\*)?[ \t]*:?[ \t]*(?=\n|$)/g;
  const marks: { at: number; end: number; keep: string | null }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1].trim().toLowerCase().replace(/\s+/g, " ");
    if (KEEP_SECTIONS[name]) marks.push({ at: m.index, end: re.lastIndex, keep: KEEP_SECTIONS[name] });
    else if (JUNK_SECTIONS.has(name)) marks.push({ at: m.index, end: re.lastIndex, keep: null });
  }
  const sec: Record<string, string> = {};
  const tidy = (s: string) => s.replace(/^[ \t]*#{1,4}[ \t]*\n/gm, "").replace(/\n[ \t]*#{1,4}[ \t]*$/g, "").trim();
  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i], next = marks[i + 1];
    const content = tidy(text.slice(mk.end, next ? next.at : text.length));
    if (mk.keep) sec[mk.keep] = content; // last occurrence wins (the real report follows any reasoning)
  }
  const technique = sec["technique"] || "";
  let findings = sec["findings"] || "";
  const impression = sec["impression"] || "";
  const recommendations = sec["recommendations"] || "";
  if (!findings && !technique && !impression) findings = text.trim(); // model ignored headings
  return { technique, findings, impression, recommendations };
}

// Parse the "Key Images" section into slice references (slice number + optional view + caption).
function parseKeyImageRefs(text: string): { slice: number; view?: string; caption?: string }[] {
  const out: { slice: number; view?: string; caption?: string }[] = [];
  const seen = new Set<number>();
  const kiIdx = text.search(/#{0,4}\s*\**\s*key\s*(images?|candidates?)\b/i);
  const scope = kiIdx >= 0 ? text.slice(kiIdx) : text;
  const re = /(?:^|\n)\s*[-*]?\s*(?:key\s*)?(?:slice|image)\s*#?\s*(\d+)\s*(?:\(([^)]*)\))?\s*[:\-–]?\s*([^\n]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope)) && out.length < 8) {
    const slice = parseInt(m[1], 10);
    if (!slice || seen.has(slice)) continue;
    seen.add(slice);
    out.push({ slice, view: (m[2] || "").trim() || undefined, caption: (m[3] || "").trim() || undefined });
  }
  if (!out.length) { // fallback: any "slice N" / "image N" mentions anywhere
    const re2 = /(?:slice|image)\s*#?\s*(\d+)/gi; let x: RegExpExecArray | null;
    while ((x = re2.exec(text)) && out.length < 6) { const s = parseInt(x[1], 10); if (s && !seen.has(s)) { seen.add(s); out.push({ slice: s }); } }
  }
  return out;
}

const TOOLS = [
  { name: "Wwwc", label: "Window / Level", icon: Contrast },
  { name: "Pan", label: "Pan", icon: Move },
  { name: "Zoom", label: "Zoom", icon: ZoomIn },
  { name: "Magnify", label: "Magnify", icon: Search },
  { name: "Length", label: "Length", icon: Ruler },
  { name: "Angle", label: "Angle", icon: Triangle },
  { name: "RectangleRoi", label: "Rectangle", icon: Square },
  { name: "EllipticalRoi", label: "Ellipse", icon: Circle },
  { name: "Probe", label: "Probe (HU)", icon: Crosshair },
  { name: "ArrowAnnotate", label: "Annotate", icon: MessageSquare },
  { name: "FreehandRoi", label: "Freehand", icon: PenTool },
];
const WL_PRESETS = [
  { label: "Soft tissue", ww: 400, wc: 40 },
  { label: "CT Angio", ww: 600, wc: 200 },
  { label: "Lung", ww: 1500, wc: -600 },
  { label: "Bone", ww: 1800, wc: 400 },
  { label: "Brain", ww: 80, wc: 40 },
];
const SHORTCUTS: [string, string][] = [
  ["↑ / ↓  or  ← / →", "Previous / next slice"],
  ["Mouse wheel", "Scroll slices (toggle to zoom)"],
  ["+  /  −", "Zoom in / out"],
  ["Ctrl / ⌘ + C", "Copy current image"],
  ["Space", "Play / pause cine"],
  ["R", "Reset view"],
  ["I", "Invert"],
  ["O", "Toggle overlays"],
  ["F", "Full screen"],
  ["P", "Pin slice for focused AI"],
  ["1 – 9, 0", "Select tool"],
  ["?", "This help"],
];

interface AiState { loading: boolean; connected?: boolean; message?: string; text?: string }
interface Readout { ww: number; wc: number; scale: number }
interface Cursor { x: number; y: number; hu: number | null }
interface Toast { id: number; msg: string; tone: "ok" | "info" }

export default function Viewer() {
  const elRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<CornerstoneApi | null>(null);
  const cineRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imgTagCache = useRef<Map<string, Record<string, string>>>(new Map());
  const toastSeq = useRef(0);
  const wheelModeRef = useRef<"zoom" | "stack">("stack");

  const [ready, setReady] = useState(false);
  const [study, setStudy] = useState<LoadedStudy | null>(null);
  const [activeSeriesId, setActiveSeriesId] = useState("");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("Wwwc");
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(15);
  const [ai, setAi] = useState<AiState>({ loading: false });
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportFindings, setReportFindings] = useState("");
  const [reportImpression, setReportImpression] = useState("");
  const [reportTechnique, setReportTechnique] = useState("");
  const [reportRecs, setReportRecs] = useState("");
  const [reportHistory, setReportHistory] = useState("");
  const [showQuestions, setShowQuestions] = useState(false); // result-driven questions AFTER the first read
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const pendingRef = useRef<{ preliminary: string; meta: any; refineImages: string[]; refineLabels: string[]; selected: boolean } | null>(null);
  const [aiPicks, setAiPicks] = useState<string[]>([]); // imageIds hand-picked for focused analysis
  const [showPicks, setShowPicks] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const [keyImages, setKeyImages] = useState<KeyImage[]>([]);
  const [exporting, setExporting] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [readout, setReadout] = useState<Readout>({ ww: 0, wc: 0, scale: 1 });
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [imgTags, setImgTags] = useState<Record<string, string>>({});
  const [tagTab, setTagTab] = useState<"patient" | "all">("patient");
  const [tagSearch, setTagSearch] = useState("");
  const [wheelMode, setWheelMode] = useState<"zoom" | "stack">("stack");
  const [fullscreen, setFullscreen] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [measurements, setMeasurements] = useState<{ tool: string; text: string }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activeSeries: LoadedSeries | null = useMemo(
    () => (study ? study.series.find((s) => s.id === activeSeriesId) || study.series[0] || null : null),
    [study, activeSeriesId]
  );

  useEffect(() => { setAiPicks([]); setShowPicks(false); }, [study?.id]);

  function toast(msg: string, tone: "ok" | "info" = "ok") {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }

  useEffect(() => {
    let mounted = true;
    (async () => { const api = await initCornerstone(); if (!mounted) return; apiRef.current = api; setReady(true); })();
    return () => {
      mounted = false;
      if (cineRef.current) clearInterval(cineRef.current);
      const api = apiRef.current;
      if (api && elRef.current) { try { api.cornerstone.disable(elRef.current); } catch {} }
    };
  }, []);

  function ensureEnabled(api: CornerstoneApi, el: HTMLElement) {
    try { api.cornerstone.getEnabledElement(el); }
    catch { api.cornerstone.enable(el); registerTools(api); }
  }
  function registerTools(api: CornerstoneApi) {
    const t = api.cornerstoneTools;
    const add = (tool: any) => { try { t.addTool(tool); } catch {} };
    add(t.PanTool); add(t.ZoomTool); add(t.WwwcTool); add(t.MagnifyTool);
    add(t.LengthTool); add(t.AngleTool); add(t.RectangleRoiTool); add(t.EllipticalRoiTool);
    add(t.ProbeTool); add(t.ArrowAnnotateTool); add(t.FreehandRoiTool);
    add(t.StackScrollMouseWheelTool); add(t.ZoomMouseWheelTool); add(t.PanMultiTouchTool); add(t.ZoomTouchPinchTool);
    try {
      t.setToolActive("Wwwc", { mouseButtonMask: 1 });
      t.setToolActive("Pan", { mouseButtonMask: 4 });
      t.setToolActive("Zoom", { mouseButtonMask: 2 });
    } catch {}
    applyWheel(wheelModeRef.current);
  }
  function applyWheel(mode: "zoom" | "stack") {
    const api = apiRef.current; if (!api) return;
    try {
      if (mode === "zoom") { api.cornerstoneTools.setToolActive("ZoomMouseWheel", {}); api.cornerstoneTools.setToolDisabled("StackScrollMouseWheel", {}); }
      else { api.cornerstoneTools.setToolActive("StackScrollMouseWheel", {}); api.cornerstoneTools.setToolDisabled("ZoomMouseWheel", {}); }
    } catch {}
  }
  function toggleWheel() { const m = wheelModeRef.current === "zoom" ? "stack" : "zoom"; wheelModeRef.current = m; setWheelMode(m); applyWheel(m); }

  function recomputeMeasurements() {
    const api = apiRef.current, el = elRef.current; if (!api || !el) return;
    const out: { tool: string; text: string }[] = [];
    const grab = (tn: string, fmt: (d: any) => string) => {
      try { const st = api.cornerstoneTools.getToolState(el, tn); st?.data?.forEach((d: any) => { const v = fmt(d); if (v) out.push({ tool: tn, text: v }); }); } catch {}
    };
    grab("Length", (d) => (d.length != null ? `${d.length.toFixed(1)} mm` : ""));
    grab("Angle", (d) => (d.rAngle != null ? `${d.rAngle.toFixed(1)}°` : ""));
    grab("RectangleRoi", (d) => d.cachedStats ? `area ${(d.cachedStats.area || 0).toFixed(0)} mm² · mean ${(d.cachedStats.mean || 0).toFixed(0)}` : "ROI");
    grab("EllipticalRoi", (d) => d.cachedStats ? `area ${(d.cachedStats.area || 0).toFixed(0)} mm² · mean ${(d.cachedStats.mean || 0).toFixed(0)}` : "Ellipse");
    grab("Probe", (d) => d.cachedStats && d.cachedStats.storedPixels ? `HU ${Math.round(d.cachedStats.sp ?? d.cachedStats.mean ?? 0)}` : "Probe");
    setMeasurements(out);
  }

  const displayIndex = useCallback(async (i: number) => {
    const api = apiRef.current; const el = elRef.current;
    if (!api || !el || !activeSeries) return;
    const id = activeSeries.imageIds[i]; if (!id) return;
    try {
      ensureEnabled(api, el);
      const image = await api.cornerstone.loadAndCacheImage(id);
      api.cornerstone.displayImage(el, image);
      const st = api.cornerstoneTools.getToolState(el, "stack");
      if (st?.data?.[0]) st.data[0].currentImageIdIndex = i;
      if (study) {
        if (imgTagCache.current.has(id)) setImgTags(imgTagCache.current.get(id)!);
        else readImageTags(api, study.fileForId[id]).then((t) => { imgTagCache.current.set(id, t); setImgTags(t); });
      }
      recomputeMeasurements();
    } catch (e: any) { setError(`Could not render image ${i + 1}. ${e?.message || ""}`); }
  }, [activeSeries, study]);

  // resize canvas with element
  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const api = apiRef.current; if (!api) return; try { api.cornerstone.getEnabledElement(el); api.cornerstone.resize(el, true); } catch {} });
    ro.observe(el);
    const onWin = () => { const api = apiRef.current; if (!api) return; try { api.cornerstone.resize(el, true); } catch {} };
    window.addEventListener("resize", onWin);
    return () => { ro.disconnect(); window.removeEventListener("resize", onWin); };
  }, [study]);

  // render + measurement event listeners
  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const onRender = (e: any) => { const vp = e.detail?.viewport; if (vp) setReadout({ ww: Math.round(vp.voi.windowWidth), wc: Math.round(vp.voi.windowCenter), scale: vp.scale }); };
    const onMeas = () => recomputeMeasurements();
    el.addEventListener("cornerstoneimagerendered", onRender);
    el.addEventListener("cornerstonetoolsmeasurementcompleted", onMeas);
    el.addEventListener("cornerstonetoolsmeasurementremoved", onMeas);
    el.addEventListener("cornerstonetoolsmeasurementmodified", onMeas);
    return () => {
      el.removeEventListener("cornerstoneimagerendered", onRender);
      el.removeEventListener("cornerstonetoolsmeasurementcompleted", onMeas);
      el.removeEventListener("cornerstonetoolsmeasurementremoved", onMeas);
      el.removeEventListener("cornerstonetoolsmeasurementmodified", onMeas);
    };
  }, [study]);

  // active series → stack + first image + default window
  useEffect(() => {
    const api = apiRef.current; const el = elRef.current;
    if (!api || !el || !activeSeries) return;
    setError(null); setIndex(0);
    ensureEnabled(api, el);
    try { api.cornerstoneTools.clearToolState(el, "stack"); } catch {}
    api.cornerstoneTools.addStackStateManager(el, ["stack", "playClip"]);
    api.cornerstoneTools.addToolState(el, "stack", { currentImageIdIndex: 0, imageIds: activeSeries.imageIds });
    (async () => {
      try { api.cornerstone.resize(el); } catch {}
      await displayIndex(0);
      applyDefaultWL();
      try { api.cornerstone.resize(el, true); api.cornerstone.fitToWindow(el); } catch {}
    })();
    // Keep React `index` in sync when the mouse wheel / stack scroll changes the slice,
    // so Pin (and the status bar) always reflect the slice that is actually on screen.
    const onNewImage = (e: any) => {
      const id = e?.detail?.image?.imageId;
      if (!id) return;
      const idx = activeSeries.imageIds.indexOf(id);
      if (idx >= 0) setIndex(idx);
    };
    el.addEventListener("cornerstonenewimage", onNewImage);
    return () => { try { el.removeEventListener("cornerstonenewimage", onNewImage); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeries]);

  // thumbnails
  useEffect(() => {
    if (!study) return; const api = apiRef.current; if (!api) return;
    let cancelled = false;
    (async () => {
      const off = document.createElement("div");
      off.style.cssText = "position:fixed;left:-10000px;top:0;width:120px;height:120px;";
      document.body.appendChild(off);
      try { api.cornerstone.enable(off); } catch {}
      const out: Record<string, string> = {};
      for (const s of study.series) {
        try {
          const img = await api.cornerstone.loadAndCacheImage(s.imageIds[0]);
          api.cornerstone.displayImage(off, img);
          const hasVoi = img.windowWidth > 1 && img.windowCenter != null && !isNaN(img.windowCenter);
          if (/CT/i.test(s.modality) && !hasVoi) { const vp = api.cornerstone.getViewport(off); vp.voi.windowWidth = 400; vp.voi.windowCenter = 40; api.cornerstone.setViewport(off, vp); }
          try { api.cornerstone.fitToWindow(off); } catch {}
          api.cornerstone.updateImage(off);
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          const c = off.querySelector("canvas") as HTMLCanvasElement;
          if (c) out[s.id] = c.toDataURL("image/png");
        } catch {}
      }
      try { api.cornerstone.disable(off); } catch {} off.remove();
      if (!cancelled) setThumbs(out);
    })();
    return () => { cancelled = true; };
  }, [study]);

  // fullscreen sync
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) { setFullscreen(false); setTimeout(() => { const api = apiRef.current, el = elRef.current; if (api && el) { try { api.cornerstone.resize(el, true); } catch {} } }, 150); } };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement;
      if (tgt && /input|textarea|select/i.test(tgt.tagName)) return;
      if (showExport || showReport) return;
      if (e.key === "?") { setShowHelp((v) => !v); return; }
      if (showHelp && e.key === "Escape") { setShowHelp(false); return; }
      // Ctrl/Cmd+C copies the current image (unless text is selected)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (window.getSelection()?.toString()) return;
        if (!study) return;
        e.preventDefault(); copyImage();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // don't hijack other modified combos
      if (!study) return;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "+" || e.key === "=") zoomBy(1.2);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.2);
      else if (e.key === " ") { e.preventDefault(); toggleCine(); }
      else if (e.key.toLowerCase() === "r") reset();
      else if (e.key.toLowerCase() === "i") invert();
      else if (e.key.toLowerCase() === "o") setShowOverlays((v) => !v);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key.toLowerCase() === "p") { e.preventDefault(); togglePick(); }
      else if (/^[0-9]$/.test(e.key)) { const idx = e.key === "0" ? 9 : +e.key - 1; if (TOOLS[idx]) selectTool(TOOLS[idx].name); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study, showExport, showReport, showHelp, activeSeries, index, fullscreen, fps]);

  // The chatbot can drive the viewer via app commands (window/level, wheel, navigation, analyze…).
  const cmdRef = useRef<(c: { name: string; args?: any }) => void>(() => {});
  useEffect(() => {
    cmdRef.current = (c) => {
      if (c.name !== "viewer" || !study) return;
      const cmd = c.args?.command as string, val = (c.args?.value as string) || "";
      if (cmd === "wheel") { const m = val === "zoom" ? "zoom" : "stack"; wheelModeRef.current = m; setWheelMode(m); applyWheel(m); }
      else if (cmd === "window") { const map: Record<string, [number, number]> = { soft: [400, 40], angio: [600, 200], lung: [1500, -600], bone: [1800, 400], brain: [80, 40] }; const wl = map[val]; if (wl) applyWL(wl[0], wl[1]); }
      else if (cmd === "overlays") setShowOverlays(val !== "off");
      else if (cmd === "invert") invert();
      else if (cmd === "fullscreen") toggleFullscreen();
      else if (cmd === "reset") reset();
      else if (cmd === "navigate") { if (val === "next") step(1); else if (val === "prev") step(-1); else if (val === "first") scrub(0); else if (val === "last") scrub((activeSeries?.imageIds.length || 1) - 1); }
      else if (cmd === "analyze") { if (val === "pinned") runAiSelected(); else runAi(); }
      else if (cmd === "report") openReport();
    };
  });
  useEffect(() => onAppCommand((c) => cmdRef.current(c)), []);

  async function onFiles(files: File[]) {
    if (!apiRef.current) return;
    setBusy(true); setError(null); setAi({ loading: false }); setThumbs({}); imgTagCache.current.clear(); stopCine(); setProgress({ done: 0, total: 0, phase: "Reading" });
    try {
      const s = await loadStudy(files, apiRef.current, (done, total, phase) => setProgress({ done, total, phase }));
      if (s.imageIds.length === 0) { setError("No viewable images found."); setStudy(null); }
      else { setStudy(s); setActiveSeriesId(s.series[0].id); toast(`Loaded ${s.series.length} series · ${s.imageIds.length} images`); }
    } catch (e: any) { setError(`Failed to open file: ${e?.message || e}`); }
    finally { setBusy(false); setProgress(null); }
  }

  function selectTool(name: string) { const api = apiRef.current; if (!api) return; setActiveTool(name); try { api.cornerstoneTools.setToolActive(name, { mouseButtonMask: 1 }); } catch {} }
  function withViewport(fn: (vp: any) => void) { const api = apiRef.current, el = elRef.current; if (!api || !el) return; let vp; try { vp = api.cornerstone.getViewport(el); } catch { return; } if (!vp) return; fn(vp); api.cornerstone.setViewport(el, vp); }
  const applyWL = (ww: number, wc: number) => withViewport((vp) => { vp.voi.windowWidth = ww; vp.voi.windowCenter = wc; });
  // Match other PACS: keep the image's embedded DICOM window; only fall back to a
  // preset when the image carries no usable VOI (e.g. some CTs export without one).
  function applyDefaultWL() {
    const api = apiRef.current, el = elRef.current; if (!api || !el || !activeSeries) return;
    try {
      const img = api.cornerstone.getEnabledElement(el)?.image;
      const hasVoi = !!img && img.windowWidth > 1 && img.windowCenter != null && !isNaN(img.windowCenter);
      if (!hasVoi && /CT/i.test(activeSeries.modality)) applyWL(400, 40);
    } catch {}
  }
  const rotate = () => withViewport((vp) => (vp.rotation = (vp.rotation + 90) % 360));
  const flipH = () => withViewport((vp) => (vp.hflip = !vp.hflip));
  const flipV = () => withViewport((vp) => (vp.vflip = !vp.vflip));
  const invert = () => withViewport((vp) => (vp.invert = !vp.invert));
  const zoomBy = (f: number) => withViewport((vp) => (vp.scale = Math.max(0.05, vp.scale * f)));
  const setZoom = (pct: number) => withViewport((vp) => (vp.scale = Math.max(0.05, pct / 100)));
  const reset = () => { const api = apiRef.current, el = elRef.current; if (api && el) { api.cornerstone.reset(el); applyDefaultWL(); } };
  const fit = () => { const api = apiRef.current, el = elRef.current; if (api && el) try { api.cornerstone.fitToWindow(el); } catch {} };
  const oneToOne = () => withViewport((vp) => (vp.scale = 1));
  function fill() {
    const api = apiRef.current, el = elRef.current; if (!api || !el) return;
    try { const ee = api.cornerstone.getEnabledElement(el); if (!ee?.image) return; const s = Math.max(el.clientWidth / ee.image.width, el.clientHeight / ee.image.height); withViewport((vp) => (vp.scale = s)); } catch {}
  }
  function clearAnnotations() {
    const api = apiRef.current, el = elRef.current; if (!api || !el) return;
    ["Length", "Angle", "RectangleRoi", "EllipticalRoi", "Probe", "ArrowAnnotate", "FreehandRoi"].forEach((tn) => { try { api.cornerstoneTools.clearToolState(el, tn); } catch {} });
    api.cornerstone.updateImage(el); recomputeMeasurements(); toast("Annotations cleared", "info");
  }

  function onViewportMouseMove(e: React.MouseEvent) {
    const api = apiRef.current, el = elRef.current; if (!api || !el) return;
    try {
      const ee = api.cornerstone.getEnabledElement(el); if (!ee?.image) return;
      const pt = api.cornerstone.pageToPixel(el, e.pageX, e.pageY);
      const x = Math.round(pt.x), y = Math.round(pt.y);
      if (x < 0 || y < 0 || x >= ee.image.columns || y >= ee.image.rows) { setCursor(null); return; }
      let hu: number | null = null;
      if (!ee.image.color) { const sp = api.cornerstone.getStoredPixels(el, x, y, 1, 1); if (sp && sp.length) hu = Math.round(sp[0] * (ee.image.slope || 1) + (ee.image.intercept || 0)); }
      setCursor({ x, y, hu });
    } catch {}
  }

  function stopCine() { if (cineRef.current) { clearInterval(cineRef.current); cineRef.current = null; } setPlaying(false); }
  function toggleCine() {
    if (!activeSeries || activeSeries.imageIds.length < 2) return;
    if (cineRef.current) { stopCine(); return; }
    setPlaying(true);
    cineRef.current = setInterval(() => { setIndex((p) => { const n = (p + 1) % activeSeries.imageIds.length; displayIndex(n); return n; }); }, Math.max(20, 1000 / fps));
  }
  function step(d: number) { if (!activeSeries) return; stopCine(); setIndex((p) => { const n = Math.min(activeSeries.imageIds.length - 1, Math.max(0, p + d)); displayIndex(n); return n; }); }
  function scrub(i: number) { stopCine(); setIndex(i); displayIndex(i); }

  async function copyImage() {
    const canvas = elRef.current?.querySelector("canvas") as HTMLCanvasElement | null; if (!canvas) return;
    try { const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png")); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("Image copied to clipboard"); }
    catch { const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `${study?.name || "image"}.png`; a.click(); toast("Image downloaded", "info"); }
  }

  function toggleFullscreen() {
    const next = !fullscreen; setFullscreen(next);
    try { if (next) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    setTimeout(() => { const api = apiRef.current, el = elRef.current; if (api && el) { try { api.cornerstone.resize(el, true); } catch {} } }, 150);
  }

  async function exportRun(format: "gif" | "png", from1: number, to1: number) {
    const api = apiRef.current, main = elRef.current; if (!api || !main || !activeSeries) return;
    const all = activeSeries.imageIds;
    const lo = Math.max(0, Math.min(from1, to1) - 1), hi = Math.min(all.length - 1, Math.max(from1, to1) - 1);
    const count = hi - lo + 1, stepN = format === "gif" && count > 200 ? Math.ceil(count / 200) : 1;
    const base = `${(activeSeries.name || "run").replace(/\W+/g, "_")}_${lo + 1}-${hi + 1}`;
    setExporting(0); setShowExport(false);
    const off = document.createElement("div"); off.style.cssText = "position:fixed;left:-10000px;top:0;width:512px;height:512px;"; document.body.appendChild(off);
    try {
      api.cornerstone.enable(off);
      const mainVp = api.cornerstone.getViewport(main);
      let gif: any = null, zip: any = null;
      if (format === "gif") gif = new (await import("gif.js")).default({ workers: 2, quality: 10, workerScript: "/gif.worker.js", width: 512, height: 512 });
      else zip = new (await import("jszip")).default();
      let k = 0;
      for (let i = lo; i <= hi; i += stepN, k++) {
        const image = await api.cornerstone.loadAndCacheImage(all[i]);
        api.cornerstone.displayImage(off, image);
        if (mainVp) { const vp = api.cornerstone.getViewport(off); vp.voi = { ...mainVp.voi }; vp.invert = mainVp.invert; api.cornerstone.setViewport(off, vp); }
        try { api.cornerstone.fitToWindow(off); } catch {}
        api.cornerstone.updateImage(off);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const canvas = off.querySelector("canvas") as HTMLCanvasElement;
        if (gif) gif.addFrame(canvas, { copy: true, delay: Math.round(1000 / fps) });
        else { const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png")); zip.file(`${base}_${String(k + 1).padStart(4, "0")}.png`, blob); }
        setExporting(Math.round(((i - lo + 1) / count) * 90));
      }
      const finish = (blob: Blob, ext: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${base}.${ext}`; a.click(); try { api.cornerstone.disable(off); } catch {} off.remove(); setExporting(null); toast(`Exported ${ext.toUpperCase()} · ${count} frames`); };
      if (gif) { gif.on("finished", (b: Blob) => finish(b, "gif")); setExporting(95); gif.render(); }
      else { const b = await zip.generateAsync({ type: "blob" }, (m: any) => setExporting(90 + Math.round(m.percent * 0.1))); finish(b, "zip"); }
    } catch (e: any) { setError(`Export failed: ${e?.message || e}`); try { api.cornerstone.disable(off); } catch {} off.remove(); setExporting(null); }
  }

  // Cover the WHOLE study, but organize by VIEW so the model can report per view like a
  // radiologist: group slices by anatomical plane (Axial/Coronal/Sagittal, derived from
  // ImageOrientationPatient) — or, when there is no 3D orientation (e.g. X-ray/US), keep
  // each series as its own distinct projection. Each view becomes ONE montage grid whose
  // banner names the view. We never pass the series description text to the model.
  async function buildStudyMontages(): Promise<{ images: string[]; labels: string[] }> {
    const api = apiRef.current, main = elRef.current;
    if (!api || !study) return { images: [], labels: [] };
    const cs = api.cornerstone;

    // Group global slice indices by view.
    const order: string[] = [];
    const groups = new Map<string, { label: string; idxs: number[] }>();
    let genericView = 0, flat = 0;
    for (const s of study.series) {
      for (const id of s.imageIds) {
        const plane = planeOfImage(cs, id);
        const key = plane || `S:${s.id}`;
        let g = groups.get(key);
        if (!g) { g = { label: plane || `View ${++genericView}`, idxs: [] }; groups.set(key, g); order.push(key); }
        g.idxs.push(flat++);
      }
    }

    // MedGemma is a single-image, 896×896 model (strongest on 2D like chest X-ray). Match that:
    //  • 2D / few-image studies (CXR, DX, US, derm, fundus, path, plain images) → send each image
    //    at FULL 896 resolution (no grid). This is MedGemma's designed, best-performing input.
    //  • Volumetric CT/MR (3D stacks) → cover slices in compact 2×2 grids (each tile 448 → 896),
    //    and for CT apply the official 3-window→RGB preprocessing so bone/soft-tissue/brain are
    //    all visible. Bigger tiles = far better per-slice detail than a dense grid.
    const N = study.imageIds.length;
    let planeHits = 0;
    for (const k of order) if (!k.startsWith("S:")) planeHits += groups.get(k)!.idxs.length;
    const volumetric = N > 6 && planeHits >= N * 0.5;
    const isCT = /\bCT\b|CTA|CTCA|angio/i.test(`${study.modality} ${study.dict?.["Modality"] || ""}`);

    const off = document.createElement("div");
    off.style.cssText = `position:fixed;left:-10000px;top:0;width:896px;height:896px;`;
    document.body.appendChild(off);
    const images: string[] = [], labels: string[] = [];
    try {
      cs.enable(off);
      const mainVp = main ? cs.getViewport(main) : null;
      const ids = study.imageIds;

      if (!volumetric) {
        // ── 2D path: one full-resolution 896 image per source image (sampled, up to 8) ──
        const SIZE = 896, MAX_2D = 8;
        const picks: { gi: number; label: string }[] = [];
        for (const k of order) {
          const g = groups.get(k)!; const n = g.idxs.length;
          const take = Math.max(1, Math.min(n, Math.round((MAX_2D * n) / Math.max(1, N))));
          for (let t = 0; t < take; t++) picks.push({ gi: g.idxs[Math.floor(((t + 0.5) * n) / take)], label: g.label });
        }
        let done = 0;
        setAiProgress({ done: 0, total: picks.length, phase: "Rendering images" });
        for (const p of picks) {
          const c = await renderSlice(cs, off, ids[p.gi], SIZE, mainVp);
          if (picks.length > 1) stampNum(c, p.gi + 1);
          images.push(c.toDataURL("image/jpeg", 0.92)); labels.push(p.label);
          setAiProgress({ done: ++done, total: picks.length, phase: "Rendering images" });
        }
      } else {
        // ── Volumetric CT/MR path: 2×2 grids (tile 448 → 896), every slice, CT = 3-window RGB ──
        const per = 4, cols = 2, rows = 2, tile = 448, HEAD = 24;
        const plans: { label: string; part: number; parts: number; slices: number[] }[] = [];
        for (const k of order) {
          const g = groups.get(k)!;
          const parts = Math.max(1, Math.ceil(g.idxs.length / per));
          for (let m = 0; m < parts; m++) plans.push({ label: g.label, part: m + 1, parts, slices: g.idxs.slice(m * per, (m + 1) * per) });
        }
        const totalTiles = plans.reduce((a, p) => a + p.slices.length, 0);
        let done = 0;
        setAiProgress({ done: 0, total: totalTiles, phase: isCT ? "Rendering slices (CT windows)" : "Rendering slices" });
        for (const plan of plans) {
          const canvas = document.createElement("canvas");
          canvas.width = cols * tile; canvas.height = rows * tile + HEAD;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, canvas.width, HEAD);
          ctx.fillStyle = "#7ce0ff"; ctx.font = "bold 14px monospace";
          const tag = plan.parts > 1 ? `${plan.label.toUpperCase()} (${plan.part}/${plan.parts})` : plan.label.toUpperCase();
          ctx.fillText(`${tag}  ·  ${study.modality}`, 8, 17);
          let ti = 0;
          for (const gi of plan.slices) {
            const t = isCT ? await renderCtRgb(cs, off, ids[gi], tile) : await renderSlice(cs, off, ids[gi], tile, mainVp);
            const cx = (ti % cols) * tile, cy = HEAD + Math.floor(ti / cols) * tile;
            ctx.drawImage(t, cx, cy, tile, tile);
            ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(cx, cy, 32, 15);
            ctx.fillStyle = "#7ce0ff"; ctx.font = "11px monospace"; ctx.fillText(String(gi + 1), cx + 3, cy + 11);
            ti++; setAiProgress({ done: ++done, total: totalTiles, phase: `Rendering ${plan.label}` });
          }
          images.push(canvas.toDataURL("image/jpeg", 0.85)); labels.push(plan.label);
        }
      }
    } catch (e) { console.warn("montage error", e); }
    finally { try { cs.disable(off); } catch {} off.remove(); }
    return { images, labels };
  }

  // Render the exact slices the model cited (its "Key Images") into thumbnails for the report.
  async function renderKeyImages(refs: { slice: number; view?: string; caption?: string }[]): Promise<KeyImage[]> {
    const api = apiRef.current, main = elRef.current;
    if (!api || !study || !refs.length) return [];
    const cs = api.cornerstone, ids = study.imageIds, T = 320;
    const off = document.createElement("div");
    off.style.cssText = `position:fixed;left:-10000px;top:0;width:${T}px;height:${T}px;`;
    document.body.appendChild(off);
    const out: KeyImage[] = [];
    try {
      cs.enable(off);
      const mainVp = main ? cs.getViewport(main) : null;
      for (const r of refs) {
        const gi = r.slice - 1;
        if (gi < 0 || gi >= ids.length) continue;
        const img = await cs.loadAndCacheImage(ids[gi]);
        cs.displayImage(off, img);
        if (mainVp) { const vp = cs.getViewport(off); vp.voi = { ...mainVp.voi }; vp.invert = mainVp.invert; cs.setViewport(off, vp); }
        try { cs.fitToWindow(off); } catch {}
        cs.updateImage(off);
        await new Promise((res) => requestAnimationFrame(() => res(null)));
        const src = off.querySelector("canvas") as HTMLCanvasElement;
        const c = document.createElement("canvas"); c.width = T; c.height = T;
        const ctx = c.getContext("2d")!; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, T, T);
        ctx.drawImage(src, 0, 0, T, T);
        out.push({ slice: r.slice, view: r.view || planeOfImage(cs, ids[gi]) || "", caption: r.caption || "", url: c.toDataURL("image/jpeg", 0.85) });
      }
    } catch (e) { console.warn("key image error", e); }
    finally { try { cs.disable(off); } catch {} off.remove(); }
    return out;
  }

  // Render the key/impression slices at FULL 896 resolution (CT = 3-window RGB) for a
  // careful high-resolution second read by the model.
  async function renderKeyFullRes(refs: { slice: number; view?: string }[]): Promise<{ images: string[]; labels: string[] }> {
    const api = apiRef.current, main = elRef.current;
    if (!api || !study || !refs.length) return { images: [], labels: [] };
    const cs = api.cornerstone, ids = study.imageIds;
    const isCT = /\bCT\b|CTA|CTCA|angio/i.test(`${study.modality} ${study.dict?.["Modality"] || ""}`);
    const off = document.createElement("div");
    off.style.cssText = `position:fixed;left:-10000px;top:0;width:896px;height:896px;`;
    document.body.appendChild(off);
    const images: string[] = [], labels: string[] = [];
    try {
      cs.enable(off);
      const mainVp = main ? cs.getViewport(main) : null;
      for (const r of refs) {
        const gi = r.slice - 1;
        if (gi < 0 || gi >= ids.length) continue;
        const c = isCT ? await renderCtRgb(cs, off, ids[gi], 896) : await renderSlice(cs, off, ids[gi], 896, mainVp);
        stampNum(c, r.slice);
        images.push(c.toDataURL("image/jpeg", 0.92));
        labels.push(r.view || planeOfImage(cs, ids[gi]) || "");
      }
    } catch (e) { console.warn("key full-res error", e); }
    finally { try { cs.disable(off); } catch {} off.remove(); }
    return { images, labels };
  }

  // Pin / unpin the current slice for focused, full-resolution AI analysis.
  const currentImageId = activeSeries ? activeSeries.imageIds[index] : "";
  const currentPicked = !!currentImageId && aiPicks.includes(currentImageId);
  function togglePick() {
    if (!currentImageId) return;
    setAiPicks((p) => (p.includes(currentImageId) ? p.filter((x) => x !== currentImageId) : [...p, currentImageId]));
  }

  // Render the hand-picked images at FULL 896 (CT = 3-window RGB) for careful analysis.
  async function buildSelectedImages(picks: string[]): Promise<{ images: string[]; labels: string[] }> {
    const api = apiRef.current, main = elRef.current;
    if (!api || !study || !picks.length) return { images: [], labels: [] };
    const cs = api.cornerstone;
    const isCT = /\bCT\b|CTA|CTCA|angio/i.test(`${study.modality} ${study.dict?.["Modality"] || ""}`);
    const off = document.createElement("div");
    off.style.cssText = `position:fixed;left:-10000px;top:0;width:896px;height:896px;`;
    document.body.appendChild(off);
    const images: string[] = [], labels: string[] = [];
    try {
      cs.enable(off);
      const mainVp = main ? cs.getViewport(main) : null;
      let done = 0;
      setAiProgress({ done: 0, total: picks.length, phase: "Rendering selected images" });
      for (const id of picks) {
        const gi = study.imageIds.indexOf(id);
        const c = isCT ? await renderCtRgb(cs, off, id, 896) : await renderSlice(cs, off, id, 896, mainVp);
        if (picks.length > 1 && gi >= 0) stampNum(c, gi + 1);
        images.push(c.toDataURL("image/jpeg", 0.92));
        labels.push(planeOfImage(cs, id) || "");
        setAiProgress({ done: ++done, total: picks.length, phase: "Rendering selected images" });
      }
    } catch (e) { console.warn("selected render error", e); }
    finally { try { cs.disable(off); } catch {} off.remove(); }
    return { images, labels };
  }

  // Analyze straight away (no upfront questions), then ask result-driven questions before the report.
  // Pinned images → analyze ONLY those (full-res). Nothing pinned → analyze the whole study.
  function runAi() { if (!study || ai.loading) return; startAnalysis(aiPicks.length > 0 ? "selected" : "study"); }
  function runAiSelected() { if (!study || ai.loading || !aiPicks.length) return; setShowPicks(false); startAnalysis("selected"); }

  const post = (payload: any) => fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());

  // Phase 1 — read the images and produce a PRELIMINARY report + result-driven questions.
  async function startAnalysis(mode: "study" | "selected") {
    if (!study) return;
    const selected = mode === "selected" && aiPicks.length > 0;
    setReportHistory(""); pendingRef.current = null;
    setAi({ loading: true }); setAiProgress({ done: 0, total: 1, phase: "Preparing" });
    try {
      const { images, labels } = selected ? await buildSelectedImages(aiPicks) : await buildStudyMontages();
      if (!images.length) { setAiProgress(null); setAi({ loading: false, connected: false, message: "Couldn't render the study." }); return; }
      const meta = { name: study.name, modality: study.modality, imageCount: study.imageIds.length, seriesCount: study.series.length };

      // Batch read (every image at full detail), then synthesize.
      const BATCH = 6;
      const batches = Math.ceil(images.length / BATCH);
      const notes: string[] = [];
      let lastError = "";
      for (let b = 0; b < batches; b++) {
        setAiProgress({ done: b, total: batches + 1, phase: `Analyzing batch ${b + 1}/${batches}` });
        const from = b * BATCH, to = from + BATCH;
        const data = await post({ mode: "batch", ...meta, views: labels.slice(from, to), images: images.slice(from, to) });
        if (data?.connected && data?.text) notes.push(data.text);
        else if (data?.message) lastError = data.message;
      }
      if (!notes.length) { setAiProgress(null); setAi({ loading: false, connected: false, message: lastError || "No findings returned. Is the AI model running? (check the health badge)" }); return; }

      setAiProgress({ done: batches, total: batches + 1, phase: notes.length > 1 ? "Synthesizing report" : "Formatting report" });
      const sdata = await post({ mode: "synthesize", ...meta, notes });
      const preliminary: string = (sdata?.connected && sdata?.text) ? sdata.text : notes.join("\n\n");

      // Prepare the full-resolution key images for the follow-up re-analysis.
      let refineImages: string[] = [], refineLabels: string[] = [];
      if (selected) { refineImages = images.slice(0, 12); refineLabels = labels.slice(0, 12); }
      else {
        const keyRefs = parseKeyImageRefs(preliminary);
        if (keyRefs.length) { const kf = await renderKeyFullRes(keyRefs); refineImages = kf.images; refineLabels = kf.labels; }
      }
      pendingRef.current = { preliminary, meta, refineImages, refineLabels, selected };

      // Ask the result-driven questions the model raised — then re-analyze. Skippable.
      const questions = parseQuestions(preliminary);
      if (questions.length) {
        setAiQuestions(questions);
        setAiProgress(null); setAi({ loading: false });
        setShowQuestions(true);
      } else {
        await finishAnalysis("");
      }
    } catch (e: any) { setAiProgress(null); setAi({ loading: false, connected: false, message: `Request failed: ${e?.message || e}` }); }
  }

  // Phase 2 — re-analyze the key images at full resolution WITH the clinician's answers → final report.
  async function finishAnalysis(answers: string) {
    const p = pendingRef.current; if (!p || !study) return;
    setShowQuestions(false); setReportHistory(answers);
    setAi({ loading: true }); setAiProgress({ done: 0, total: 1, phase: answers ? "Re-analyzing with your answers" : "Finalizing report" });
    try {
      let finalText = p.preliminary;
      // Refine when the clinician answered, or (whole-study) to do the high-res key-image recheck.
      // For hand-picked mode with no answers, the picks were already read at full res — skip.
      if (answers || (!p.selected && p.refineImages.length)) {
        const rdata = await post({ mode: "refine", ...p.meta, history: answers, priorReport: p.preliminary, views: p.refineLabels, images: p.refineImages });
        if (rdata?.connected && rdata?.text) finalText = rdata.text;
      }
      const cv = elRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      setSnapshot(cv ? cv.toDataURL("image/png") : "");
      const parts = splitAiReport(finalText);
      setReportTechnique(parts.technique);
      setReportFindings(parts.findings || finalText);
      setReportImpression(parts.impression);
      setReportRecs(parts.recommendations);
      setAiProgress({ done: 1, total: 1, phase: "Capturing key images" });
      try { setKeyImages(await renderKeyImages(parseKeyImageRefs(finalText))); } catch { setKeyImages([]); }
      setAiProgress(null);
      setAi({ loading: false, connected: true, text: finalText });
      setShowReport(true); // auto-open the beautiful, editable report
      toast(answers ? "Re-analyzed with your answers · report ready" : "Report ready");
    } catch (e: any) { setAiProgress(null); setAi({ loading: false, connected: false, message: `Request failed: ${e?.message || e}` }); }
  }

  function openReport(findings = "") { setReportFindings(findings); setReportImpression(""); setReportTechnique(""); setReportRecs(""); setReportHistory(""); setKeyImages([]); const canvas = elRef.current?.querySelector("canvas") as HTMLCanvasElement | null; setSnapshot(canvas ? canvas.toDataURL("image/png") : ""); setShowReport(true); }

  // ───────── empty state ─────────
  if (study === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-white">Universal Viewer</h1>
          <p className="text-sm text-slate-400">Upload any imaging file — {BRAND.name} renders it with full PACS tools.</p>
        </div>
        <Dropzone accept={ACCEPT} onFiles={onFiles} busy={busy || !ready}
          title={ready ? "Drop a file, folder ZIP, or browse" : "Loading imaging engine…"}
          hint="DICOM · PACS · CT · MRI · CTCA · CAG · Echo · X-Ray · OCT · Fundus · Histopathology · PNG/JPG/TIFF · ZIP (multi-series)" />
        {progress && progress.total > 0 && (
          <div className="mx-auto mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>{progress.phase}…</span><span>{progress.done} / {progress.total}</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-medical-500 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div>
          </div>
        )}
        {error && <p className="mt-3 text-center text-sm text-critical">{error}</p>}
        <Toasts toasts={toasts} />
      </div>
    );
  }

  const total = activeSeries?.imageIds.length ?? 0;
  const d = study.dict;
  const ori = activeSeries?.orientation;
  const allTags = (activeSeries?.tags || []).filter((t) => !tagSearch || (t.label + t.value).toLowerCase().includes(tagSearch.toLowerCase()));
  const patientTags = ["Patient Name", "Patient ID", "Patient Birth Date", "Patient Sex", "Patient Age", "Patient Weight", "Patient Address", "Study Date", "Study Time", "Study ID", "Modality", "Study Description", "Referring Physician", "Series Description"].map((label) => ({ label, value: d[label] || activeSeries?.dict[label] || "" }));

  return (
    <div className="flex h-[calc(100vh-9.5rem)] flex-col gap-2">
      {/* PATIENT HEADER */}
      <div className={cn("flex items-center gap-3", fullscreen && "hidden")}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-medical-600/20 text-sm font-bold text-medical-200">{(d["Patient Name"]?.[0] || study.modality[0] || "S").toUpperCase()}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{d["Patient Name"] || study.name}</div>
            <div className="truncate text-[11px] text-slate-400">{[d["Patient Age"], d["Patient Sex"], d["Study Description"], d["Study Date"]].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <ToggleBtn active={showLeft} onClick={() => setShowLeft((v) => !v)} icon={PanelLeft} title="Toggle series browser" />
          <ToggleBtn active={showOverlays} onClick={() => setShowOverlays((v) => !v)} icon={showOverlays ? Eye : EyeOff} title="Toggle overlays (O)" />
          <ToggleBtn active={showRight} onClick={() => setShowRight((v) => !v)} icon={PanelRight} title="Toggle DICOM tags" />
          <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-navy-850 text-slate-300 hover:bg-white/10"><Keyboard className="h-4 w-4" /></button>
        </div>
      </div>

      {/* TOP TOOLBAR */}
      <div className={cn("flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-navy-900/70 px-2 py-1.5", fullscreen && "hidden")}>
        <button onClick={() => { stopCine(); setStudy(null); }} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10" title="Open another file"><Upload className="h-4 w-4" /> Open</button>
        <Sep />
        {TOOLS.map((t) => { const Icon = t.icon; return (<button key={t.name} title={`${t.label}`} onClick={() => selectTool(t.name)} className={cn("grid h-8 w-8 place-items-center rounded-lg", activeTool === t.name ? "bg-medical-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white")}><Icon className="h-4 w-4" /></button>); })}
        <Sep />
        {[{ fn: rotate, icon: RotateCw }, { fn: flipH, icon: FlipHorizontal }, { fn: flipV, icon: FlipVertical }, { fn: invert, icon: SunMedium }, { fn: reset, icon: RefreshCw }, { fn: clearAnnotations, icon: Trash2 }].map((a, i) => { const Icon = a.icon; return <button key={i} onClick={a.fn} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Icon className="h-4 w-4" /></button>; })}
        <Sep />
        {[["1:1", oneToOne], ["Fit", fit], ["Fill", fill]].map(([l, fn]) => <button key={l as string} onClick={fn as any} className="rounded-md border border-white/10 bg-navy-850 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white">{l as string}</button>)}
        <Sep />
        {WL_PRESETS.map((p) => <button key={p.label} onClick={() => applyWL(p.ww, p.wc)} className="rounded-md border border-white/10 bg-navy-850 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white">{p.label}</button>)}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={toggleWheel} title="Mouse wheel mode" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-navy-850 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-white/10">{wheelMode === "zoom" ? <Search className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}Wheel: {wheelMode === "zoom" ? "Zoom" : "Slices"}</button>
          <button onClick={toggleFullscreen} title="Full screen (F)" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-navy-850 text-slate-300 hover:bg-white/10">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          <Sep />
          {total > 1 && (<>
            <button onClick={toggleCine} className="grid h-8 w-8 place-items-center rounded-lg bg-medical-600 text-white hover:bg-medical-500">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            <span className="text-[11px] text-slate-500">FPS</span>
            <input type="number" min={1} max={60} value={fps} onChange={(e) => setFps(Math.max(1, Math.min(60, +e.target.value || 1)))} className="h-7 w-12 rounded-md border border-white/10 bg-navy-850 px-1.5 text-center text-xs text-slate-200" />
            <Sep />
          </>)}
          <button onClick={copyImage} title="Copy image" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-navy-850 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10"><Copy className="h-3.5 w-3.5" />Copy</button>
          {total > 1 && <button onClick={() => setShowExport(true)} disabled={exporting !== null} title="Export run / slides" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-navy-850 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-60">{exporting !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}{exporting !== null ? `${exporting}%` : "Export"}</button>}
          {/* Pin the current slice for focused, full-resolution AI analysis */}
          <button onClick={togglePick} title={currentPicked ? "Remove this slice from the AI selection" : "Pin this slice for focused, full-resolution AI analysis"}
            className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition", currentPicked ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "border-white/10 bg-navy-850 text-slate-300 hover:bg-white/10")}>
            {currentPicked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}Pin
          </button>
          {aiPicks.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowPicks((v) => !v)} title="Review pinned images" className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/15"><ListChecks className="h-3.5 w-3.5" />{aiPicks.length}</button>
              {showPicks && (<>
                <div className="fixed inset-0 z-10" onClick={() => setShowPicks(false)} />
                <div className="absolute bottom-11 right-0 z-20 w-64 panel p-2">
                  <div className="mb-1 flex items-center justify-between px-1"><span className="text-[11px] font-semibold text-white">Pinned for AI · {aiPicks.length}</span><button onClick={() => { setAiPicks([]); setShowPicks(false); }} className="text-[11px] text-slate-400 hover:text-critical">Clear all</button></div>
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {aiPicks.map((id) => { const gi = study.imageIds.indexOf(id); return (
                      <div key={id} className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
                        <span>Image {gi + 1}{planeOfImage(apiRef.current!.cornerstone, id) ? ` · ${planeOfImage(apiRef.current!.cornerstone, id)}` : ""}</span>
                        <button onClick={() => setAiPicks((p) => p.filter((x) => x !== id))} className="text-slate-500 hover:text-critical"><X className="h-3 w-3" /></button>
                      </div>); })}
                  </div>
                  <button onClick={runAiSelected} disabled={ai.loading} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-60"><Sparkles className="h-3.5 w-3.5" />Analyze {aiPicks.length} at full res</button>
                </div>
              </>)}
            </div>
          )}
          <button onClick={runAi} disabled={ai.loading} title={aiPicks.length > 0 ? `Analyze ${aiPicks.length} pinned image(s) at full resolution` : "Analyze the whole study"}
            className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition disabled:opacity-60", aiPicks.length > 0 ? "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25" : "border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/15")}>
            {ai.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{aiPicks.length > 0 ? `Analyze ${aiPicks.length} pinned` : "AI"}</button>
          <button onClick={() => openReport()} className="flex items-center gap-1.5 rounded-lg bg-medical-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-medical-500"><FileText className="h-3.5 w-3.5" />Report</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* LEFT — DICOM browser */}
        <div className={cn("hidden w-52 shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-navy-900/60 lg:flex", (fullscreen || !showLeft) && "lg:!hidden")}>
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Layers className="h-3.5 w-3.5" /> Series · {study.series.length}</div>
          <div className="flex-1 overflow-y-auto p-2">
            {study.series.map((s) => (
              <button key={s.id} onClick={() => { stopCine(); setActiveSeriesId(s.id); }}
                className={cn("group mb-2 flex w-full gap-2 rounded-lg border p-1.5 text-left transition", s.id === activeSeries?.id ? "border-medical-500/60 bg-medical-600/15 shadow-[0_0_0_1px_rgba(79,151,255,0.3),0_6px_20px_-8px_rgba(43,118,245,0.5)]" : "border-white/10 hover:bg-white/5")}>
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-black">
                  {thumbs[s.id] ? <img src={thumbs[s.id]} alt="" className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-110" /> : <div className="grid h-full w-full place-items-center text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{s.count}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-white" title={s.name}>{s.name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400"><span className="rounded bg-white/10 px-1 font-mono">{s.modality}</span>{s.isMultiframe ? " · cine" : ""}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div className={cn("flex min-w-0 flex-1 flex-col gap-2", fullscreen && "fixed inset-0 z-50 bg-black p-3")}>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
            <div ref={elRef} className="absolute inset-0" onContextMenu={(e) => e.preventDefault()} onMouseMove={onViewportMouseMove} onMouseLeave={() => setCursor(null)} />
            <button onClick={toggleFullscreen} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"} className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-navy-900/80 text-slate-200 backdrop-blur hover:bg-navy-800">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            {showOverlays && (<>
              <Overlay pos="tl"><div className="font-semibold">{d["Patient Name"] || "—"}{d["Patient Age"] ? `   ${d["Patient Age"]}` : ""}{d["Patient Sex"] ? `/${d["Patient Sex"]}` : ""}</div><div>{d["Patient ID"]}</div><div>{d["Patient Birth Date"]} {d["Patient Sex"]}</div><div>{d["Study Description"]}</div></Overlay>
              <Overlay pos="tr"><div className="font-semibold">{d["Model"] || d["Manufacturer"] || study.modality}</div><div>{d["Referring Physician"]}</div><div>{[d["Study Date"], d["Study Time"]].filter(Boolean).join("  ")}</div></Overlay>
              <Overlay pos="bl"><div>{imgTags.sliceThickness ? `ST: ${(+imgTags.sliceThickness).toFixed(2)} mm  ` : ""}{imgTags.sliceLocation ? `SL: ${(+imgTags.sliceLocation).toFixed(2)} mm` : ""}</div><div>{activeSeries?.modality}</div><div>{d["Transfer Syntax"]}</div><div>Images: {total ? index + 1 : 0}/{total}</div><div>Series: {activeSeries?.dict["Series Number"] || activeSeries?.name}</div></Overlay>
              <Overlay pos="br"><div>{[imgTags.mA ? `${imgTags.mA} mA` : "", imgTags.kvp ? `${imgTags.kvp} kV` : ""].filter(Boolean).join("  ")}</div><div>Zoom: {Math.round(readout.scale * 100)}%</div><div>WL: {readout.wc}  WW: {readout.ww}</div></Overlay>
              {ori && (<><Edge pos="top">{ori.top}</Edge><Edge pos="bottom">{ori.bottom}</Edge><Edge pos="left">{ori.left}</Edge><Edge pos="right">{ori.right}</Edge></>)}
            </>)}
            {error && <div className="absolute inset-x-0 bottom-0 bg-critical/20 px-3 py-1.5 text-center text-xs text-critical">{error}</div>}
            <AnimatePresence>{ai.message && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-3 max-w-md -translate-x-1/2 rounded-lg border border-teal-500/30 bg-navy-900/90 px-3 py-2 text-xs text-slate-200 backdrop-blur">
                {ai.message} {ai.connected === false && <a href="https://colab.research.google.com/gist/ys941/5d09f9d6abd2e8422baa7a072cd061b6/medgemma_aura_colab.ipynb" target="_blank" rel="noreferrer" className="text-teal-300 underline">Start the AI model (Colab → Run all)</a>}
              </motion.div>
            )}</AnimatePresence>
            {/* AI progress */}
            <AnimatePresence>{ai.loading && aiProgress && (
              <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-teal-500/30 bg-navy-900/95 p-5 text-center shadow-[0_0_40px_-8px_rgba(20,184,166,0.5)] backdrop-blur">
                {/* colorful rotating ring */}
                <div className="relative mx-auto mb-3 h-16 w-16">
                  <div className="absolute inset-0 rounded-full [animation:spin_1.1s_linear_infinite]"
                    style={{ background: "conic-gradient(from 0deg, #22d3ee, #6366f1, #ec4899, #f59e0b, #10b981, #22d3ee)", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))" }} />
                  <div className="absolute inset-0 rounded-full opacity-60 blur-md [animation:spin_1.1s_linear_infinite]"
                    style={{ background: "conic-gradient(from 0deg, #22d3ee, #6366f1, #ec4899, #f59e0b, #10b981, #22d3ee)", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))" }} />
                  <div className="absolute inset-0 grid place-items-center"><Sparkles className="h-5 w-5 animate-pulse text-teal-200" /></div>
                </div>
                <div className="text-sm font-semibold text-white">Analyzing whole study</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {aiProgress.phase}{aiProgress.total > 1 ? ` · ${aiProgress.done}/${aiProgress.total} slices` : " — reading with MedGemma…"}
                </div>
                {aiProgress.total > 1 && (
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((aiProgress.done / Math.max(1, aiProgress.total)) * 100)}%`, background: "linear-gradient(90deg,#22d3ee,#6366f1,#ec4899)" }} />
                  </div>
                )}
                <div className="mt-2 text-[10px] text-slate-500">{study.imageIds.length} slices · every slice · all views</div>
              </motion.div>
            )}</AnimatePresence>
          </div>

          {/* STATUS BAR */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-900/60 px-3 py-1.5 font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-medical-300"><Activity className="h-3 w-3" />{TOOLS.find((t) => t.name === activeTool)?.label}</span>
            <span>X {cursor?.x ?? "–"} Y {cursor?.y ?? "–"}</span>
            <span className={cn(cursor?.hu != null && "text-teal-300")}>HU {cursor?.hu ?? "–"}</span>
            <span className="ml-auto flex items-center gap-1">Zoom <input value={Math.round(readout.scale * 100)} onChange={(e) => setZoom(+e.target.value || 100)} className="w-12 rounded bg-navy-850 px-1 text-right text-slate-200 outline-none" />%</span>
            <span>WL {readout.wc} / WW {readout.ww}</span>
            {total > 1 && <span>Frame {index + 1}/{total}</span>}
          </div>

          {total > 1 && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-900/60 px-3 py-1.5">
              <button onClick={() => step(-1)} className="text-slate-400 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
              <input type="range" min={0} max={total - 1} value={index} onChange={(e) => scrub(parseInt(e.target.value, 10))} className="flex-1 accent-medical-500" />
              <button onClick={() => step(1)} className="text-slate-400 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
              <span className="w-16 text-right font-mono text-xs text-slate-400">{index + 1}/{total}</span>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className={cn("hidden w-72 shrink-0 flex-col gap-2 overflow-hidden xl:flex", (fullscreen || !showRight) && "xl:!hidden")}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-navy-900/60">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Tag className="h-3.5 w-3.5" /> DICOM Tags</div>
            <div className="border-b border-white/10 p-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-850 px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search tags…" className="h-7 w-full bg-transparent text-xs text-slate-200 outline-none" /></div>
              <div className="mt-2 flex gap-1">{(["patient", "all"] as const).map((t) => (<button key={t} onClick={() => setTagTab(t)} className={cn("flex-1 rounded-md px-2 py-1 text-[11px] font-medium", tagTab === t ? "bg-medical-600 text-white" : "bg-white/5 text-slate-400 hover:text-white")}>{t === "patient" ? "Patient info" : "All tags"}</button>))}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              <table className="w-full text-[11px]"><tbody>
                {(tagTab === "patient" ? patientTags : allTags).map((t, i) => (<tr key={i} className="border-b border-white/5 odd:bg-white/[0.02]"><td className="py-1 pl-2 pr-2 align-top text-slate-500">{t.label}</td><td className="py-1 pr-2 align-top text-slate-200 break-words">{t.value || "—"}</td></tr>))}
              </tbody></table>
            </div>
          </div>
          {/* measurements */}
          <div className="max-h-52 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-navy-900/60">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><span className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" /> Measurements</span>{measurements.length > 0 && <button onClick={clearAnnotations} className="text-slate-500 hover:text-critical" title="Clear"><Trash2 className="h-3 w-3" /></button>}</div>
            <div className="max-h-40 overflow-y-auto p-2">
              {measurements.length === 0 ? <p className="px-1 py-3 text-center text-[11px] text-slate-500">Use a measure tool — results appear here.</p> :
                measurements.map((m, i) => (<div key={i} className="flex items-center justify-between rounded px-1.5 py-1 text-[11px] hover:bg-white/5"><span className="text-slate-500">{m.tool.replace("Roi", " ROI")}</span><span className="font-mono text-slate-200">{m.text}</span></div>))}
            </div>
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />
      <AnimatePresence>{showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}</AnimatePresence>
      <AnimatePresence>{showAiResult && ai.text && (
        <AiResultModal text={ai.text} study={study} snapshot={snapshot} keyImages={keyImages} measurements={measurements} onClose={() => setShowAiResult(false)}
          onCopy={() => { navigator.clipboard?.writeText(ai.text || ""); toast("Findings copied"); }}
          onReport={() => { setShowAiResult(false); openReport(ai.text || ""); }} />
      )}</AnimatePresence>
      <AnimatePresence>{showQuestions && study && <QuestionsModal questions={aiQuestions} onSubmit={(a) => finishAnalysis(a)} onSkip={() => finishAnalysis("")} />}</AnimatePresence>
      <AnimatePresence>{showReport && study && <ReportModal study={study} ai={ai} snapshot={snapshot} measurements={measurements} initialFindings={reportFindings} initialImpression={reportImpression} initialTechnique={reportTechnique} initialRecs={reportRecs} initialHistory={reportHistory} keyImages={keyImages} onClose={() => setShowReport(false)} onSaved={() => toast("Report downloaded")} />}</AnimatePresence>
      <AnimatePresence>{showExport && activeSeries && <ExportModal seriesName={activeSeries.name} total={total} current={index + 1} fps={fps} onClose={() => setShowExport(false)} onExport={exportRun} />}</AnimatePresence>
    </div>
  );
}

function Sep() { return <div className="mx-0.5 h-6 w-px bg-white/10" />; }
function ToggleBtn({ active, onClick, icon: Icon, title }: { active: boolean; onClick: () => void; icon: any; title: string }) {
  return <button onClick={onClick} title={title} className={cn("grid h-8 w-8 place-items-center rounded-lg border", active ? "border-medical-500/40 bg-medical-600/15 text-medical-200" : "border-white/10 bg-navy-850 text-slate-400 hover:bg-white/10")}><Icon className="h-4 w-4" /></button>;
}
function Overlay({ pos, children }: { pos: "tl" | "tr" | "bl" | "br"; children: React.ReactNode }) {
  const cls = { tl: "left-2 top-2 text-left", tr: "right-12 top-2 text-right", bl: "left-2 bottom-2 text-left", br: "right-2 bottom-2 text-right" }[pos];
  return <div className={cn("pointer-events-none absolute font-mono text-[11px] leading-tight text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", cls)}>{children}</div>;
}
function Edge({ pos, children }: { pos: "top" | "bottom" | "left" | "right"; children: React.ReactNode }) {
  const cls = { top: "left-1/2 top-1 -translate-x-1/2", bottom: "left-1/2 bottom-1 -translate-x-1/2", left: "left-1 top-1/2 -translate-y-1/2", right: "right-1 top-1/2 -translate-y-1/2" }[pos];
  return <div className={cn("pointer-events-none absolute font-mono text-sm font-bold text-teal-300/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", cls)}>{children}</div>;
}
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur", t.tone === "ok" ? "border-good/30 bg-navy-900/90 text-good" : "border-white/10 bg-navy-900/90 text-slate-200")}>
            <CheckCircle2 className="h-4 w-4" />{t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5"><div className="flex items-center gap-2"><Keyboard className="h-4 w-4 text-medical-300" /><span className="text-sm font-semibold text-white">Keyboard shortcuts</span></div><button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="p-5">
          <table className="w-full text-sm"><tbody>
            {SHORTCUTS.map(([k, v]) => (<tr key={k} className="border-b border-white/5"><td className="py-1.5 pr-4"><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">{k}</kbd></td><td className="py-1.5 text-slate-400">{v}</td></tr>))}
          </tbody></table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function dlHtml(html: string, name: string) { const b = new Blob([html], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
function printHtml(html: string) { const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 350); }

interface ReportOpts { info?: Record<string, string>; history?: string; technique?: string; comparison?: string; findings?: string; impression?: string; recommendations?: string; snapshot?: string; keyImages?: KeyImage[]; measurements?: { tool: string; text: string }[]; aiConnected?: boolean; clinicName?: string; clinicAddress?: string; doctorName?: string; doctorCreds?: string }
function buildReportHtml(study: LoadedStudy, o: ReportOpts): string {
  const d = study.dict;
  const info = o.info || {};
  const measurements = o.measurements || [];
  const snapshot = o.snapshot || "";
  const keyImages = o.keyImages || [];
  const history = o.history || "";
  // Technique only if genuinely provided (real reports omit it for plain radiographs).
  const technique = (o.technique || "").trim();
  const impression = o.impression || "";
  const findings = o.findings || "";
  const esc = (s: string) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const md = (src: string) => {
    if (!src) return "";
    const lines = esc(src).split(/\r?\n/);
    let html = "", inList = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
    for (const raw of lines) {
      const line = raw.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
      const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (h) { closeList(); html += `<h3>${h[2].replace(/[:#]+$/, "")}</h3>`; }
      else if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${li[1]}</li>`; }
      else if (line.trim() === "") { closeList(); }
      else { closeList(); html += `<p>${line}</p>`; }
    }
    closeList();
    return html;
  };
  const comparison = o.comparison || "";
  const recommendations = o.recommendations || "";
  const clinicName = o.clinicName || `${BRAND.name} Diagnostic Imaging`;
  const clinicAddress = o.clinicAddress || "";
  const doctorName = o.doctorName || "";
  const doctorCreds = o.doctorCreds || "";
  const val = (k: string) => (info[k] ?? d[k] ?? "");
  const now = new Date();
  const reportDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const examTitle = (val("Study Description") || `${study.modality} STUDY`).toUpperCase();
  const ageSex = [val("Patient Age"), val("Patient Sex")].filter(Boolean).join(" / ");
  const ptRows: [string, string][] = [
    ["Patient Name", val("Patient Name") || study.name], ["Patient ID", val("Patient ID")],
    ["Age / Sex", ageSex], ["Referred By", val("Referring Physician")],
    ["Study Date", val("Study Date")], ["Accession No.", val("Accession #")],
    ["Modality", val("Modality") || study.modality], ["Report Date", reportDate],
  ];
  const ptTable = `<table class="pt"><tbody>${[0, 2, 4, 6].map((i) => `<tr><th>${ptRows[i][0]}</th><td>${esc(ptRows[i][1] || "—")}</td><th>${ptRows[i + 1][0]}</th><td>${esc(ptRows[i + 1][1] || "—")}</td></tr>`).join("")}</tbody></table>`;
  const meas = measurements.length ? `<div class="sect"><h2>Measurements</h2><ul>${measurements.map((m) => `<li>${esc(m.tool.replace("Roi", " ROI"))}: <b>${esc(m.text)}</b></li>`).join("")}</ul></div>` : "";
  const findingsHtml = findings ? md(findings) : `<p class="muted">${o.aiConnected ? "—" : "[entered manually]"}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(examTitle)} — ${esc(val("Patient Name") || study.name)}</title>
<style>
:root{--ink:#111827;--muted:#6b7280;--line:#d1d5db;--accent:#1e3a8a}
*{box-sizing:border-box}
body{font-family:Cambria,'Times New Roman',Georgia,serif;color:var(--ink);margin:0;background:#e5e7eb;font-size:13.5px;line-height:1.55}
.page{max-width:820px;margin:20px auto;background:#fff;box-shadow:0 4px 24px -10px rgba(0,0,0,.3);padding:34px 44px 26px}
.lh{text-align:center;border-bottom:3px double var(--accent);padding-bottom:10px}
.lh .cn{font-size:21px;font-weight:700;letter-spacing:.06em;color:var(--accent);text-transform:uppercase}
.lh .ca{font-size:11.5px;color:var(--muted);margin-top:2px}
.pt{border-collapse:collapse;width:100%;margin:14px 0 4px;font-size:12.5px}
.pt th{text-align:left;font-weight:700;background:#f3f4f6;width:14%;white-space:nowrap}
.pt td{width:36%} .pt td,.pt th{border:1px solid var(--line);padding:5px 9px}
.title{text-align:center;font-size:15px;font-weight:700;letter-spacing:.08em;text-decoration:underline;text-underline-offset:4px;margin:16px 0 4px;text-transform:uppercase}
.sect{margin-top:13px}
h2{font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink);margin:0 0 4px;border-bottom:1px solid var(--line);padding-bottom:2px}
h3{font-size:13px;margin:8px 0 2px;color:var(--ink)}
ul{margin:2px 0 6px 22px;padding:0} li{margin:2.5px 0}
p{margin:4px 0}
.sec{white-space:pre-wrap}
.muted{color:var(--muted)}
.imp p,.imp li{font-weight:600}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:6px}
.kimg{margin:0;border:1px solid var(--line);overflow:hidden}
.kimg img{width:100%;display:block;background:#000}
.kimg figcaption{font-size:10.5px;color:#374151;padding:4px 6px;border-top:1px solid var(--line)}
.sig{margin-top:34px;display:flex;justify-content:flex-end}
.sig .box{text-align:center;min-width:230px}
.sig .line{border-top:1px solid var(--ink);margin-bottom:4px}
.sig .dn{font-weight:700} .sig .dc{font-size:11.5px;color:var(--muted)}
.everify{margin-top:6px;font-size:10.5px;color:var(--muted);text-align:right}
.disclaimer{margin-top:18px;border-top:1px solid var(--line);padding-top:7px;color:var(--muted);font-size:10.5px}
.endline{text-align:center;font-size:11px;letter-spacing:.2em;color:var(--muted);margin-top:16px}
.print-btn{position:fixed;top:16px;right:16px;background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Segoe UI',sans-serif}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:100%;padding:10mm 12mm}.print-btn{display:none}.sect,.pt,.sig,.kimg{page-break-inside:avoid}h2{page-break-after:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
<div class="page">
  <div class="lh"><div class="cn">${esc(clinicName)}</div>${clinicAddress ? `<div class="ca">${esc(clinicAddress)}</div>` : ""}</div>
  ${ptTable}
  <div class="title">${esc(examTitle)}</div>
  ${history ? `<div class="sect"><h2>Clinical History</h2><div class="sec">${esc(history)}</div></div>` : ""}
  ${technique ? `<div class="sect"><h2>Technique</h2><div class="sec">${esc(technique)}</div></div>` : ""}
  ${comparison ? `<div class="sect"><h2>Comparison</h2><div class="sec">${esc(comparison)}</div></div>` : ""}
  <div class="sect"><h2>Findings</h2>${findingsHtml}</div>
  ${meas}
  ${impression ? `<div class="sect imp"><h2>Impression</h2>${md(impression)}</div>` : ""}
  ${recommendations ? `<div class="sect"><h2>Advice / Recommendations</h2>${md(recommendations)}</div>` : ""}
  ${keyImages.length ? `<div class="sect"><h2>Key Images</h2><div class="gallery">${keyImages.map((k) => `<figure class="kimg"><img src="${k.url}" alt="slice ${k.slice}"/><figcaption><b>Slice ${k.slice}${k.view ? ` · ${esc(k.view)}` : ""}</b>${k.caption ? ` — ${esc(k.caption)}` : ""}</figcaption></figure>`).join("")}</div></div>` : ""}
  ${snapshot && !keyImages.length ? `<div class="sect"><h2>Reference Image</h2><div class="gallery"><figure class="kimg"><img src="${snapshot}"/></figure></div></div>` : ""}
  <div class="sig"><div class="box"><div style="height:46px"></div><div class="line"></div><div class="dn">${esc(doctorName) || "&nbsp;"}</div>${doctorCreds ? `<div class="dc">${esc(doctorCreds)}</div>` : ""}</div></div>
  <div class="everify">Electronically verified report · Generated ${reportDate}</div>
  <div class="disclaimer">AI-assisted preliminary read (${study.imageIds.length} images reviewed) — clinical decision support only, <b>not a final diagnosis</b>. To be correlated clinically and verified by the reporting radiologist. Images processed locally.</div>
  <div class="endline">— END OF REPORT —</div>
</div></body></html>`;
}

function AiResultModal({ text, study, snapshot, keyImages = [], measurements, onClose, onCopy, onReport }: { text: string; study: LoadedStudy; snapshot: string; keyImages?: KeyImage[]; measurements: { tool: string; text: string }[]; onClose: () => void; onCopy: () => void; onReport: () => void }) {
  const parts = splitAiReport(text);
  const report = () => { const p = loadPrefs(); return buildReportHtml(study, { technique: parts.technique, findings: parts.findings || text, impression: parts.impression, recommendations: parts.recommendations, snapshot, keyImages, measurements, aiConnected: true, clinicName: p.clinicName, clinicAddress: p.clinicAddress, doctorName: p.doctorName, doctorCreds: p.doctorCreds }); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="flex max-h-[85vh] w-full max-w-xl flex-col panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal-300" /><span className="text-sm font-semibold text-white">AI analysis — whole study</span></div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{text}</div>
          <p className="mt-4 rounded-lg border border-warn/20 bg-warn/5 p-2.5 text-[11px] text-warn">Decision support on sampled images — not a diagnosis. Verify against the full study.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3.5">
          <button onClick={onCopy} className="btn-ghost"><Copy className="h-4 w-4" /> Copy</button>
          <button onClick={() => printHtml(report())} className="btn-ghost">🖨 Print</button>
          <button onClick={onReport} className="btn-ghost"><FileText className="h-4 w-4" /> Edit in report</button>
          <button onClick={() => dlHtml(report(), `report-${study.name.replace(/\W+/g, "_")}.html`)} className="btn-primary"><Download className="h-4 w-4" /> Full report</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ExportModal({ seriesName, total, current, fps, onClose, onExport }: { seriesName: string; total: number; current: number; fps: number; onClose: () => void; onExport: (format: "gif" | "png", from: number, to: number) => void }) {
  const [from, setFrom] = useState(1); const [to, setTo] = useState(total);
  const clamp = (n: number) => Math.max(1, Math.min(total, n || 1));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5"><div className="flex items-center gap-2"><Film className="h-4 w-4 text-medical-300" /><span className="text-sm font-semibold text-white">Export / copy run</span></div><button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="space-y-4 p-5">
          <p className="text-xs text-slate-400">Export <span className="text-slate-200">{seriesName}</span> ({total} frames). Pick the slides, then save a GIF (animated — drops into PowerPoint/Word) or a ZIP of PNGs.</p>
          <div className="flex flex-wrap gap-2"><button onClick={() => { setFrom(1); setTo(total); }} className="rounded-md border border-white/10 bg-navy-850 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10">Whole run</button><button onClick={() => { setFrom(current); setTo(current); }} className="rounded-md border border-white/10 bg-navy-850 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10">This slide only</button></div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400">From<input type="number" min={1} max={total} value={from} onChange={(e) => setFrom(clamp(+e.target.value))} className="h-8 w-20 rounded-md border border-white/10 bg-navy-850 px-2 text-center text-sm text-slate-200" /></label>
            <label className="flex items-center gap-2 text-xs text-slate-400">To<input type="number" min={1} max={total} value={to} onChange={(e) => setTo(clamp(+e.target.value))} className="h-8 w-20 rounded-md border border-white/10 bg-navy-850 px-2 text-center text-sm text-slate-200" /></label>
            <span className="text-[11px] text-slate-500">{Math.abs(to - from) + 1} frames · {fps} fps</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3.5"><button onClick={() => onExport("png", from, to)} className="btn-ghost"><Download className="h-4 w-4" /> PNG frames (.zip)</button><button onClick={() => onExport("gif", from, to)} className="btn-primary"><Film className="h-4 w-4" /> Animated GIF</button></div>
      </motion.div>
    </motion.div>
  );
}

// Pre-analysis question: clinical history sharpens the read; fully skippable.
// After the first read, the model asks the clinical questions its findings raised.
// Answering them triggers a full-resolution re-analysis; skipping keeps the preliminary report.
function QuestionsModal({ questions, onSubmit, onSkip }: { questions: string[]; onSubmit: (answers: string) => void; onSkip: () => void }) {
  const [ans, setAns] = useState<string[]>(() => questions.map(() => ""));
  const compiled = questions.map((q, i) => (ans[i].trim() ? `${q.replace(/\?+$/, "")}? ${ans[i].trim()}` : "")).filter(Boolean).join(" ");
  const anyAnswered = ans.some((a) => a.trim());
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="flex max-h-[88vh] w-full max-w-lg flex-col panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal-300" /><span className="text-sm font-semibold text-white">A few questions to sharpen the report</span></div>
          <button onClick={onSkip} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <p className="text-xs text-slate-400">I've read the images. Answering these will let me <span className="text-teal-300">re-analyze and give a more accurate report</span>. Answer what you can — or skip.</p>
          {questions.map((q, i) => (
            <label key={i} className="block">
              <span className="text-[13px] text-slate-200">{q.replace(/\?*$/, "?")}</span>
              <input autoFocus={i === 0} value={ans[i]} onChange={(e) => setAns((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && anyAnswered) onSubmit(compiled); }}
                placeholder="Your answer (optional)"
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-navy-850 px-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-500/50" />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3.5">
          <button onClick={onSkip} className="btn-ghost">Skip — keep this report</button>
          <button onClick={() => onSubmit(compiled)} disabled={!anyAnswered} className="btn-primary disabled:opacity-50"><Sparkles className="h-4 w-4" /> Re-analyze with answers</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const PREFS_KEY = "aura-report-prefs";
function loadPrefs(): Record<string, string> { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch { return {}; } }

function ReportModal({ study, ai, snapshot, measurements, initialFindings = "", initialImpression = "", initialTechnique = "", initialRecs = "", initialHistory = "", keyImages = [], onClose, onSaved }: { study: LoadedStudy; ai: AiState; snapshot: string; measurements: { tool: string; text: string }[]; initialFindings?: string; initialImpression?: string; initialTechnique?: string; initialRecs?: string; initialHistory?: string; keyImages?: KeyImage[]; onClose: () => void; onSaved: () => void }) {
  const d = study.dict;
  // all details, auto-filled from DICOM, fully editable
  const [f, setF] = useState<Record<string, string>>({
    "Patient Name": d["Patient Name"] || "", "Patient ID": d["Patient ID"] || "",
    "Patient Sex": d["Patient Sex"] || "", "Patient Age": d["Patient Age"] || "",
    "Patient Birth Date": d["Patient Birth Date"] || "", "Study Date": d["Study Date"] || "",
    "Study Description": d["Study Description"] || "", "Referring Physician": d["Referring Physician"] || "",
    "Accession #": d["Accession #"] || "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [history, setHistory] = useState(initialHistory);
  const [technique, setTechnique] = useState(initialTechnique || "");
  const [comparison, setComparison] = useState("");
  const [findings, setFindings] = useState(initialFindings);
  const [impression, setImpression] = useState(initialImpression);
  const [recommendations, setRecommendations] = useState(initialRecs);
  // letterhead + signature — remembered across sessions (localStorage, this device only)
  const [prefs] = useState(loadPrefs);
  const [clinicName, setClinicName] = useState(prefs.clinicName || "");
  const [clinicAddress, setClinicAddress] = useState(prefs.clinicAddress || "");
  const [doctorName, setDoctorName] = useState(prefs.doctorName || "");
  const [doctorCreds, setDoctorCreds] = useState(prefs.doctorCreds || "");
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ clinicName, clinicAddress, doctorName, doctorCreds })); } catch {} };
  const buildHtml = () => buildReportHtml(study, { info: f, history, technique, comparison, findings, impression, recommendations, snapshot, keyImages, measurements, aiConnected: ai.connected, clinicName, clinicAddress, doctorName, doctorCreds });
  function downloadHtml() { savePrefs(); dlHtml(buildHtml(), `report-${(f["Patient Name"] || study.name).replace(/\W+/g, "_")}.html`); onSaved(); }
  function printReport() { savePrefs(); printHtml(buildHtml()); }
  const detailFields = ["Patient Name", "Patient ID", "Patient Sex", "Patient Age", "Study Date", "Study Description", "Referring Physician", "Accession #"];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="flex max-h-[90vh] w-full max-w-2xl flex-col panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-medical-300" /><span className="text-sm font-semibold text-white">Structured Report — editable</span></div><button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex gap-4">{snapshot && <img src={snapshot} alt="key" className="h-24 w-24 shrink-0 rounded-lg border border-white/10 object-contain" />}<div className="flex-1 text-xs text-slate-400"><div className="font-semibold text-slate-200">{f["Patient Name"] || study.name}</div><div>{study.modality} · {study.series.length} series · {study.imageIds.length} images</div>{measurements.length > 0 && <div className="mt-1 text-slate-300">{measurements.length} measurement(s) included</div>}<div className="mt-1 text-good">All fields below are editable — the report uses your edits.</div></div></div>
          {keyImages.length > 0 && (
            <div>
              <label className="label-tiny">Key images ({keyImages.length}) — slices the AI flagged</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {keyImages.map((k, i) => (
                  <figure key={i} className="overflow-hidden rounded-lg border border-white/10 bg-black">
                    <img src={k.url} alt={`slice ${k.slice}`} className="aspect-square w-full object-cover" />
                    <figcaption className="truncate px-1.5 py-1 text-[10px] text-slate-400" title={k.caption}>Slice {k.slice}{k.view ? ` · ${k.view}` : ""}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label-tiny">Patient &amp; study details</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {detailFields.map((k) => (
                <label key={k} className="block"><span className="text-[10px] text-slate-500">{k}</span>
                  <input value={f[k] || ""} onChange={(e) => set(k, e.target.value)} className="mt-0.5 h-9 w-full rounded-lg border border-white/10 bg-navy-850 px-2.5 text-sm text-slate-200 outline-none focus:border-medical-500/50" />
                </label>
              ))}
            </div>
          </div>
          {[{ label: "Clinical history", v: history, set: setHistory, r: 2 }, { label: "Technique", v: technique, set: setTechnique, r: 2 }, { label: "Comparison", v: comparison, set: setComparison, r: 1 }, { label: "Findings", v: findings, set: setFindings, r: 6 }, { label: "Impression", v: impression, set: setImpression, r: 3 }, { label: "Advice / Recommendations", v: recommendations, set: setRecommendations, r: 2 }].map((s) => (<L key={s.label} label={s.label}><textarea value={s.v} onChange={(e) => s.set(e.target.value)} rows={s.r} className={rin} /></L>))}
          <div>
            <label className="label-tiny">Letterhead &amp; reporting doctor <span className="text-slate-500">(remembered on this device)</span></label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { k: "Centre name", v: clinicName, set: setClinicName, ph: "e.g. City Heart Imaging Centre" },
                { k: "Centre address / phone", v: clinicAddress, set: setClinicAddress, ph: "e.g. Mall Road, Bathinda · +91 …" },
                { k: "Reporting doctor", v: doctorName, set: setDoctorName, ph: "e.g. Dr. A. Sharma" },
                { k: "Qualifications / Reg. no.", v: doctorCreds, set: setDoctorCreds, ph: "e.g. MD (Radiodiagnosis) · Reg. 12345" },
              ].map((x) => (
                <label key={x.k} className="block"><span className="text-[10px] text-slate-500">{x.k}</span>
                  <input value={x.v} onChange={(e) => x.set(e.target.value)} placeholder={x.ph} className="mt-0.5 h-9 w-full rounded-lg border border-white/10 bg-navy-850 px-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-medical-500/50" />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3.5"><button onClick={printReport} className="btn-ghost">🖨 Print / PDF</button><button onClick={downloadHtml} className="btn-primary"><Download className="h-4 w-4" /> Download report</button></div>
      </motion.div>
    </motion.div>
  );
}
const rin = "mt-1 w-full rounded-lg border border-white/10 bg-navy-850 p-2.5 text-sm text-slate-200 outline-none focus:border-medical-500/50";
function L({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="label-tiny">{label}</label>{children}</div>; }
