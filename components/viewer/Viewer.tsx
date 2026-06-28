"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initCornerstone, type CornerstoneApi } from "@/lib/cornerstoneSetup";
import { loadStudy, readImageTags, type LoadedStudy, type LoadedSeries } from "@/lib/loadStudy";
import { Dropzone } from "@/components/Dropzone";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import {
  Contrast, Move, ZoomIn, Search, Ruler, Triangle, Square, Circle, Crosshair,
  MessageSquare, PenTool, RotateCw, FlipHorizontal, FlipVertical, SunMedium,
  RefreshCw, Play, Pause, Copy, Sparkles, FileText, Trash2, Upload, X,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, Plug, Download, Film, Layers, Tag,
  Maximize2, Minimize2, Rows3, PanelLeft, PanelRight, Keyboard, Eye, EyeOff, Activity,
} from "lucide-react";

const ACCEPT = ".dcm,.dicom,.ima,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tif,.tiff,.zip,application/dicom,image/*,application/zip";

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
  ["Mouse wheel", "Zoom (toggle to slice-scroll)"],
  ["+  /  −", "Zoom in / out"],
  ["Ctrl / ⌘ + C", "Copy current image"],
  ["Space", "Play / pause cine"],
  ["R", "Reset view"],
  ["I", "Invert"],
  ["O", "Toggle overlays"],
  ["F", "Full screen"],
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
  const wheelModeRef = useRef<"zoom" | "stack">("zoom");

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
  const [showAiResult, setShowAiResult] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportFindings, setReportFindings] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [exporting, setExporting] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [readout, setReadout] = useState<Readout>({ ww: 0, wc: 0, scale: 1 });
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [imgTags, setImgTags] = useState<Record<string, string>>({});
  const [tagTab, setTagTab] = useState<"patient" | "all">("patient");
  const [tagSearch, setTagSearch] = useState("");
  const [wheelMode, setWheelMode] = useState<"zoom" | "stack">("zoom");
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
      if (/CT/i.test(activeSeries.modality)) applyWL(400, 40);
      try { api.cornerstone.resize(el, true); api.cornerstone.fitToWindow(el); } catch {}
    })();
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
          if (/CT/i.test(s.modality)) { const vp = api.cornerstone.getViewport(off); vp.voi.windowWidth = 400; vp.voi.windowCenter = 40; api.cornerstone.setViewport(off, vp); }
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
      else if (/^[0-9]$/.test(e.key)) { const idx = e.key === "0" ? 9 : +e.key - 1; if (TOOLS[idx]) selectTool(TOOLS[idx].name); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study, showExport, showReport, showHelp, activeSeries, fullscreen, fps]);

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
  const rotate = () => withViewport((vp) => (vp.rotation = (vp.rotation + 90) % 360));
  const flipH = () => withViewport((vp) => (vp.hflip = !vp.hflip));
  const flipV = () => withViewport((vp) => (vp.vflip = !vp.vflip));
  const invert = () => withViewport((vp) => (vp.invert = !vp.invert));
  const zoomBy = (f: number) => withViewport((vp) => (vp.scale = Math.max(0.05, vp.scale * f)));
  const setZoom = (pct: number) => withViewport((vp) => (vp.scale = Math.max(0.05, pct / 100)));
  const reset = () => { const api = apiRef.current, el = elRef.current; if (api && el) { api.cornerstone.reset(el); if (activeSeries && /CT/i.test(activeSeries.modality)) applyWL(400, 40); } };
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

  // Render evenly-sampled slices of the active series (incl. current) to base64 — what the AI actually sees.
  async function collectStudyImages(maxN = 6): Promise<string[]> {
    const api = apiRef.current, main = elRef.current; if (!api || !activeSeries) return [];
    const ids = activeSeries.imageIds, n = ids.length;
    const picks = new Set<number>([Math.min(index, n - 1)]);
    const stepN = Math.max(1, Math.floor(n / maxN));
    for (let i = 0; i < n && picks.size < maxN; i += stepN) picks.add(i);
    const sorted = Array.from(picks).sort((a, b) => a - b).slice(0, maxN);
    const off = document.createElement("div"); off.style.cssText = "position:fixed;left:-10000px;top:0;width:448px;height:448px;"; document.body.appendChild(off);
    const out: string[] = [];
    try {
      api.cornerstone.enable(off);
      const mainVp = main ? api.cornerstone.getViewport(main) : null;
      for (const i of sorted) {
        const img = await api.cornerstone.loadAndCacheImage(ids[i]);
        api.cornerstone.displayImage(off, img);
        if (mainVp) { const vp = api.cornerstone.getViewport(off); vp.voi = { ...mainVp.voi }; vp.invert = mainVp.invert; api.cornerstone.setViewport(off, vp); }
        try { api.cornerstone.fitToWindow(off); } catch {}
        api.cornerstone.updateImage(off);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const c = off.querySelector("canvas") as HTMLCanvasElement;
        out.push(c.toDataURL("image/jpeg", 0.85));
      }
    } catch {} finally { try { api.cornerstone.disable(off); } catch {} off.remove(); }
    return out;
  }

  async function runAi() {
    if (!study) return; setAi({ loading: true });
    try {
      const images = await collectStudyImages(6);
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: study.name, modality: study.modality, imageCount: study.imageIds.length, images }) });
      const data = await res.json();
      if (data.connected && data.text) { setAi({ loading: false, connected: true, text: data.text }); setShowAiResult(true); toast("AI analysis complete"); }
      else setAi({ loading: false, connected: false, message: data.message || "No response." });
    } catch (e: any) { setAi({ loading: false, connected: false, message: `Request failed: ${e?.message || e}` }); }
  }

  function openReport(findings = "") { setReportFindings(findings); const canvas = elRef.current?.querySelector("canvas") as HTMLCanvasElement | null; setSnapshot(canvas ? canvas.toDataURL("image/png") : ""); setShowReport(true); }

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
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2">
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
          <button onClick={runAi} disabled={ai.loading} className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/15 disabled:opacity-60">{ai.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}AI</button>
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
                {ai.message} {ai.connected === false && <Link href="/settings" className="text-teal-300 underline">Connect a model</Link>}
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
        <AiResultModal text={ai.text} model={(d["Modality"] || study.modality)} onClose={() => setShowAiResult(false)}
          onCopy={() => { navigator.clipboard?.writeText(ai.text || ""); toast("Findings copied"); }}
          onReport={() => { setShowAiResult(false); openReport(ai.text || ""); }} />
      )}</AnimatePresence>
      <AnimatePresence>{showReport && study && <ReportModal study={study} ai={ai} snapshot={snapshot} measurements={measurements} initialFindings={reportFindings} onClose={() => setShowReport(false)} onSaved={() => toast("Report downloaded")} />}</AnimatePresence>
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

