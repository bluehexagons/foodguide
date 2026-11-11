import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import httpServer from 'http-server';
import { createHash } from 'node:crypto';
import { chromium, firefox } from 'playwright';

const browserType = process.env.PLAYWRIGHT_BROWSER === 'firefox' ? firefox : chromium;

const root = new URL('../html/', import.meta.url);
const originalWorker = await readFile(new URL('sw.js', root), 'utf8');
const newline = originalWorker.indexOf('\n');
const originalConfig = JSON.parse(originalWorker.slice('const config = '.length, newline - 1));
const digest = data => createHash('sha256').update(data).digest('hex');

for (const scope of ['/', '/foodguide/']) {
	test(`CI smoke: offline guide and safe updates at ${scope}`, { timeout: 60000 }, async t => {
		let worker = originalWorker;
		let version = await readFile(new URL('version.js', root));
		let broken = true;
		const server = createServer(async (request, response) => {
			try {
				const path = new URL(request.url, 'http://localhost').pathname;
				if (!path.startsWith(scope)) {
					response.writeHead(404).end();
					return;
				}
				const relative = path.slice(scope.length) || 'index.html';
				if (relative.includes('..')) {
					response.writeHead(400).end();
					return;
				}
				const body =
					relative === 'sw.js'
						? worker
						: relative === 'version.js'
							? version
							: await readFile(new URL(relative, root));
				if (broken === true && relative === 'style/main.css') {
					response.writeHead(503).end();
					return;
				}
				const type = relative.endsWith('.js')
					? 'text/javascript'
					: relative.endsWith('.css')
						? 'text/css'
						: relative.endsWith('.html') || relative.endsWith('.htm')
							? 'text/html'
							: relative.endsWith('.png')
								? 'image/png'
								: 'application/json';
				response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
				response.end(
					broken === 'mismatch' && relative === 'version.js'
						? 'different deployment'
						: body,
				);
			} catch {
				response.writeHead(404).end();
			}
		});
		await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
		t.after(() => new Promise(resolve => server.close(resolve)));
		const browser = await browserType.launch({ headless: true });
		t.after(() => browser.close());
		const context = await browser.newContext();
		const url = `http://127.0.0.1:${server.address().port}${scope}`;
		let page = await context.newPage();
		await page.goto(url + '#simulator?game=together&ingredients=carrot,carrot,carrot,meat');
		await page.waitForFunction(() =>
			document
				.querySelector('#offline-status')
				.textContent.includes('Offline download failed'),
		);
		assert.equal(
			await page.evaluate(() => caches.keys().then(keys => keys.length)),
			0,
			'A failed first download leaves no usable cache',
		);
		broken = false;
		await page.goto(url + '#about');
		await page.locator('#offline-retry').click();
		await page.waitForFunction(
			() => document.querySelector('#offline-status').textContent === 'Ready to use offline.',
		);
		await page.goto(url + '#simulator?game=together&ingredients=carrot,carrot,carrot,meat');
		await page.evaluate(() =>
			navigator.serviceWorker.ready.then(
				() =>
					new Promise(resolve => {
						if (navigator.serviceWorker.controller) {
							resolve();
						} else {
							navigator.serviceWorker.addEventListener('controllerchange', resolve, {
								once: true,
							});
						}
					}),
			),
		);
		const manifest = await page.evaluate(async () =>
			(await fetch('manifest.webmanifest')).json(),
		);
		assert.equal(manifest.scope, './');
		assert.deepEqual(
			manifest.icons.map(icon => icon.sizes),
			['192x192', '512x512'],
		);
		await page.locator('#cookbook-dish-name').fill('Offline dinner');
		await page.getByRole('button', { name: 'Save dish', exact: true }).click();
		await page.waitForFunction(() => document.querySelectorAll('.cookbook-card').length === 1);
		await context.setOffline(true);
		await page.close();
		page = await context.newPage();
		await page.goto(
			url + '?installed=1#simulator?game=together&ingredients=carrot,carrot,carrot,meat',
		);
		await page.waitForFunction(
			() => document.querySelectorAll('#simulator .ingredient[data-id]').length === 4,
		);
		assert.equal(
			await page.locator('.cookbook-card .cookbook-dish-name').textContent(),
			'Offline dinner',
		);
		await page.locator('#language-picker').selectOption('es');
		await page.locator('#simulator .ingredientpicker').fill('Zanahoria');
		await page
			.locator('#simulator')
			.getByRole('option', { name: 'Zanahoria 3', exact: true })
			.waitFor();
		const assets = await page.evaluate(
			async paths => {
				for (const path of paths) {
					let response;
					try {
						response = await fetch(path);
					} catch {
						return path;
					}
					if (!response.ok) {
						return path;
					}
				}
				return null;
			},
			originalConfig.assets.map(asset => asset.path),
		);
		assert.equal(assets, null, 'Every deployed asset is available offline');
		await page.locator('#language-picker').selectOption('en');
		await context.setOffline(false);
		// A registration can outlive manually cleared or evicted cached assets.
		await page.evaluate(async () => {
			for (const key of await caches.keys()) {
				await caches.delete(key);
			}
		});
		await page.reload();
		await page.waitForFunction(() =>
			document
				.querySelector('#offline-status')
				.textContent.includes('Offline download failed'),
		);
		assert.equal(await page.locator('.cookbook-dish-name').textContent(), 'Offline dinner');
		await page.goto(url + '#about');
		await page.locator('#offline-retry').click();
		await page.waitForFunction(
			() => document.querySelector('#offline-status').textContent === 'Ready to use offline.',
		);
		await context.setOffline(true);
		await page.reload();
		await page.waitForFunction(
			() => document.querySelector('#offline-status').textContent === 'Ready to use offline.',
		);
		await context.setOffline(false);
		const nextBuild = () => {
			version = Buffer.from(
				`document.getElementById('build-version').textContent = 'Test upgrade';\n`,
			);
			const config = structuredClone(originalConfig);
			config.id = 'test-upgrade';
			config.assets.find(asset => asset.path === 'version.js').hash = digest(version);
			worker = `const config = ${JSON.stringify(config)};\n${originalWorker.slice(newline + 1)}`;
		};
		nextBuild();
		broken = true;
		await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.getRegistration();
			await registration.update();
		});
		await page.waitForFunction(
			async () =>
				document
					.querySelector('#offline-status')
					.textContent.includes('Update download failed') &&
				!(await navigator.serviceWorker.getRegistration()).installing &&
				(await caches.keys()).length === 1 &&
				!(await navigator.serviceWorker.getRegistration()).waiting,
		);
		await context.setOffline(true);
		await page.reload();
		await page.waitForFunction(
			() => document.querySelector('.cookbook-dish-name')?.textContent === 'Offline dinner',
		);
		await context.setOffline(false);
		broken = 'mismatch';
		await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
		await page.waitForFunction(
			async () =>
				document
					.querySelector('#offline-status')
					.textContent.includes('Update download failed') &&
				!(await navigator.serviceWorker.getRegistration()).installing &&
				(await caches.keys()).length === 1 &&
				!(await navigator.serviceWorker.getRegistration()).waiting,
		);
		broken = false;
		await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
		await page.waitForFunction(() => !document.querySelector('#offline-update').hidden);
		// An evicted waiting build cannot be activated until it is restored.
		await page.evaluate(() =>
			caches.delete(`foodguide:${location.origin}${location.pathname}:test-upgrade`),
		);
		assert.equal(
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.getRegistration();
				const channel = new MessageChannel();
				return new Promise(resolve => {
					channel.port1.onmessage = event => {
						channel.port1.close();
						resolve(event.data);
					};
					registration.waiting.postMessage({ type: 'ACTIVATE' }, [channel.port2]);
				});
			}),
			'MISSING',
		);
		await page.reload();
		await page.waitForFunction(
			async () =>
				document
					.querySelector('#offline-status')
					.textContent.includes('Update download failed') &&
				!(await navigator.serviceWorker.getRegistration()).installing,
		);
		await page.goto(url + '#about');
		await page.locator('#offline-retry').click();
		await page.waitForFunction(() => !document.querySelector('#offline-update').hidden);
		const second = await context.newPage();
		await second.goto(url);
		await page.locator('#offline-update').click();
		await page.waitForFunction(() =>
			document
				.querySelector('#offline-status')
				.textContent.startsWith('Close other guide tabs'),
		);
		await page.setViewportSize({ width: 320, height: 812 });
		for (const locale of ['en', 'es', 'pt-BR', 'ru', 'zh']) {
			await page.locator('#language-picker').selectOption(locale);
			assert.equal(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
				true,
				`${locale}: update notice fits a narrow screen`,
			);
			assert.ok((await page.locator('#offline-update').textContent()).trim());
		}
		await page.locator('#language-picker').selectOption('en');
		await second.close();
		await page.locator('#offline-update').click();
		await page.waitForFunction(
			() => document.querySelector('#build-version').textContent === 'Test upgrade',
		);
		assert.equal(await page.locator('.cookbook-dish-name').textContent(), 'Offline dinner');
		assert.equal(await page.evaluate(() => caches.keys().then(keys => keys.length)), 1);
		await context.setOffline(true);
		await page.reload();
		await page.waitForFunction(
			() => document.querySelector('#build-version').textContent === 'Test upgrade',
		);
	});
}

