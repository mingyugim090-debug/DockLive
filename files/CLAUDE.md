# CLAUDE.md — AI 개발 지침

> 이 파일은 Claude Code 및 AI 어시스턴트가 Dock Live 프로젝트를 개발할 때 반드시 참고해야 하는 핵심 지침입니다.  
> 모든 코드 작성, 구조 설계, 기능 구현 전에 이 파일을 먼저 읽으세요.

---

## 🧠 프로젝트 컨텍스트

**Dock Live**는 공모전·정부사업 공고문(PDF)을 AI가 분석하여 인터랙티브 서비스로 변환하는 웹 애플리케이션입니다.

### 핵심 사용자 흐름
```
PDF 업로드 → AI 분석 → STEP1(타임라인) → STEP2(체크리스트) → STEP3(문서 틀)
```

### 현재 개발 단계
- **v1.0 MVP 개발 중** — 1회성 문서 변환 툴
- 로그인/인증 없음, 커뮤니티 없음 (v2.0에서 추가)

---

## 📁 절대 규칙 (Must Follow)

### 1. 파일 수정 전 확인
- 기존 파일을 수정하기 전에 반드시 파일 전체를 먼저 읽을 것
- 관련 컴포넌트·서비스가 어떻게 연결되어 있는지 파악 후 수정

### 2. 타입 안전성
- TypeScript 사용 시 `any` 타입 절대 사용 금지
- 모든 API 응답에 Pydantic 스키마(백엔드) / TypeScript 인터페이스(프론트) 정의

### 3. 컴포넌트 구조
- 하나의 컴포넌트는 하나의 책임만 가짐
- 200줄 이상의 컴포넌트는 분리 검토
- 재사용 가능한 UI는 `components/ui/`에 배치

### 4. API 연동
- 프론트에서 API 직접 호출 금지 → 반드시 `lib/api.ts`를 통해 호출
- 에러 처리는 모든 API 호출에 필수 포함

### 5. 환경변수
- 민감 정보(API 키 등)는 코드에 하드코딩 절대 금지
- 반드시 `.env` / `.env.local` 파일 사용
- `.env` 파일은 절대 git에 커밋하지 않음

---

## 🎨 디자인 시스템

### 컬러 팔레트
```css
/* Primary */
--primary: #6366F1;        /* Indigo - 메인 액션 버튼, 강조 */
--primary-dark: #4F46E5;   /* Hover 상태 */

/* Background */
--bg-base: #0F0F13;        /* 최외곽 배경 */
--bg-card: #1A1A24;        /* 카드/패널 배경 */
--bg-elevated: #22222F;    /* 입력창, 모달 배경 */

/* Text */
--text-primary: #F1F1F5;   /* 주요 텍스트 */
--text-secondary: #9090A8; /* 보조 텍스트 */
--text-muted: #5A5A72;     /* 비활성 텍스트 */

/* Status */
--success: #22C55E;   /* 완료, 통과 */
--warning: #F59E0B;   /* 마감 임박 (D-7 이하) */
--danger: #EF4444;    /* 마감 (D-3 이하), 에러 */
--info: #3B82F6;      /* 정보, 안내 */

/* Border */
--border: rgba(255,255,255,0.08);
--border-active: rgba(99,102,241,0.5);
```

### 타이포그래피
```css
font-family: 'Pretendard', 'Noto Sans KR', sans-serif;

/* Scale */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
```

### 스페이싱 & 반경
```css
/* 카드 border-radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
```

