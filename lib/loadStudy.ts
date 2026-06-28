"use client";

import type { CornerstoneApi } from "@/lib/cornerstoneSetup";

export interface TagRow { label: string; value: string }

export interface LoadedSeries {
  id: string;
  name: string;
  modality: string;
  imageIds: string[];
  count: number;
  isMultiframe: boolean;
  tags: TagRow[];
  dict: Record<string, string>;
  orientation?: { top: string; bottom: string; left: string; right: string };
}

export interface LoadedStudy {
  id: string;
  name: string;
  modality: string;
  series: LoadedSeries[];
  imageIds: string[];
  dict: Record<string, string>;
  fileForId: Record<string, File>;
  fileCount: number;
}

const DICOM_EXT = /\.(dcm|dicom|ima)$/i;
const IMG_EXT = /\.(png|jpe?g|gif|bmp|webp)$/i;
const TIFF_EXT = /\.(tiff?)$/i;
const ZIP_EXT = /\.zip$/i;

function rid(p = "S") { return `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function trailingNum(name: string) { const m = name.match(/(\d+)\D*$/); return m ? parseInt(m[1], 10) : 0; }

// ── tag formatting ───────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtPN = (v: string) => v.replace(/\^+/g, " ").trim();
const fmtDate = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(6, 8)}-${MONTHS[+v.slice(4, 6) - 1] || v.slice(4, 6)}-${v.slice(0, 4)}` : v);
const fmtTime = (v: string) => (/^\d{6}/.test(v) ? `${v.slice(0, 2)}:${v.slice(2, 4)}:${v.slice(4, 6)}` : v);
const TS: Record<string, string> = {
  "1.2.840.10008.1.2": "Implicit VR Little Endian",
  "1.2.840.10008.1.2.1": "Little Endian Explicit",
  "1.2.840.10008.1.2.2": "Big Endian Explicit",
  "1.2.840.10008.1.2.4.50": "JPEG Baseline",
  "1.2.840.10008.1.2.4.51": "JPEG Extended",
  "1.2.840.10008.1.2.4.57": "JPEG Lossless",
  "1.2.840.10008.1.2.4.70": "JPEG Lossless (SV1)",
  "1.2.840.10008.1.2.4.90": "JPEG 2000 Lossless",
  "1.2.840.10008.1.2.4.91": "JPEG 2000",
  "1.2.840.10008.1.2.5": "RLE Lossless",
};
const fmtTS = (v: string) => TS[v] || v;

interface TagDef { id: string; label: string; num?: boolean; fmt?: (v: string) => string }
const TAG_DEFS: TagDef[] = [
  { id: "x00100010", label: "Patient Name", fmt: fmtPN },
  { id: "x00100020", label: "Patient ID" },
  { id: "x00100030", label: "Patient Birth Date", fmt: fmtDate },
  { id: "x00100040", label: "Patient Sex" },
  { id: "x00101010", label: "Patient Age" },
  { id: "x00101030", label: "Patient Weight" },
  { id: "x00101040", label: "Patient Address" },
  { id: "x00080020", label: "Study Date", fmt: fmtDate },
  { id: "x00080030", label: "Study Time", fmt: fmtTime },
  { id: "x00200010", label: "Study ID" },
  { id: "x00080050", label: "Accession #" },
  { id: "x00080060", label: "Modality" },
  { id: "x00081030", label: "Study Description" },
  { id: "x00080090", label: "Referring Physician", fmt: fmtPN },
  { id: "x00080080", label: "Institution" },
  { id: "x00080070", label: "Manufacturer" },
  { id: "x00081090", label: "Model" },
  { id: "x00081010", label: "Station" },
  { id: "x0008103e", label: "Series Description" },
  { id: "x00200011", label: "Series Number" },
  { id: "x00180060", label: "KVP" },
  { id: "x00181151", label: "Tube Current" },
  { id: "x00180050", label: "Slice Thickness" },
  { id: "x00280030", label: "Pixel Spacing" },
  { id: "x00280010", label: "Rows", num: true },
  { id: "x00280011", label: "Columns", num: true },
  { id: "x00020010", label: "Transfer Syntax", fmt: fmtTS },
];

