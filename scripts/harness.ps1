param(
  [ValidateSet("quick", "backend", "agent", "frontend", "full", "hwpx")]
  [string]$Profile = "quick",
  [switch]$IncludeHwpx,
  [switch]$ContinueOnFailure,
  [string]$PythonPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

function Test-PythonExecutable {
  param([string]$Path)

  if (-not $Path) {
    return $false
  }

  try {
    & $Path --version *> $null
    return ($LASTEXITCODE -eq 0)
  }
  catch {
    return $false
  }
}

$Candidates = @(
  $PythonPath,
  $env:PYTHON,
  (Join-Path $Root "backend\venv\Scripts\python.exe"),
  (Join-Path $Root ".venv\Scripts\python.exe")
)

$Python = $null
foreach ($Candidate in $Candidates) {
  if (-not $Candidate) {
    continue
  }
  if ((Test-Path -LiteralPath $Candidate) -and (Test-PythonExecutable $Candidate)) {
    $Python = $Candidate
    break
  }
}

if (-not $Python) {
  $Command = Get-Command python -ErrorAction SilentlyContinue
  if ($Command -and (Test-PythonExecutable $Command.Source)) {
    $Python = $Command.Source
  }
}

if (-not $Python) {
  $Command = Get-Command py -ErrorAction SilentlyContinue
  if ($Command -and (Test-PythonExecutable $Command.Source)) {
    $Python = $Command.Source
  }
}

if (-not $Python) {
  Write-Error "No working Python executable was found. Create backend\venv, set -PythonPath, or add Python to PATH, then retry."
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
