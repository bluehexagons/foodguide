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

const createSavedPage = (browser, baseUrl, state) =>
	browser.newPage({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: baseUrl,
					localStorage: [{ name: 'foodGuideState', value: JSON.stringify(state) }],
				},
			],
		},
	});

const trackDiagnostics = page => {
	const diagnostics = [];
	page.on('pageerror', error => diagnostics.push(error.message));
	page.on('console', message => {
		if (['warning', 'error'].includes(message.type())) {
			diagnostics.push(message.text());
		}
	});
	return diagnostics;
};

// Vary the markup without changing the control's identity or registered listeners.
const nestControlContents = locator =>
	locator.evaluate(element => {
		const content = document.createElement('span');
		content.className = 'test-control-content';
		content.append(...element.childNodes);
		if (!content.hasChildNodes()) {
			content.style.display = 'block';
			content.style.width = '100%';
			content.style.height = '100%';
		}
		element.appendChild(content);
	});

for (const { tab, slots, limited } of [
	{ tab: 'simulator', slots: '#ingredients', limited: true },
	{ tab: 'discovery', slots: '#inventory', limited: false },
]) {
	test(`${tab} picker handles mouse clicks on ingredient names, icons, and padding`, async t => {
		const { baseUrl, browser } = await createBrowserFixture(t);
		const page = await createSavedPage(browser, baseUrl, {
			activeTab: tab,
			version: 'together',
			pickers: [[], []],
		});
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		const search = page.locator(`#${tab} .ingredientpicker`);
		const meat = page.locator(`#${tab}`).getByRole('option', { name: 'Meat', exact: true });
		const selectedKeys = () =>
			page
				.locator(`${slots} .ingredient[data-id]`)
				.evaluateAll(items => items.map(item => item.dataset.id));
		await search.fill('Meat');
		await meat.locator('.text').click();
		assert.deepEqual(await selectedKeys(), ['meat@together']);
		await meat.locator('.icon').click();
		assert.deepEqual(await selectedKeys(), limited ? ['meat@together', 'meat@together'] : []);
		await meat.click({ position: { x: 2, y: 10 } });
		assert.deepEqual(
			await selectedKeys(),
			limited ? ['meat@together', 'meat@together', 'meat@together'] : ['meat@together'],
		);
		await meat.locator('.text').click({ button: 'right' });
		assert.deepEqual(await selectedKeys(), limited ? ['meat@together', 'meat@together'] : []);
		await meat.locator('.text').click();
		await search.fill('Berries');
		const berries = page
			.locator(`#${tab}`)
			.getByRole('option', { name: 'Berries', exact: true });
		await berries.locator('.text').click();
		const fullSelection = await selectedKeys();
		assert.deepEqual(
			fullSelection,
			limited
				? ['meat@together', 'meat@together', 'meat@together', 'berries@together']
				: ['meat@together', 'berries@together'],
		);
		if (limited) {
			await berries.locator('.text').click();
			assert.match(await berries.getAttribute('class'), /ingredient-action-error/);
			assert.deepEqual(await selectedKeys(), fullSelection);
		} else {
			await berries.locator('.text').click();
			assert.deepEqual(await selectedKeys(), ['meat@together']);
		}
		await berries.locator('.text').click({ button: 'right' });
		if (limited) {
			assert.deepEqual(await selectedKeys(), fullSelection.slice(0, -1));
		} else {
			assert.match(await berries.getAttribute('class'), /ingredient-action-error/);
			assert.deepEqual(await selectedKeys(), ['meat@together']);
		}
		assert.deepEqual(diagnostics, []);
	});
}

