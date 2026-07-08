# HWP_COM_GUIDE — 한글(HWP) 실시간 제어 규약

> HWP 관련 코드를 작성/수정하기 전에 반드시 이 문서를 정독할 것.
> 한글 COM은 Excel COM보다 함정이 훨씬 많다.

## 1. 접속과 보안 모듈 (최대 함정)

```python
import win32com.client as win32
hwp = win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")  # 필수!
hwp.XHwpWindows.Item(0).Visible = True   # ← 이게 "실시간으로 보이는" 스위치
```

- `RegisterModule`을 생략하면 파일 열기/저장마다 **보안 승인 팝업**이 떠서 자동화가 멈춘다.
- `FilePathCheckerModule`은 레지스트리 등록이 선행되어야 한다
  (`HKCU\Software\HNC\HwpAutomation\Modules`). 설치 스크립트는 `scripts/register_hwp_module.py` 참조.
- 한컴오피스 미설치 환경에서는 Dispatch 자체가 실패한다 → hwp_open이 즉시 감지하고
  "한컴오피스 설치 필요 / 또는 HWPX 직접 조작 모드 사용" 에러를 반환할 것.

## 2. 양식 채우기의 정석: 누름틀(Field) > 찾아바꾸기 > 커서 이동

| 우선순위 | 방법 | 언제 |
|---|---|---|
| 1 | `PutFieldText(field_name, text)` | 양식에 누름틀이 있을 때 (정부 서식 다수) |
| 2 | 찾아바꾸기 (AllReplace 액션) | `{{회사명}}` 같은 플레이스홀더 치환 |
| 3 | `MoveToField` + InsertText | 필드 위치로 이동 후 삽입 |
| 4 | 커서 좌표 이동 | 최후 수단. 깨지기 쉬움 |

- `GetFieldList()`로 문서의 누름틀 목록을 먼저 읽는다 → 에이전트가 "이 양식엔 이런
  필드가 있다"를 파악하는 read_range 상당의 역할.
- 필드가 하나도 없으면 찾아바꾸기 방식으로 폴백.

## 3. 표 생성/채우기

- 표 생성: `HAction.GetDefault("TableCreate", ...)` + HParameterSet.HTableCreation
  (Rows/Cols/WidthType 지정) → `HAction.Execute("TableCreate", ...)`
- 셀 이동: 표 안에서 `HAction.Run("TableRightCell")` 로 다음 셀 이동하며 InsertText.
  (좌상단부터 행 우선 순회가 안전)
- 기존 표 채우기: 누름틀이 셀 안에 있으면 PutFieldText가 가장 안전.

## 4. 차트/그래프: 이미지 삽입 전략

한글의 네이티브 차트 객체는 COM 제어가 사실상 불가능하다. **정석은:**
1. `chart_tools.render_chart()` — matplotlib으로 PNG 렌더 (한글 폰트 Malgun Gothic 강제)
2. `hwp_insert_image(png_path)` — InsertPicture로 현재 커서 위치에 삽입
3. HWPX 직접 조작 모드에서는 BinData/에 PNG 추가 + manifest.xml 갱신 (hwpx-pipeline 참조)

## 5. 저장

- `hwp.SaveAs(path, "HWPX")` — HWPX 포맷 명시. 확장자와 포맷 인자 불일치 주의.
- 저장 전 원본 백업은 hwp_open 시점에 이미 완료되어 있어야 한다 (불변 규칙 #1).

## 6. 수명주기 / 좀비 프로세스

- Hwp 핸들은 HwpSession 싱글턴만 소유. 종료 시 `hwp.Quit()` (atexit 등록).
- Excel과 달리 한글은 `hwp.XHwpDocuments.Close(isDirty=False)` 로 문서만 닫는 경로도 필요.
- 워커 스레드에서 호출 시 `pythoncom.CoInitialize()` 필수 (Phase 5 WebSocket 통합 시).

## 7. 액션 ID 검증

이 문서와 코드의 HAction ID(TableCreate, InsertText, AllReplace 등)는 한컴 자동화
API 표준 명칭이지만, 한컴오피스 버전에 따라 파라미터셋 구조가 다를 수 있다.
Windows 실검증 시 `hwp.HAction` 탐색으로 확인하고, 다르면 이 문서를 갱신할 것.
`# WINDOWS-VERIFY:` 주석이 붙은 지점이 검증 포인트다.
