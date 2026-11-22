<#
  Unified pnpm entry point.

  Why this layer exists:
  - pnpm.cmd on this machine's PATH is the DSH desktop wrapper, and calling it directly fails with spawn EPERM;
  - this script instead locates pnpm's core script and runs it with node, bypassing the wrapper;
  - it also turns off pnpm's automatic version management, so pnpm does not download another
    copy based on the packageManager field in package.json (that hangs on intranet/offline machines).

  Usage:
    pwsh -File tools\pnpm.ps1 install
    pwsh -File tools\pnpm.ps1 add -D some-package
    pwsh -File tools\pnpm.ps1 run lint

  On another machine where pnpm itself works, you can skip this script and run `pnpm install` directly.
#>
[CmdletBinding()]
param(
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]] $PnpmArgs
)

$ErrorActionPreference = 'Stop'

if (-not $PnpmArgs -or $PnpmArgs.Count -eq 0) {
	Write-Host 'Usage: pwsh -File tools\pnpm.ps1 <pnpm subcommand> [args...]'
	exit 2
}

$root = Split-Path $PSScriptRoot -Parent

# Candidate locations of pnpm's core script. The project is self-contained, so a
# sibling development directory is only a fallback; missing candidates are
# skipped automatically.
$candidates = @(
	$env:LinkRetro_PNPM_JS,
	'C:\Program Files\DSH Desktop\resources\app.asar.unpacked\node_modules\pnpm\bin\pnpm.cjs',
	(Join-Path $root '..\_dev\pnpm\bin\pnpm.cjs')
) | Where-Object { $_ -and (Test-Path $_) }

$pnpmJs = $candidates | Select-Object -First 1

# Keep pnpm from switching versions automatically based on the packageManager field
$env:npm_config_manage_package_manager_versions = 'false'

# Non-interactive: never prompt when pnpm has to rebuild node_modules (without a TTY it just errors out)
$env:CI = '1'

# A development machine may keep the pnpm store outside the project (so the
# checkout stays clean); other machines fall back to pnpm's default cache.
# Point $env:LinkRetro_PNPM_STORE at a custom store directory when needed.
$storeCandidates = @(
	$env:LinkRetro_PNPM_STORE,
	(Join-Path $root '..\_dev\pnpm-store'),
	(Join-Path $root '.pnpm-store')
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $env:npm_config_store_dir) {
	$storeDir = $storeCandidates | Select-Object -First 1
	if ($storeDir) { $env:npm_config_store_dir = (Resolve-Path $storeDir).Path }
}

Push-Location $root
try {
	if ($pnpmJs) {
		& node $pnpmJs @PnpmArgs
	} else {
		$cmd = Get-Command pnpm -ErrorAction SilentlyContinue
		if (-not $cmd) {
			throw 'No usable pnpm found: install pnpm, or point the LinkRetro_PNPM_JS environment variable at pnpm.cjs.'
		}
		& $cmd.Source @PnpmArgs
	}
	$code = $LASTEXITCODE
} finally {
	Pop-Location
}

exit $code