test('nested control contents preserve mode changes, slot removal, table sorting, and links', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [
			['honey', 'meat', 'meat', 'carrot'],
			['meat', 'carrot'],
		],
	});
	const diagnostics = trackDiagnostics(page);
	page.setDefaultTimeout(5000);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	for (const name of ["Don't Starve", 'Reign of Giants', 'Webber', "Don't Starve Together"]) {
		const button = page.getByRole('button', { name, exact: true });
		await nestControlContents(button);
		await button.locator('.test-control-content').click();
		assert.equal(await button.getAttribute('aria-pressed'), 'true');
	}
	const slot = page.locator('#ingredients [data-id="meat@together"]').first();
	await nestControlContents(slot);
	await slot.locator('.icon').click();
	assert.deepEqual(
		await page
			.locator('#ingredients .icon')
			.evaluateAll(icons => icons.map(icon => icon.title)),
		['Honey', 'Meat', 'Carrot'],
	);
	const search = page.locator('#simulator .ingredientpicker');
	await search.fill('Meat');
	await search.press('ArrowDown');
	await search.press('Enter');
	const requirement = page.locator('#results [data-link="tag:meat"]').first();
	await nestControlContents(requirement);
	await requirement.locator('.test-control-content').click();
	assert.equal(await search.inputValue(), 'meat');
	assert.equal(
		await page
			.locator('#simulator [role="menuitemradio"][data-value="tag"]')
			.getAttribute('aria-checked'),
		'true',
	);

	await page.locator('#navbar [data-tab="foodlist"]').click();
	const health = page.locator('#food th[data-sort="health"]');
	await nestControlContents(health.locator('button'));
	for (const direction of ['sort-desc', 'sort-asc']) {
		await health.locator('.test-control-content').click();
		assert.match(await health.getAttribute('class'), new RegExp(direction));
	}
	const cookedCarrot = page.locator('#food [data-link="*Roasted Carrot"]').first();
	await nestControlContents(cookedCarrot);
	await cookedCarrot.locator('.icon').click();
	assert.deepEqual(await page.locator('#food .highlighted td:nth-child(2)').allTextContents(), [
		'Roasted Carrot',
	]);
	const meatballs = page.locator('#food [data-link="recipe:Meatballs"]').first();
	await nestControlContents(meatballs);
	await meatballs.locator('.icon').click();
	assert.equal(
		await page.locator('#navbar [data-tab="crockpot"]').getAttribute('aria-pressed'),
		'true',
	);
	assert.deepEqual(
		await page.locator('#recipes .highlighted td:nth-child(2)').allTextContents(),
		['Meatballs'],
	);
	await page.locator('#navbar [data-tab="discovery"]').click();
	const inventorySlot = page.locator('#inventory [data-id="meat@together"]');
	await nestControlContents(inventorySlot);
	await inventorySlot.locator('.icon').click({ button: 'right' });
	assert.equal(await page.locator('#inventory .ingredient[data-id]').count(), 1);
	assert.equal(
		await page.locator('#inventory .ingredient[data-id]').getAttribute('title'),
		'Carrot',
	);
	assert.deepEqual(diagnostics, []);
});

test('analyzer filter clicks preserve other exclusions and match the displayed results', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'discovery',
		version: 'dontstarve',
		pickers: [[], ['meat', 'carrot', 'berries', 'honey']],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.locator('#makable .makablebutton').click();
	await page.waitForFunction(() => !document.querySelector('#makable .makablebutton').disabled);
	const names = () => page.locator('#makable td:nth-child(2)').allTextContents();
	assert.ok((await names()).includes('Meatballs'));
	assert.ok((await names()).includes('Ratatouille'));
	const meatballs = page.locator('#makable .recipeFilter [title="Meatballs"]');
	const ratatouille = page.locator('#makable .recipeFilter [title="Ratatouille"]');
	for (const icon of [meatballs, ratatouille]) {
		await icon.click({ button: 'right' });
		assert.match(await icon.getAttribute('class'), /excluded/);
	}
	await meatballs.click();
	assert.doesNotMatch(await meatballs.getAttribute('class'), /excluded|selected/);
	assert.match(await ratatouille.getAttribute('class'), /excluded/);
	assert.ok((await names()).includes('Meatballs'));
	assert.ok(!(await names()).includes('Ratatouille'));
	await nestControlContents(ratatouille);
	await ratatouille.locator('.test-control-content').click({ button: 'right' });
	assert.ok((await names()).includes('Ratatouille'));
	await ratatouille.locator('.test-control-content').click();
	assert.deepEqual([...new Set(await names())], ['Ratatouille']);
	await meatballs.click({ button: 'right' });
	assert.doesNotMatch(await ratatouille.getAttribute('class'), /selected/);
	assert.ok((await names()).includes('Ratatouille'));
	assert.ok(!(await names()).includes('Meatballs'));
	const meat = page.locator('#makable .foodFilter [data-id="meat"]');
	await nestControlContents(meat);
	await meat.locator('.test-control-content').click();
	assert.match(await meat.getAttribute('class'), /selected/);
	assert.ok(!(await names()).includes('Ratatouille'));
	await meat.locator('.test-control-content').click({ button: 'right' });
	assert.doesNotMatch(await meat.getAttribute('class'), /selected|excluded/);
	assert.ok((await names()).includes('Ratatouille'));
	assert.deepEqual(diagnostics, []);
});

