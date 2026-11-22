#!/usr/bin/env node
/**
 * extract-ota.mjs — derive the "Bluetooth OTA app image" from the "full image" used for USB flashing.
 *
 * Background (why slicing is mandatory):
 *   · the full image (factory / merged) = bootloader + partition table + boot_app0 + app, flashed from address 0x0
 *   · Bluetooth OTA has the device write the app partition directly through esp_ota_write and only
 *     accepts app images (the ESP-IDF app descriptor magic is at image offset 0x20)
 *   Handing the full image to OTA writes the bootloader into the app partition, and the device will not boot.
 *
 * Input / output:
 *   firmware\*.bin          put only the USB full images here (tracked in version control)
 *   OTA_Firmware\*.bin      the sliced OTA images (handed to customers / used manually, a build artifact)
 *   static\ota\*.bin        plus index.json, read directly by the in-page Bluetooth panel (a build artifact)
 *
 * Usage:
 *   node tools\extract-ota.mjs                    # read and write the directories above by default
 *   node tools\extract-ota.mjs --src X --out Y    # custom source directory / OTA directory (for testing)
 *
 * Exit code: 0 = success (or no source files); 1 = some files could not be sliced and the file count is > 0
 */
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeName, parsePartitions, readAppDesc, APP_DESC_MAGIC } from './fw-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- Arguments ---------- */
function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const SRC = resolve(root, arg('src', 'firmware'));
const OTA_SRC = resolve(root, arg('ota-src', 'OTA_Firmware'));
const WEB_OUT = resolve(root, arg('web-out', 'static/ota'));

/* ---------- Helpers ---------- */
const isAppImage = (buf) =>
	buf.length > 0x40 && buf[0] === 0xe9 && buf.readUInt32LE(0x20) === APP_DESC_MAGIC;

/** Slice the app out of a full image using its partition table; returns { image, offset } or null */
function sliceApp(buf) {
	const parts = parsePartitions(buf);
	if (!parts.length) return null;

	// Prefer factory (type 0x00 / subtype 0x00), fall back to any app partition
	const app =
		parts.find((p) => p.type === 0x00 && p.sub === 0x00) || parts.find((p) => p.type === 0x00);
	if (!app) return null;

	const start = app.offset;
	const end = Math.min(buf.length, app.offset + app.size);
	if (end - start < 0x1000) return null;

	const image = buf.subarray(start, end);
	return { image, offset: start, capacity: app.size, label: app.label };
}

/* ---------- Main flow ---------- */
let names = [];
try {
	names = (await readdir(SRC)).filter((f) => /\.bin$/i.test(f)).sort();
} catch {
	console.log(`[ota] Source directory does not exist: ${SRC} (skipped)`);
	process.exit(0);
}

if (!names.length) {
	console.log(`[ota] No .bin files in ${SRC}, skipped`);
	await rm(WEB_OUT, { recursive: true, force: true });
	await rm(OTA_SRC, { recursive: true, force: true });
	process.exit(0);
}

await rm(OTA_SRC, { recursive: true, force: true });
await mkdir(OTA_SRC, { recursive: true });
await rm(WEB_OUT, { recursive: true, force: true });
await mkdir(WEB_OUT, { recursive: true });

const index = [];
const skipped = [];

for (const name of names) {
	const buf = await readFile(join(SRC, name));
	const info = describeName(name);

	let image = null;
	let appOffset = 0;
	let capacity = 0;
	let how = '';

	if (isAppImage(buf)) {
		// Already an app image: use it as is (some people drop OTA packages in here directly)
		image = buf;
		how = 'app-only';
	} else {
		const sliced = sliceApp(buf);
		if (sliced && isAppImage(sliced.image)) {
			image = sliced.image;
			appOffset = sliced.offset;
			capacity = sliced.capacity;
			how = 'from-merged';
		}
	}

	if (!image) {
		skipped.push({
			name,
			why: parsePartitions(buf).length ? 'partition table found but the app partition is invalid' : 'neither a full image nor an app image'
		});
		continue;
	}

	if (capacity && image.length > capacity) {
		skipped.push({ name, why: `app image ${image.length} B exceeds the partition capacity ${capacity} B` });
		continue;
	}

	const desc = readAppDesc(image, 0);
	await writeFile(join(OTA_SRC, name), image);
	await writeFile(join(WEB_OUT, name), image);

	index.push({
		name,
		size: image.length,
		label: info.label,
		meta: info.meta,
		target: info.target,
		feature: info.feature,
		version: info.version,
		date: info.date,
		source: how,
		appOffset,
		build: desc
	});
}

await writeFile(join(WEB_OUT, 'index.json'), JSON.stringify(index, null, '\t') + '\n', 'utf8');

/* Notes for the customer, shipped together with the OTA packages */
if (index.length) {
	const lines = [
		'LinkRetro Wireless Receiver — Bluetooth (OTA) firmware images',
		'',
		'These are app-only images for the in-browser Bluetooth update.',
		'They are generated automatically from the full images in firmware\\ by',
		'tools\\extract-ota.mjs — do not edit them by hand.',
		'',
		'For a USB update use the full images in firmware\\ instead.',
		'',
		...index.map((f) => `  ${f.label.padEnd(16)} ${(f.size / 1024).toFixed(0).padStart(4)} KB   ${f.name}`)
	];
	await writeFile(join(OTA_SRC, 'README.txt'), lines.join('\r\n') + '\r\n', 'utf8');
}

/* ---------- Report ---------- */
const total = index.reduce((sum, f) => sum + f.size, 0);
const rel = (p) => p.replace(root + '\\', '').replace(root + '/', '');
console.log(
	`[ota] ${index.length} OTA images -> ${rel(OTA_SRC)}\\  (${(total / 1048576).toFixed(2)} MB)`
);
for (const f of index) {
	const how = f.source === 'app-only' ? 'already an app image' : `full image from 0x${f.appOffset.toString(16).toUpperCase()}`;
	console.log(`      ${f.label.padEnd(16)} ${(f.size / 1024).toFixed(0).padStart(4)} KB   ${how}`);
}
if (skipped.length) {
	console.log('[ota] The following files were skipped:');
	for (const s of skipped) console.log(`      ${s.name} — ${s.why}`);
}

if (!index.length) {
	console.error('[ota] No firmware could be sliced into an OTA image; check that the files in firmware\\ are ESP32 full images');
	process.exit(1);
}
if (skipped.length) {
	console.error(`[ota] ${skipped.length} file(s) were skipped (the rest were generated)`);
	process.exit(1);
}
