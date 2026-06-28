import fs from "node:fs";
import JSZip from "jszip";
import dicomParser from "dicom-parser";

const zipPath = process.argv[2];
const buf = fs.readFileSync(zipPath);
const zip = await JSZip.loadAsync(buf);
const entries = Object.values(zip.files).filter((e) => !e.dir);

// group by parent folder
const groups = {};
for (const e of entries) {
  const parts = e.name.split("/");
  const folder = parts.slice(0, -1).join("/") || "(root)";
  (groups[folder] ||= []).push(e);
}

function isDicom(u8) {
  return u8.length > 132 && u8[128] === 0x44 && u8[129] === 0x49 && u8[130] === 0x43 && u8[131] === 0x4d;
}

for (const [folder, list] of Object.entries(groups)) {
  // first by numeric order
  list.sort((a, b) => {
    const na = parseInt((a.name.match(/(\d+)\D*$/) || [])[1] || "0", 10);
    const nb = parseInt((b.name.match(/(\d+)\D*$/) || [])[1] || "0", 10);
    return na - nb;
  });
  const first = list[0];
  const u8 = new Uint8Array(await first.async("arraybuffer"));
  let info = { dicom: isDicom(u8) };
  if (info.dicom) {
    try {
      const ds = dicomParser.parseDicom(u8);
      const s = (t) => { try { return ds.string(t) || ""; } catch { return ""; } };
      info.modality = s("x00080060");
      info.series = s("x0008103e");
      info.frames = s("x00280008") || "1";
      info.rows = s("x00280010");
      info.cols = s("x00280011");
      info.photometric = s("x00280004");
      info.wc = s("x00280050");
      info.ww = s("x00280051");
    } catch (e) { info.parseErr = String(e); }
  }
  console.log(`\n=== ${folder.split("/").pop()} (${list.length} files) ===`);
  console.log(JSON.stringify(info, null, 0));
}
