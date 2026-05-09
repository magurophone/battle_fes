param(
    [switch]$AllTrackedTextFiles
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$textExtensions = @(".md", ".html", ".txt", ".json", ".toml", ".yml", ".yaml")

function Get-TargetFiles {
    if ($AllTrackedTextFiles) {
        $candidates = Get-ChildItem -Recurse -File | Where-Object {
            $textExtensions -contains $_.Extension.ToLowerInvariant()
        } | ForEach-Object {
            $relative = $_.FullName.Substring($root.Length).TrimStart('\')
            $relative
        }
        return $candidates | Sort-Object -Unique
    }

    $statusLines = git status --short
    $files = @()

    foreach ($line in $statusLines) {
        if ($line.Length -lt 4) {
            continue
        }

        $path = $line.Substring(3).Trim()
        if ($path -like "* -> *") {
            $path = ($path -split " -> ")[-1]
        }

        $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        if ($textExtensions -contains $extension) {
            $files += $path
        }
    }

    return $files | Sort-Object -Unique
}

$targets = Get-TargetFiles

if (-not $targets -or $targets.Count -eq 0) {
    Write-Output "No changed text files to guard."
    exit 0
}

Write-Output ("Guarding files: {0}" -f ($targets -join ", "))
& (Join-Path $root "scripts\safe-edit-guard.ps1") -Files $targets
