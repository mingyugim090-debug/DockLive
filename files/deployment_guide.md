# LiveDock 배포 가이드 (Railway + Vercel)

> 예상 소요 시간: 약 20~30분

---

## 사전 준비

- [ ] GitHub 계정 및 저장소 생성 완료
- [ ] [railway.app](https://railway.app) 계정 (GitHub 로그인 권장)
- [ ] [vercel.com](https://vercel.com) 계정 (GitHub 로그인 권장)
- [ ] Anthropic API 키 보유

---

## STEP 1 — GitHub 푸시

### 1-1. Git 초기화 및 첫 커밋

```bash
# 프로젝트 루트에서 실행
cd "c:\Users\alseh\OneDrive\바탕 화면\LiveDock"

git init
git add .
git commit -m "feat: LiveDock MVP 초기 커밋"
```

### 1-2. GitHub 원격 저장소 연결

```bash
git remote add origin https://github.com/<USERNAME>/livedock.git
git branch -M main
git push -u origin main
```

> [!IMPORTANT]
> `.env`, `.env.local` 파일이 `.gitignore`에 포함되어 있어 푸시되지 않습니다.
> `git status`로 해당 파일이 **untracked**인지 반드시 확인하세요.

---

## STEP 2 — Railway 백엔드 배포 (P8-02)

### 2-1. Railway 프로젝트 생성

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** 선택
3. `livedock` 저장소 선택
4. **Root Directory** → `backend` 입력

### 2-2. 환경변수 설정 (P8-03)

Railway 대시보드 → **Variables** 탭에서 아래 값 입력:

| 키 | 값 |
|----|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (실제 키) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (Vercel 배포 후 업데이트) |
| `MAX_PDF_SIZE_MB` | `20` |
| `MOCK_MODE` | `false` |

### 2-3. 배포 확인

- Railway가 Dockerfile로 자동 빌드 시작 (2~3분 소요)
- 배포 후 **Settings → Networking → Generate Domain** 클릭
- 부여된 URL 기록: `https://livedock-backend-xxxx.railway.app`
- 헬스체크 확인:
  ```
  GET https://livedock-backend-xxxx.railway.app/health
  → {"status": "ok", "service": "LiveDock API"}
  ```

---

## STEP 3 — Vercel 프론트엔드 배포 (P8-01)

### 3-1. Vercel 프로젝트 생성

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub에서 `livedock` 저장소 가져오기
3. **Root Directory** → `frontend` 입력
4. **Framework Preset** → `Next.js` (자동 감지)

### 3-2. 환경변수 설정

Vercel → **Settings → Environment Variables**:

| 키 | 값 | 환경 |
|----|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://livedock-backend-xxxx.railway.app` | Production, Preview |

### 3-3. 배포

- **Deploy** 버튼 클릭
- 배포 완료 후 URL 기록: `https://livedock-xxxx.vercel.app`

---

## STEP 4 — CORS 업데이트 (P8-03 마무리)

Railway 백엔드로 돌아가 `FRONTEND_URL` 환경변수를 Vercel 실제 URL로 업데이트:

```
FRONTEND_URL=https://livedock-xxxx.vercel.app
```

→ Railway가 자동 재배포 트리거

---

## STEP 5 — 최종 확인

### 기능 체크리스트

- [ ] `https://livedock-xxxx.vercel.app` 접속 → 메인 페이지 로드
- [ ] **"샘플 데이터로 미리보기 (Demo)"** 버튼 클릭 → 결과 페이지 이동
- [ ] 결과 페이지 새로고침 → 404 없이 정상 표시 (localStorage 캐시)
- [ ] 실제 PDF 공고문 업로드 → AI 분석 결과 확인
- [ ] `🔗 공유` 버튼 → URL 복사 후 새 탭에서 접속

### API 엔드포인트 체크

| 엔드포인트 | 예상 응답 |
|------------|-----------|
| `GET /health` | `{"status":"ok"}` |
| `GET /api/demo` | `{"success":true,"data":{...}}` |
| `POST /api/analyze` | PDF 업로드 시 분석 결과 |

---

## 트러블슈팅

### 빌드 실패: PyMuPDF

```
Railway Logs에서 확인 후 requirements.txt의 PyMuPDF 버전 고정:
PyMuPDF==1.25.5  (wheel 지원 확인 필요)
```

### CORS 오류

브라우저 콘솔에서 CORS 오류 발생 시:
1. Railway `FRONTEND_URL` 값이 Vercel URL과 정확히 일치하는지 확인
2. `https://` 프로토콜 포함 여부 확인
3. 후행 슬래시(`/`) 없이 설정

### 분석 실패 (500 오류)

1. Railway Variables에서 `MOCK_MODE=false` 확인
2. `ANTHROPIC_API_KEY`가 정확한지 확인
3. Railway Logs에서 실제 오류 메시지 확인

---

## 배포 후 환경변수 최종 정리

### Railway (백엔드)
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
FRONTEND_URL=https://livedock-xxxx.vercel.app
MAX_PDF_SIZE_MB=20
MOCK_MODE=false
```

### Vercel (프론트엔드)
```env
NEXT_PUBLIC_API_URL=https://livedock-backend-xxxx.railway.app
```