test('statistics default exclusions keep visible sprites and recalculation follows the game', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'statistics',
		version: 'dontstarve',
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	for (const [version, meatKey] of [
		['dontstarve', 'meat'],
		['together', 'meat@together'],
	]) {
		await page.locator(`.version-btn[data-version="${version}"]`).click();
		await page.locator('#statistics .makablebutton').click();
		await page.locator('#statistics .pauseButton').click();
		assert.equal(
			await page.locator(`#statistics .foodFilter [data-id="${meatKey}"]`).count(),
			1,
		);
		const excluded = page.locator('#statistics .foodFilter .excluded');
		assert.ok((await excluded.count()) > 0);
		assert.equal(
			await excluded.evaluateAll(icons =>
				icons.every(
					icon =>
						icon.classList.contains('icon') && icon.getBoundingClientRect().width > 0,
				),
			),
			true,
		);
		await page.locator('#statistics .deleteButton').click();
		assert.equal(await page.locator('#statistics .makableContainer').count(), 0);
	}
	assert.deepEqual(diagnostics, []);
});

test('changing analyzer inputs cancels pending work and releases translation listeners', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'statistics',
		version: 'together',
		pickers: [[], ['meat', 'carrot']],
	});
	const diagnostics = trackDiagnostics(page);
	await page.addInitScript(() => {
		// Observe the real scheduler and listener lifecycle without replacing calculation logic.
		const pending = new Set();
		const schedule = window.setTimeout.bind(window);
		const cancel = window.clearTimeout.bind(window);
		window.setTimeout = (callback, delay, ...args) => {
			if (delay !== 0 || typeof callback !== 'function') {
				return schedule(callback, delay, ...args);
			}
			const id = schedule(() => {
				pending.delete(id);
				callback.apply(window, args);
			}, delay);
			pending.add(id);
			return id;
		};
		window.clearTimeout = id => {
			pending.delete(id);
			cancel(id);
		};
		const listeners = new Set();
		const subscribe = document.addEventListener.bind(document);
		const unsubscribe = document.removeEventListener.bind(document);
		document.addEventListener = (type, listener, options) => {
			if (type === 'foodguide:localechange') {
				listeners.add(listener);
			}
			subscribe(type, listener, options);
		};
		document.removeEventListener = (type, listener, options) => {
			if (type === 'foodguide:localechange') {
				listeners.delete(listener);
			}
			unsubscribe(type, listener, options);
		};
		window.controlAudit = () => ({ pending: pending.size, listeners: listeners.size });
	});
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const baseline = await page.evaluate(() => window.controlAudit());
	assert.equal(baseline.pending, 0);
	await page.locator('#statistics .makablebutton').click();
	assert.ok((await page.evaluate(() => window.controlAudit())).pending > 0);
	await page.locator('.version-btn[data-version="dontstarve"]').click();
	assert.deepEqual(await page.evaluate(() => window.controlAudit()), baseline);
	assert.equal(await page.locator('#statistics .makableContainer').count(), 0);
	await page.locator('#statistics .makablebutton').click();
	await page.locator('#statistics .deleteButton').click();
	assert.deepEqual(await page.evaluate(() => window.controlAudit()), baseline);

	await page.locator('#navbar [data-tab="discovery"]').click();
	await page.locator('#makable .makablebutton').click();
	assert.equal(
		(await page.evaluate(() => window.controlAudit())).listeners,
		baseline.listeners + 2,
	);
	await page.locator('#discovery .ingredientpicker').fill('Berries');
	await page.locator('#discovery [role="option"][aria-label="Berries"] .text').click();
	assert.deepEqual(await page.evaluate(() => window.controlAudit()), baseline);
	assert.equal(await page.locator('#makable .makableContainer').count(), 0);
	assert.equal(await page.locator('#makable .makablebutton').isEnabled(), true);
	assert.deepEqual(diagnostics, []);
});

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