test('offline data and assets survive a full browser restart', { timeout: 60000 }, async t => {
	const profile = await mkdtemp(join(tmpdir(), 'foodguide-offline-profile-'));
	const server = httpServer.createServer({ root: fileURLToPath(root), cache: -1 });
	let context;
	t.after(async () => {
		await context?.close();
		await new Promise(resolve => server.server.close(resolve));
		await rm(profile, { recursive: true, force: true });
	});
	await new Promise((resolve, reject) => {
		server.server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const url = `http://127.0.0.1:${server.server.address().port}/#simulator?game=together&ingredients=carrot,carrot,carrot,meat`;
	context = await browserType.launchPersistentContext(profile, { headless: true });
	let page = context.pages()[0] ?? (await context.newPage());
	await page.goto(url);
	await page.waitForFunction(
		() => document.querySelector('#offline-status').textContent === 'Ready to use offline.',
	);
	await page.locator('#cookbook-dish-name').fill('Dinner after restart');
	await page.getByRole('button', { name: 'Save dish', exact: true }).click();
	await page.waitForFunction(
		() => document.querySelector('.cookbook-dish-name')?.textContent === 'Dinner after restart',
	);
	await context.close();
	// This launches a new browser process using only the saved on-disk profile.
	context = await browserType.launchPersistentContext(profile, { headless: true });
	await context.setOffline(true);
	page = context.pages()[0] ?? (await context.newPage());
	await page.goto(url);
	await page.waitForFunction(
		() => document.querySelector('#offline-status').textContent === 'Ready to use offline.',
	);
	assert.equal(await page.locator('.cookbook-dish-name').textContent(), 'Dinner after restart');
	assert.match(await page.locator('#results').textContent(), /Meatballs/);
	await page.locator('#language-picker').selectOption('ru');
	assert.equal(
		await page
			.locator('#simulator .ingredient[data-id^="carrot"] .ingredient-name')
			.first()
			.textContent(),
		'Морковь',
	);
	assert.equal(
		await page.evaluate(async () => (await fetch('img/sprites/sprites.json')).ok),
		true,
	);
});
