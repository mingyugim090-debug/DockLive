# ARCHITECTURE.md — 시스템 아키텍처

---

## 🏗️ 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                       │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                          │
│                    Next.js 14 App Router                      │
│                                                              │
│  [/]           메인 랜딩 + PDF 업로드 화면                    │
│  [/result/id]  분석 결과 (타임라인·체크리스트·문서 틀)         │
└───────────────────┬─────────────────────────────────────────┘
                    │ REST API (JSON)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Render)                           │
│                    FastAPI + Python 3.11                      │
│                                                              │
│  POST /api/analyze   PDF 수신 + 분석 통합 엔드포인트          │
│  GET  /api/result/id 분석 결과 조회                           │
│  GET  /health        헬스체크                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ pdf_parser   │  │openai_service│  │    analyzer      │  │
│  │ (PyMuPDF)    │→ │ (OpenAI SDK) │→ │(후처리·D-Day계산) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS API
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  OpenAI API (ChatGPT 모델)                    │
│                  gpt-4o-mini                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 요청 흐름 상세

### 공고문 분석 플로우

```
1. 사용자가 PDF 파일을 DropZone에 드롭

2. Frontend
   └─ FormData로 파일 패키징
   └─ POST /api/analyze 요청

3. Backend - upload 검증
   ├─ 파일 형식 확인 (PDF만)
   ├─ 파일 크기 확인 (20MB 이하)
   └─ 바이트 읽기

4. Backend - PDF 파싱 (pdf_parser.py)
   └─ PyMuPDF로 페이지별 텍스트 추출
   └─ 빈 텍스트면 에러 반환

5. Backend - AI 분석 (openai_service.py)
   └─ 추출된 텍스트를 OpenAI API에 전송
   └─ JSON 응답 수신 + 파싱

6. Backend - 후처리 (analyzer.py)
   ├─ 날짜 → D-Day 계산
   ├─ D-Day 상태 분류 (safe/warning/danger/passed)
   ├─ 결과에 UUID 부여
   └─ 메모리 캐시에 저장

7. Frontend
   └─ 분석 결과 수신
   └─ /result/{id}로 리다이렉트
   └─ Zustand 스토어에 결과 저장

8. 결과 페이지 렌더링
   ├─ STEP 1: 타임라인 컴포넌트
   ├─ STEP 2: 체크리스트 컴포넌트
   └─ STEP 3: 문서 틀 컴포넌트
```

---

## 📁 디렉토리 구조 (상세)

```
dock-live/
│
├── 📄 render.yaml
├── 📁 files/
│   ├── README.md
│   ├── CODEX.md
│   ├── SKILLS.md
│   ├── TASKS.md
│   ├── ARCHITECTURE.md
│   └── deployment_guide.md
│
├── 🎨 frontend/
│   ├── app/
│   │   ├── layout.tsx              # 루트 레이아웃 (폰트, 메타태그)
│   │   ├── page.tsx                # 메인 랜딩 페이지
│   │   ├── result/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # 분석 결과 페이지
│   │   └── globals.css             # CSS 변수, 전역 스타일
│   │
│   ├── components/
│   │   ├── upload/
│   │   │   ├── DropZone.tsx        # 드래그앤드롭 파일 업로드
│   │   │   └── UploadProgress.tsx  # 분석 진행 상태 표시
│   │   │
│   │   ├── timeline/
│   │   │   ├── Timeline.tsx        # 타임라인 전체 레이아웃
│   │   │   └── TimelineItem.tsx    # 개별 일정 아이템 (날짜 + D-Day)
│   │   │
│   │   ├── checklist/
│   │   │   ├── Checklist.tsx       # 체크리스트 (필수/선택 섹션)
│   │   │   ├── CheckItem.tsx       # 개별 체크 항목
│   │   │   └── Tooltip.tsx         # AI 설명 툴팁
│   │   │
│   │   ├── document/
│   │   │   ├── DocTemplate.tsx     # 문서 틀 전체
│   │   │   └── SectionCard.tsx     # 섹션 카드 (제목 + 힌트)
│   │   │
│   │   └── ui/                     # 공통 UI 컴포넌트
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Progress.tsx
│   │       └── StepIndicator.tsx   # 상단 단계 표시 바
│   │
│   ├── lib/
│   │   ├── api.ts                  # 모든 API 호출 함수 (단일 진입점)
│   │   ├── store.ts                # Zustand 전역 상태
│   │   ├── types.ts                # TypeScript 타입 정의
│   │   └── utils.ts                # D-Day 계산, 날짜 포맷 등
│   │
│   ├── .env.local                  # 환경변수 (git 제외)
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── ⚙️ backend/
    ├── main.py                     # FastAPI 앱 초기화, 라우터 등록
    │
    ├── routers/
    │   ├── analyze.py              # POST /api/analyze, GET /api/result/{id}
    │   └── demo.py                 # GET /api/demo
    │
    ├── services/
    │   ├── pdf_parser.py           # PyMuPDF 텍스트 추출
    │   ├── openai_service.py       # OpenAI API 연동
    │   └── analyzer.py             # D-Day 계산, 후처리
    │
    ├── models/
    │   └── schemas.py              # Pydantic 스키마 전체 정의
    │
    ├── core/
    │   ├── config.py               # 환경변수 (pydantic-settings)
    │   └── errors.py               # 커스텀 예외 클래스
    │
    ├── .env                        # 환경변수 (git 제외)
    ├── requirements.txt
    └── Dockerfile
```

