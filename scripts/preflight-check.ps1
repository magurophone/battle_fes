$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Running Playwright UI smoke tests..."
npm run test:ui
if ($LASTEXITCODE -ne 0) {
  throw "Playwright UI smoke tests failed. Deployment stopped."
}

Write-Host "Playwright UI smoke tests passed."