### 다크 테마 원칙
- 배경은 항상 다크 (#0F0F13 기반)
- 카드는 약간 밝은 다크 (#1A1A24)
- 밝은 테두리(border)로 요소 구분
- 글로우 효과는 primary 컬러로만 사용

---

## 🏗️ 프론트엔드 규칙 (Next.js 14)

### 디렉토리 구조
```
app/
  page.tsx              ← 메인 랜딩 + 업로드
  result/[id]/page.tsx  ← 변환 결과 페이지
  layout.tsx            ← 루트 레이아웃

components/
  upload/
    DropZone.tsx        ← 드래그앤드롭 업로드
    UploadProgress.tsx  ← 업로드 + 분석 진행 상태
  timeline/
    Timeline.tsx        ← 타임라인 전체 래퍼
    TimelineItem.tsx    ← 개별 일정 아이템
  checklist/
    Checklist.tsx       ← 체크리스트 전체
    CheckItem.tsx       ← 개별 체크 항목
    Tooltip.tsx         ← AI 설명 툴팁
  document/
    DocTemplate.tsx     ← 문서 틀 전체
    SectionCard.tsx     ← 섹션 카드
  ui/                   ← 공통 UI 컴포넌트
    Button.tsx
    Card.tsx
    Badge.tsx
    Progress.tsx
    StepIndicator.tsx

lib/
  api.ts               ← 모든 API 호출 함수 (여기서만 fetch)
  utils.ts             ← 날짜 계산, 포맷 등 유틸
  types.ts             ← 전역 TypeScript 타입 정의
```

### 컴포넌트 작성 규칙
```typescript
// ✅ 올바른 예시
interface TimelineItemProps {
  date: string;
  label: string;
  dDay: number;
  isDeadline?: boolean;
}

export function TimelineItem({ date, label, dDay, isDeadline = false }: TimelineItemProps) {
  // ...
}

// ❌ 잘못된 예시 — any 타입, props 타입 미정의
export function TimelineItem(props: any) {
  // ...
}
```

### API 호출 규칙
```typescript
// lib/api.ts에서만 fetch 호출
export async function analyzeDocument(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    throw new Error(`분석 실패: ${res.status}`);
  }
  
  return res.json();
}

// 컴포넌트에서는 이렇게 사용
import { analyzeDocument } from '@/lib/api';
```

---

## ⚙️ 백엔드 규칙 (FastAPI)

### 디렉토리 구조
```
backend/
  main.py               ← FastAPI 앱 초기화, 라우터 등록
  routers/
    upload.py           ← POST /upload (PDF 업로드)
    analyze.py          ← POST /analyze (AI 분석)
    result.py           ← GET /result/{id} (결과 조회)
  services/
    pdf_parser.py       ← PyMuPDF로 텍스트 추출
    claude_service.py   ← Claude API 호출 로직
    analyzer.py         ← 분석 결과 후처리
  models/
    schemas.py          ← Pydantic 스키마 전체
  core/
    config.py           ← 환경변수 설정
    errors.py           ← 커스텀 예외 클래스
```

### Pydantic 스키마 예시
```python
# models/schemas.py

from pydantic import BaseModel
from typing import Optional
from datetime import date

class TimelineItem(BaseModel):
    label: str
    date: date
    d_day: int
    is_deadline: bool = False
    status: str  # "upcoming" | "warning" | "danger" | "passed"

class ChecklistItem(BaseModel):
    id: str
    label: str
    category: str  # "required" | "optional"
    description: Optional[str] = None
    file_format: Optional[str] = None
    
class DocumentSection(BaseModel):
    title: str
    hint: str
    order: int

class AnalysisResult(BaseModel):
    id: str
    doc_type: str  # "competition" | "research" | "scholarship" | "startup"
    title: str
    organization: str
    timeline: list[TimelineItem]
    checklist: list[ChecklistItem]
    document_template: list[DocumentSection]
    analyzed_at: str
```

### Claude API 호출 패턴
```python
# services/claude_service.py

import anthropic
from models.schemas import AnalysisResult

client = anthropic.Anthropic()

SYSTEM_PROMPT = """
당신은 한국 공모전·정부사업 공고문을 분석하는 전문가입니다.
공고문 텍스트를 분석하여 다음을 추출하세요:
1. 모든 날짜·일정 (상대적 표현도 절대 날짜로 변환)
2. 제출 서류 목록 (필수/선택 구분)
3. 자격 조건
4. 문서 유형 판별 및 제출서류 구조

반드시 JSON 형식으로만 응답하세요.
"""

async def analyze_document(text: str) -> dict:
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"다음 공고문을 분석해주세요:\n\n{text}"}
        ]
    )
    return message.content[0].text
```

---

## 🤖 Claude API 프롬프트 설계 원칙

### 분석 프롬프트 구조
```
1. 역할 정의: "한국 공모전 공고문 분석 전문가"
2. 추출 항목 명시: 날짜, 서류, 자격, 유형
3. 출력 형식 강제: "반드시 JSON으로만 응답"
4. 엣지케이스 처리: "날짜가 없으면 null", "상대적 날짜는 변환"
5. 언어 설정: "한국어로 응답"
```

### JSON 출력 스키마 (프롬프트에 포함)
```json
{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목",
  "organization": "주관 기관명",
  "timeline": [
    {
      "label": "접수 시작",
      "date": "2025-05-01",
      "is_deadline": false
    }
  ],
  "checklist": [
    {
      "label": "사업계획서",
      "category": "required",
      "description": "A4 10매 이내",
      "file_format": "PDF, HWP"
    }
  ],
  "document_sections": [
    {
      "title": "문제 정의",
      "hint": "해결하려는 사회적 문제와 현황을 서술하세요",
      "order": 1
    }
  ]
}
```

---

## 🐛 디버깅 & 에러 처리

### 프론트엔드 에러 처리 패턴
```typescript
// 모든 API 호출에 try-catch 필수
try {
  const result = await analyzeDocument(file);
  setAnalysis(result);
} catch (error) {
  // 사용자에게 친화적인 메시지 표시
  setError('공고문 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
  console.error('Analysis error:', error);
}
```

### 백엔드 에러 처리 패턴
```python
from fastapi import HTTPException

# 명확한 HTTP 상태코드와 메시지
raise HTTPException(
    status_code=422,
    detail="PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF인지 확인하세요."
)
```

---

## ⚡ 성능 고려사항

- PDF 분석은 시간이 걸림 → 반드시 **로딩 상태(스켈레톤/프로그레스)** 표시
- Claude API 응답은 **스트리밍** 고려 (나중에 UX 개선 시)
- 분석 결과는 **임시 ID로 URL에 저장** → 새로고침해도 결과 유지
- 이미지/아이콘은 Next.js `<Image>` 컴포넌트 사용

---

## 🚫 하지 말아야 할 것들

1. `console.log` 를 프로덕션 코드에 남기지 말 것 (디버깅 후 제거)
2. 하드코딩된 URL, API 키 절대 금지
3. `useEffect` 의존성 배열 누락 금지
4. 한국어 UI 텍스트를 영어로 쓰지 말 것 (서비스 전체가 한국어)
5. 컴포넌트 내부에서 직접 `fetch()` 호출 금지

---

## ✅ 새 기능 개발 체크리스트

기능 개발 전:
- [ ] TASKS.md에 해당 태스크 있는지 확인
- [ ] ARCHITECTURE.md에서 관련 컴포넌트/서비스 파악
- [ ] 기존 코드 충돌 여부 확인

기능 개발 후:
- [ ] TypeScript 타입 오류 없는지 확인
- [ ] 에러 처리 포함되었는지 확인
- [ ] 로딩 상태 UI 포함되었는지 확인
- [ ] 한국어 텍스트 올바른지 확인
- [ ] TASKS.md 태스크 상태 업데이트
