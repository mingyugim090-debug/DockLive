# SKILLS.md — 기술 역량 및 패턴 가이드

> Dock Live 개발에 사용되는 핵심 기술 패턴, 코드 스니펫, 베스트 프랙티스 모음입니다.

---

## 📚 기술 스택 전체 목록

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Frontend Framework | Next.js | 14.x (App Router) | 메인 프레임워크 |
| Language (FE) | TypeScript | 5.x | 타입 안전성 |
| Styling | Tailwind CSS | 3.x | 유틸리티 CSS |
| Animation | Framer Motion | 11.x | 전환 애니메이션 |
| State | Zustand | 4.x | 전역 상태 관리 |
| Backend Framework | FastAPI | 0.111.x | API 서버 |
| Language (BE) | Python | 3.11+ | 백엔드 언어 |
| PDF 파싱 | PyMuPDF (fitz) | 1.24.x | PDF 텍스트 추출 |
| AI | OpenAI SDK | 1.30+ | ChatGPT API 연동 |
| HTTP Client (BE) | httpx | 0.27.x | 비동기 HTTP |
| 배포 (FE) | Vercel | - | 프론트 배포 |
| 배포 (BE) | Railway | - | 백엔드 배포 |

---

## 🎨 Frontend 패턴

### 1. 파일 업로드 (드래그앤드롭)

