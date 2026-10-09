import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT_DIR = join(import.meta.dirname, '..');
const HTTP_SERVER = join(ROOT_DIR, 'node_modules/http-server/bin/http-server');

const startServer = () => {
	const server = spawn(
		process.execPath,
		[HTTP_SERVER, 'html', '-p', '0', '-a', '127.0.0.1', '-i', 'false', '-c', '-1'],
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

	const timeout = setTimeout(() => {
		if (!settled) {
			settled = true;
			server.kill();
			rejectReady(new Error(`http-server did not become ready: ${output.join('')}`));
		}
	}, 20_000);
	timeout.unref();

	const handleOutput = chunk => {
		output.push(chunk.toString());
		const match = output.join('').match(/http:\/\/127\.0\.0\.1:(\d+)/);
		if (!settled && match) {
			settled = true;
			clearTimeout(timeout);
			resolveReady(`http://127.0.0.1:${match[1]}`);
		}
	};

	server.stdout.on('data', handleOutput);
	server.stderr.on('data', handleOutput);
	server.once('error', error => {
		if (!settled) {
			settled = true;
			clearTimeout(timeout);
			rejectReady(error);
		}
	});
	server.once('exit', code => {
		if (!settled) {
			settled = true;
			clearTimeout(timeout);
			rejectReady(new Error(`http-server exited before becoming ready (code ${code})`));
		}
	});

	return { server, ready };
};

const stopServer = async server => {
	if (!server.pid || server.exitCode !== null || server.signalCode !== null) {
		return;
	}
	const closed = new Promise(resolve => server.once('close', resolve));
	server.kill();
	await closed;
};

const createBrowserFixture = async t => {
	const { server, ready } = startServer();
	t.after(() => stopServer(server));
	const baseUrl = await ready;
	const browser = await chromium.launch({
		headless: true,
		...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
			: {}),
	});
	t.after(() => browser.close());
	return { baseUrl, browser };
};

test('loads the guide, assets, translations, and a rendered food table', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
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

	const sortButton = page.locator('#simulator button.sortingredients');
	await sortButton.focus();
	await sortButton.press('ArrowDown');
	assert.equal(await sortButton.getAttribute('aria-expanded'), 'true');
	await page.keyboard.press('End');
	assert.equal(await page.locator(':focus').getAttribute('data-value'), 'perish');
	await page.keyboard.press('Enter');
	assert.equal(await sortButton.getAttribute('aria-expanded'), 'false');
	assert.equal(
		await page
			.locator(':focus')
			.evaluate(
				element => element === document.querySelector('#simulator button.sortingredients'),
			),
		true,
	);
	assert.equal(
		await page
			.locator('#simulator [role="menuitemradio"][data-value="perish"]')
			.getAttribute('aria-checked'),
		'true',
	);
	assert.equal(
		JSON.parse(await page.evaluate(() => localStorage.getItem('foodGuideSortPreference')))[0],
		'perish',
	);
	await sortButton.press('ArrowUp');
	await page.keyboard.press('Escape');
	assert.equal(await sortButton.getAttribute('aria-expanded'), 'false');
	await sortButton.press('ArrowDown');
	await page.keyboard.press('Enter');

	const search = page.locator('#simulator .ingredientpicker');
	await search.fill('mushroom');
	for (const name of ['Red Cap', 'Green Cap', 'Blue Cap']) {
		assert.equal(
			await page.locator(`#simulator [role="option"][aria-label="${name}"]`).count(),
			1,
		);
	}
	for (const name of ['Meat', 'Berries', 'Berries', 'Berries']) {
		await search.fill(name);
		await search.press('ArrowDown');
		assert.equal(
			await page
				.locator('#simulator [role="option"][aria-selected="true"]')
				.getAttribute('aria-label'),
			name,
		);
		await search.press('Enter');
	}
	assert.equal(await page.locator('#ingredients .icon').count(), 4);
	await page.locator('#results a').getByText('Meatballs', { exact: true }).first().waitFor();

	await page.locator('#navbar li[data-tab="foodlist"]').focus();
	await page.locator('#navbar li[data-tab="foodlist"]').press('Enter');
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
});

test('recovers from stale or reserved names in saved preferences', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	for (const settings of [
		{ activeTab: '__proto__', version: 'constructor', baseMode: 'toString' },
		{ activeTab: 'simulator', version: 'together', character: 'constructor' },
	]) {
		const page = await browser.newPage();
		const errors = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.addInitScript(
			state => {
				localStorage.setItem('foodGuideState', JSON.stringify(state));
				localStorage.setItem('foodGuideLocale', 'constructor');
			},
			{
				...settings,
				pickers: [
					['filter', '__proto__', 'carrot', '0'],
					['byName', 'constructor', 'meat'],
				],
			},
		);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		assert.deepEqual(errors, []);
		assert.equal(await page.locator('html').getAttribute('lang'), 'en');
		assert.equal(
			await page.locator('#navbar [data-tab="simulator"]').getAttribute('aria-pressed'),
			'true',
		);
		assert.equal(await page.locator('#ingredients .icon').count(), 1);
		assert.equal(await page.locator('#ingredients .icon').getAttribute('title'), 'Carrot');
		assert.equal(await page.locator('#discovery .ingredient .icon').count(), 1);
		await page.close();
	}
});