test('table controls support keyboard sorting, toggles, and linked highlights without losing focus', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [['honey@together', 'meat@together', 'meat@together', 'ice@together'], []],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const cooking = page.locator('#results table').first();
	const healthHeader = cooking.locator('th[data-sort="health"]');
	const health = healthHeader.getByRole('button', { name: 'Health', exact: true });
	await health.focus();
	await health.press('Enter');
	assert.equal(await healthHeader.getAttribute('aria-sort'), 'descending');
	assert.deepEqual(await cooking.locator('td:nth-child(2)').allTextContents(), [
		'Total',
		'Potential',
		'Honey Ham',
		'Meatballs',
		'Wet Goop',
	]);
	assert.equal(await health.evaluate(button => button === document.activeElement), true);
	await health.press('Space');
	assert.equal(await healthHeader.getAttribute('aria-sort'), 'ascending');
	assert.deepEqual(await cooking.locator('td:nth-child(2)').allTextContents(), [
		'Total',
		'Potential',
		'Wet Goop',
		'Meatballs',
		'Honey Ham',
	]);
	assert.equal(await health.evaluate(button => button === document.activeElement), true);
	const name = cooking.locator('th[data-sort="name"] button');
	await name.focus();
	await name.press('Enter');
	assert.equal(await healthHeader.getAttribute('aria-sort'), null);
	assert.equal(
		await cooking.locator('th[data-sort="name"]').getAttribute('aria-sort'),
		'ascending',
	);
	assert.equal(await cooking.locator('th[aria-sort]').count(), 1);

	const toggles = page.locator('#results .column-toggle-bar').first();
	const healthToggle = toggles.getByRole('button', { name: 'Health', exact: true });
	assert.equal(await healthToggle.getAttribute('aria-pressed'), 'true');
	await healthToggle.focus();
	await healthToggle.press('Space');
	assert.equal(await healthToggle.getAttribute('aria-pressed'), 'false');
	assert.equal(await healthHeader.isVisible(), false);
	await healthToggle.press('Enter');
	assert.equal(await healthToggle.getAttribute('aria-pressed'), 'true');
	assert.equal(await healthHeader.isVisible(), true);
	const auto = toggles.getByRole('button', { name: 'Auto', exact: true });
	assert.equal(await auto.getAttribute('aria-pressed'), 'true');
	await auto.focus();
	await auto.press('Enter');
	assert.equal(await auto.getAttribute('aria-pressed'), 'false');

	await page.locator('#navbar [data-tab="foodlist"]').click();
	const carrot = page.locator('#food button[data-link="*Roasted Carrot"]').first();
	assert.equal(await carrot.getAttribute('type'), 'button');
	await carrot.focus();
	await carrot.press('Enter');
	assert.deepEqual(await page.locator('#food .highlighted td:nth-child(2)').allTextContents(), [
		'Roasted Carrot',
	]);
	assert.equal(await carrot.evaluate(button => button === document.activeElement), true);
	await carrot.press('Space');
	assert.equal(await page.locator('#food .highlighted').count(), 0);
	assert.equal(await carrot.evaluate(button => button === document.activeElement), true);
	assert.deepEqual(diagnostics, []);
});