function extractTags(ds: any): { list: TagRow[]; dict: Record<string, string> } {
  const list: TagRow[] = [];
  const dict: Record<string, string> = {};
  for (const t of TAG_DEFS) {
    let v = "";
    try {
      v = t.num ? String(ds.uint16(t.id) ?? "") : ds.string(t.id) || "";
    } catch { v = ""; }
    if (v && t.fmt) v = t.fmt(v);
    if (v) { list.push({ label: t.label, value: v }); dict[t.label] = v; }
  }
  return { list, dict };
}

function opp(l: string) { return ({ L: "R", R: "L", A: "P", P: "A", S: "I", I: "S" } as any)[l] || l; }
function axisLetter(v: number[]) {
  const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
  if (ax >= ay && ax >= az) return v[0] > 0 ? "L" : "R";
  if (ay >= ax && ay >= az) return v[1] > 0 ? "P" : "A";
  return v[2] > 0 ? "S" : "I";
}
function orientationFrom(ds: any) {
  try {
    const r = [0, 1, 2].map((i) => ds.floatString("x00200037", i));
    const c = [3, 4, 5].map((i) => ds.floatString("x00200037", i));
    if (r.some((n) => n == null || isNaN(n)) || c.some((n) => n == null || isNaN(n))) return undefined;
    const right = axisLetter(r as number[]);
    const bottom = axisLetter(c as number[]);
    return { right, left: opp(right), bottom, top: opp(bottom) };
  } catch { return undefined; }
}

async function isDicom(file: File): Promise<boolean> {
  if (DICOM_EXT.test(file.name) || file.type === "application/dicom") return true;
  if (IMG_EXT.test(file.name) || TIFF_EXT.test(file.name) || ZIP_EXT.test(file.name)) return false;
  if (file.size < 132) return false;
  const head = new Uint8Array(await file.slice(128, 132).arrayBuffer());
  return head[0] === 0x44 && head[1] === 0x49 && head[2] === 0x43 && head[3] === 0x4d;
}

interface NamedFile { file: File; folder: string }

export type ProgressFn = (done: number, total: number, phase: string) => void;

async function buildSeries(name: string, files: File[], api: CornerstoneApi, fileForId: Record<string, File>, tick?: () => void): Promise<LoadedSeries> {
  const imageIds: string[] = [];
  let modality = "";
  let multiframeFrames = 0;
  let tags: TagRow[] = [];
  let dict: Record<string, string> = {};
  let orientation: LoadedSeries["orientation"];

  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    try {
      if (await isDicom(f)) {
        const baseId: string = api.wado.wadouri.fileManager.add(f);
        let frames = 1;
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          const ds = api.dicomParser.parseDicom(buf);
          frames = parseInt((ds.string("x00280008") || "1"), 10) || 1;
          const mod = ds.string("x00080060") || "DICOM";
          if (!modality || modality === "Image") modality = mod;
          if (fi === 0 || tags.length === 0) {
            const ex = extractTags(ds);
            tags = ex.list; dict = ex.dict;
            orientation = orientationFrom(ds);
          }
        } catch { /* ignore parse */ }
        const ids = frames > 1 ? Array.from({ length: frames }, (_, i) => `${baseId}?frame=${i}`) : [baseId];
        if (frames > 1) multiframeFrames = frames;
        ids.forEach((id) => (fileForId[id] = f));
        imageIds.push(...ids);
      } else if (TIFF_EXT.test(f.name)) {
        const UTIF = (await import("utif")).default as any;
        const buf = await f.arrayBuffer();
        const ifds = UTIF.decode(buf);
        for (const ifd of ifds) {
          UTIF.decodeImage(buf, ifd);
          const rgba = UTIF.toRGBA8(ifd);
          const canvas = document.createElement("canvas");
          canvas.width = ifd.width; canvas.height = ifd.height;
          const ctx = canvas.getContext("2d")!;
          const im = ctx.createImageData(ifd.width, ifd.height); im.data.set(rgba); ctx.putImageData(im, 0, 0);
          const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
          imageIds.push(`weblocal:${URL.createObjectURL(blob)}`);
        }
        if (!modality) modality = "Image";
      } else {
        imageIds.push(`weblocal:${URL.createObjectURL(f)}`);
        if (!modality) modality = "Image";
      }
    } catch (e) { console.warn("Skipped", f.name, e); }
    tick?.();
  }

  return {
    id: rid("SE"), name, modality: modality || "Image", imageIds,
    count: imageIds.length, isMultiframe: files.length === 1 && multiframeFrames > 1,
    tags, dict, orientation,
  };
}

