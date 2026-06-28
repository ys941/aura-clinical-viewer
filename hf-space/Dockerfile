# MedGemma 1.5 4B (vision) served via llama.cpp on a FREE Hugging Face CPU Space.
# Exposes an OpenAI-compatible API at /v1/chat/completions on port 7860.
#
# Uses the public GGUF unsloth/medgemma-1.5-4b-it-GGUF. The -hf flag auto-downloads
# the model AND its multimodal projector (mmproj) for image understanding.

FROM ghcr.io/ggml-org/llama.cpp:server

# Hugging Face Spaces route external traffic to port 7860.
ENV LLAMA_ARG_HOST=0.0.0.0
ENV LLAMA_ARG_PORT=7860
# Cache model downloads under /data (writable on Spaces).
ENV HF_HOME=/data/.cache/huggingface
ENV LLAMA_CACHE=/data/.cache/llama

# Model + context. Q4_K_M is the best size/quality balance for free CPU.
# (Drop to :Q3_K_M if the Space runs out of memory.)
CMD ["-hf", "unsloth/medgemma-1.5-4b-it-GGUF:Q4_K_M", "--ctx-size", "4096", "--jinja", "--no-warmup"]
