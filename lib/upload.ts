import dicomParser from "dicom-parser";
import {
  type Study,
  type ReportDoc,
  genId,
  anonLabel,
} from "@/lib/store";

const DICOM_EXT = /\.(dcm|dicom|ima)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i;

function ext(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

/** Read a File into a Study, parsing real DICOM tags when present. */
export async function fileToStudy(file: File): Promise<Study> {
  const url = URL.createObjectURL(file);
  const base: Study = {
    id: genId("ST"),
    fileName: file.name,
    fileType: "image",
    modality: "—",
    bodyPart: "—",
    studyDescription: file.name,
    patientLabel: anonLabel(file.name + file.size),
    url,
    sizeBytes: file.size,
    uploadedAt: Date.now(),
    tags: {},
  };

  const isDicom =
    DICOM_EXT.test(file.name) ||
    file.type === "application/dicom" ||
    (!IMAGE_EXT.test(file.name) && (await looksLikeDicom(file)));

  if (!isDicom) return base;

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const ds = dicomParser.parseDicom(buf);
    const s = (tag: string) => {
      try {
        return ds.string(tag) || "";
      } catch {
        return "";
      }
    };
    const tags: Record<string, string> = {
      Modality: s("x00080060"),
      BodyPart: s("x00180015"),
      StudyDescription: s("x00081030"),
      SeriesDescription: s("x0008103e"),
      Manufacturer: s("x00080070"),
      StudyDate: s("x00080020"),
      Rows: s("x00280010"),
      Columns: s("x00280011"),
      KVP: s("x00180060"),
      SliceThickness: s("x00180050"),
    };
    return {
      ...base,
      fileType: "dicom",
      modality: tags.Modality || "DICOM",
      bodyPart: tags.BodyPart || "—",
      studyDescription: tags.StudyDescription || tags.SeriesDescription || file.name,
      // PHI tags (patient name/ID) are deliberately NOT read or stored.
      tags: Object.fromEntries(Object.entries(tags).filter(([, v]) => v)),
    };
  } catch {
    // Not a parseable DICOM after all — treat as a generic file.
    return base;
  }
}

/** Sniff the DICOM "DICM" magic at byte offset 128. */
async function looksLikeDicom(file: File): Promise<boolean> {
  if (file.size < 132) return false;
  const head = new Uint8Array(await file.slice(128, 132).arrayBuffer());
  return (
    head[0] === 0x44 && head[1] === 0x49 && head[2] === 0x43 && head[3] === 0x4d
  );
}

/** Read a File into a ReportDoc, extracting plain text when it is a text file. */
export async function fileToReport(file: File): Promise<ReportDoc> {
  const e = ext(file.name);
  const url = URL.createObjectURL(file);
  let extractedText: string | undefined;

  if (e === "txt" || file.type.startsWith("text/")) {
    try {
      extractedText = await file.text();
    } catch {
      /* ignore */
    }
  }

  return {
    id: genId("RPT"),
    fileName: file.name,
    fileType: e || file.type || "file",
    url,
    sizeBytes: file.size,
    uploadedAt: Date.now(),
    extractedText,
  };
}

export const ACCEPT_STUDIES = ".dcm,.dicom,.ima,image/*,application/dicom";
export const ACCEPT_REPORTS = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,text/plain,image/*";
