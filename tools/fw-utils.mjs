/**
 * Shared firmware filename parsing plus ESP image structure parsing.
 * Used by both sync-firmware.mjs (USB full images) and extract-ota.mjs (Bluetooth OTA app images),
 * so the parsing rules are not written twice and slowly drift apart.
 */

export const APP_DESC_MAGIC = 0xabcd5432;
export const PART_MAGIC = 0x50aa;

/** Model code -> display name in the UI */
const TARGETS = {
	PS12: 'PS1 / PS2',
	NGC: 'GameCube',
	N64: 'N64',
	SW: 'Switch',
	DC: 'Dreamcast'
};

/**
 * LinkRetro-Blueretro-25.10-beta-N64-Rumble-260908.bin
 * → { target:"N64", feature:"Rumble", version:"25.10 beta", date:"260908",
 *     label:"N64 · Rumble", meta:"25.10 beta · 2026-09-08" }
 */
export function describeName(name) {
	const base = name.replace(/\.bin$/i, '');
	const parts = base.split('-');
	let target = '';
	let feature = '';
	let version = '';
	let date = '';

	// No fixed brand prefix: <brand>-BlueRetro-<version>-<model>-<feature>-<YYMMDD>.bin
	if (parts.length >= 4 && /^\d{6}$/.test(parts[parts.length - 1])) {
		date = parts.pop();
		feature = parts.pop();
		target = parts.pop();
		// Drop the brand and BlueRetro tokens; whatever remains is the version string
		version = parts
			.filter((t) => !/^(LinkRetro|linkretro|blueretro)$/i.test(t))
			.join(' ');
	}

	const label = [TARGETS[target] || target, feature].filter(Boolean).join(' · ') || base;

	let meta = '';
	if (version) meta = version.replace(/-/g, ' ');
	if (date) {
		const y = '20' + date.slice(0, 2);
		meta += (meta ? ' · ' : '') + `${y}-${date.slice(2, 4)}-${date.slice(4, 6)}`;
	}

	return { label, meta, target, feature, version, date };
}

/** Read the app descriptor; off is the start of the app image (the descriptor magic sits at off+0x20) */
export function readAppDesc(buf, off) {
	const at = off + 0x20;
	if (at + 0x90 > buf.length) return null;
	if (buf.readUInt32LE(at) !== APP_DESC_MAGIC) return null;
	const str = (o, n) =>
		buf
			.subarray(at + o, at + o + n)
			.toString('utf8')
			.split('\0')[0]
			.trim();
	return { version: str(0x10, 32), project: str(0x30, 32), time: str(0x50, 16), date: str(0x60, 16) };
}

/** Parse the partition table at 0x8000; returns [{type, sub, offset, size, label}] */
export function parsePartitions(buf) {
	if (buf.length < 0x8000 + 32) return [];
	if (buf.readUInt16LE(0x8000) !== PART_MAGIC) return [];
	const out = [];
	for (let i = 0; i < 95; i++) {
		const p = 0x8000 + i * 32;
		if (p + 32 > buf.length) break;
		if (buf.readUInt16LE(p) !== PART_MAGIC) break;
		out.push({
			type: buf[p + 2],
			sub: buf[p + 3],
			offset: buf.readUInt32LE(p + 4),
			size: buf.readUInt32LE(p + 8),
			label: buf
				.subarray(p + 12, p + 28)
				.toString('utf8')
				.split('\0')[0]
				.trim()
		});
	}
	return out;
}
