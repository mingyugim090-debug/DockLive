# Dock Live 🚀

> **공고문 PDF를 올리면, AI가 일정·서류·문서 틀을 자동으로 정리해주는 서울과기대 학생 전용 공모전 플랫폼**

---

## 📌 서비스 개요

기존 정부/공모전 공고문은 HWP·PDF 정적 텍스트로 되어 있어 중요 정보를 파악하기 어렵습니다.  
Dock Live는 공고문을 업로드하면 AI가 구조를 분석하여 **인터랙티브 디지털 서비스**로 변환합니다.

### 핵심 가치
- 📄 정적인 공고문 → 동적인 인터랙티브 서비스
- 🤖 AI 자동 분석으로 중요 정보 즉시 파악
- 👥 팀 모집 커뮤니티 연결 (v2.0)

---

## 🎯 타겟 유저

| 단계 | 타겟 |
|------|------|
| v1.0 | 서울과학기술대학교 재학생 |
| v2.0 | 국내 전체 대학생 |

---

## ✨ 핵심 기능

### v1.0 — 문서 변환 툴 (현재 개발 중)

**STEP 1. 인터랙티브 타임라인**
- 공고문 내 모든 일정·날짜를 시각적 로드맵으로 변환
- D-N일 자동 계산 및 마감 임박 강조 표시
- 상대적 날짜 표현 → 절대 날짜 자동 변환

**STEP 2. 서류 준비 체크리스트**
- 필수/선택 서류 자동 분류
- 자격 조건 자가진단 기능
- 항목별 AI 설명 툴팁
- 체크박스로 진행 상황 관리

**STEP 3. 제출 문서 틀 생성**
- 공고 유형 자동 판별 (공모전/연구/장학금/창업)
- 유형별 문서 섹션 구조 자동 생성
- 각 섹션별 작성 힌트 제공

### v2.0 — 공모전 커뮤니티 (예정)
- 학교 이메일 인증 기반 팀 모집 방 개설
- 변환 결과 팀원과 자동 공유
- 오픈카톡 연동 소통

---

## 🗂️ 프로젝트 구조

```
dock-live/
├── frontend/          # Next.js 14 + TypeScript
│   ├── app/
│   │   ├── page.tsx              # 메인 랜딩 (업로드)
│   │   ├── result/[id]/page.tsx  # 변환 결과
│   │   └── layout.tsx
│   ├── components/
│   │   ├── upload/               # 파일 업로드 UI
│   │   ├── timeline/             # 타임라인 컴포넌트
│   │   ├── checklist/            # 체크리스트 컴포넌트
│   │   └── document/             # 문서 틀 컴포넌트
│   └── lib/
│       └── api.ts                # API 호출 함수
│
├── backend/           # FastAPI + Python
│   ├── main.py
│   ├── routers/
│   │   ├── analyze.py            # PDF 업로드 + AI 분석 + 결과 조회
│   │   └── demo.py               # 샘플 Demo 결과
│   ├── services/
│   │   ├── pdf_parser.py         # PDF 텍스트 추출
│   │   ├── openai_service.py     # OpenAI API 연동
│   │   └── analyzer.py           # 공고 분석 로직
│   └── models/
│       └── schemas.py            # Pydantic 스키마
│
├── render.yaml
└── files/
    ├── README.md
    ├── CODEX.md
    ├── SKILLS.md
    ├── TASKS.md
    ├── ARCHITECTURE.md
    └── deployment_guide.md
```

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.11+ |
| **AI** | OpenAI API (ChatGPT 모델, gpt-4o-mini) |
| **PDF 처리** | PyMuPDF (fitz) |
| **상태 관리** | Zustand |
| **배포** | Vercel (Frontend), Render (Backend) |

---

## 🚀 로컬 개발 환경 세팅

### Prerequisites
- Node.js 18+
- Python 3.11+
- OpenAI API Key

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# http://localhost:8000
```

### 환경변수
```bash
# backend/.env
OPENAI_API_KEY=your_api_key_here

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📋 개발 로드맵

| 버전 | 내용 | 상태 |
|------|------|------|
| v0.1 | 프로젝트 하네스 구축 | ✅ 완료 |
| v0.2 | PDF 업로드 + 텍스트 추출 | 🔄 진행 중 |
| v0.3 | OpenAI API 연동 + 분석 | ⏳ 예정 |
| v0.4 | 타임라인 UI | ⏳ 예정 |
| v0.5 | 체크리스트 UI | ⏳ 예정 |
| v0.6 | 문서 틀 생성 UI | ⏳ 예정 |
| v1.0 | MVP 완성 + 배포 | ⏳ 예정 |
| v2.0 | 커뮤니티 기능 추가 | ⏳ 예정 |

---

## 📄 관련 문서

- [CODEX.md](./CODEX.md) — Codex 개발 지침
- [SKILLS.md](./SKILLS.md) — 기술 역량 및 코드 스타일
- [TASKS.md](./TASKS.md) — 개발 태스크 목록
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 아키텍처

### Codex에게 일을 시키는 예시
- "먼저 분석해줘"
- "이 작업을 작은 단위로 계획해줘"
- "수정하고 테스트까지 해줘"
- "커밋 전 변경사항 리뷰해줘"
- "이 파일 기준으로 다음 작업 추천해줘"
