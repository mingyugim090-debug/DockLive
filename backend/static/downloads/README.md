# downloads/

레거시 백엔드 다운로드 폴더. 현재 사용자용 Agent 다운로드는 InsForge Storage의
`agent-downloads` 공개 버킷에서 제공한다.

이 폴더의 `*.exe`, `*.zip`, `*.dmg`는 git에 커밋하지 않는다 (`.gitignore` 참조).

## DockLiveAgent-windows.zip (Windows 로컬 Agent)

1. `docklive-inline-agent`에서 `.env`에 `AGENT_PROXY_TOKEN`을 설정 (백엔드와 같은 값).
2. `powershell -ExecutionPolicy Bypass -File docklive-inline-agent/scripts/package_agent_downloads.ps1` 실행.
3. 생성된 `frontend/public/downloads/DockLiveAgent-windows.zip`을 InsForge Storage
   `agent-downloads/DockLiveAgent-windows.zip`으로 업로드한다.
4. 긴급 패키지는 `Start-DockLiveAgent.cmd`를 실행하는 Python bootstrap ZIP이다.

## DockLiveAgent-mac.zip (macOS 로컬 Agent)

1. macOS 빌드 머신에서 `docklive-inline-agent/.env`에 `AGENT_PROXY_TOKEN`을 설정한다.
2. `bash docklive-inline-agent/scripts/build_agent_app_macos.sh` 실행 후
   `docklive-inline-agent/dist/DockLiveAgent-mac.zip` 생성.
3. 생성된 ZIP을 InsForge Storage `agent-downloads/DockLiveAgent-mac.zip`으로 업로드한다.

브라우저는 내려받은 실행 파일을 자동으로 열 수 없다. UI 안내는 사용자가 다운로드 후
직접 실행하도록 설명하고, 실행된 Agent가 `127.0.0.1:8765`에서 연결 및 폴더 선택을
제공하는 흐름을 기준으로 한다.

토큰을 교체(rotate)하면 위 과정을 반복해 재빌드·재배포해야 배포판이 계속 동작한다.
