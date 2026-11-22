// Offline verification of dist: required files + every local reference resolves + the three manifests parse.
// Usage: node tools/check-dist.mjs [distDir] [basePath]
import { readFile, access } from 'node:fs/promises';
import { join, normalize, relative } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = (process.argv[3] ?? '/tools/blueretro-webconfig').replace(/\/$/, '');
const prefix = base + '/';

const required = [
	'index.html',
	'404.html',
	'guide/index.html',
	'controller/global/index.html',
	'controller/presets/index.html',
	'controller/buttons/index.html',
	'system/update/index.html',
	'system/ota/index.html',
	'updater/index.html',
	'firmware/index.json',
	'ota/index.json',
	'config/presets/index.json',
	'gameid.db',
	'brand/linkretro-logo.png',
	'brand/favicon.svg',
	'guide/01-connect.png',
	'updater/vendor/esptool-js.js'
];

const problems = [];
for (const file of required) {
	try {
		await access(join(dist, file));
	} catch {
		problems.push(`Missing ${file}`);
	}
}

const htmlFiles = [
	'index.html',
	'404.html',
	'guide/index.html',
	'controller/global/index.html',
	'controller/presets/index.html',
	'controller/buttons/index.html',
	'system/update/index.html',
	'system/ota/index.html',
	'updater/index.html'
];

let checked = 0;
for (const file of htmlFiles) {
	let html;
	try {
		html = await readFile(join(dist, file), 'utf8');
	} catch {
		continue;
	}
	for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
		const url = match[1];
		if (/^(https?:|data:|mailto:|#)/.test(url)) continue;
		if (!url.startsWith('/') && !url.startsWith(prefix)) {
			// Relative references (such as app.css on the updater page) resolve against their own directory
			const target = normalize(join(dist, file, '..', url.split(/[?#]/)[0]));
			checked++;
			try {
				await access(target);
			} catch {
				problems.push(`${file} → ${url}`);
			}
			continue;
		}
		const rel = url.startsWith(prefix) ? url.slice(prefix.length) : url.slice(1);
		checked++;
		try {
			await access(join(dist, rel.split('?')[0]));
		} catch {
			problems.push(`${file} → ${url}`);
		}
	}
}

for (const json of ['firmware/index.json', 'ota/index.json', 'config/presets/index.json']) {
	try {
		const data = JSON.parse(await readFile(join(dist, json), 'utf8'));
		const count = Array.isArray(data) ? data.length : Object.keys(data).length;
		console.log(`json ${json}: ${count} entries`);
	} catch (error) {
		problems.push(`${json} is not valid JSON: ${error.message}`);
	}
}

console.log(`\nChecked ${required.length} required files and ${checked} local references (${relative(process.cwd(), dist) || '.'})`);
if (problems.length) {
	console.error(`\nFound ${problems.length} problem(s):`);
	for (const problem of [...new Set(problems)].slice(0, 40)) console.error('  - ' + problem);
	process.exit(1);
}
console.log('dist verification passed');
