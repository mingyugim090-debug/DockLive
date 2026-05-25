# LiveDock Frontend

Next.js 14 기반의 LiveDock 사용자 화면입니다.

사용자가 공고문을 업로드하거나 샘플 Agent 흐름을 실행하고, 분석 결과, 체크리스트, 초안, 확인 필요 항목, export 상태를 확인하는 역할을 맡습니다.

## 구조

```text
frontend/
  app/             App Router 페이지와 레이아웃
  components/      화면 단위 UI 컴포넌트
    checklist/     요구사항 체크리스트 UI
    document/      제출 문서 초안 UI
    timeline/      Agent 진행 단계 UI
    ui/            공통 UI 요소
    upload/        파일 업로드 UI
  lib/             API client, result cache, store, shared types
  vercel.json      Vercel frontend build 설정
```

## 실행

```powershell
npm install
copy .env.example .env.local
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 환경변수

`frontend/.env.example`을 기준으로 `frontend/.env.local`을 만듭니다.

- `NEXT_PUBLIC_API_URL`: FastAPI backend base URL

실제 `.env.local`은 커밋하지 않습니다.

## 검증

```powershell
npm run test
npm run build
```

Repository root에서 하네스 profile로 실행할 수도 있습니다.

```powershell
.\scripts\harness.ps1 -Profile frontend
```
