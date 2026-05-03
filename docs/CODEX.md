# Codex Working Guide

이 문서는 Codex가 LiveDock을 개발할 때 따라야 하는 작업 규칙입니다.

## 현재 제품 우선순위

1. Agent MVP 안정화
2. 공고 분석 스키마 개선
3. 사용자 입력 수집과 섹션별 초안 작성
4. 최종 문서 확인/수정/export
5. HWPX export 검증
6. Supabase 기반 persistence

커뮤니티 기능은 v2입니다. 사용자가 명시하지 않는 한 피드, 팀 모집, 추천, 프로필 구현으로 넘어가지 않습니다.

## 작업 시작 루틴

작업 전 확인:

1. 관련 파일을 먼저 읽는다.
2. `AGENTS.md`와 `docs/README.md`의 우선순위를 확인한다.
3. API 계약 변경 시 backend schema와 frontend type을 함께 수정한다.
4. 한국어 문자열이 깨진 파일을 만지면 해당 영역을 정상 한국어로 복구한다.

## Agent 계약 규칙

- 원문에 없는 핵심 사실을 만들지 않는다.
- 불확실한 정보는 `uncertain_fields`와 `confirmation_required`에 남긴다.
- 초안은 공고 분석 결과와 사용자 입력만 근거로 한다.
- 최종 문서 생성 전 사용자 확인 단계를 유지한다.
- 분석 결과에는 가능한 경우 `source_evidence`를 포함한다.

## HWPX 작업 규칙

`hwpx` skill 또는 `jkf87/hwpx-skill`을 사용할 때:

- HWPX는 ZIP+XML 패키지임을 전제로 한다.
- 생성 후 `fix_namespaces.py`를 실행한다.
- `validate.py`로 구조를 검증한다.
- 사용자가 `.hwp`를 제공하면 먼저 HWPX로 변환한다.
- 사용자가 `.hwpx` 양식을 제공하면 먼저 `clone_form.py --analyze`로 구조를 확인한다.
- 테이블/이미지가 있는 복잡한 양식은 clone workflow를 우선한다.
- XML run을 직접 갈아엎어 서식을 망가뜨리지 않는다.

## Verification

Frontend 변경:

```bash
cd frontend
npm run build
```

Backend 변경:

```bash
cd backend
python -m compileall .
```

API 계약 변경 시 확인 대상:

- `backend/models/schemas.py`
- `frontend/lib/types.ts`
- `frontend/lib/api.ts`

HWPX export 변경:

- HWPX toolchain 설치 여부 확인
- HWPX 생성
- namespace fix
- validate
- text extract 또는 구조 검증

## Commit-ready Checklist

- [ ] 깨진 한국어 문자열이 새로 생기지 않았다.
- [ ] Agent MVP 우선순위를 벗어나지 않았다.
- [ ] API schema/type이 일치한다.
- [ ] 실패 시 사용자에게 명확한 오류가 표시된다.
- [ ] 가능한 검증 명령을 실행했다.
- [ ] HWPX 관련 변경은 검증 절차를 문서화했다.
