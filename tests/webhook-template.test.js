import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const exec = promisify(execFile);
const hasGo = spawnSync('go', ['version'], { stdio: 'ignore' }).status === 0;

test(
	'webhook secret template preserves quotes, backslashes, and newlines in valid JSON',
	{
		skip: !hasGo && 'Go is needed to validate webhook template rendering',
	},
	async () => {
		const secret = 'test-quote"-backslash\\-newline\n';
		const { stdout } = await exec(
			'go',
			[
				'run',
				fileURLToPath(new URL('./helpers/render-hooks.go', import.meta.url)),
				fileURLToPath(new URL('../scripts/server/hooks.json', import.meta.url)),
			],
			{ env: { ...process.env, WEBHOOK_SECRET: secret } },
		);
		const [hook] = JSON.parse(stdout);
		assert.equal(hook['trigger-rule'].match.value, secret);
		assert.deepEqual(hook['trigger-rule'].match.parameter, {
			source: 'header',
			name: 'X-Webhook-Secret',
		});
	},
);
