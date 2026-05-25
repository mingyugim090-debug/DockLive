FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN git clone --depth 1 https://github.com/jkf87/hwp2hwpx-python-refactor.git /app/hwpx_toolchain/.hwp2hwpx-repo
ENV HWP2HWPX_DIR=/app/hwpx_toolchain/.hwp2hwpx-repo

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
