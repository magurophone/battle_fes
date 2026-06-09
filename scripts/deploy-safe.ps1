$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# CRITICAL: CF Pages project "battle-fes" の Production branch = master
# --branch main にすると Preview デプロイになり、battle-fes.pages.dev に反映されない
# 変数化すると npx.ps1 の StrictMode で参照エラーになるためリテラルで直書き
# 確認方法: npx wrangler pages deployment list --project-name battle-fes
#   Environment 列が "Production" の Branch が本番ブランチ

if (Test-Path ".\scripts\preflight-check.ps1") {
  powershell -ExecutionPolicy Bypass -File ".\scripts\preflight-check.ps1"
} else {
  Write-Warning "scripts\preflight-check.ps1 not found; skipping preflight."
}
npx wrangler pages deploy public --project-name battle-fes --branch master --commit-dirty=true --commit-message "deploy"
