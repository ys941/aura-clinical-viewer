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
- **The AI reads it like a radiologist** — full‑res for 2D, 3‑window RGB for CT, every slice by view — then reads first, **asks the questions its findings raise**, and re‑reads for a formal report.
- **Pin the exact slices** you care about (across films) for a focused full‑resolution read, or **chat** with the floating **Siri‑style assistant** — drop/paste/upload any image and ask in **any language**.
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
- **Live AI health badge** (top‑right): a colorful pill that auto‑polls your model — 🟢 Live / 🟡 Warming / 🔴 Offline — with a one‑click "Open Colab" when it's asleep.

### 🎞 Cine + export for the slides
Play multi‑frame runs (FPS control + scrubber), then **export a run** — whole thing, a **range**, or a single slide — as an animated **GIF** or a **PNG zip**. Yeet it straight into PowerPoint/Word. 🎬

### 🤖 AI that actually reads the study — the MedGemma way
One click → analysis kicks off with a **colorful rotating ring** + progress bar, powered by **MedGemma 1.5 4B (vision)** or Gemini/Gemma. It's tuned to how MedGemma actually works:
- **2D studies (CXR, X‑ray, derm, fundus, path, plain images)** → each image sent at **full 896×896** (MedGemma's strongest, native input) — no shrinking into tiles.
- **CT** → the **official 3‑window→RGB** preprocessing (bone/lung · soft‑tissue · brain), every slice.
- **MR / volumetric** → compact tiles covering **every slice**, grouped **by view** (Axial / Coronal / Sagittal, derived from `ImageOrientationPatient`, never by series name).

It reads the study like a radiologist writes it: **Findings by anatomical structure**, numbered **Impression**, **Recommendations**, and a **Key Images** list — with the model's "thinking"/teaching/junk tokens stripped out.

### 🎯 Pin exactly what matters (highest accuracy)
Scroll to any slice and hit **Pin** (or press **`P`**) — across **any films/series** of the patient. Pin 8–10 and the **AI** button flips to **"Analyze N pinned"**: it reads *only* those, each at **full 896 resolution** (CT = 3‑window RGB). Nothing pinned → it reads the whole study. Human‑in‑the‑loop, no triage miss.

### ❓ Asks, then re‑reads — for an accurate report
No generic questions up front. It **reads first**, then asks the **clinical questions its findings actually raised** (smoking history? prior malignancy? symptom duration?) — fully skippable. Your answers trigger a **full‑resolution re‑analysis of the key slices** → a sharper final report.

### 💬 Aura Assistant — the floating Siri orb
A glowing animated orb bottom‑right. **Drop, paste, or upload** any medical image and **chat** about it in **any language** (it mirrors yours). Multi‑turn, image‑aware. Pick its brain in **Settings → AI Assistant**: **MedGemma**, **Gemini**, or **Groq** (model lists are pulled live from each provider; keys stay in your browser). And it can **drive the app for you** — see below.

### 📋 A report that looks like a real radiology report
After analysis the **editable report opens itself** — a formal **letterhead layout** (your centre + reporting doctor, remembered on your device), patient table, exam title, **Clinical History → Findings → Impression → Advice → Key Images gallery**, signature block, and "electronically verified." Export a styled standalone **`report.html`** with a built‑in **🖨 Print / Save PDF** button. Format follows the **ACR / RSNA** structured‑reporting standard.

### 🔐 Auth + settings, no cap
**Clerk** handles login — email/password **and Google SSO** + password reset. Settings let you change your photo, name, role, org (stored on your account, not some database).

---

## 🧠 The two AIs (and what each one does)

Aura has **two separate AI brains** — don't mix them up:

### 1) The Imaging AI — *reads pictures, writes reports*
This is the **AI** button in the viewer. It looks at the pixels and produces a radiology report. **It does not control the app** — it only reads and writes findings.

- **Providers:** MedGemma 1.5 (free, on Colab) · Gemini / Gemma.
- **What it does:** reads the **whole study** or your **pinned slices** → **Findings** (by anatomical structure) · **Impression** · **Recommendations** · **Key Images**; asks the **clinical questions** its findings raise, then **re‑reads at full resolution** for a sharper report; renders the editable, printable report.
- **Input smarts:** 2D (CXR/derm/etc.) at full **896**, **CT with 3‑window RGB**, MR/volumetric every slice by view.

### 2) The Aura Assistant — *chats, and drives the whole app*
This is the **floating orb**. It talks to you about images **and** can **operate the app on your command** (natural language, any language). Choose its model in **Settings → AI Assistant**.

| Provider | Chat | Reads images | **Controls the app** |
|---|---|---|---|
| **MedGemma** | weak (it's a vision model) | ✅ best for medical images | ❌ |
| **Gemini** | ✅ excellent, multilingual | ✅ | ✅ |
| **Groq** (Llama) | ✅ excellent, very fast | ✅ *(vision models only)* | ✅ |

**What the Assistant can control** (on Gemini or Groq) — just say it in plain language:

- **Profile:** name · role · organization → *"set my role to Radiologist"*
- **Report letterhead:** centre name · address · doctor name · qualifications → *"reporting doctor Dr. A. Sharma, MD, Reg 12345"*
- **Its own model/keys:** *"use gemini"* · *"use groq"* · *"my key is …"* · *"switch to gemini‑2.5‑pro"*
- **The viewer:**
  - **Window/level:** *"apply lung window"* · *bone · brain · soft tissue · CT angio*
  - **Navigation:** *"next slice"* · *previous · first · last*
  - **Display:** *"invert"* · *"turn off overlays"* · *"go fullscreen"* · *"reset the view"* · *"wheel to zoom / scroll"*
  - **Actions:** *"analyze the whole study"* · *"analyze pinned images"* · *"open the report"*

> ⚠️ Config‑by‑chat needs **Gemini or Groq** (MedGemma can't do reliable command extraction). Viewer commands only act when a study is open. Everything is whitelisted server‑side; keys never leave your browser.

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
| **`setup-and-run.bat`** 🪄 | **Zero‑to‑running.** Installs **Node.js** if you don't have it, installs all deps, writes a `.env.local` with everything pre‑filled **except** your two Clerk keys (opens Clerk + Notepad for you), opens Colab, and launches the app. You literally only paste the keys. |
| **`start-all.bat`** ⭐ | Everyday launcher (Node already installed) — opens the MedGemma **Colab** notebook, installs deps first run, starts the app, opens the browser. `start-all.bat prod` = optimized build. |

First time on a fresh machine? Use **`setup-and-run.bat`**. After that, **`start-all.bat`** is your daily driver. Close the terminal window to shut it all down.

---

## ☁️ Ship it (Vercel / Railway)

Aura is a standard Next.js app — deploys to both in a couple of clicks. Set the [env vars](#-the-envlocal-situationship) in the host's dashboard (never commit secrets; `.env.local` is gitignored).

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ys941/aura-clinical-viewer&env=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,AI_PROVIDER,MEDGEMMA_NTFY_TOPIC,MEDGEMMA_MODEL&envDescription=Clerk%20keys%20%2B%20AI%20config&project-name=aura&repository-name=aura)
&nbsp;&nbsp;
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/new)

</div>

> The buttons work for **you** (the repo owner) since the repo is private — you'll be asked to sign in / grant access and to enter the env vars.

### ▲ Vercel
1. Click **Deploy with Vercel** above (or **Import** at [vercel.com/new](https://vercel.com/new) — auto‑detects Next.js).
2. Enter the env vars it prompts for (Clerk + AI).
3. **Deploy.** Done — Vercel handles build + hosting.
   > ⏱ **Heads‑up:** MedGemma's first call cold‑starts (~1 min), which can exceed Vercel's serverless function timeout on the **Hobby** plan. On Vercel, prefer **`AI_PROVIDER=gemini`** (fast), or use Railway / a paid plan for the MedGemma path.

### 🚂 Railway
1. **New Project → Deploy from GitHub repo** at [railway.app](https://railway.app).
2. Add the env vars. Railway auto‑builds (Nixpacks) and runs `npm run build` → `npm run start`.
3. The app binds to Railway's injected **`$PORT`** automatically (the `start` script is `next start`). No timeout issues — great for the **MedGemma** path.

### Env vars to set (both hosts)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login          NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/viewer
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/viewer
AI_PROVIDER   MEDGEMMA_NTFY_TOPIC   MEDGEMMA_MODEL   (+ MEDGEMMA_ENDPOINT or GEMINI_API_KEY/GEMINI_MODEL)
```

> 🔐 Using **Clerk test keys** works anywhere. For a real production domain, add that domain in your Clerk dashboard (and switch to `pk_live`/`sk_live`).
> 🩻 Imaging still runs **100% in the browser** even when hosted — the server only relays AI requests.

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

A CT can be **hundreds of slices**. Sending them one‑by‑one = huge, slow, sad. So Aura plays it smart with **view‑grouped montages** — and covers **every single slice**:

1. **Group by view** — each slice is bucketed into its anatomical plane (Axial / Coronal / Sagittal), derived from the DICOM `ImageOrientationPatient`. No 3D orientation (X‑ray/US)? Each acquisition stays its own projection.
2. **Tile every slice at high resolution** — all of a view's slices are packed into montage grids (a few slices per grid, **large tiles** for fine detail), each with a **banner naming the view** and every tile stamped with its **slice number**. Nothing is sampled away.
3. **Analyze in batches** — the montages go to the model in small batches (few images each), so **every slice is read at full detail** instead of squashed into one request. Each batch returns partial findings.
4. **Synthesize** — a final pass merges all the batch notes into one clean report (Technique · per‑view Findings · Impression · Key Images), de‑duplicating across batches.

Result: **every slice, at high resolution, grouped by view** — a few requests instead of one, with a colorful rotating ring + "batch k/N" progress so you're never guessing. Accuracy over shortcuts. 🔬 (Bigger studies take longer — that's the honest cost of reading everything properly.)

---

## 📑 The report glow-up

- **Auto‑generated** from the AI + your DICOM metadata, then **100% editable** — every patient/study field, Clinical History, Technique, per‑view **Findings**, **Impression**.
- **Beautiful HTML**: gradient header band, patient/study info grid, series table, per‑view Markdown findings in tidy cards, and a **Key Images gallery** — thumbnails of the exact slices the AI flagged, captioned with slice # + view.
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
