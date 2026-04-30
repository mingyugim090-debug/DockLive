# TASKS.md — 개발 태스크 목록

> 태스크 상태: ⏳ 예정 | 🔄 진행 중 | ✅ 완료 | ❌ 블로킹

---

## 🏁 PHASE 0 — 프로젝트 하네스 구축

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P0-01 | README.md 작성 | ✅ 완료 | |
| P0-02 | CLAUDE.md 작성 | ✅ 완료 | |
| P0-03 | SKILLS.md 작성 | ✅ 완료 | |
| P0-04 | TASKS.md 작성 | ✅ 완료 | |
| P0-05 | ARCHITECTURE.md 작성 | ✅ 완료 | |

---

## 🔧 PHASE 1 — 개발 환경 세팅

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P1-01 | Next.js 14 프로젝트 초기화 | ✅ 완료 | `frontend/` 구성 완료 |
| P1-02 | Tailwind CSS 설정 | ✅ 완료 | CSS 변수 커스텀 팔레트 (`globals.css`) |
| P1-03 | 프론트 패키지 설치 | ✅ 완료 | framer-motion, zustand, react-dropzone |
| P1-04 | FastAPI 백엔드 초기화 | ✅ 완료 | `backend/` 폴더 구조 완료 |
| P1-05 | 백엔드 패키지 설치 | ✅ 완료 | `requirements.txt` 완성 (openai>=1.30.0) |
| P1-06 | 환경변수 파일 설정 | ✅ 완료 | `.env`, `.env.local`, `.gitignore` 완료 |
| P1-07 | CORS 설정 | ✅ 완료 | `main.py` CORSMiddleware 설정 |
| P1-08 | 헬스체크 엔드포인트 | ✅ 완료 | `GET /health` → `{"status": "ok"}` |

---

## 📄 PHASE 2 — PDF 업로드 & 파싱

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P2-01 | `POST /api/analyze` 엔드포인트 구현 | ✅ 완료 | 업로드 + 분석 통합 |
| P2-02 | PDF 사이즈 제한 검사 | ✅ 완료 | 최대 20MB (`FileTooLargeError`) |
| P2-03 | PyMuPDF로 텍스트 추출 로직 | ✅ 완료 | `pdf_parser.py` (join 최적화 적용) |
| P2-04 | 스캔 PDF 감지 + 에러 메시지 | ✅ 완료 | 텍스트 없으면 `PDFParseError(422)` |
| P2-05 | DropZone 컴포넌트 구현 | ✅ 완료 | `components/upload/DropZone.tsx` |
| P2-06 | 파일 유효성 검사 UI | ✅ 완료 | PDF만 허용, 크기 제한 안내 |
| P2-07 | 업로드 진행 상태 UI | ✅ 완료 | `UploadProgress.tsx` (단계별 진행 표시) |

---

## 🤖 PHASE 3 — Claude API 연동 & 분석

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P3-01 | `claude_service.py` 구현 | ✅ 완료 | OpenAI SDK (gpt-4o-mini) 연동으로 전환 |
| P3-02 | 분석 시스템 프롬프트 작성 | ✅ 완료 | 날짜 추출, 서류 분류, 유형 판별 |
| P3-03 | JSON 응답 파싱 로직 | ✅ 완료 | `_clean_json()` + 2차 재시도 |
| P3-04 | `POST /api/analyze` 엔드포인트 | ✅ 완료 | `routers/analyze.py` |
| P3-05 | 분석 결과 임시 저장 | ✅ 완료 | 서버 인메모리 + 클라이언트 localStorage |
| P3-06 | `GET /api/result/{id}` 엔드포인트 | ✅ 완료 | `routers/analyze.py` |
| P3-07 | D-Day 자동 계산 후처리 | ✅ 완료 | `analyzer.py` `_calculate_d_day()` |
| P3-08 | 공고 유형 판별 로직 검증 | 🔄 진행 중 | 실제 공고문으로 추가 테스트 필요 |
| P3-09 | API 에러 핸들링 | ✅ 완료 | `core/errors.py` + anthropic 예외 처리 |

---

## 🗓️ PHASE 4 — STEP 1: 인터랙티브 타임라인

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P4-01 | `Timeline.tsx` 래퍼 컴포넌트 | ✅ 완료 | |
| P4-02 | `TimelineItem.tsx` 개별 아이템 | ✅ 완료 | 날짜, 라벨, D-Day 뱃지 |
| P4-03 | D-Day 상태별 색상 처리 | ✅ 완료 | safe/warning/danger/passed |
| P4-04 | 타임라인 연결선 시각화 | ✅ 완료 | 수직 라인 + 마커 |
| P4-05 | 오늘 날짜 표시 | ✅ 완료 | 현재 위치 강조 |
| P4-06 | 마감 임박 항목 강조 애니메이션 | ✅ 완료 | Framer Motion pulse 효과 |
| P4-07 | Framer Motion 등장 애니메이션 | ✅ 완료 | 순차적 페이드인 |

---

## ✅ PHASE 5 — STEP 2: 서류 준비 체크리스트

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P5-01 | `Checklist.tsx` 래퍼 컴포넌트 | ✅ 완료 | 필수/선택 섹션 분리 |
| P5-02 | `CheckItem.tsx` 개별 항목 | ✅ 완료 | 체크박스 + 라벨 + 뱃지 |
| P5-03 | 체크 상태 Zustand 연동 | ✅ 완료 | `checkedItems` 상태 사용 |
| P5-04 | 진행률 프로그레스 바 | ✅ 완료 | 체크된 항목 수 / 전체 |
| P5-05 | `Tooltip.tsx` AI 설명 컴포넌트 | ✅ 완료 | 항목 클릭 시 설명 표시 |
| P5-06 | 필수/선택 뱃지 디자인 | ✅ 완료 | 필수(인디고), 선택(회색) |
| P5-07 | 파일 형식 표시 | ✅ 완료 | "PDF, HWP" 등 |

