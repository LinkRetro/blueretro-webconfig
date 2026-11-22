<#
  Build the LinkRetro web config tool (static site).

  Usage:
    pwsh -File tools\build.ps1                                    # build to build\, then assemble dist\
    pwsh -File tools\build.ps1 -BasePath /tools/blueretro         # example sub-path build
    pwsh -File tools\build.ps1 -NoDist                            # only build\, do not assemble dist\
    pwsh -File tools\build.ps1 -SkipInstall                       # skip install when dependencies are unchanged

  About BasePath:
    ''              -> built for the domain root
    '/tools/blueretro' -> built for a sub-path; a leading slash is required

  dist\ is the copy handed to the customer: build\ has no index.html, its SPA fallback page is
  404.html (upstream follows the GitHub Pages convention), and dist\ adds an index.html on top.
  Note that asset paths are baked in at build time: a root build (empty BasePath) can also be
  opened by double-clicking index.html, while a subdirectory build only works when a web server
  serves it from that subdirectory -- double-clicking it shows a blank page.
#>
[CmdletBinding()]
param(
	[string] $BasePath = '',
	[switch] $SkipInstall,
	[switch] $NoDist
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$buildDir = Join-Path $root 'build'
$distDir = Join-Path $root 'dist'

if (-not $SkipInstall -and -not (Test-Path (Join-Path $root 'node_modules\vite\bin\vite.js'))) {
	Write-Host '== Dependencies missing, installing first =='
	& (Join-Path $PSScriptRoot 'pnpm.ps1') install
	if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
}

# Call vite directly instead of going through pnpm run (one spawn less, steadier in restricted environments)
$env:BASE_PATH = $BasePath
Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host '== Generate presets index =='
& node (Join-Path $root 'tools\gen-presets-index.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Failed to generate the presets index' }

Write-Host '== Sync firmware into the site =='
& node (Join-Path $root 'tools\sync-firmware.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Firmware sync failed' }

Write-Host '== Extract Bluetooth OTA images =='
& node (Join-Path $root 'tools\extract-ota.mjs')
if ($LASTEXITCODE -ne 0) { throw 'OTA image extraction failed' }

Write-Host "== vite build (BASE_PATH='$BasePath') =="
& node (Join-Path $root 'node_modules\vite\bin\vite.js') build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

if (-not $NoDist) {
	Write-Host '== Assemble dist =='
	Remove-Item $distDir -Recurse -Force -ErrorAction SilentlyContinue
	Copy-Item $buildDir $distDir -Recurse
	$fallback = Join-Path $distDir '404.html'
	if (Test-Path $fallback) {
		Copy-Item $fallback (Join-Path $distDir 'index.html') -Force
	}
	$size = [math]::Round(((Get-ChildItem $distDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)
	Write-Host "== Done: dist\ ($size MB) =="
} else {
	Write-Host '== Done: build\ =='
}
