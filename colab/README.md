# MedGemma on Google Colab (free GPU) → Aura

Run real **MedGemma 1.5 (vision)** on Colab's free T4 GPU and connect it to the app —
free, GPU-fast, no Hugging Face token needed.

## One-click

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/gist/ys941/5d09f9d6abd2e8422baa7a072cd061b6/medgemma_aura_colab.ipynb)

`start-all.bat` opens this exact link for you automatically.

## Steps
1. Open the notebook (badge above, or `start-all.bat` opens it).
2. **Runtime → Change runtime type → T4 GPU**.
3. **Runtime → Run all.** It installs Ollama + pulls `medgemma1.5` (a few minutes, once per session).
4. The notebook **auto-publishes** the live endpoint to the app — no copy/paste, no `.env` editing.
   The app auto-discovers it via the shared ntfy topic. Just open a study and click **AI**.

Uses Ollama's official **`medgemma1.5`** model, which is **vision-capable** (bundles the projector) —
so it actually reads the images, not just text.

## Notes
- **Keep the Colab tab open** — the endpoint lives only while the runtime runs. The URL changes each
  session, but the app re-syncs automatically (via ntfy), so you don't touch anything.
- Colab free runtimes time out after idle / ~12 h — just **Run all** again; the app re-syncs.
- Seeing a `530` in the app? The Colab runtime went to sleep — re-run the notebook.
- This is the **fast** option; the CPU-only Hugging Face Space (see [`../hf-space/`](../hf-space/))
  is the always-on but slower alternative.
