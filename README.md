<div align="center">

# 🩺 Aura

### Universal DICOM Viewer & Clinical Intelligence Platform

A modern, privacy-first medical imaging workstation in your browser — open **any** study (DICOM, PACS, CT, MRI, CTCA, CAG, Echo, X-Ray, OCT, Fundus, Histopathology, images, or a multi-series ZIP), read it with a full PACS toolset, and generate a structured report — with optional AI analysis.

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Cornerstone.js](https://img.shields.io/badge/Cornerstone.js-DICOM-1E88E5)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## ✨ Highlights

- 🗂 **Universal upload** — `.dcm` / DICOM, plain images (PNG · JPG · TIFF), and **ZIP archives** with multiple series/folders. Multi-frame DICOM and cine runs (CAG / Echo) supported.
- 🩻 **Real PACS rendering** powered by **Cornerstone.js** — one engine for DICOM *and* images.
- 🧰 **Full tool set** — Window/Level, Pan, Zoom, Magnify, Length, Angle, Rectangle & Elliptical ROI, Pixel Probe (HU), Annotate, Freehand, Rotate, Flip, Invert, 1:1 / Fit / Fill.
- 🧭 **Workstation UI** — series browser with thumbnails, corner DICOM overlays, orientation markers, live **HU + cursor position**, WL/WW & zoom readout, and a searchable **DICOM Tags** panel.
- 🎞 **Cine + export** — play multi-frame runs, then **export a run** as an animated **GIF** or a **PNG sequence** (drop straight into PowerPoint / Word).
- 📋 **Copy & report** — copy the current frame (`Ctrl/⌘+C`), capture measurements, and generate a **structured report** (download as HTML / print to PDF).
- 🤖 **AI analysis (optional)** — send representative slices to a vision model and get **Findings + Impression** that flow into the report. Works with **Google AI Studio (Gemini / Gemma)** or a **self-hosted MedGemma** endpoint.
- 🔐 **Privacy-first** — images are processed **entirely in your browser**. **No database, no upload to a backend.** Authentication via **Clerk**.
- ⌨️ **Keyboard-driven** — arrows to scroll slices, `+/−` zoom, `Space` cine, `F` fullscreen, number keys for tools, `?` for help.

---

## 🚀 Quick start

```bash
# 1. Install
npm install

# 2. Configure (see Environment below)
#    create .env.local with your Clerk keys

# 3. Run
npm run dev          # → http://localhost:4477
```

On Windows you can simply **double-click `start-all.bat`** (installs deps on first run, starts the server, and opens the browser). For an optimized run use **`build-and-start.bat`**.

---

## ⚙️ Environment

Create a `.env.local` in the project root:

```ini
# Authentication — Clerk (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/viewer
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/viewer

# AI analysis (optional) — pick ONE provider
AI_PROVIDER=gemini
GEMINI_API_KEY=                 # free key: https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.5-flash   # or gemma-3-27b-it, gemma-4-26b-it, …

# …or self-hosted MedGemma (OpenAI-compatible, e.g. a llama.cpp HF Space)
# AI_PROVIDER=openai
# MEDGEMMA_ENDPOINT=https://<user>-<space>.hf.space/v1/chat/completions
# MEDGEMMA_MODEL=medgemma
```

> The app runs fully without an AI key — the **AI** button simply reports "not connected" until one is configured.

---

## 🧠 AI options

| Provider | Setup | Notes |
|---|---|---|
| **Gemini / Gemma** (Google AI Studio) | free API key | Fast, hosted, vision-capable, generous free tier. General-purpose. |
| **MedGemma on Colab** (free GPU) | run [`colab/`](colab/) notebook | Real medical model on a free T4 GPU; fast. URL changes per session. |
| **MedGemma on HF Space** (free CPU) | deploy [`hf-space/`](hf-space/) | Always-on but slow on CPU. |

The AI route ([`app/api/analyze/route.ts`](app/api/analyze/route.ts)) is provider-agnostic — switch by editing `.env.local`.

---

## 🏗 Architecture

```
app/
  (app)/viewer        ← the workstation (single module)
  (app)/settings      ← profile, role & account (Clerk)
  login / signup      ← Clerk auth (incl. password reset)
  api/analyze         ← provider-agnostic AI endpoint
components/viewer/    ← Viewer (Cornerstone engine, tools, overlays, export, report)
lib/
  cornerstoneSetup.ts ← Cornerstone engine bootstrap
  loadStudy.ts        ← DICOM/ZIP ingest, tag extraction, series grouping
hf-space/             ← deployable MedGemma server (Docker)
```

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Cornerstone.js (`cornerstone-core` / `-tools` / `-wado-image-loader`) · `dicom-parser` · `jszip` · `utif` · `gif.js` · framer-motion · Clerk.

---

## 🔒 Privacy & compliance

- All imaging is decoded and rendered **client-side**; pixel data never leaves the browser unless **you** trigger AI analysis (which sends only a few sampled, windowed images).
- No backend storage — refreshing the tab clears the session.
- Built with HIPAA/GDPR-minded workflows in mind.

> ⚠️ **Not a certified medical device.** For research, education, and workflow use only. AI output is decision support and must be verified by a clinician.

---

## 📄 License

[MIT](LICENSE) © 2026 — see the disclaimer in the license file.
