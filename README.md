<div align="center">

# 🩺 Aura

### Universal DICOM Viewer & Clinical Intelligence Platform

**A modern, privacy‑first medical‑imaging workstation in your browser.**
Open *any* study, read it with a full PACS toolset, analyze the **whole study** with AI, and generate a **beautiful, editable, printable report** — all locally, with no database.

<br>

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Cornerstone.js](https://img.shields.io/badge/Cornerstone.js-DICOM-1E88E5)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)
![MedGemma](https://img.shields.io/badge/AI-MedGemma%201.5%20(vision)-0d9488)
![License](https://img.shields.io/badge/License-MIT-3fb950.svg)

</div>

---

## 📖 Table of contents

- [Why Aura](#-why-aura)
- [Feature tour](#-feature-tour)
- [Quick start](#-quick-start)
- [Environment configuration](#️-environment-configuration)
- [AI: MedGemma on a free Colab GPU](#-ai-medgemma-on-a-free-colab-gpu)
- [How whole‑study analysis works](#-how-whole-study-analysis-works)
- [The report system](#-the-report-system)
- [Controls & shortcuts](#️-controls--shortcuts)
- [Architecture](#-architecture)
- [Privacy & compliance](#-privacy--compliance)
- [Roadmap & limitations](#-roadmap--limitations)
- [License & disclaimer](#-license--disclaimer)

---

## ✨ Why Aura

Most web DICOM viewers are either read‑only toys or heavyweight enterprise PACS. **Aura** is a focused, single‑module workstation that runs entirely in the browser:

- **Everything is local.** Images are decoded and rendered client‑side. **No database, no upload to a backend.**
- **Universal.** DICOM/PACS, CT, MRI, CTCA, CAG, Echo, X‑Ray, OCT, Fundus, histopathology, plain images, and **multi‑series ZIP archives** — all in one viewer.
- **AI that reads the *whole* study**, not one slice — in a single, low‑token request — and drops the result into a polished, editable clinical report.
- **Free AI.** Runs **real MedGemma 1.5 (vision)** on a free Google Colab GPU, or any Gemini/Gemma vision model.

---

## 🧭 Feature tour

### 🗂 Universal upload & series browser
- Drag‑and‑drop `.dcm`/DICOM, images (PNG · JPG · **TIFF**), or a **ZIP** with multiple folders/series.
- **Multi‑frame DICOM** and **cine runs** (CAG / Echo) supported.
- Left **DICOM Browser**: patient header + a series list with **live rendered thumbnails** and image counts.

### 🩻 Real PACS rendering (Cornerstone.js)
One engine renders DICOM *and* standard images, with genuine DICOM decoding via the WADO image loader + `dicom-parser`.

### 🧰 Full tool set
`Window/Level` · `Pan` · `Zoom` · `Magnify` · `Length` · `Angle` · `Rectangle ROI` · `Elliptical ROI` · `Pixel Probe (HU)` · `Annotate` · `Freehand` · `Rotate` · `Flip H/V` · `Invert` · `1:1 / Fit / Fill` · `Reset` · `Clear`. Annotations are high‑contrast and legible.

### 🧭 Workstation UI
- **Corner overlays** (patient · institution · technical params · live WL/WW & zoom) and **orientation markers** (R/L/S/I, from the image orientation cosines) — toggle with `O`.
- **Live status bar**: HU value + cursor X/Y, active tool, editable zoom %, WL/WW, frame index.
- **Searchable DICOM Tags** panel (Patient info / All tags), **collapsible panels**, and **full‑screen** mode.
- **Brightness/contrast matches other PACS** — uses each image's embedded DICOM window (VOI); falls back to a soft‑tissue preset only when a scan carries no window.

### 🎞 Cine & export
- Play multi‑frame runs with an **FPS** control and a frame scrubber.
- **Export a run** (whole run, a frame **range**, or a single slide) as an animated **GIF** or a **PNG sequence (.zip)** — perfect for **PowerPoint / Word**.

### 🤖 AI analysis (whole study, one request)
- One click analyzes the **entire study** — see [how it works](#-how-whole-study-analysis-works) — with a **progress bar**.
- Powered by **MedGemma 1.5 4B (vision)** on Colab, or Gemini/Gemma. Findings & Impression, with model reasoning tokens stripped.

### 📋 Beautiful, editable, printable report
- After analysis the **editable report opens automatically**, pre‑filled with **all patient/study details** (from DICOM, fully editable), the AI **Findings**, and a split‑out **Impression**.
- Export a styled, standalone **`report.html`** (header band, info grid, series table, key image, Markdown‑rendered findings) with a built‑in **🖨 Print / Save PDF** button.

### 🔐 Auth, settings & privacy
- **Clerk** authentication — email/password **and Google SSO**, with password reset.
- **Settings**: edit profile photo, name, role, and organization (stored on your Clerk account — no DB).

---

## 🚀 Quick start

```bash
git clone https://github.com/ys941/aura-clinical-viewer.git
cd aura-clinical-viewer
npm install
# create .env.local (see below), then:
npm run dev          # → http://localhost:4477
```

**Windows one‑click launchers** (in the repo root):

| Script | What it does |
|---|---|
| **`start-all.bat`** | Installs deps (first run), starts the dev app, opens the browser. |
| **`build-and-start.bat`** | Production build + `npm start` (faster, optimized). |
| **`start-medgemma.bat`** | Opens the **MedGemma Colab** notebook *and* starts the app — the AI endpoint auto‑syncs. |

There's also an **"Aura Viewer"** desktop shortcut. Close the terminal window to stop the server.

---

## ⚙️ Environment configuration

Create `.env.local` in the project root:

```ini
# ── Authentication — Clerk (https://dashboard.clerk.com) ──
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/viewer
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/viewer

# ── AI — MedGemma on Colab (auto endpoint sync) ──
AI_PROVIDER=openai
MEDGEMMA_ENDPOINT=                       # leave blank → auto‑discover from ntfy
MEDGEMMA_NTFY_TOPIC=aura-med-9k3f7q2x8w  # must match the Colab notebook
MEDGEMMA_MODEL=medgemma1.5

# ── AI alternative — Google AI Studio (Gemini / Gemma) ──
# AI_PROVIDER=gemini
# GEMINI_API_KEY=                        # free: https://aistudio.google.com/apikey
# GEMINI_MODEL=gemini-2.5-flash          # or gemma-3-27b-it, gemma-4-26b-it, …
```

> The app runs fully without AI — the **AI** button simply reports "not connected" until a provider is configured. Clerk keys are required to sign in.

---

## 🧠 AI: MedGemma on a free Colab GPU

Real, medical‑tuned **MedGemma 1.5 4B (vision)** — free, no local server, no HF token.

1. Run **`start-medgemma.bat`** (or open [`colab/medgemma_aura_colab.ipynb`](colab/) in Colab).
2. In Colab: **Runtime → Change runtime type → T4 GPU**, then **Runtime → Run all**.
3. The notebook installs **Ollama**, pulls the vision model, exposes it via a free **Cloudflare tunnel**, and **auto‑publishes the endpoint** to a private **ntfy.sh** topic.
4. The app **auto‑discovers** that endpoint — **no copy‑paste, no `.env` edits**. Just click **AI**.

**Keep the Colab tab open** while using AI. Free runtimes sleep after inactivity — if you see a `530` error, the runtime went to sleep: re‑run the notebook and it re‑syncs automatically.

<details>
<summary><b>Why Ollama (and other AI options)</b></summary>

| Provider | Setup | Notes |
|---|---|---|
| **MedGemma on Colab** (default) | run the notebook | Real medical model on a **free T4 GPU**, vision‑capable, fast. URL auto‑syncs via ntfy. |
| **Gemini / Gemma** | free API key | Hosted, very fast, generous free tier. General‑purpose (not MedGemma). Set `AI_PROVIDER=gemini`. |
| **MedGemma on HF Space** | deploy [`hf-space/`](hf-space/) | Always‑on but slow on free CPU. |

MedGemma's public GGUF loads **text‑only** in Ollama, so Aura uses Ollama's official **`medgemma1.5`** model, which bundles the vision projector. The tunnel uses `--http-host-header localhost:11434` so Ollama accepts the forwarded request.
</details>

---

## 🔬 How whole‑study analysis works

A CT can have **hundreds of slices** — sending them all would be huge and slow. Aura instead builds **montages**:

1. Sample ~**36 slices evenly across the *entire* study** (all series).
2. Render them (with your current window) into a few **4×4 grid images** (slice numbers labelled).
3. Send just those montages in **one request**.

Because Gemma‑3 vision encodes each image to a fixed ~256 tokens, ~3 montages ≈ **a few hundred tokens** yet the model "sees" the whole study. You get **whole‑study coverage, one request, low tokens** — with a live progress bar while slices render.

---

## 📑 The report system

- **Auto‑generated** from the AI result and the DICOM metadata, then **fully editable** — every patient/study field, Clinical History, Technique, **Findings**, and **Impression**.
- **Beautiful HTML output**: gradient header band, patient/study info grid, series table, embedded key image, and Markdown‑rendered findings in styled cards.
- **Print / Save PDF** (button baked into the report + print‑optimized CSS) or **Download `report.html`**.
- Reachable two ways: the toolbar **Report** button (blank report) or automatically **after AI analysis** (pre‑filled).

---

## ⌨️ Controls & shortcuts

**Mouse (PACS‑standard):**

| Input | Action |
|---|---|
| **Wheel** | Scroll slices *(toggle to Zoom in the toolbar)* |
| **Left‑drag** | Window / Level (brightness + contrast) |
| **Right‑drag** | Zoom |
| **Middle‑drag** | Pan |

**Keyboard** (press `?` in the viewer for the full list):

| Key | Action | Key | Action |
|---|---|---|---|
| `↑ ↓ ← →` | Prev / next slice | `Space` | Play / pause cine |
| `+` / `−` | Zoom in / out | `Ctrl/⌘ + C` | Copy current image |
| `R` | Reset view | `I` | Invert |
| `O` | Toggle overlays | `F` | Full screen |
| `1–9, 0` | Select tool | `?` | Shortcuts help |

---

## 🏗 Architecture

```
app/
  (app)/viewer          ← the workstation (single module)
  (app)/settings        ← profile, role & account (Clerk)
  login / signup        ← Clerk auth (email/password, Google SSO, reset)
  api/analyze           ← provider‑agnostic AI endpoint (+ ntfy auto‑discovery)
components/
  viewer/Viewer.tsx     ← Cornerstone engine, tools, overlays, cine, export, report
  Sidebar · Topbar · Dropzone · ui …
lib/
  cornerstoneSetup.ts   ← engine bootstrap (WADO worker, tool styles)
  loadStudy.ts          ← DICOM/ZIP ingest, tag extraction, series grouping, orientation
colab/                  ← MedGemma Colab notebook (Ollama + auto endpoint sync)
hf-space/               ← alternative MedGemma server (Docker, HF Space)
public/cornerstone/     ← WADO web‑worker bundle · gif.worker.js
```

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Cornerstone.js (`cornerstone-core` / `-tools` / `-wado-image-loader` / `-web-image-loader`) · `dicom-parser` · `jszip` · `utif` · `gif.js` · framer‑motion · Clerk · Zustand.

---

## 🔒 Privacy & compliance

- All imaging is decoded and rendered **client‑side**; pixel data never leaves the browser unless **you** trigger AI analysis (which sends only a few sampled, windowed montage images).
- **No backend storage** — refreshing the tab clears the session. Profile/role live on your Clerk account.
- HIPAA/GDPR‑minded workflows; overlays surface only what a clinician expects at the workstation.

> ⚠️ **Not a certified medical device.** For research, education, and workflow use only. AI output is **decision support, not a diagnosis** — always verify against the full study.

---

## 🧭 Roadmap & limitations

- **Pyramidal whole‑slide** pathology (`.svs`) isn't supported yet (baseline TIFF is) — needs a tiling viewer.
- **MPR / 3D** (multi‑planar, MIP, volume rendering) not yet implemented.
- Colab endpoints are **ephemeral** (per session); auto‑sync handles the URL change, but the runtime must be running.
- Ideas: MPR & multi‑pane layouts, cross‑series reference lines, montage tiles embedded in the report, clinic letterhead, light theme.

---

## 📄 License & disclaimer

[MIT](LICENSE) © 2026 — with a medical‑use disclaimer in the license file.

**This software is provided for research, education, and workflow purposes only. It is not a certified medical device and is not intended for primary diagnosis or treatment decisions. Any AI‑generated output is decision support only and must be verified by a qualified clinician.**
