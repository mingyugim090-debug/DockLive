# DockLiveAgent.exe 빌드 스크립트 (Windows 전용)
# 사용: docklive-inline-agent 폴더에서 `powershell -File scripts/build_agent_exe.ps1`
#
# .env (AGENT_PROXY_TOKEN)를 exe에 함께 번들해, 다운로드한 사용자가 별도 키 설정 없이
# 바로 실행할 수 있게 한다. .env 자체는 git에 커밋하지 않는다 (.gitignore 처리됨).

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".env")) {
    Write-Warning ".env가 없습니다. AGENT_PROXY_TOKEN 없이 빌드하면 배포판이 백엔드 인증에 실패할 수 있습니다."
}

python -m pip install -q pyinstaller

$dataArg = if (Test-Path ".env") { ".env;." } else { $null }

$pyinstallerArgs = @(
    "--noconfirm", "--onefile", "--windowed",
    "--name", "DockLiveAgent",
    "--paths", "src",
    "--hidden-import", "xlwings",
    "--hidden-import", "win32timezone",
    "--hidden-import", "win32com",
    "--hidden-import", "win32com.client",
    "--collect-submodules", "uvicorn",
    "--collect-data", "xlwings"
)
if ($dataArg) {
    $pyinstallerArgs += @("--add-data", $dataArg)
}
$pyinstallerArgs += "src/tray.py"

python -m PyInstaller @pyinstallerArgs

$exePath = Join-Path (Get-Location) "dist\DockLiveAgent.exe"
$signtool = $env:WINDOWS_SIGNTOOL_PATH
if (-not $signtool) {
    $signtoolCommand = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($signtoolCommand) {
        $signtool = $signtoolCommand.Source
    }
}

if ($signtool -and $env:WINDOWS_CERT_SHA1) {
    & $signtool sign /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 /sha1 $env:WINDOWS_CERT_SHA1 $exePath
    Write-Host "Authenticode signed: $exePath" -ForegroundColor Green
} else {
    Write-Warning "DockLiveAgent.exe is unsigned. Edge/SmartScreen may warn until an Authenticode certificate is configured with WINDOWS_CERT_SHA1."
}

Write-Host ""
Write-Host "빌드 완료: dist/DockLiveAgent.exe" -ForegroundColor Green