---

## 🔌 API 명세

### POST /api/analyze
공고문 PDF를 분석하여 결과를 반환합니다.

**Request**
```
Content-Type: multipart/form-data
Body: file (PDF, max 20MB)
```

**Response 200**
```json
{
  "id": "uuid-v4",
  "doc_type": "competition",
  "title": "2025 청년 창업 아이디어 공모전",
  "organization": "서울특별시",
  "timeline": [
    {
      "label": "접수 시작",
      "date": "2025-05-01",
      "d_day": 3,
      "is_deadline": false,
      "status": "warning"
    },
    {
      "label": "서류 마감",
      "date": "2025-05-15",
      "d_day": 17,
      "is_deadline": true,
      "status": "safe"
    }
  ],
  "checklist": [
    {
      "id": "item-1",
      "label": "사업계획서",
      "category": "required",
      "description": "A4 10매 이내, 지정 양식 사용",
      "file_format": "PDF, HWP"
    },
    {
      "id": "item-2",
      "label": "팀원 재학증명서",
      "category": "required",
      "description": "발급일 3개월 이내",
      "file_format": "PDF"
    }
  ],
  "document_template": [
    {
      "id": "sec-1",
      "title": "문제 정의",
      "hint": "해결하려는 사회적 문제와 현황을 데이터와 함께 서술하세요.",
      "order": 1
    },
    {
      "id": "sec-2",
      "title": "솔루션 제안",
      "hint": "우리 팀이 제안하는 해결책과 차별점을 명확하게 작성하세요.",
      "order": 2
    }
  ],
  "analyzed_at": "2025-04-28T12:00:00Z"
}
```

**Response 400** — 잘못된 파일 형식  
**Response 413** — 파일 크기 초과  
**Response 422** — 텍스트 추출 불가 (스캔 PDF)  
**Response 500** — OpenAI API 오류

---

### GET /api/result/{id}
분석 결과를 조회합니다.

**Response 200** — 위 분석 결과와 동일  
**Response 404** — 결과 없음 (만료 또는 잘못된 ID)

---

## 💾 데이터 저장 전략 (MVP)

### v1.0 — 인메모리 캐시
```python
# 서버 메모리에 딕셔너리로 저장
results_cache: dict[str, AnalysisResult] = {}

# 단점: 서버 재시작 시 사라짐
# MVP에서는 허용 (링크 공유 후 바로 사용하는 패턴)
```

### v2.0 — Supabase 연동 (예정)
```
로그인 기능 추가 시 PostgreSQL(Supabase)로 마이그레이션
분석 결과 영구 저장 + 히스토리 기능
```

---

## 🔐 보안 고려사항

| 항목 | 처리 방법 |
|------|----------|
| API Key 노출 | 환경변수, 서버사이드에서만 사용 |
| 파일 업로드 악용 | 파일 형식 + 크기 제한 |
| CORS | 허용 도메인만 화이트리스트 |
| 업로드 파일 보관 | 분석 후 즉시 메모리에서 제거 (저장 안 함) |
| Rate Limiting | v2.0에서 추가 예정 |

---

## 📊 성능 목표

| 지표 | 목표 |
|------|------|
| PDF 텍스트 추출 | < 2초 |
| OpenAI API 분석 | < 15초 |
| 전체 분석 응답 | < 20초 |
| 페이지 로드 (FCP) | < 1.5초 |