function AiResultModal({ text, model, onClose, onCopy, onReport }: { text: string; model: string; onClose: () => void; onCopy: () => void; onReport: () => void }) {
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
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3.5">
          <button onClick={onCopy} className="btn-ghost"><Copy className="h-4 w-4" /> Copy</button>
          <button onClick={onReport} className="btn-primary"><FileText className="h-4 w-4" /> Use in report</button>
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

function ReportModal({ study, ai, snapshot, measurements, initialFindings = "", onClose, onSaved }: { study: LoadedStudy; ai: AiState; snapshot: string; measurements: { tool: string; text: string }[]; initialFindings?: string; onClose: () => void; onSaved: () => void }) {
  const d = study.dict;
  const [patient, setPatient] = useState(d["Patient Name"] || "");
  const [history, setHistory] = useState("");
  const [technique, setTechnique] = useState(`${study.modality} study comprising ${study.series.length} series (${study.imageIds.length} images): ${study.series.map((s) => `${s.name} [${s.count}]`).join(", ")}.`);
  const [findings, setFindings] = useState(initialFindings);
  const [impression, setImpression] = useState("");
  function buildHtml() {
    const esc = (s: string) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const rows = study.series.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.modality)}</td><td>${s.count}</td></tr>`).join("");
    const info = ["Patient Name", "Patient ID", "Patient Birth Date", "Patient Sex", "Study Date", "Modality", "Study Description", "Referring Physician"].filter((k) => d[k]).map((k) => `<tr><td>${esc(k)}</td><td>${esc(d[k])}</td></tr>`).join("");
    const meas = measurements.length ? `<h2>Measurements</h2><ul>${measurements.map((m) => `<li>${esc(m.tool)}: ${esc(m.text)}</li>`).join("")}</ul>` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><title>Report — ${esc(study.name)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;color:#111;max-width:820px;margin:24px auto;padding:0 16px}h1{font-size:20px;border-bottom:2px solid #1a5ae0;padding-bottom:6px}h2{font-size:13px;color:#1a5ae0;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.04em}table{border-collapse:collapse;width:100%;font-size:12px;margin:6px 0}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}.muted{color:#666;font-size:12px}img{max-width:360px;border:1px solid #ccc;border-radius:6px;margin-top:8px}.sec{white-space:pre-wrap;font-size:13px}ul{font-size:12px}</style></head><body>
<h1>${BRAND.name} — Imaging Report</h1>
${info ? `<h2>Patient & Study</h2><table>${info}</table>` : `<div class="muted">${esc(study.name)} · ${esc(study.modality)}</div>`}
<h2>Series</h2><table><tr><th>Series</th><th>Modality</th><th>Images</th></tr>${rows}</table>
${snapshot ? `<h2>Key image</h2><img src="${snapshot}"/>` : ""}${meas}
<h2>Clinical history</h2><div class="sec">${esc(history) || "—"}</div>
<h2>Technique</h2><div class="sec">${esc(technique) || "—"}</div>
<h2>Findings</h2><div class="sec">${esc(findings) || (ai.connected ? "—" : "[AI analysis not connected — entered manually]")}</div>
<h2>Impression</h2><div class="sec">${esc(impression) || "—"}</div>
<p class="muted" style="margin-top:24px">Generated by ${BRAND.name}. Images processed locally.</p></body></html>`;
  }
  function downloadHtml() { const b = new Blob([buildHtml()], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `report-${study.name.replace(/\W+/g, "_")}.html`; a.click(); onSaved(); }
  function printReport() { const w = window.open("", "_blank"); if (!w) return; w.document.write(buildHtml()); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="flex max-h-[88vh] w-full max-w-2xl flex-col panel p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-medical-300" /><span className="text-sm font-semibold text-white">Structured Report — whole study</span></div><button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex gap-4">{snapshot && <img src={snapshot} alt="key" className="h-28 w-28 shrink-0 rounded-lg border border-white/10 object-contain" />}<div className="flex-1 text-xs text-slate-400"><div className="font-semibold text-slate-200">{d["Patient Name"] || study.name}</div><div>{study.modality} · {study.series.length} series · {study.imageIds.length} images</div>{measurements.length > 0 && <div className="mt-1 text-slate-300">{measurements.length} measurement(s) included</div>}{!ai.connected && <div className="mt-1 text-warn">AI not connected — findings entered manually.</div>}</div></div>
          <L label="Patient / ID"><input value={patient} onChange={(e) => setPatient(e.target.value)} className={rin} /></L>
          {[{ label: "Clinical history", v: history, set: setHistory, r: 2 }, { label: "Technique", v: technique, set: setTechnique, r: 2 }, { label: "Findings", v: findings, set: setFindings, r: 5 }, { label: "Impression", v: impression, set: setImpression, r: 3 }].map((s) => (<L key={s.label} label={s.label}><textarea value={s.v} onChange={(e) => s.set(e.target.value)} rows={s.r} className={rin} /></L>))}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3.5"><button onClick={printReport} className="btn-ghost">Print / PDF</button><button onClick={downloadHtml} className="btn-primary"><Download className="h-4 w-4" /> Download report</button></div>
      </motion.div>
    </motion.div>
  );
}
const rin = "mt-1 w-full rounded-lg border border-white/10 bg-navy-850 p-2.5 text-sm text-slate-200 outline-none focus:border-medical-500/50";
function L({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="label-tiny">{label}</label>{children}</div>; }
