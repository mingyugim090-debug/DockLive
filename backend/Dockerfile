# Railway / 프로덕션 배포용 Dockerfile
# PyMuPDF는 공식 wheel을 사용하므로 빌드 시 libmupdf-dev 불필요
FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 (최소화 — PyMuPDF wheel이 바이너리 포함)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 의존성 먼저 설치 (레이어 캐시 최적화)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사 (.dockerignore로 불필요한 파일 제외)
COPY . .

# 포트 노출
EXPOSE 8000

# Railway는 $PORT 환경변수를 주입함
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