test('legacy settings and both ingredient pickers survive migration and reload', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await browser.newPage({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: baseUrl,
					localStorage: [
						{
							name: 'foodGuideState',
							value: JSON.stringify({
								activeTab: 'help',
								modeMask: 23,
								pickers: [['carrot'], ['meat', 'berries']],
							}),
						},
					],
				},
			],
		},
	});
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	assert.equal(
		await page.locator('#navbar [data-tab="about"]').getAttribute('aria-pressed'),
		'true',
	);
	assert.equal(
		await page.locator('.version-btn.selected').getAttribute('data-version'),
		'dontstarve',
	);
	assert.equal(await page.locator('.char-btn.selected').getAttribute('data-character'), 'warly');
	assert.equal(await page.locator('.dlc-btn.selected').count(), 2);
	assert.equal(await page.locator('#ingredients .icon').count(), 1);
	assert.equal(await page.locator('#discovery .ingredient .icon').count(), 2);
	await page.reload({ waitUntil: 'networkidle' });
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('foodGuideState')));
	assert.equal(saved.activeTab, 'about');
	assert.equal(saved.version, 'dontstarve');
	assert.equal(saved.character, 'warly');
	assert.deepEqual(saved.dlc, { giants: true, shipwrecked: true });
	assert.equal(saved.pickers[0].filter(Boolean).length, 1);
	assert.equal(saved.pickers[1].filter(Boolean).length, 2);
	assert.equal(await page.locator('#ingredients .icon').count(), 1);
	assert.equal(await page.locator('#discovery .ingredient .icon').count(), 2);
	assert.deepEqual(errors, []);
});

test('tables retain sorting, pinned summaries, column visibility, and linked highlights', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await browser.newPage({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: baseUrl,
					localStorage: [
						{
							name: 'foodGuideState',
							value: JSON.stringify({
								version: 'together',
								pickers: [
									[
										'honey@together',
										'meat@together',
										'meat@together',
										'ice@together',
									],
									['carrot@together', 'meat@together', 'berries@together'],
								],
							}),
						},
					],
				},
			],
		},
	});
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const cooking = page.locator('#results table').first();
	const names = () => cooking.locator('td:nth-child(2)').allTextContents();
	await cooking.locator('th[data-sort="health"]').click();
	assert.deepEqual(await names(), ['Total', 'Potential', 'Honey Ham', 'Meatballs', 'Wet Goop']);
	await cooking.locator('th[data-sort="health"]').click();
	assert.deepEqual(await names(), ['Total', 'Potential', 'Wet Goop', 'Meatballs', 'Honey Ham']);

	const healthToggle = page
		.locator('#results .column-toggle-bar')
		.first()
		.getByRole('button', { name: 'Health', exact: true });
	await healthToggle.click();
	assert.equal(await cooking.locator('th[data-sort="health"]').isVisible(), false);
	assert.equal(await cooking.locator('td:nth-child(3).col-hidden').count(), 5);
	await cooking.locator('th[data-sort="name"]').click();
	assert.equal(await cooking.locator('td:nth-child(3).col-hidden').count(), 5);
	await healthToggle.click();
	assert.equal(await cooking.locator('th[data-sort="health"]').isVisible(), true);

	await page.locator('#navbar [data-tab="foodlist"]').click();
	const cookedCarrot = page.locator('#food [data-link="*Roasted Carrot"] .icon').first();
	await cookedCarrot.click();
	assert.deepEqual(await page.locator('#food .highlighted td:nth-child(2)').allTextContents(), [
		'Roasted Carrot',
	]);
	await cookedCarrot.click();
	assert.equal(await page.locator('#food .highlighted').count(), 0);

	await page.locator('#food [data-link="recipe:Meatballs"] .icon').first().click();
	assert.equal(
		await page.locator('#navbar [data-tab="crockpot"]').getAttribute('aria-pressed'),
		'true',
	);
	assert.deepEqual(
		await page.locator('#recipes .highlighted td:nth-child(2)').allTextContents(),
		['Meatballs'],
	);
	await page.locator('#recipes th[data-sort="health"]').click();
	assert.equal(await page.locator('#recipes .highlighted').count(), 1);

	const meatLink = page.locator('#recipes [data-link="tag:meat"]').first();
	await meatLink.click();
	const meatHighlights = await page
		.locator('#food .highlighted td:nth-child(2)')
		.allTextContents();
	assert.ok(meatHighlights.includes('Meat'));
	assert.ok(meatHighlights.length > 1);
	await page.locator('#navbar [data-tab="crockpot"]').click();
	await meatLink.click();
	assert.deepEqual(
		await page.locator('#food .highlighted td:nth-child(2)').allTextContents(),
		meatHighlights,
	);

	await page.locator('#navbar [data-tab="discovery"]').click();
	assert.equal(await page.locator('#discoverfood td:nth-child(2)').count(), 3);
	await page.locator('#discoverfood th[data-sort="health"]').click();
	await page.locator('#discover th[data-sort="health"]').click();
	await page.locator('#makable .makablebutton').click();
	await page.waitForFunction(() => {
		const button = document.querySelector('#makable .makablebutton');
		return button && !button.disabled;
	});
	assert.ok((await page.locator('#makable td:nth-child(2)').count()) > 0);
	await page.locator('#makable th[data-sort="name"]').click();
	const analyzedNames = await page.locator('#makable td:nth-child(2)').allTextContents();
	assert.deepEqual(analyzedNames, [...analyzedNames].sort());
	assert.deepEqual(errors, []);
});