```typescript
// components/upload/DropZone.tsx
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  isLoading?: boolean;
}

export function DropZone({ onFileAccepted, isLoading = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileAccepted(acceptedFiles[0]);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
        transition-all duration-200
        ${isDragOver 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-white/10 hover:border-white/20 bg-white/5'
        }
      `}
    >
      <input {...getInputProps()} />
      <p className="text-text-secondary">
        PDF 파일을 드래그하거나 클릭하여 업로드하세요
      </p>
    </div>
  );
}
```

### 2. 단계 진행 인디케이터

```typescript
// components/ui/StepIndicator.tsx
interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  steps: Array<{ label: string; icon: string }>;
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        
        return (
          <div key={stepNum} className="flex items-center">
            <div className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
              transition-all duration-300
              ${isActive ? 'bg-indigo-500 text-white' : ''}
              ${isCompleted ? 'text-green-400' : ''}
              ${!isActive && !isCompleted ? 'text-white/30' : ''}
            `}>
              <span>{step.icon}</span>
              <span>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 ${isCompleted ? 'bg-green-400' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### 3. D-Day 계산 유틸리티

```typescript
// lib/utils.ts

export function calculateDDay(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDDayStatus(dDay: number): 'safe' | 'warning' | 'danger' | 'passed' {
  if (dDay < 0) return 'passed';
  if (dDay <= 3) return 'danger';
  if (dDay <= 7) return 'warning';
  return 'safe';
}

export function formatDDay(dDay: number): string {
  if (dDay < 0) return '마감';
  if (dDay === 0) return 'D-Day';
  return `D-${dDay}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
```

### 4. Zustand 전역 상태

```typescript
// lib/store.ts
import { create } from 'zustand';
import type { AnalysisResult } from './types';

interface AppState {
  // 업로드 상태
  uploadedFile: File | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  
  // 분석 결과
  analysisResult: AnalysisResult | null;
  
  // 현재 단계
  currentStep: 1 | 2 | 3;
  
  // 체크리스트 상태
  checkedItems: Set<string>;
  
  // 액션
  setFile: (file: File) => void;
  setAnalyzing: (loading: boolean) => void;
  setResult: (result: AnalysisResult) => void;
  setError: (error: string | null) => void;
  setStep: (step: 1 | 2 | 3) => void;
  toggleCheck: (itemId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  uploadedFile: null,
  isAnalyzing: false,
  analysisError: null,
  analysisResult: null,
  currentStep: 1,
  checkedItems: new Set(),
  
  setFile: (file) => set({ uploadedFile: file }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) => set({ analysisResult: result }),
  setError: (error) => set({ analysisError: error }),
  setStep: (step) => set({ currentStep: step }),
  toggleCheck: (itemId) => set((state) => {
    const newChecked = new Set(state.checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    return { checkedItems: newChecked };
  }),
}));
```

### 5. TypeScript 타입 정의

```typescript
// lib/types.ts

export type DocType = 'competition' | 'research' | 'scholarship' | 'startup';
export type ItemCategory = 'required' | 'optional';
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';

export interface TimelineItem {
  id: string;
  label: string;
  date: string;          // "YYYY-MM-DD"
  dDay: number;
  isDeadline: boolean;
  status: DayStatus;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: ItemCategory;
  description?: string;
  fileFormat?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
  hint: string;
  order: number;
}

export interface AnalysisResult {
  id: string;
  docType: DocType;
  title: string;
  organization: string;
  timeline: TimelineItem[];
  checklist: ChecklistItem[];
  documentTemplate: DocumentSection[];
  analyzedAt: string;
}

// API 응답 타입
export interface ApiError {
  detail: string;
  status: number;
}
```

---

## ⚙️ Backend 패턴

### 1. FastAPI 앱 초기화

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, analyze, result

app = FastAPI(
    title="Dock Live API",
    version="1.0.0",
    description="공고문 AI 분석 서비스"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://dock-live.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(result.router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

### 2. PDF 텍스트 추출

```python
# services/pdf_parser.py
import fitz  # PyMuPDF
from fastapi import HTTPException

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """PDF 바이트에서 텍스트를 추출합니다."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            full_text += page.get_text()
            full_text += "\n\n"
        
        doc.close()
        
        if not full_text.strip():
            raise HTTPException(
                status_code=422,
                detail="PDF에서 텍스트를 추출할 수 없습니다. 스캔 이미지 PDF가 아닌지 확인하세요."
            )
        
        return full_text.strip()
        
    except fitz.FileDataError:
        raise HTTPException(
            status_code=400,
            detail="손상된 PDF 파일입니다."
        )
```

### 3. OpenAI API 연동

```python
# services/openai_service.py
import json
from openai import OpenAI
from core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

ANALYSIS_PROMPT = """당신은 한국 공모전·정부사업 공고문을 분석하는 전문가입니다.
아래 공고문 텍스트를 분석하여 반드시 다음 JSON 형식으로만 응답하세요.
다른 텍스트나 설명을 포함하지 마세요.

{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목",
  "organization": "주관 기관명",
  "timeline": [
    {
      "label": "일정 이름 (예: 접수 시작, 서류 마감, 결과 발표)",
      "date": "YYYY-MM-DD 형식",
      "is_deadline": true/false
    }
  ],
  "checklist": [
    {
      "label": "서류명",
      "category": "required | optional",
      "description": "부가 설명 (페이지 수, 양식 등)",
      "file_format": "허용 파일 형식"
    }
  ],
  "document_sections": [
    {
      "title": "섹션 제목",
      "hint": "이 섹션에 작성해야 할 내용 안내",
      "order": 1
    }
  ]
}

규칙:
- 날짜가 "접수 시작일로부터 14일 이내" 같은 상대적 표현이면 오늘({today}) 기준으로 절대 날짜로 계산
- 날짜를 찾을 수 없으면 해당 항목 제외
- 모든 텍스트는 한국어로 작성
"""

def analyze_announcement(text: str, today: str) -> dict:
    """공고문 텍스트를 OpenAI API로 분석합니다."""
    
    prompt = ANALYSIS_PROMPT.format(today=today)
    
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=4096,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "당신은 한국 공고문 분석 전문가입니다. 반드시 순수 JSON만 반환하세요."
            },
            {
                "role": "user",
                "content": f"{prompt}\n\n[공고문 내용]\n{text}"
            }
        ]
    )
    
    response_text = completion.choices[0].message.content
    
    # JSON 파싱
    try:
        # 코드블록 제거 후 파싱
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"OpenAI 응답을 파싱할 수 없습니다: {e}")
```

### 4. 환경변수 설정

```python
# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_PDF_SIZE_MB: int = 20
    
    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 🎨 Tailwind CSS 클래스 패턴

### 카드 컴포넌트
```
bg-[#1A1A24] border border-white/8 rounded-2xl p-6
```

### 기본 버튼
```
bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl
font-medium transition-all duration-200 active:scale-95
```

### 아웃라인 버튼
```
border border-white/10 hover:border-white/20 text-white/70
hover:text-white px-6 py-3 rounded-xl transition-all duration-200
```

### D-Day 뱃지
```
# safe (초록)
bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg text-sm

# warning (노랑)
bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-lg text-sm

# danger (빨강)
bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg text-sm

# passed (회색)
bg-white/5 text-white/30 border border-white/10 px-2 py-1 rounded-lg text-sm
```

### 체크박스 아이템
```
flex items-start gap-3 p-4 rounded-xl border border-white/8
hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-200 cursor-pointer
```

---

## 📦 주요 라이브러리 사용법

### Framer Motion 애니메이션

```typescript
import { motion } from 'framer-motion';

// 페이드 인 (스텝 전환)
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
};

// 리스트 아이템 순차 등장
const listItem = {
  initial: { opacity: 0, x: -20 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1 }
  })
};

// 사용 예시
<motion.div {...fadeIn}>
  <TimelineItem />
</motion.div>

{items.map((item, i) => (
  <motion.div key={item.id} variants={listItem} custom={i}>
    <CheckItem />
  </motion.div>
))}
```

### react-dropzone 설치

```bash
npm install react-dropzone
```

---

## 🔧 개발 환경 세팅 커맨드

```bash
# 프론트엔드 초기화
npx create-next-app@14 frontend --typescript --tailwind --app --src-dir=false
cd frontend
npm install framer-motion zustand react-dropzone

# 백엔드 초기화
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn python-multipart PyMuPDF openai pydantic-settings httpx

# requirements.txt 생성
pip freeze > requirements.txt
```
