# HWP MCP Architecture

이 문서는 `tools/hwp-mcp` 로컬 helper의 내부 구조를 설명합니다.

## 역할

HWP MCP는 LiveDock backend의 일반 서버 코드가 아니라, Windows 로컬 환경에서 한글 프로그램을 제어하기 위한 보조 도구입니다.

주요 사용 목적:

- `.hwp` 파일 열기, 저장, 변환 자동화
- 한글 문서 텍스트 삽입과 테이블 조작
- HWPX 중심 workflow를 보완하는 로컬 HWP 제어 실험

## 구성

```text
tools/hwp-mcp/
  hwp_mcp_stdio_server.py
  src/
    tools/
      hwp_controller.py
      hwp_table_tools.py
    utils/
      command_parser.py
  tests/
    test_command_parser.py
    test_hwp_controller.py
  security_module/
    FilePathCheckerModuleExample.dll
```

## 책임 분리

- `hwp_mcp_stdio_server.py`: MCP stdio entrypoint와 tool registration
- `src/tools/hwp_controller.py`: HWP COM automation wrapper
- `src/tools/hwp_table_tools.py`: HWP table 작업 helper
- `src/utils/command_parser.py`: JSON command parsing
- `tests/`: command parser와 controller behavior 검증
- `security_module/`: 한글 프로그램 보안 모듈 예시

## LiveDock와의 관계

LiveDock의 우선 export target은 HWPX입니다. 이 MCP 도구는 다음 경우에만 보조적으로 사용합니다.

- 사용자가 `.hwp` 파일을 제공해 `.hwpx` 변환이 필요한 경우
- 로컬 Windows 환경에서 한글 프로그램 기반 검증이 필요한 경우
- HWPX XML만으로 처리하기 어려운 한글 전용 기능을 실험하는 경우
