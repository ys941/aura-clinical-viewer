# MedGemma on Google Colab (free GPU) → Aura

Run real **MedGemma 1.5 4B (vision)** on Colab's free T4 GPU and connect it to the app.
Fast (GPU), free, and no Hugging Face token needed (uses the public `unsloth/medgemma-1.5-4b-it-GGUF`).

## Steps
1. Open **[`medgemma_aura_colab.ipynb`](medgemma_aura_colab.ipynb)** in Google Colab
   (colab.research.google.com → **File → Upload notebook**, or open it from this repo).
2. **Runtime → Change runtime type → T4 GPU**.
3. **Runtime → Run all.** First run builds llama.cpp with CUDA (~10–15 min, once per session).
4. The last cell prints:
   ```
   MEDGEMMA_ENDPOINT=https://xxxx.trycloudflare.com/v1/chat/completions
   ```
5. In the app's `.env.local`:
   ```ini
   AI_PROVIDER=openai
   MEDGEMMA_ENDPOINT=https://xxxx.trycloudflare.com/v1/chat/completions
   MEDGEMMA_MODEL=medgemma
   ```
   Restart the app (`npm run dev` / `start-all.bat`) → open a study → click **AI**.

## Notes
- **Keep the Colab tab open** — the endpoint lives only while the runtime runs, and the URL changes each session (paste the new one each time).
- Colab free runtimes time out after idle / ~12 h — just re-run the notebook and update the URL.
- If you hit GPU memory limits, change `medgemma-1.5-4b-it-Q4_K_M.gguf` to `...-Q3_K_M.gguf` in the download cell.
- This is the **fast** option; the CPU-only Hugging Face Space (see [`../hf-space/`](../hf-space/)) is the always-on but slow alternative.
