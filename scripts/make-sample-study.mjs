/**
 * Builds the demo's sample study: a synthetic CT phantom, written as real
 * DICOM and zipped into public/demo/.
 *
 * Nothing here comes from a person. The slices are drawn from circles and
 * ellipses in Hounsfield units, so the demo has something to open without
 * shipping anyone's scan. The files are generated, not committed — see
 * scripts/build-demo.mjs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "demo");

const SIZE = 128;
const SLICES = 16;
const SLICE_MM = 5;

// A private UID root: 2.25.<random> is the standard way to mint one without
// registering an org prefix.
const UID_ROOT = "2.25.8814027319455103246";
const STUDY_UID = `${UID_ROOT}.1`;
const SERIES_UID = `${UID_ROOT}.2`;
const CT_IMAGE_STORAGE = "1.2.840.10008.5.1.4.1.1.2";
const EXPLICIT_VR_LE = "1.2.840.10008.1.2.1";

/** Stored value for a Hounsfield number, given RescaleIntercept -1024. */
const hu = (v) => Math.max(0, Math.min(4095, Math.round(v + 1024)));

const AIR = hu(-1000);
const FAT = hu(-90);
const TISSUE = hu(40);
const CSF = hu(12);
const BONE = hu(900);

/** One axial slice of the phantom, as 16-bit unsigned pixels. */
function renderSlice(index) {
  const px = new Uint16Array(SIZE * SIZE).fill(AIR);
  const c = (SIZE - 1) / 2;

  // The head narrows towards the top of the stack, so scrolling reads as 3D.
  const t = index / (SLICES - 1);
  const outer = SIZE * 0.42 * (1 - 0.18 * t * t);
  const skull = outer - SIZE * 0.035;
  const scalp = outer - SIZE * 0.012;

  // A small lesion fades in across the middle slices.
  const lesionStrength = Math.max(0, 1 - Math.abs(index - SLICES * 0.55) / 2.5);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy * 1.08);
      if (r > outer) continue;

      let value;
      if (r > scalp) value = FAT;            // scalp
      else if (r > skull) value = BONE;      // skull
      else {
        value = TISSUE;                      // brain

        // Paired lateral ventricles.
        for (const side of [-1, 1]) {
          const vx = (dx - side * SIZE * 0.085) / (SIZE * 0.045);
          const vy = (dy + SIZE * 0.02) / (SIZE * 0.1);
          if (vx * vx + vy * vy < 1) value = CSF;
        }

        if (lesionStrength > 0) {
          const lx = (dx + SIZE * 0.14) / (SIZE * 0.05);
          const ly = (dy - SIZE * 0.1) / (SIZE * 0.05);
          if (lx * lx + ly * ly < 1) value = hu(40 + 45 * lesionStrength);
        }
      }

      // A little texture so windowing has something to bite on.
      px[y * SIZE + x] = Math.max(0, value + (((x * 7 + y * 13 + index * 5) % 11) - 5));
    }
  }
  return px;
}

// ── DICOM encoding (Explicit VR Little Endian) ──────────────────────────────

const PADDED = (s, pad) => (s.length % 2 ? s + pad : s);
const textValue = (vr, s) => Buffer.from(PADDED(s, vr === "UI" ? "\0" : " "), "latin1");

/** Long-form VRs carry a 4-byte length after two reserved bytes. */
const LONG_FORM = new Set(["OB", "OW", "OF", "SQ", "UT", "UN"]);

function element(group, el, vr, value) {
  const head = Buffer.alloc(LONG_FORM.has(vr) ? 12 : 8);
  head.writeUInt16LE(group, 0);
  head.writeUInt16LE(el, 2);
  head.write(vr, 4, "latin1");
  if (LONG_FORM.has(vr)) head.writeUInt32LE(value.length, 8);
  else head.writeUInt16LE(value.length, 6);
  return Buffer.concat([head, value]);
}

const uid = (group, el, s) => element(group, el, "UI", textValue("UI", s));
const str = (group, el, vr, s) => element(group, el, vr, textValue(vr, String(s)));

function uint16(group, el, n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return element(group, el, "US", b);
}

function encodeSlice(index, pixels) {
  const instanceUid = `${UID_ROOT}.3.${index + 1}`;
  const position = (index * SLICE_MM).toFixed(1);

  const dataset = Buffer.concat([
    str(0x0008, 0x0020, "DA", "20260101"),
    str(0x0008, 0x0030, "TM", "120000"),
    uid(0x0008, 0x0016, CT_IMAGE_STORAGE),
    uid(0x0008, 0x0018, instanceUid),
    str(0x0008, 0x0060, "CS", "CT"),
    str(0x0008, 0x0070, "LO", "Aura"),
    str(0x0008, 0x1030, "LO", "Synthetic phantom - demo data"),
    str(0x0008, 0x103e, "LO", "Axial phantom"),
    str(0x0010, 0x0010, "PN", "Phantom^Synthetic"),
    str(0x0010, 0x0020, "LO", "DEMO-0001"),
    str(0x0010, 0x0040, "CS", "O"),
    uid(0x0020, 0x000d, STUDY_UID),
    uid(0x0020, 0x000e, SERIES_UID),
    str(0x0020, 0x0011, "IS", "1"),
    str(0x0020, 0x0013, "IS", String(index + 1)),
    str(0x0020, 0x0032, "DS", `-64.0\\-64.0\\${position}`),
    str(0x0020, 0x0037, "DS", "1\\0\\0\\0\\1\\0"),
    str(0x0020, 0x1041, "DS", position),
    uint16(0x0028, 0x0002, 1),
    str(0x0028, 0x0004, "CS", "MONOCHROME2"),
    uint16(0x0028, 0x0010, SIZE),
    uint16(0x0028, 0x0011, SIZE),
    str(0x0028, 0x0030, "DS", "1.0\\1.0"),
    uint16(0x0028, 0x0100, 16),
    uint16(0x0028, 0x0101, 16),
    uint16(0x0028, 0x0102, 15),
    uint16(0x0028, 0x0103, 0),
    str(0x0028, 0x1050, "DS", "40"),
    str(0x0028, 0x1051, "DS", "400"),
    str(0x0028, 0x1052, "DS", "-1024"),
    str(0x0028, 0x1053, "DS", "1"),
    str(0x0018, 0x0050, "DS", String(SLICE_MM)),
    element(0x7fe0, 0x0010, "OW", Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)),
  ]);

  const metaBody = Buffer.concat([
    element(0x0002, 0x0001, "OB", Buffer.from([0x00, 0x01])),
    uid(0x0002, 0x0002, CT_IMAGE_STORAGE),
    uid(0x0002, 0x0003, instanceUid),
    uid(0x0002, 0x0010, EXPLICIT_VR_LE),
    uid(0x0002, 0x0012, `${UID_ROOT}.4`),
  ]);
  const metaLength = Buffer.alloc(4);
  metaLength.writeUInt32LE(metaBody.length, 0);

  return Buffer.concat([
    Buffer.alloc(128),
    Buffer.from("DICM", "latin1"),
    element(0x0002, 0x0000, "UL", metaLength),
    metaBody,
    dataset,
  ]);
}

const zip = new JSZip();
for (let i = 0; i < SLICES; i++) {
  zip.file(`slice-${String(i + 1).padStart(3, "0")}.dcm`, encodeSlice(i, renderSlice(i)));
}

const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "sample-ct-phantom.zip"), archive);
console.log(`sample study: ${SLICES} slices, ${(archive.length / 1024).toFixed(0)} KB`);
