"use client";

// Cornerstone engine bootstrap. Client-only, idempotent.
// Renders DICOM (via WADO image loader) and standard images (via a small
// custom color loader) through ONE engine, so the same toolset works for all.

import { asset } from "@/lib/asset";

type CS = typeof import("cornerstone-core");

let initialized = false;
let cornerstoneRef: any = null;
let toolsRef: any = null;
let wadoRef: any = null;
let dicomParserRef: any = null;

function unwrap(mod: any) {
  return mod && mod.default ? mod.default : mod;
}

/** Custom cornerstone loader for standard browser images (png/jpg/webp/gif/bmp) from object URLs. */
function makeWebLocalLoader(cornerstone: any) {
  return function loadImage(imageId: string) {
    const url = imageId.replace(/^weblocal:/, "");
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const getPixelData = () => pixelData;
        resolve({
          imageId,
          minPixelValue: 0,
          maxPixelValue: 255,
          slope: 1,
          intercept: 0,
          windowCenter: 128,
          windowWidth: 256,
          getPixelData,
          rows: img.naturalHeight,
          columns: img.naturalWidth,
          height: img.naturalHeight,
          width: img.naturalWidth,
          color: true,
          rgba: true,
          columnPixelSpacing: undefined,
          rowPixelSpacing: undefined,
          invert: false,
          sizeInBytes: pixelData.length,
        });
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
    return { promise } as any;
  };
}

export interface CornerstoneApi {
  cornerstone: any;
  cornerstoneTools: any;
  wado: any;
  dicomParser: any;
}

export async function initCornerstone(): Promise<CornerstoneApi> {
  if (initialized) {
    return { cornerstone: cornerstoneRef, cornerstoneTools: toolsRef, wado: wadoRef, dicomParser: dicomParserRef };
  }

  const cornerstone = unwrap(await import("cornerstone-core"));
  const cornerstoneMath = unwrap(await import("cornerstone-math"));
  const cornerstoneTools = unwrap(await import("cornerstone-tools"));
  const Hammer = unwrap(await import("hammerjs"));
  const dicomParser = unwrap(await import("dicom-parser"));
  const wado = unwrap(await import("cornerstone-wado-image-loader"));

  // wire externals
  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
  wado.external.cornerstone = cornerstone;
  wado.external.dicomParser = dicomParser;

  // Explicitly register the WADO image loaders (wadouri / dicomfile schemes),
  // in case this build doesn't auto-register on import.
  try { wado.wadouri?.register?.(cornerstone); } catch {}
  try { wado.webImageLoader?.register?.(cornerstone); } catch {}
  try { wado.register?.(cornerstone); } catch {}

  // WADO loader + web workers (codecs are bundled in the worker file copied to /public)
  wado.configure({ useWebWorkers: true, decodeConfig: { convertFloatPixelDataToInt: false } });
  try {
    wado.webWorkerManager.initialize({
      maxWebWorkers: Math.max(1, (navigator.hardwareConcurrency || 2) - 1),
      startWebWorkersOnDemand: true,
      webWorkerPath: asset("/cornerstone/index.worker.bundle.min.worker.js"),
      taskConfiguration: {
        decodeTask: { initializeCodecsOnStartup: false, strict: false },
      },
    });
  } catch {
    /* already initialized */
  }

  cornerstone.registerImageLoader("weblocal", makeWebLocalLoader(cornerstone));

  cornerstoneTools.init({
    mouseEnabled: true,
    touchEnabled: true,
    showSVGCursors: true,
  });

  // High-contrast, legible annotations (the default thin/dark style is hard to read on scans)
  try {
    cornerstoneTools.toolStyle.setToolWidth(2);
    cornerstoneTools.toolColors.setToolColor("rgb(124, 224, 255)"); // bright cyan
    cornerstoneTools.toolColors.setActiveColor("rgb(255, 215, 64)"); // amber when active
    cornerstoneTools.textStyle.setFontSize(14);
    cornerstoneTools.textStyle.setFont("14px Arial, sans-serif");
    cornerstoneTools.textStyle.setBackgroundColor("rgba(0, 0, 0, 0.72)");
  } catch {
    /* style API differences are non-fatal */
  }

  cornerstoneRef = cornerstone;
  toolsRef = cornerstoneTools;
  wadoRef = wado;
  dicomParserRef = dicomParser;
  initialized = true;

  return { cornerstone, cornerstoneTools, wado, dicomParser };
}
