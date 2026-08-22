import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT_DIR = join(import.meta.dirname, '..');
const HTTP_SERVER = join(
	ROOT_DIR,
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'http-server.cmd' : 'http-server',
);

const startServer = () => {
	const server = spawn(
		HTTP_SERVER,
		['html', '-p', '0', '-a', '127.0.0.1', '-i', 'false', '-c', '-1'],
		{
			cwd: ROOT_DIR,
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);

	const output = [];
	let settled = false;
	let resolveReady;
	let rejectReady;
	const ready = new Promise((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});

	const handleOutput = chunk => {
		output.push(chunk.toString());
		const match = output.join('').match(/http:\/\/127\.0\.0\.1:(\d+)/);
		if (!settled && match) {
			settled = true;
			resolveReady(`http://127.0.0.1:${match[1]}`);
		}
	};

	server.stdout.on('data', handleOutput);
	server.stderr.on('data', handleOutput);
	server.once('error', error => {
		if (!settled) {
			settled = true;
			rejectReady(error);
		}
	});
	server.once('exit', code => {
		if (!settled) {
			settled = true;
			rejectReady(new Error(`http-server exited before becoming ready (code ${code})`));
		}
	});

	return { server, ready };
};

const stopServer = server => {
	if (!server.killed) {
		server.kill();
	}
};

test('loads the guide, assets, translations, and a rendered food table', async () => {
	const { server, ready } = startServer();
	let browser;

	try {
		const baseUrl = await ready;
		const browserOptions = { headless: true };

		if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
			browserOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
		}

		browser = await chromium.launch(browserOptions);
		const page = await browser.newPage();
		const pageErrors = [];
		page.on('pageerror', error => pageErrors.push(error));

		const response = await page.goto(`${baseUrl}/index.html`, {
			waitUntil: 'domcontentloaded',
		});
		assert.equal(response?.status(), 200);
		await page.locator('#language-picker').waitFor();
		assert.equal(await page.title(), "Don't Starve Food Guide");
		assert.equal(await page.locator('#navbar li[data-tab]').count(), 7);
		assert.equal(await page.locator('#language-picker').count(), 1);
		assert.equal(await page.locator('#theme-toggle').count(), 1);

		const manifestResponse = await page.request.get(`${baseUrl}/img/sprites/sprites.json`);
		assert.equal(manifestResponse.status(), 200);
		assert.equal((await manifestResponse.json()).cellSize, 64);

		await page.locator('#navbar li[data-tab="foodlist"]').click();
		await page.locator('#food table tr:nth-child(2)').waitFor();
		assert.ok((await page.locator('#food table tr').count()) > 1);
		assert.match(
			await page
				.locator('#food .icon')
				.first()
				.evaluate(element => element.style.backgroundImage),
			/sprites\/sheet-0\.png/,
		);

		await page.locator('#language-picker').selectOption('es');
		assert.equal(await page.locator('html').getAttribute('lang'), 'es');
		assert.equal(await page.locator('[data-i18n="tabSimulator"]').textContent(), 'Simulador');

		assert.deepEqual(pageErrors, []);
	} finally {
		if (browser) {
			await browser.close();
		}
		stopServer(server);
	}
});
