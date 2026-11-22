#!/usr/bin/env node
/**
 * Sync firmware\*.bin from the project root into static/firmware/ and generate the index.json manifest.
 *
 * This script handles the "full images" (bootloader + partition table + app) used for USB serial
 * flashing; the "app images" needed by Bluetooth OTA are sliced out by tools/extract-ota.mjs.
 *
 * A web page cannot read a local directory, so firmware has to be published with the site:
 * drop the .bin files into firmware\, run a build (tools\build.ps1 calls this script automatically),
 * and step 2 of the updater lists the manifest for the user to pick from.
 *
 * Usage: node tools\sync-firmware.mjs
 */
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeName, readAppDesc } from './fw-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'firmware');
const dest = join(root, 'static', 'firmware');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let names = [];
try {
	names = (await readdir(src)).filter((f) => /\.bin$/i.test(f)).sort();
} catch {
	console.log('firmware/ directory does not exist, skipped');
	process.exit(0);
}

const index = [];
for (const name of names) {
	const from = join(src, name);
	const to = join(dest, name);
	await copyFile(from, to);
	const info = await stat(to);
	const { label, meta, target, feature, version, date } = describeName(name);

	// Read the app descriptor inside the image once, so device read-back can be matched to a model
	let build = null;
	try {
		const buf = await readFile(to);
		build = readAppDesc(buf, 0x10000) || readAppDesc(buf, 0x00);
	} catch {
		build = null;
	}

	index.push({ name, size: info.size, label, meta, target, feature, version, date, build });
}

await writeFile(join(dest, 'index.json'), JSON.stringify(index, null, '\t') + '\n', 'utf8');

const total = index.reduce((sum, f) => sum + f.size, 0);
console.log(
	`firmware: ${index.length} files -> static/firmware/  (${(total / 1048576).toFixed(2)} MB)`
);
for (const f of index) console.log(`  ${f.label.padEnd(16)} ${f.name}`);
