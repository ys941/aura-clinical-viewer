---
title: MedGemma Server
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# MedGemma 1.5 4B — OpenAI-compatible server (free CPU)

Serves [`unsloth/medgemma-1.5-4b-it-GGUF`](https://huggingface.co/unsloth/medgemma-1.5-4b-it-GGUF)
via [llama.cpp](https://github.com/ggml-org/llama.cpp) with an OpenAI-compatible API.

**Endpoint:** `https://<your-username>-<space-name>.hf.space/v1/chat/completions`

Vision-capable (the mmproj is auto-loaded), so you can POST chat messages with
`image_url` content. Runs on the **free CPU tier** — first request is slow while the
model downloads and loads, and responses take ~1 min+ per image. For speed, use fewer
images per request.

Point the Aura app at this Space:

```
AI_PROVIDER=openai
MEDGEMMA_ENDPOINT=https://<your-username>-<space-name>.hf.space/v1/chat/completions
MEDGEMMA_MODEL=medgemma
```
