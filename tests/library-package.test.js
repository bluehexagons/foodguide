import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = join(root, 'node_modules/typescript/bin/tsc');

test('packed library works outside the checkout with runtime and declaration exports', async t => {
	// npm test builds first. Disable pack lifecycle scripts to avoid rebuilding in parallel.
	assert(process.env.npm_execpath, 'Run this test with npm test');
	const directory = await mkdtemp(join(tmpdir(), 'foodguide-package-'));
	t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
	const npm = (args, cwd) =>
		run(process.execPath, [process.env.npm_execpath, '--prefix', cwd, ...args], { cwd });
	const { stdout } = await npm(
		['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
		root,
	);
	const [packed] = JSON.parse(stdout);
	assert(packed.files.some(file => file.path === 'html/models.d.ts'));
	assert(
		!packed.files.some(file => file.path.startsWith('src/') || file.path === 'html/index.htm'),
	);

	const consumer = join(directory, 'consumer');
	await mkdir(consumer);
	await writeFile(
		join(consumer, 'package.json'),
		JSON.stringify({ name: 'foodguide-package-consumer', private: true, type: 'module' }),
	);
	await npm(
		[
			'install',
			'--offline',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			join(directory, packed.filename),
		],
		consumer,
	);
	await copyFile(join(root, 'tests/types/library-consumer.ts'), join(consumer, 'consumer.ts'));
	await writeFile(
		join(consumer, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				strict: true,
				noEmit: true,
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				target: 'ES2022',
				types: [],
				lib: ['ES2022', 'DOM'],
			},
			include: ['consumer.ts'],
		}),
	);
	for (const options of [[], ['--module', 'ES2022', '--moduleResolution', 'bundler']]) {
		await run(process.execPath, [compiler, '-p', 'tsconfig.json', ...options], {
			cwd: consumer,
		});
	}

	const metadata = JSON.parse(
		await readFile(join(consumer, 'node_modules/foodguide/package.json'), 'utf8'),
	);
	const entryPoints = Object.keys(metadata.exports)
		.filter(key => !key.includes('*') && key !== './package.json')
		.map(key => (key === '.' ? 'foodguide' : `foodguide/${key.slice(2)}`));
	await writeFile(
		join(consumer, 'runtime.mjs'),
		`import assert from 'node:assert/strict';
const { food } = await import('foodguide/food');
assert(food.length > 300);
assert(food.filter(item => item.key === 'carrot').includes(food.carrot));
assert.equal(food.byName('carrot').id, 'carrot');
const { recipes, listLocales } = await import('foodguide');
assert(recipes.length > 130);
assert.equal(recipes.byName('meatballs').name, 'Meatballs');
assert.equal(recipes.meatballs.name, 'Meatballs');
assert(listLocales().includes('es'));
for (const entryPoint of ${JSON.stringify(entryPoints)}) await import(entryPoint);
await import('foodguide/locales/es');
await import('foodguide/locales/zh');
`,
	);
	await run(process.execPath, ['runtime.mjs'], { cwd: consumer });
});
