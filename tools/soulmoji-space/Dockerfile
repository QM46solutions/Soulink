# Soulink AI on a free Hugging Face Space (CPU basic: 2 vCPU, 16 GB RAM): Soulmoji expressions + voice translator.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl unzip zstd procps && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /app
RUN pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir numpy==1.26.4 opencv-python-headless==4.10.0.84 onnxruntime==1.18.0 onnx==1.16.1 pyyaml scipy==1.13.1 \
    scikit-image==0.24.0 imageio==2.34.2 rich==13.7.1 tyro==0.8.5 tqdm pillow pykalman==0.9.7 requests huggingface_hub typing_extensions \
    transformers==4.44.2 sentencepiece protobuf av==12.3.0 uroman
# LivePortrait source + model files (downloaded while the Space builds, ~700 MB)
RUN curl -fsSL https://github.com/KwaiVGI/LivePortrait/archive/refs/heads/main.zip -o lp.zip && unzip -q lp.zip && mv LivePortrait-main LivePortrait && rm lp.zip
COPY get_weights.py ./
RUN python get_weights.py
# Argue referee: the same free model as on the laptop (Ollama + Llama 3.2 3B), pulled while the Space builds
ENV OLLAMA_MODELS=/app/ollama
RUN curl -fsSL https://ollama.com/install.sh | sh \
 && (ollama serve > /tmp/ollama.log 2>&1 &) && sleep 8 && ollama pull llama3.2:3b && ollama list | grep -q llama3.2 && (pkill ollama || true)
COPY soulmoji_ai.py space_server.py ./
RUN chown -R user /app
USER user
ENV OMP_NUM_THREADS=2
EXPOSE 7860
CMD ["python", "space_server.py"]
