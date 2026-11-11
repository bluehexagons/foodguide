import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../html/', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
async function walk(directory, relative = '') {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = relative + entry.name;
		if (entry.isDirectory()) {
			files.push(...(await walk(join(directory, entry.name), path + '/')));
		} else if (
			!path.endsWith('.d.ts') &&
			!path.endsWith('.map') &&
			path !== 'sw.js' &&
			!path.startsWith('.')
		) {
			files.push({ path, hash: hash(await readFile(join(root, path))) });
		}
	}
	return files;
}
const assets = (await walk(root)).sort((a, b) => a.path.localeCompare(b.path, 'en'));
const template = await readFile(
	new URL('../build/worker/service-worker.js', import.meta.url),
	'utf8',
);
const id = hash(JSON.stringify(assets) + template);
await writeFile(
	join(root, 'sw.js'),
	`const config = ${JSON.stringify({ id, assets })};\n${template}`,
);
console.log(`Offline build ${id.slice(0, 12)}: ${assets.length} verified assets`);