test('repeated picker edits release replaced tables immediately', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [[], []],
	});
	await page.addInitScript(() => {
		const registrations = new Map();
		const add = Set.prototype.add;
		const remove = Set.prototype.delete;
		Set.prototype.add = function (value) {
			if (value instanceof HTMLDivElement && typeof value.updateLocale === 'function') {
				if (!registrations.has(this)) {
					registrations.set(this, new Set());
				}
				add.call(registrations.get(this), value);
			}
			return add.call(this, value);
		};
		Set.prototype.delete = function (value) {
			if (registrations.has(this)) {
				remove.call(registrations.get(this), value);
			}
			return remove.call(this, value);
		};
		window.tableAudit = () => ({
			live: [...document.querySelectorAll('div')].filter(
				element => typeof element.updateLocale === 'function',
			).length,
			registries: [...registrations.values()].map(tables => ({
				count: tables.size,
				detached: [...tables].filter(table => !table.isConnected).length,
			})),
		});
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const assertReleased = async () => {
		const audit = await page.evaluate(() => window.tableAudit());
		assert.equal(audit.registries.length, 2);
		for (const registry of audit.registries) {
			assert.equal(registry.detached, 0, JSON.stringify(audit));
			assert.equal(registry.count, audit.live, JSON.stringify(audit));
		}
	};
	await assertReleased();
	for (const { tab, slots } of [
		{ tab: 'simulator', slots: '#ingredients' },
		{ tab: 'discovery', slots: '#inventory' },
	]) {
		await page.locator(`#navbar [data-tab="${tab}"]`).click();
		const search = page.locator(`#${tab} .ingredientpicker`);
		for (let attempt = 0; attempt < 4; attempt++) {
			for (const ingredient of ['Meat', 'Carrot']) {
				await search.fill(ingredient);
				await page
					.locator(`#${tab}`)
					.getByRole('option', { name: ingredient, exact: true })
					.click();
				await assertReleased();
			}
			while (await page.locator(`${slots} .ingredient[data-id]`).count()) {
				await page.locator(`${slots} .ingredient[data-id]`).first().click();
				await assertReleased();
			}
		}
	}
	assert.deepEqual(diagnostics, []);
});

test('table updates honor highlight scrolling and cancel restoration on disposal', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await browser.newPage();
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const result = await page.evaluate(async () => {
		const { createSortableTableFactory } = await import('./sortable-table.js');
		const localeTables = new Set();
		const responsiveTables = new Set();
		const { makeSortableTable, cells } = createSortableTableFactory({
			translate: key => key,
			translateTableLabel: label => label,
			translateTableHint: hint => hint,
			translateSummaryLabel: label => label,
			localeTables,
			responsiveTables,
		});
		const spacer = document.createElement('div');
		spacer.style.height = '3000px';
		document.body.appendChild(spacer);
		let highlight = false;
		const highlighted = makeSortableTable({
			headers: { Name: 'name' },
			dataset: [{ name: 'Carrot' }],
			defaultSort: 'name',
			rowGenerator: item => cells('td', item.name),
			highlightCallback: () => highlight,
		});
		document.body.appendChild(highlighted);
		window.scrollTo(0, 0);
		highlight = true;
		highlighted.update(true);
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const rect = highlighted.querySelector('.highlighted').getBoundingClientRect();
		const highlightVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
		highlighted.dispose();
		highlighted.remove();
		const results = [];
		for (const toggleable of [false, true]) {
			const dataset = [{ name: 'Carrot' }];
			const table = makeSortableTable({
				headers: { Name: 'name' },
				dataset,
				defaultSort: 'name',
				rowGenerator: item => cells('td', item.name),
				columnConfig: { toggleable },
			});
			document.body.appendChild(table);
			window.scrollTo(0, 0);
			table.update();
			table.dispose();
			table.dispose();
			table.remove();
			dataset.push({ name: 'Meat' });
			table.update();
			table.setMaxRows(10);
			window.scrollTo(0, 120);
			await new Promise(resolve =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			);
			results.push({
				locale: localeTables.size,
				responsive: responsiveTables.size,
				rows: table.querySelectorAll('td').length,
				scrollY: window.scrollY,
			});
		}
		spacer.remove();
		return { highlightVisible, disposed: results };
	});
	assert.equal(result.highlightVisible, true);
	assert.deepEqual(result.disposed, [
		{ locale: 0, responsive: 0, rows: 1, scrollY: 120 },
		{ locale: 0, responsive: 0, rows: 1, scrollY: 120 },
	]);
});

