param(
    [Parameter(Mandatory = $true)]
    [string[]]$Files
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $root ".safety-backups"
$sessionRoot = Join-Path $backupRoot $timestamp

New-Item -ItemType Directory -Path $sessionRoot -Force | Out-Null

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$manifest = @()

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    if (-not $baseFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($baseFull)
    $targetUri = New-Object System.Uri([System.IO.Path]::GetFullPath($TargetPath))
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Test-StrictUtf8 {
    param([byte[]]$Bytes)

    try {
        [void]$utf8Strict.GetString($Bytes)
        return $true
    }
    catch {
        return $false
    }
}

foreach ($file in $Files) {
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $file))

    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "File not found: $file"
    }

    $relativePath = Get-RelativePathCompat -BasePath $root -TargetPath $fullPath
    $destination = Join-Path $sessionRoot $relativePath
    $destinationDir = Split-Path -Parent $destination

    if ($destinationDir) {
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    }

    Copy-Item -LiteralPath $fullPath -Destination $destination -Force

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $utf8Ok = Test-StrictUtf8 -Bytes $bytes

    $tracked = $false
    $gitTrackedOutput = git ls-files -- "$relativePath" 2>$null
    if ($gitTrackedOutput) {
        $tracked = $true
    }

    $manifest += [pscustomobject]@{
        file = $relativePath
        backup = Get-RelativePathCompat -BasePath $root -TargetPath $destination
        tracked = $tracked
        byteLength = $bytes.Length
        utf8Status = if ($utf8Ok) { "UTF8_OK" } else { "NON_UTF8_OR_UNKNOWN" }
    }
}

$manifestPath = Join-Path $sessionRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$manifest | ForEach-Object {
    Write-Output ("[{0}] tracked={1} bytes={2} backup={3}" -f $_.utf8Status, $_.tracked, $_.byteLength, $_.backup)
}

$badFiles = $manifest | Where-Object { $_.utf8Status -ne "UTF8_OK" }
if ($badFiles.Count -gt 0) {
    Write-Error "Encoding guard failed. Backups were created, but at least one file is not strict UTF-8."
}
