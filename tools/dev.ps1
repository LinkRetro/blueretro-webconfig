<#
  Start the development server (with hot reload).

  Usage:
    pwsh -File tools\dev.ps1
    pwsh -File tools\dev.ps1 -Port 5180 -Open

  Notes:
  - BASE_PATH is empty in development, so the site runs at http://localhost:<port>/;
  - Web Bluetooth requires a secure context, and localhost counts as secure, so no local certificate is needed;
  - to open it from a phone on the LAN (which needs HTTPS), set $env:LinkRetro_MKCERT='1' before starting;
    mkcert then signs a local certificate (the first run downloads mkcert and installs its root certificate).
#>
[CmdletBinding()]
param(
	[int] $Port = 5173,
	[string] $HostName = '127.0.0.1',
	[switch] $Open
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$viteBin = Join-Path $root 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteBin)) {
	Write-Host '== Dependencies missing, installing first =='
	& (Join-Path $PSScriptRoot 'pnpm.ps1') install
	if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
}

$viteArgs = @($viteBin, 'dev', '--port', $Port, '--host', $HostName, '--strictPort')
if ($Open) { $viteArgs += '--open' }

# The dev server reads static\ directly, so generate the firmware index and OTA images first
Write-Host '== Sync firmware and OTA images =='
& node (Join-Path $root 'tools\sync-firmware.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Firmware sync failed' }
& node (Join-Path $root 'tools\extract-ota.mjs')
if ($LASTEXITCODE -ne 0) { throw 'OTA image extraction failed' }

Write-Host "== vite dev  http://${HostName}:${Port}/ =="
Push-Location $root
try {
	& node @viteArgs
	$code = $LASTEXITCODE
} finally {
	Pop-Location
}
exit $code