test('picker controls and tables fit narrow screens in every locale and game', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	for (const width of [320, 375]) {
		await page.setViewportSize({ width, height: 720 });
		for (const locale of ['en', 'es', 'zh']) {
			await page.locator('#language-picker').selectOption(locale);
			for (const version of ['together', 'dontstarve', 'hamlet']) {
				await page.locator(`.version-btn[data-version="${version}"]`).click();
				for (const tab of ['simulator', 'discovery', 'foodlist', 'crockpot']) {
					await page.locator(`#navbar [data-tab="${tab}"]`).click();
					const layout = await page.evaluate(() => ({
						width: innerWidth,
						pageWidth: document.documentElement.scrollWidth,
						controls: [
							...document.querySelectorAll('.ingredient-search-controls button'),
						]
							.map(button => button.getBoundingClientRect())
							.filter(rect => rect.width > 0)
							.map(rect => ({ left: rect.left, right: rect.right })),
					}));
					const context = `${width}px, ${locale}, ${version}, ${tab}`;
					assert.ok(layout.pageWidth <= layout.width, `Page overflow: ${context}`);
					assert.ok(
						layout.controls.every(rect => rect.left >= 0 && rect.right <= layout.width),
						`Clipped picker controls: ${context}`,
					);
				}
			}
		}
	}
});

test('keyboard mode controls update ingredient variants, analysis, and saved selections', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [
			['meat', 'meat', 'honey', 'carrot'],
			['meat', 'meat@together', 'batnose'],
		],
	});
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const selectedKeys = selector =>
		page
			.locator(`${selector} .ingredient[data-id]`)
			.evaluateAll(slots => slots.map(slot => slot.dataset.id));
	assert.deepEqual(await selectedKeys('#ingredients'), [
		'meat@together',
		'meat@together',
		'honey@together',
		'carrot@together',
	]);
	assert.deepEqual(await selectedKeys('#inventory'), ['meat@together', 'batnose']);

	const dontStarve = page.getByRole('button', { name: "Don't Starve", exact: true });
	await dontStarve.focus();
	await dontStarve.press('Enter');
	assert.equal(await dontStarve.getAttribute('aria-pressed'), 'true');
	assert.deepEqual(await selectedKeys('#ingredients'), ['meat', 'meat', 'honey', 'carrot']);
	assert.deepEqual(await selectedKeys('#inventory'), ['meat']);
	const giants = page.getByRole('button', { name: 'Reign of Giants', exact: true });
	await giants.focus();
	await giants.press('Space');
	assert.equal(await giants.getAttribute('aria-pressed'), 'true');
	const webber = page.getByRole('button', { name: 'Webber', exact: true });
	await webber.focus();
	await webber.press('Enter');
	assert.equal(await webber.getAttribute('aria-pressed'), 'true');
	await webber.press('Space');
	assert.equal(await webber.getAttribute('aria-pressed'), 'false');

	await page.locator('#navbar [data-tab="discovery"]').click();
	await page.locator('#makable .makablebutton').click();
	await page.waitForFunction(() => !document.querySelector('#makable .makablebutton').disabled);
	assert.ok((await page.locator('#makable td:nth-child(2)').count()) > 0);
	await page.reload({ waitUntil: 'networkidle' });
	assert.equal(await dontStarve.getAttribute('aria-pressed'), 'true');
	assert.equal(await giants.getAttribute('aria-pressed'), 'true');
	assert.deepEqual(await selectedKeys('#ingredients'), ['meat', 'meat', 'honey', 'carrot']);
	assert.deepEqual(await selectedKeys('#inventory'), ['meat']);
	assert.deepEqual(errors, []);
});

test('restored DLC ingredients remain available during initial picker creation', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'dontstarve',
		dlc: { giants: true, shipwrecked: false },
		pickers: [['mole'], ['mole']],
	});
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('#ingredients [data-id="mole"]').count(), 1);
	assert.equal(await page.locator('#inventory [data-id="mole"]').count(), 1);
	assert.equal(
		await page
			.getByRole('button', { name: 'Reign of Giants', exact: true })
			.getAttribute('aria-pressed'),
		'true',
	);
});