export async function loadStudy(files: File[], api: CornerstoneApi, onProgress?: ProgressFn): Promise<LoadedStudy> {
  const named: NamedFile[] = [];
  for (const f of files) {
    if (ZIP_EXT.test(f.name)) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(f);
      const entries = Object.values(zip.files).filter((e: any) => !e.dir) as any[];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const blob = await e.async("blob");
        const parts = e.name.split("/");
        named.push({ file: new File([blob], parts[parts.length - 1] || e.name), folder: parts.slice(0, -1).pop() || "Series" });
        if (i % 8 === 0) onProgress?.(i + 1, entries.length, "Extracting archive");
      }
    } else {
      named.push({ file: f, folder: "" });
    }
  }

  const groups = new Map<string, File[]>();
  for (const nf of named) {
    const key = nf.folder || (files.length === 1 ? files[0].name : "Uploaded files");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(nf.file);
  }

  const fileForId: Record<string, File> = {};
  const series: LoadedSeries[] = [];
  const totalFiles = named.length;
  let done = 0;
  for (const [name, groupFiles] of Array.from(groups.entries())) {
    groupFiles.sort((a, b) => {
      const d = trailingNum(a.name) - trailingNum(b.name);
      return d !== 0 ? d : a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    const s = await buildSeries(name, groupFiles, api, fileForId, () => { done++; if (done % 8 === 0 || done === totalFiles) onProgress?.(done, totalFiles, "Reading images"); });
    if (s.imageIds.length > 0) series.push(s);
  }
  series.sort((a, b) => b.count - a.count);

  const imageIds = series.flatMap((s) => s.imageIds);
  const firstDicom = series.find((s) => s.modality !== "Image");
  const modality = firstDicom?.modality || series[0]?.modality || "Image";
  const dict = firstDicom?.dict || series[0]?.dict || {};
  const name =
    files.length === 1 && !ZIP_EXT.test(files[0].name) ? files[0].name : files[0]?.name.replace(/\.zip$/i, "") || "Study";

  return { id: rid(), name, modality, series, imageIds, dict, fileForId, fileCount: named.length };
}

/** Lazily parse one image's per-slice tags (instance #, slice location). */
export async function readImageTags(api: CornerstoneApi, file: File | undefined): Promise<Record<string, string>> {
  if (!file) return {};
  try {
    const ds = api.dicomParser.parseDicom(new Uint8Array(await file.arrayBuffer()));
    const out: Record<string, string> = {};
    const inst = ds.string("x00200013"); if (inst) out.instance = inst;
    const loc = ds.string("x00201041"); if (loc) out.sliceLocation = loc;
    const th = ds.string("x00180050"); if (th) out.sliceThickness = th;
    const ma = ds.string("x00181151"); if (ma) out.mA = ma;
    const kv = ds.string("x00180060"); if (kv) out.kvp = kv;
    return out;
  } catch { return {}; }
}
