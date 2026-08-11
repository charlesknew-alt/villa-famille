# Bump the site version so every upgrade hard-reloads browsers.
# Usage: .\scripts\bump-version.ps1 20260811k
param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$root = Split-Path -Parent $PSScriptRoot
$index = Join-Path $root "index.html"
$verJs = Join-Path $root "js\version.js"

$indexText = Get-Content -Raw -Path $index
$indexText = [regex]::Replace($indexText, '\?v=\d+[a-z]?', "?v=$Version")
$indexText = [regex]::Replace($indexText, 'data-tfh-version="[^"]+"', "data-tfh-version=`"$Version`"")
Set-Content -Path $index -Value $indexText -NoNewline

$js = Get-Content -Raw -Path $verJs
$js = [regex]::Replace($js, 'window\.TFH_VERSION = "[^"]+"', "window.TFH_VERSION = `"$Version`"")
Set-Content -Path $verJs -Value $js -NoNewline

Write-Host "Bumped site version to $Version"
