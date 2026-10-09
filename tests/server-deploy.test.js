import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const exec = promisify(execFile);
const deployScript = fileURLToPath(new URL('../scripts/server/deploy.sh', import.meta.url));

const createDeployment = async t => {
	const root = await mkdtemp(join(tmpdir(), 'foodguide-deploy-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const origin = join(root, 'origin');
	const checkout = join(root, 'checkout');
	const serving = join(root, 'serving');
	await mkdir(origin);
	await mkdir(serving);
	await exec('git', ['init', '--initial-branch=main', origin]);
	const git = args => exec('git', ['-C', origin, ...args]);
	await git(['config', 'user.name', 'Deployment Test']);
	await git(['config', 'user.email', 'deployment-test@example.invalid']);
	await mkdir(join(origin, 'html'));
	await writeFile(join(origin, 'html', 'index.htm'), 'current guide');
	await writeFile(
		join(origin, 'generate.mjs'),
		`import { mkdir, writeFile } from 'node:fs/promises';
if (process.env.FOODGUIDE_TEST_FAIL_BUILD) throw new Error('Sprite generation failed');
await mkdir('html/img/sprites', { recursive: true });
await writeFile('html/img/sprites/sprites.json', '{"generated":true}');
`,
	);
	await writeFile(
		join(origin, 'package.json'),
		JSON.stringify({
			name: 'foodguide-deployment-fixture',
			version: '1.0.0',
			scripts: {
				preinstall: 'node -e "process.exit(1)"',
				build: 'node generate.mjs',
				'generate-sprites': 'node generate.mjs',
			},
		}),
	);
	await writeFile(
		join(origin, 'package-lock.json'),
		JSON.stringify({
			name: 'foodguide-deployment-fixture',
			version: '1.0.0',
			lockfileVersion: 3,
			packages: {
				'': { name: 'foodguide-deployment-fixture', version: '1.0.0' },
			},
		}),
	);
	await git(['add', '.']);
	await git(['commit', '-m', 'Deployment fixture']);
	await exec('git', ['clone', origin, checkout]);
	await writeFile(join(serving, 'index.htm'), 'previous guide');
	await writeFile(join(serving, 'obsolete.txt'), 'obsolete asset');
	return {
		serving,
		deploy: extraEnv =>
			exec('bash', [deployScript], {
				env: { ...process.env, REPO_DIR: checkout, SERVE_DIR: serving, ...extraEnv },
			}),
	};
};

// The webhook deployment targets Linux servers and depends on flock and rsync.
test(
	'server deployment publishes generated assets and removes obsolete files',
	{
		skip: process.platform !== 'linux',
	},
	async t => {
		const { serving, deploy } = await createDeployment(t);
		await deploy();
		assert.equal(await readFile(join(serving, 'index.htm'), 'utf8'), 'current guide');
		assert.deepEqual(
			JSON.parse(await readFile(join(serving, 'img/sprites/sprites.json'), 'utf8')),
			{
				generated: true,
			},
		);
		await assert.rejects(readFile(join(serving, 'obsolete.txt')), { code: 'ENOENT' });
	},
);

test(
	'a failed sprite build leaves the existing deployment untouched',
	{
		skip: process.platform !== 'linux',
	},
	async t => {
		const { serving, deploy } = await createDeployment(t);
		await assert.rejects(
			deploy({ FOODGUIDE_TEST_FAIL_BUILD: '1' }),
			/Sprite generation failed/,
		);
		assert.equal(await readFile(join(serving, 'index.htm'), 'utf8'), 'previous guide');
		assert.equal(await readFile(join(serving, 'obsolete.txt'), 'utf8'), 'obsolete asset');
	},
);
