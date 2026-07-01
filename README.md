<div align="center">

# 🩺 Aura

### The Universal DICOM Viewer that actually slaps.

Open *any* scan, poke it with real PACS tools, let AI read the **whole study** in one shot, and spit out a **gorgeous, editable, printable report** — all in your browser. No database. No nonsense. Big brain energy. 🧠✨

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

## 🗺️ The lay of the land

- [The vibe](#-the-vibe)
- [What it does (the good stuff)](#-what-it-does-the-good-stuff)
- [Get it running (0 to 100 real quick)](#-get-it-running-0-to-100-real-quick)
- [The `.env.local` situationship](#️-the-envlocal-situationship)
- [AI on a free Colab GPU (yes, actually free)](#-ai-on-a-free-colab-gpu-yes-actually-free)
- [How the AI reads the WHOLE study without crying](#-how-the-ai-reads-the-whole-study-without-crying)
- [The report glow-up](#-the-report-glow-up)
- [Controls & shortcuts (muscle memory unlocked)](#️-controls--shortcuts-muscle-memory-unlocked)
- [Under the hood](#-under-the-hood)
- [Privacy (we're not weird about your data)](#-privacy-were-not-weird-about-your-data)
- [Roadmap & receipts](#-roadmap--receipts)
- [License & the "please don't sue us" disclaimer](#-license--the-please-dont-sue-us-disclaimer)

---

## 💅 The vibe

Most web DICOM viewers are either read‑only toys or bloated enterprise PACS that need a PhD to install. **Aura said no.** It's one clean workstation that runs *entirely in your browser*:

- **Everything's local.** Pixels get decoded and rendered client‑side. **No database. Nothing leaves your machine** unless *you* press the AI button. Privacy? Immaculate.
- **It eats anything.** DICOM/PACS, CT, MRI, CTCA, CAG, Echo, X‑Ray, OCT, Fundus, histopath, plain images, and chonky **multi‑series ZIPs**. All one viewer. No fuss.
- **The AI reads the whole study**, not one lonely slice — in **one low‑token request** — then drops the findings into a report that's genuinely *pretty*.
- **The AI is free.** Real **MedGemma 1.5 (vision)** on a free Google Colab GPU. Zero dollars. Chef's kiss. 👨‍🍳💋

---

## 🚀 What it does (the good stuff)

### 🗂 Upload anything + a series browser that shows off
Drag‑drop `.dcm`, images (PNG · JPG · **TIFF**), or a **ZIP** with folders. Multi‑frame DICOM and **cine runs** (CAG / Echo) just work. The left panel gives you a patient header + a series list with **live rendered thumbnails**. Fancy.

### 🩻 Legit PACS rendering (Cornerstone.js)
One engine renders DICOM *and* normal images, with real DICOM decoding. Not a screenshot in a trench coat — actual pixel data.

### 🧰 The whole toolbox
`Window/Level` · `Pan` · `Zoom` · `Magnify` · `Length` · `Angle` · `Rect ROI` · `Ellipse ROI` · `Pixel Probe (HU)` · `Annotate` · `Freehand` · `Rotate` · `Flip H/V` · `Invert` · `1:1 / Fit / Fill` · `Reset` · `Clear`. Annotations are bright and readable, not sad grey scribbles.

### 🧭 Workstation drip
- **Corner overlays** (patient · institution · technical params · live WL/WW & zoom) + **orientation letters** (R/L/S/I). Toggle with `O` if they're in your way.
- **Live status bar**: HU + cursor X/Y, active tool, editable zoom %, WL/WW, frame.
- **Searchable DICOM Tags** panel, **collapsible panels**, **fullscreen** (`F`).
- **Brightness/contrast matches other PACS** — it respects each image's embedded DICOM window and only falls back to a preset when a scan ships with none.

### 🎞 Cine + export for the slides
Play multi‑frame runs (FPS control + scrubber), then **export a run** — whole thing, a **range**, or a single slide — as an animated **GIF** or a **PNG zip**. Yeet it straight into PowerPoint/Word. 🎬

### 🤖 AI that actually reads the study
One click → the **entire study** gets analyzed (with a progress bar), powered by **MedGemma 1.5 4B (vision)** or Gemini/Gemma. Findings + Impression, with the model's mumbly "thinking" tokens cleaned out.

### 📋 A report that pulls up looking fine
After analysis the **editable report opens itself**, pre‑filled with **all your patient/study details** (editable!), the AI **Findings**, and a split‑out **Impression**. Export a styled standalone **`report.html`** with a built‑in **🖨 Print / Save PDF** button.

### 🔐 Auth + settings, no cap
**Clerk** handles login — email/password **and Google SSO** + password reset. Settings let you change your photo, name, role, org (stored on your account, not some database).

---

## 🏃 Get it running (0 to 100 real quick)

```bash
git clone https://github.com/ys941/aura-clinical-viewer.git
cd aura-clinical-viewer
npm install
# make your .env.local (peek below), then:
npm run dev          # → http://localhost:4477
```

**Windows folks — just double‑click a `.bat` and vibe:**

| Script | What it does |
|---|---|
| **`start-all.bat`** ⭐ | **The one button to rule them all** — opens the MedGemma **Colab** notebook, installs deps (first run), starts the app, opens the browser. AI endpoint auto‑syncs. |
| **`build-and-start.bat`** | Production build + `npm start` (snappier, optimized). |

There's also an **"Aura Viewer"** desktop shortcut (points at `start-all.bat`). Close the terminal window to shut it all down.

---

## 🔑 The `.env.local` situationship

Pop a `.env.local` in the project root:

```ini
# ── Auth — Clerk (https://dashboard.clerk.com) ──
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/viewer
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/viewer

# ── AI — MedGemma on Colab (auto endpoint sync, it's magic) ──
AI_PROVIDER=openai
MEDGEMMA_ENDPOINT=                       # leave blank → auto-discovers from ntfy
MEDGEMMA_NTFY_TOPIC=aura-med-9k3f7q2x8w  # must match the Colab notebook
MEDGEMMA_MODEL=medgemma1.5

# ── AI plan B — Google AI Studio (Gemini / Gemma) ──
# AI_PROVIDER=gemini
# GEMINI_API_KEY=                        # free: https://aistudio.google.com/apikey
# GEMINI_MODEL=gemini-2.5-flash          # or gemma-3-27b-it, gemma-4-26b-it, …
```

> The app runs fine with no AI — the **AI** button just says "not connected" until you wire a provider. Clerk keys *are* needed to log in, though.

---

## 🧠 AI on a free Colab GPU (yes, actually free)

Real, medical‑tuned **MedGemma 1.5 4B (vision)**. Free. No local server. No HF token. No credit card. 🆓

1. Run **`start-all.bat`** (it opens the notebook for you), or open [`colab/medgemma_aura_colab.ipynb`](colab/) in Colab yourself.
2. In Colab: **Runtime → Change runtime type → T4 GPU**, then **Runtime → Run all**.
3. The notebook installs **Ollama**, pulls the vision model, tunnels it out via **Cloudflare**, and **auto‑publishes the endpoint** to a private **ntfy.sh** topic.
4. The app **auto‑discovers** it. **No copy‑paste. No `.env` surgery.** Just smash the **AI** button.

**Keep the Colab tab open.** Free runtimes nap when idle — if you get a `530`, Colab dozed off: re‑run the notebook and it re‑syncs itself. 😴

<details>
<summary><b>Why Ollama, and other AI options</b></summary>

| Provider | Setup | The tea |
|---|---|---|
| **MedGemma on Colab** (default) | run the notebook | Real medical model on a **free T4 GPU**, sees images, fast enough. URL auto‑syncs via ntfy. |
| **Gemini / Gemma** | free API key | Hosted, zoomy, generous free tier. General‑purpose (not MedGemma). Set `AI_PROVIDER=gemini`. |
| **MedGemma on HF Space** | deploy [`hf-space/`](hf-space/) | Always on, but CPU‑slow. |

The public MedGemma GGUF loads **text‑only** in Ollama (rude), so Aura uses Ollama's official **`medgemma1.5`** which packs the vision projector. The tunnel uses `--http-host-header localhost:11434` so Ollama stops throwing 403s at the forwarded host.
</details>

---

## 🔬 How the AI reads the WHOLE study without crying

A CT can be **hundreds of slices**. Sending all of them = huge, slow, sad. So Aura plays it smart with **montages**:

1. Grab ~**36 slices spread evenly across the *whole* study** (every series).
2. Render them (with your window) into a few **4×4 grids**, slice numbers labelled.
3. Fire off **one request** with just those grids.

Gemma‑3 vision squishes each image into ~256 tokens, so ~3 montages ≈ **a few hundred tokens** while the model still peeps the entire study. **Whole‑study coverage, one request, low tokens** — with a progress bar so you're not left guessing. Efficiency: unlocked. 🔓

---

## 📑 The report glow-up

- **Auto‑generated** from the AI + your DICOM metadata, then **100% editable** — every patient/study field, Clinical History, Technique, **Findings**, **Impression**.
- **Beautiful HTML**: gradient header band, patient/study info grid, series table, embedded key image, Markdown findings in tidy cards.
- **Print / Save PDF** (button baked right in + print‑friendly CSS) or **Download `report.html`**.
- Two ways in: the toolbar **Report** button (blank canvas) or automatically **right after AI** (pre‑filled and ready).

---

## ⌨️ Controls & shortcuts (muscle memory unlocked)

**Mouse (PACS‑standard, as the gods intended):**

| Input | Action |
|---|---|
| **Wheel** | Scroll slices *(flip to Zoom in the toolbar)* |
| **Left‑drag** | Window/Level (brightness + contrast) |
| **Right‑drag** | Zoom |
| **Middle‑drag** | Pan |

**Keyboard** (hit `?` in the viewer for the full cheat sheet):

| Key | Action | Key | Action |
|---|---|---|---|
| `↑ ↓ ← →` | Prev / next slice | `Space` | Play / pause cine |
| `+` / `−` | Zoom in / out | `Ctrl/⌘ + C` | Copy current image |
| `R` | Reset view | `I` | Invert |
| `O` | Toggle overlays | `F` | Fullscreen |
| `1–9, 0` | Pick a tool | `?` | Shortcuts help |

---

## 🛠 Under the hood

```
app/
  (app)/viewer          ← the workstation (one module, does it all)
  (app)/settings        ← profile, role & account (Clerk)
  login / signup        ← Clerk auth (email/password, Google SSO, reset)
  api/analyze           ← provider-agnostic AI endpoint (+ ntfy auto-discovery)
components/
  viewer/Viewer.tsx     ← Cornerstone engine, tools, overlays, cine, export, report
  Sidebar · Topbar · Dropzone · ui …
lib/
  cornerstoneSetup.ts   ← engine bootstrap (WADO worker, tool styling)
  loadStudy.ts          ← DICOM/ZIP ingest, tag extraction, series grouping, orientation
colab/                  ← MedGemma Colab notebook (Ollama + auto endpoint sync)
hf-space/               ← backup MedGemma server (Docker, HF Space)
public/cornerstone/     ← WADO web-worker bundle · gif.worker.js
```

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Cornerstone.js (`cornerstone-core` / `-tools` / `-wado-image-loader` / `-web-image-loader`) · `dicom-parser` · `jszip` · `utif` · `gif.js` · framer‑motion · Clerk · Zustand.

---

## 🔒 Privacy (we're not weird about your data)

- All imaging is decoded and rendered **client‑side**. Pixels never leave your browser unless **you** hit AI (which only sends a few sampled, windowed montage images).
- **No backend storage** — refresh the tab and the session's gone. Profile/role live on your Clerk account.
- Built with HIPAA/GDPR‑minded workflows in mind.

> ⚠️ **Not a certified medical device.** Research / education / workflow only. AI output is **decision support, not a diagnosis** — always double‑check against the full study. 🩺

---

## 🧭 Roadmap & receipts

- **Pyramidal whole‑slide** pathology (`.svs`) — not yet (baseline TIFF is). Needs a tiling viewer.
- **MPR / 3D** (multi‑planar, MIP, volume rendering) — coming eventually™.
- Colab endpoints are **ephemeral** (per session); auto‑sync covers the URL change, but the runtime's gotta be awake.
- On the wishlist: MPR & multi‑pane layouts, cross‑series reference lines, montage tiles inside the report, clinic letterhead, light theme.

---

## 📄 License & the "please don't sue us" disclaimer

[MIT](LICENSE) © 2026 — with a medical‑use disclaimer in the license file.

**This software is for research, education, and workflow purposes only. It is not a certified medical device and is not intended for primary diagnosis or treatment decisions. Any AI‑generated output is decision support only and must be verified by a qualified clinician.**

<br>

<div align="center">

### Designed with <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif" alt="❤️" width="26" height="26"> by <a href="https://github.com/ys941"><b>Yati Bhardwaj</b></a>

<sub>build cool things · stay curious · touch grass occasionally 🌱</sub>

</div>
