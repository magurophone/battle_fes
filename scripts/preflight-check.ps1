$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".\node_modules\playwright")) {
  Write-Host "Installing locked frontend test dependencies..."
  npm ci
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed. Deployment stopped."
  }
}

Write-Host "Running Playwright UI smoke tests..."
npm run test:ui
if ($LASTEXITCODE -ne 0) {
  throw "Playwright UI smoke tests failed. Deployment stopped."
}

Write-Host "Playwright UI smoke tests passed."