---

## 📝 PHASE 6 — STEP 3: 제출 문서 틀 생성

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P6-01 | `DocTemplate.tsx` 래퍼 컴포넌트 | ✅ 완료 | 공고 유형 표시 + 섹션 목록 |
| P6-02 | `SectionCard.tsx` 섹션 카드 | ✅ 완료 | 제목 + 힌트 텍스트 |
| P6-03 | 공고 유형 뱃지 | ✅ 완료 | "공모전", "연구과제" 등 |
| P6-04 | 섹션 순서 표시 | ✅ 완료 | 번호 + 순서 표시 |
| P6-05 | 힌트 텍스트 스타일 | ✅ 완료 | 작성 가이드 강조 처리 |

---

## 🏠 PHASE 7 — 전체 페이지 & UX

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P7-01 | 메인 랜딩 페이지 (`/`) | ✅ 완료 | 업로드 폼 + Demo 버튼 + 서비스 설명 |
| P7-02 | 분석 중 로딩 페이지 | ✅ 완료 | `UploadProgress.tsx` 단계 메시지 |
| P7-03 | 결과 페이지 (`/result/[id]`) | ✅ 완료 | 3단계 탭 구조 + localStorage 폴백 |
| P7-04 | `StepIndicator.tsx` 단계 표시 | ✅ 완료 | 결과 페이지 상단 탭 네비게이션 |
| P7-05 | 단계 전환 Framer Motion | ✅ 완료 | 슬라이드 전환 애니메이션 |
| P7-06 | 결과 링크 복사 기능 | ✅ 완료 | URL 클립보드 복사 |
| P7-07 | 모바일 반응형 | ✅ 완료 | Tailwind responsive 적용 |
| P7-08 | 에러 페이지 UI | ✅ 완료 | 분석 실패 시 안내 + 다시 분석 버튼 |

---

## 🚀 PHASE 8 — 배포

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P8-01 | Vercel 프론트엔드 배포 | ✅ 완료 | https://dock-live-98tx.vercel.app |
| P8-02 | Render 백엔드 배포 | ✅ 완료 | https://docklive.onrender.com (Railway → Render 전환) |
| P8-03 | 환경변수 프로덕션 설정 | ✅ 완료 | Render OPENAI_API_KEY, FRONTEND_URL 설정 완료 |
| P8-04 | 도메인 설정 | ⏳ 예정 | 추후 결정 |
| P8-05 | 실제 공고문 테스트 (5개 이상) | 🔄 진행 중 | 테스트 중 |

---

## 🔧 PHASE 9 — 즉시 수정

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P9-01 | "Claude AI" 텍스트 수정 | ✅ 완료 | UploadProgress.tsx → "AI 분석 중 · 약 10~15초 소요" |
| P9-02 | TASKS.md 현행화 | ✅ 완료 | OpenAI 전환, Render/Vercel 배포 완료 반영 |

---

## 🎨 PHASE 10 — UX 개선

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P10-01 | 콜드스타트 배너 | ✅ 완료 | 페이지 로드 시 /health 핑 → 느리면 "서버 준비 중" 배너 표시 |
| P10-02 | 프롬프트 고도화 | ✅ 완료 | 상대적 날짜 변환 예시·doc_type 기준·checklist/sections 규칙 명확화 |
| P10-03 | 결과 영속성 | ✅ 완료 | storage.py — Redis(REDIS_URL 설정 시) + 인메모리 폴백, TTL 7일 |

---

## 🔧 PHASE 11 — 안정성 & 품질

| ID | 태스크 | 상태 | 비고 |
|----|--------|------|------|
| P11-01 | 백엔드 Python 로깅 | ✅ 완료 | logging.basicConfig (main.py), 서비스별 logger 추가 |
| P11-02 | 분석 결과 폴백 데이터 | ✅ 완료 | analyzer.py — 빈 체크리스트/섹션 시 doc_type별 기본값 자동 제공 |
| P11-03 | React Error Boundary | ✅ 완료 | components/ErrorBoundary.tsx → app/layout.tsx 전체 래핑 |
| P11-04 | Redis 영속성 연동 | ✅ 완료 | Upstash Redis 연동 가이드 (REDIS_URL 환경변수 설정 필요) |

---

## 🐛 버그 트래킹

> 발견된 버그는 여기에 기록

| ID | 설명 | 심각도 | 상태 |
|----|------|--------|------|
| BUG-01 | anthropic SDK 버전 불일치 (0.28→0.40+) | 🔴 높음 | ✅ 수정 완료 |
| BUG-02 | 인메모리 캐시 소멸 시 결과 페이지 404 | 🔴 높음 | ✅ localStorage 폴백으로 해결 |
| BUG-03 | datetime.utcnow() deprecated (Python 3.11+) | 🟡 중간 | ✅ timezone.utc로 교체 |

---

## 📌 보류된 기능 (v2.0으로 이관)

| 기능 | 이유 |
|------|------|
| 로그인 / 이메일 인증 | MVP 범위 초과 |
| 팀 모집 커뮤니티 방 | 변환 툴 완성 후 추가 |
| 체크리스트 공동 편집 | 인증 필요 |
| 캘린더 `.ics` 내보내기 | 추후 기능 |
| HWP 직접 업로드 | 파싱 라이브러리 불안정 |
| 공모전 히스토리 저장 | DB 연동 필요 (localStorage → Redis) |
| 타 학교 확장 | 서울과기대 검증 후 |
