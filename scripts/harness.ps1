param(
  [ValidateSet("quick", "backend", "agent", "frontend", "full", "hwpx")]
  [string]$Profile = "quick",
  [switch]$IncludeHwpx,
  [switch]$ContinueOnFailure
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

$Candidates = @(
  (Join-Path $Root "backend\venv\Scripts\python.exe"),
  (Join-Path $Root ".venv\Scripts\python.exe")
)

$Python = $null
foreach ($Candidate in $Candidates) {
  if (Test-Path -LiteralPath $Candidate) {
    $Python = $Candidate
    break
  }
}

if (-not $Python) {
  $Command = Get-Command python -ErrorAction SilentlyContinue
  if ($Command) {
    $Python = $Command.Source
  }
}

if (-not $Python) {
  $Command = Get-Command py -ErrorAction SilentlyContinue
  if ($Command) {
    $Python = $Command.Source
  }
}

if (-not $Python) {
  Write-Error "Python을 찾지 못했습니다. backend\venv를 만들거나 Python을 PATH에 추가한 뒤 다시 실행하세요."
  exit 1
}

$ArgsList = @("tools\harness\run_harness.py", "--profile", $Profile)
if ($IncludeHwpx) {
  $ArgsList += "--include-hwpx"
}
if ($ContinueOnFailure) {
  $ArgsList += "--continue-on-failure"
}

Push-Location $Root
try {
  & $Python @ArgsList
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
