# Deploy MedGemma on a free Hugging Face CPU Space

This makes **real MedGemma 1.5 4B** live with a free, hosted, OpenAI-compatible endpoint.
No local server. Slow on free CPU, but free.

## 1. Create the Space (web — easiest)
1. Sign in / create a free account at https://huggingface.co
2. Go to https://huggingface.co/new-space
3. Settings:
   - **Owner**: you   **Space name**: `medgemma-server`
   - **SDK**: **Docker**  →  template **Blank**
   - **Hardware**: **CPU basic** (free)
   - **Visibility**: Public (so the app can reach it with no token)
4. Create the Space.

## 2. Add the two files
In the new Space → **Files** → **Add file** → **Create a new file**, create:
- `Dockerfile`  → paste the contents of `hf-space/Dockerfile`
- `README.md`   → paste the contents of `hf-space/README.md`

(Or `git clone` the Space repo, copy both files in, `git push`.)

## 3. Wait for the build
The Space builds, then on the first request downloads the model (~3 GB) and loads it.
First call can take several minutes; after that it stays warm until idle.

## 4. Point the app at it
Your endpoint is:
`https://<your-username>-medgemma-server.hf.space/v1/chat/completions`

In the app's `.env.local`:
```
AI_PROVIDER=openai
MEDGEMMA_ENDPOINT=https://<your-username>-medgemma-server.hf.space/v1/chat/completions
MEDGEMMA_MODEL=medgemma
```
Restart: `npm run dev`, then click **AI** on a study.

## Notes
- Free CPU is slow; the app sends only a couple of images for the MedGemma path.
- If the Space errors on memory, change `:Q4_K_M` to `:Q3_K_M` in the Dockerfile.
- Free Spaces sleep when idle — the first call after sleep returns "waking up"; retry in ~1 min.
