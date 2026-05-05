# HWP-MCP 활용 가이드

LiveDock 안에는 `tools/hwp-mcp` 경로로 [`jkf87/hwp-mcp`](https://github.com/jkf87/hwp-mcp) 소스를 보관한다. 이 도구는 Windows에서 설치형 한글(HWP)을 COM으로 제어하는 MCP 서버다.

## 현재 설치 상태

- 소스 위치: `tools/hwp-mcp`
- 가상환경: `tools/hwp-mcp/.venv`
- 실행 Python: `tools/hwp-mcp/.venv/Scripts/python.exe`
- 설치 패키지: `requirements.txt` + `mcp`
- 보안 DLL 경로: `security_module/FilePathCheckerModuleExample.dll`

설치는 다음 방식으로 했다.

```powershell
cd "C:\Users\alseh\OneDrive\바탕 화면\LiveDock\tools\hwp-mcp"
$env:UV_CACHE_DIR="C:\Users\alseh\OneDrive\바탕 화면\LiveDock\.uv-cache"
uv venv .venv --python "C:\Users\alseh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
uv pip install -r requirements.txt mcp
```

## 실행 전제

hwp-mcp는 HWPX 파일을 직접 조립하는 라이브러리가 아니라, PC에 설치된 한글 프로그램을 자동 조작하는 도구다. 따라서 다음 조건이 필요하다.

- Windows
- 한글(HWP) 프로그램 설치 및 정상 실행 가능
- 로컬 데스크톱 세션
- MCP 클라이언트가 stdio 서버 실행을 지원

Render, FastAPI 서버, CI, 클라우드 런타임에서는 한글 COM 자동화가 거의 동작하지 않는다. LiveDock의 서버/배포용 문서 생성은 기존 HWPX ZIP/XML 워크플로우를 기본으로 유지한다.

## MCP 서버 등록 예시

MCP 클라이언트 설정에 아래처럼 등록한다.

```json
{
  "mcpServers": {
    "hwp": {
      "command": "C:\\Users\\alseh\\OneDrive\\바탕 화면\\LiveDock\\tools\\hwp-mcp\\.venv\\Scripts\\python.exe",
      "args": [
        "C:\\Users\\alseh\\OneDrive\\바탕 화면\\LiveDock\\tools\\hwp-mcp\\hwp_mcp_stdio_server.py"
      ],
      "cwd": "C:\\Users\\alseh\\OneDrive\\바탕 화면\\LiveDock\\tools\\hwp-mcp"
    }
  }
}
```

## LiveDock에서의 권장 역할

1. Agent MVP의 기본 산출물은 HWPX로 둔다.
2. 공식 신청서 양식이 `.hwpx`로 주어지면 HWPX form clone/replacement 방식을 우선한다.
3. 공식 양식이 `.hwp`만 있거나 한글 프로그램에서 열어 검수해야 하는 경우에 hwp-mcp를 보조 도구로 사용한다.
4. hwp-mcp는 로컬 운영자/개발자 워크스테이션에서 양식 열기, 텍스트 삽입, 표 채우기, 저장 검증에 사용한다.
5. 사용자-facing 백엔드 API가 hwp-mcp에 직접 의존하지 않게 한다. 한글 미설치 환경에서도 분석, 초안, HWPX export가 작동해야 한다.

## 주요 MCP 기능

대표 기능은 다음과 같다.

- `hwp_create`: 새 문서 생성
- `hwp_open`: 기존 `.hwp`/문서 열기
- `hwp_save`: 문서 저장
- `hwp_insert_text`: 텍스트 삽입
- `hwp_set_font`: 글꼴, 크기, 굵게 등 설정
- `hwp_insert_table`: 표 생성
- `hwp_fill_table_with_data`: 표 데이터 채우기
- `hwp_find_text`, `hwp_replace_text`: 텍스트 검색/치환
- `hwp_create_document_from_text`: 텍스트 기반 문서 생성
- `hwp_batch_operations`: 여러 작업 일괄 실행

## 권장 작업 흐름

### 로컬 HWP 자동화

1. 한글 프로그램이 설치되어 있는지 확인한다.
2. MCP 클라이언트에 `hwp` 서버를 등록한다.
3. `hwp_create` 또는 `hwp_open`으로 문서를 연다.
4. LiveDock의 분석/초안 결과를 section 단위로 확정한 뒤 `hwp_insert_text`, `hwp_fill_table_with_data`로 반영한다.
5. `hwp_save`로 `.hwp` 저장 후 사람이 한글에서 최종 확인한다.

### Agent MVP 문서 생성

1. 공고 PDF/URL/본문을 분석한다.
2. 필수 요구사항과 사용자 입력 항목을 확정한다.
3. 섹션별 초안을 만들고 중요한 claim은 확인받는다.
4. HWPX export는 기존 HWPX 스킬/ZIP XML 검증 플로우로 생성한다.
5. 필요한 경우에만 hwp-mcp로 한글 앱에서 열어 렌더링/양식 입력을 보조 검수한다.

## 주의사항

- hwp-mcp는 한글 COM 자동화라서 서버리스/리눅스/원격 CI에 맞지 않는다.
- 한글 보안 경고는 `security_module/FilePathCheckerModuleExample.dll` 등록으로 완화할 수 있지만, 한글 버전과 보안 설정에 따라 대화상자가 뜰 수 있다.
- 원본 저장소의 `README.md` 일부 Korean text는 PowerShell 출력 환경에서 깨져 보일 수 있다. GitHub 원문과 파일 자체를 기준으로 확인한다.
- `.hwp`는 바이너리 포맷이므로 LiveDock 내부 자동 생성/검증의 장기 표준은 `.hwpx`가 더 적합하다.
- 사용자 제출용 최종본은 생성 후 반드시 HWPX namespace fix와 validate 과정을 거친다.

## 빠른 점검 명령

```powershell
cd "C:\Users\alseh\OneDrive\바탕 화면\LiveDock\tools\hwp-mcp"
& ".venv\Scripts\python.exe" -c "import mcp, fastmcp, win32com.client, comtypes; print('imports ok')"
& ".venv\Scripts\python.exe" -m pytest src\__tests__\test_command_parser.py
```

한글 프로그램까지 포함한 실제 연결 테스트는 MCP 클라이언트에서 `hwp_create`를 호출하거나, 한글을 실행한 상태에서 문서 열기/저장을 호출해 확인한다.
