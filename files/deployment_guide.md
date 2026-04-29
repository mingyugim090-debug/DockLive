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

## STEP 2 — Render 백엔드 배포

> 무료 티어 사용. 15분 비활성 시 슬립 → 첫 요청 콜드스타트 약 30~50초

### 2-1. Render 프로젝트 생성

1. [render.com](https://render.com) → **New +** → **Web Service**
2. **Build and deploy from a Git repository** 선택
3. GitHub 계정 연결 후 `DockLive` 저장소 선택 → **Connect**
4. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| **Name** | `livedock-backend` |
| **Root Directory** | `backend` |
| **Runtime** | `Docker` (자동 감지) |
| **Instance Type** | `Free` |

### 2-2. 환경변수 설정

**Environment** 탭에서 아래 값 입력:

| 키 | 값 |
|----|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (실제 키) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (Vercel 배포 후 업데이트) |
| `MAX_PDF_SIZE_MB` | `20` |
| `MOCK_MODE` | `false` |

### 2-3. 배포 확인

- **Create Web Service** 클릭 → Dockerfile로 자동 빌드 시작 (3~5분 소요)
- 배포 완료 후 상단 URL 기록: `https://livedock-backend.onrender.com`
- 헬스체크 확인:
  ```
  GET https://livedock-backend.onrender.com/health
  → {"status": "ok", "service": "LiveDock API"}
  ```

> [!NOTE]
> 무료 플랜은 슬립 모드가 있어 첫 요청이 느릴 수 있습니다.
> 실제 서비스 전환 시 Render Starter ($7/월) 또는 Vercel Fluid Compute 고려.

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

Render 백엔드로 돌아가 `FRONTEND_URL` 환경변수를 Vercel 실제 URL로 업데이트:

```
FRONTEND_URL=https://livedock-xxxx.vercel.app
```

→ Render가 자동 재배포 트리거

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
Render Logs에서 확인 후 requirements.txt의 PyMuPDF 버전 고정:
PyMuPDF==1.25.5  (wheel 지원 확인 필요)
```

### 콜드스타트 (무료 플랜)

Render 무료 플랜은 15분 비활성 시 슬립 → 첫 요청 30~50초 지연.
- 해결: Render Starter 플랜($7/월) 업그레이드
- 임시 해결: UptimeRobot 등으로 14분 간격 헬스체크 핑 설정

### CORS 오류

브라우저 콘솔에서 CORS 오류 발생 시:
1. Render `FRONTEND_URL` 값이 Vercel URL과 정확히 일치하는지 확인
2. `https://` 프로토콜 포함 여부 확인
3. 후행 슬래시(`/`) 없이 설정

### 분석 실패 (500 오류)

1. Render Environment에서 `MOCK_MODE=false` 확인
2. `ANTHROPIC_API_KEY`가 정확한지 확인
3. Render Logs에서 실제 오류 메시지 확인

---

## 배포 후 환경변수 최종 정리

### Render (백엔드)
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
FRONTEND_URL=https://livedock-xxxx.vercel.app
MAX_PDF_SIZE_MB=20
MOCK_MODE=false
```

### Vercel (프론트엔드)
```env
NEXT_PUBLIC_API_URL=https://livedock-backend.onrender.com
```
