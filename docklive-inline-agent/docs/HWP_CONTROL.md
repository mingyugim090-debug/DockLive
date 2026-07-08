# 한글(HWP) 제어 검토 (Phase 5)

결론: **HWPX 직접 조작(Zip+XML)을 표준 경로로 확정. HwpCtrl COM은 채택 보류.**

## 비교

| 항목 | HWPX 직접 조작 | HwpCtrl COM (한컴 오토메이션) |
|---|---|---|
| 실행 요건 | 없음 (파일만 있으면 됨) | 한컴오피스 설치 + 보안모듈(FilePathCheckDLL) 레지스트리 등록 |
| 신뢰성 | 결정적 (XML 편집) | 버전별 API 차이, 자동화 승인 대화상자 등 변수 많음 |
| 기존 자산 | DockLive `backend/hwpx_toolchain/` 파이프라인 그대로 재사용 | 신규 개발 필요 |
| 실시간 편집 표시 | 불가 (파일 저장 후 열기) | 가능 (창 안에서 실시간) |
| .hwp (구형 바이너리) | 불가 — HWPX 변환 필요 | 가능 |

## 결정 사항

1. **읽기**: 이미 구현됨 — `src/tools/file_tools.py`의 `read_document`가 HWPX(zip → `Contents/section*.xml`)를 파싱한다.
2. **쓰기**: 로컬 에이전트가 XML을 직접 수정하지 않는다. `compose_hwpx_form` 도구가 로컬 파일을
   DockLive 백엔드의 `hwpx_toolchain` 자동작성 API로 보내고, 검증(validate/verify)된 완성본만
   PC에 저장한다. 로컬에서 중복 구현하면 검증 없는 HWPX가 생길 위험이 있다.
3. **HwpCtrl COM 보류 사유**: 사용자 PC에 한컴 설치 + 보안모듈 등록을 요구하는 순간
   "트레이 하나 켜면 동작"하는 배포 모델이 깨진다. Excel(xlwings)과 달리 사전 준비 비용이 크다.
4. **재검토 조건**: (a) .hwp 구형 파일의 인라인 편집 요구가 실제 사용자에게서 확인되고,
   (b) 대상 사용자 환경에 한컴오피스 설치가 전제될 수 있을 때. 그때 `hwp_tools.py`를
   excel_tools와 같은 `{"ok", "data"|"error"}` 계약으로 추가한다.

## 사용자 흐름 (현재)

- 한글 문서가 필요한 경우: 웹(DockLive) 워크스페이스 HWPX 자동작성 또는 로컬 Agent의
  `compose_hwpx_form` → 검증된 완성본 저장 → 사용자가 한글로 열어 최종 확인.
- 로컬 에이전트의 실시간 창 편집은 Excel에 집중한다. HWPX는 백엔드 검증 파이프라인을 경유한다.
