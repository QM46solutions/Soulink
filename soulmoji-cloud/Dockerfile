# Soulmoji AI for Azure Container Apps (CPU). Built by .github/workflows/soulmoji-ai.yml from the repo root:
#   docker build -f soulmoji-cloud/Dockerfile .
# Same Python packages and the same LivePortrait code as the laptop install (tools/soulmoji-ai/install.ps1).
FROM python:3.11-slim
LABEL org.opencontainers.image.source=https://github.com/QM46solutions/Soulink org.opencontainers.image.description="Soulmoji AI (LivePortrait) for Soulink"
ENV PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu \
 && pip install numpy==1.26.4 opencv-python-headless==4.10.0.84 onnxruntime==1.18.0 onnx==1.16.1 pyyaml==6.0.1 scipy==1.13.1 \
    scikit-image==0.24.0 imageio==2.34.2 rich==13.7.1 tyro==0.8.5 tqdm pillow pykalman==0.9.7 huggingface_hub==0.36.2 typing_extensions
WORKDIR /app
# LivePortrait source (MIT, https://github.com/KwaiVGI/LivePortrait): the copy the laptop runs
COPY soulmoji-cloud/LivePortrait ./LivePortrait
COPY soulmoji-cloud/get_weights.py ./
RUN python get_weights.py && rm get_weights.py
# the expression recipes: the very same file the laptop uses
COPY tools/soulmoji-ai/soulmoji_ai.py soulmoji-cloud/server.py ./
RUN useradd -m -u 1000 app && chown -R app /app
USER app
ENV OMP_NUM_THREADS=2 PORT=7860
EXPOSE 7860
CMD ["python", "server.py"]
