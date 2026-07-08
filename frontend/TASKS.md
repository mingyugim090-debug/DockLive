# TASKS — 마이그레이션 순서 (스트랭글러: 새 구조 먼저, 삭제는 마지막)

## Phase A — 골격
- [x] 프로젝트 데이터 모델에 상태 필드(6단계) + 단계별 산출물 스키마 추가
      — lib/pipeline.ts (ProjectState 상태 머신 + ProjectArtifacts + localStorage 레지스트리)
- [x] 새 라우트 골격 (/app, /app/new, /app/p/:id/1~6) + 스테퍼 컴포넌트
      — /app=프로젝트 목록, /app/new=단일 입력(텍스트·파일·URL 한 영역)+양식만 채우기,
        /app/p/:id=현재 단계 리다이렉트, [stage]=단계 셸(1·2·3 실데이터, 4·5 이식 안내, 6 검사 준비 중).
        구 Workspace는 /app/workspace로 이동 (삭제 아님)
- [x] 사이드바 교체 (프로젝트 목록형) — 기존 7메뉴는 아직 라우트로는 접근 가능 (URL 직접 접근)

## Phase B — 흡수 (기존 화면을 단계로 이식)
- [x] 공고 입력·분석·질문 → 1·2·3단계로 이식 (분석 카드에 근거 하이라이트 추가)
      — 2단계: 마감/자격/서류/평가기준(배점) 카드 + 카드별 "원문 근거 n건" 인용 하이라이트,
        3단계: blur 자동 저장 + 나중에 채우기. (기관용 /app/agency 화면 자체는 별개 —
        Phase C 리다이렉트 대상)
- [x] HWPX 양식 작성(현 Workspace) → 4단계로 이식
      — FormStage 탭: "공고 기반 구조로 작성"(document_template) / "HWPX 양식 업로드"(HwpxFormEditor 임베드).
        기존 Templates 갤러리 탭 통합은 Phase C 정리 때 (현재 /app/templates 접근 가능)
- [x] 작성 화면 → 5단계 2패널 캔버스로 재구성
      — DraftStage: 좌=평가기준(배점)·요구사항·내 답변(미입력 배지)·원문 근거 고정 패널,
        우=섹션 카드(SSE 스트리밍 초안, 근거 칩→좌패널 하이라이트, 직접 입력=restoreWorkflow 영속화,
        AI 다시 받기+피드백, 실시간 글자수)
- [x] export → 6단계로 이식 + 무결성 API 연동(GET /api/projects/:id/integrity)
      — ExportStage: 진입 시 자동 검사(미구현이면 C1~C5 "검사 준비 중" 폴백), 실패 항목→5단계 점프 링크,
        확인 필요 항목 체크 전 다운로드 차단, 통과 시에만 기본 다운로드, 우회는 _검증전 파일명,
        finalize→export 순서 준수

## Phase C — 정리
- [ ] 리다이렉트 표 전체 적용 + 기존 페이지 legacy/ 이동
- [ ] 랜딩 수정 (PAGE_SPECS 랜딩 체크리스트)
- [ ] 빈 상태·에러 카피 전수 교체 (COPY_GUIDE 기준)
- [ ] PAGE_SPECS 전 항목 최종 점검 + 데모 스크린샷 재촬영

## 금지
- Phase A 완료 전 기존 화면 삭제 금지 / 새 최상위 메뉴 추가 금지 / rm 금지(legacy 이동만)
