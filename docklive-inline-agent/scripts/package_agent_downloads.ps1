$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$downloadDir = Join-Path $repoRoot "frontend\public\downloads"
$windowsZip = Join-Path $downloadDir "DockLiveAgent-windows.zip"
$macZipSource = Join-Path $agentRoot "dist\DockLiveAgent-mac.zip"
$macZipTarget = Join-Path $downloadDir "DockLiveAgent-mac.zip"
$tmpDir = Join-Path $agentRoot "dist\windows-download"

New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

if (Test-Path $tmpDir) {
    Remove-Item -LiteralPath $tmpDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $tmpDir "agent") | Out-Null
Copy-Item -LiteralPath (Join-Path $agentRoot "src") -Destination (Join-Path $tmpDir "agent\src") -Recurse
Copy-Item -LiteralPath (Join-Path $agentRoot "requirements.txt") -Destination (Join-Path $tmpDir "agent\requirements.txt")
if (Test-Path (Join-Path $agentRoot ".env")) {
    Copy-Item -LiteralPath (Join-Path $agentRoot ".env") -Destination (Join-Path $tmpDir "agent\.env")
}
Get-ChildItem -LiteralPath (Join-Path $tmpDir "agent\src") -Recurse -Directory -Filter "__pycache__" |
    Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $tmpDir "agent\src") -Recurse -File |
    Where-Object { $_.Extension -in @(".pyc", ".pyo") } |
    Remove-Item -Force

@"
@echo off
setlocal
cd /d "%~dp0agent"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY_CMD=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is required to run DockLive Agent.
    echo Install Python 3 from https://www.python.org/downloads/windows/ and run this file again.
    pause
    exit /b 1
  )
  set "PY_CMD=python"
)

if not exist ".venv\Scripts\python.exe" (
  echo Preparing DockLive Agent for first run. This may take a few minutes.
  %PY_CMD% -m venv .venv || goto :fail
  ".venv\Scripts\python.exe" -m pip install --upgrade pip || goto :fail
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :fail
)

if exist ".venv\Scripts\pythonw.exe" (
  start "" ".venv\Scripts\pythonw.exe" "src\tray.py"
) else (
  start "" ".venv\Scripts\python.exe" "src\tray.py"
)

echo DockLive Agent is starting. Return to DockLive and press the recheck button.
rem timeout는 stdin 리디렉션 환경에서 실패하므로 ping으로 대기 (약 3초)
ping -n 4 127.0.0.1 >nul
exit /b 0

:fail
echo DockLive Agent could not start. Check your internet connection and Python installation.
pause
exit /b 1
"@ | Set-Content -Path (Join-Path $tmpDir "Start-DockLiveAgent.cmd") -Encoding ASCII

@"
DockLive Agent for Windows

1. Extract this ZIP file.
2. Run Start-DockLiveAgent.cmd.
3. On first run, the script creates a local Python virtual environment and installs Agent dependencies.
4. When the tray icon appears, return to DockLive and press the recheck button.

This emergency bootstrap avoids direct .exe downloads. For a no-warning production
installer, build and sign DockLiveAgent.exe with an Authenticode code-signing
certificate before packaging the release.
"@ | Set-Content -Path (Join-Path $tmpDir "README_FIRST.txt") -Encoding UTF8

if (Test-Path $windowsZip) {
    Remove-Item -LiteralPath $windowsZip -Force
}
Compress-Archive -Path (Join-Path $tmpDir "*") -DestinationPath $windowsZip -CompressionLevel Optimal

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    & $python.Source (Join-Path $agentRoot "scripts\build_agent_macos_bootstrap.py") | Out-Null
}

if (-not (Test-Path $macZipSource)) {
    throw "Missing $macZipSource. Build it on macOS with build_agent_app_macos.sh or create the bootstrap ZIP."
}

Copy-Item -LiteralPath $macZipSource -Destination $macZipTarget -Force

Write-Host "Packaged Agent downloads:"
Write-Host " - $windowsZip"
Write-Host " - $macZipTarget"
