#!/usr/bin/env node
/**
 * Generate static/config/presets/index.json -- the manifest used by the presets page.
 *
 * Upstream fetches that directory from the GitHub API every time the presets page opens
 * (darthcloud/BlueRetroWebCfg/map/), so on restricted networks or when rate limited the presets
 * page comes up blank. Generating the manifest before the build and shipping it with the site
 * avoids that: the list comes only from this project's own static/config/presets/, so just rerun
 * this script after adding or removing a preset.
 *
 * Usage:
 *   node tools\gen-presets-index.mjs
 *   (called by both tools\build.ps1 and the build script in package.json)
 */
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'static', 'config', 'presets');

const files = (await readdir(dir))
	.filter((f) => f.toLowerCase().endsWith('.json') && f.toLowerCase() !== 'index.json')
	.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

const index = files.map((name) => ({ name }));

await writeFile(join(dir, 'index.json'), JSON.stringify(index, null, '\t') + '\n', 'utf8');

console.log(`presets index: ${index.length} presets -> static/config/presets/index.json`);
