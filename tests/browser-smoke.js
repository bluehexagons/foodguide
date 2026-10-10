import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import axe from 'axe-core';

const ROOT_DIR = join(import.meta.dirname, '..');
const HTTP_SERVER = join(ROOT_DIR, 'node_modules/http-server/bin/http-server');

const colorContrast = (first, second) => {
	const luminance = color => {
		const channels = color
			.match(/[\d.]+/g)
			.slice(0, 3)
			.map(Number)
			.map(value => {
				const s = value / 255;
				return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			});
		return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
	};
	const a = luminance(first);
	const b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

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

const createSavedPage = (browser, baseUrl, state, options = {}) =>
	browser.newPage({
		...options,
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

test('keyboard navigation covers tabs, picker dismissal, removal, and filter groups', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'simulator',
		version: 'together',
		pickers: [
			['meat', 'berries', 'berries', 'berries'],
			['meat', 'berries'],
		],
	});
	const diagnostics = trackDiagnostics(page);
	page.setDefaultTimeout(10_000);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.keyboard.press('Tab');
	assert.equal(
		await page
			.getByRole('link', { name: 'Skip to content', exact: true })
			.evaluate(e => e === document.activeElement),
		true,
	);
	await page.keyboard.press('Enter');
	assert.equal(await page.locator('main').evaluate(e => e === document.activeElement), true);
	const active = () => page.evaluate(() => document.activeElement?.outerHTML);
	const simulator = page.getByRole('tab', { name: 'Simulator', exact: true });
	await simulator.focus();
	await simulator.press('ArrowLeft');
	assert.equal(
		await page
			.getByRole('tab', { name: 'Game Info', exact: true })
			.getAttribute('aria-selected'),
		'true',
	);
	await page.keyboard.press('Home');
	assert.equal(await simulator.evaluate(e => e === document.activeElement), true);
	await page.keyboard.press('ArrowRight');
	assert.equal(
		await page
			.getByRole('tab', { name: 'Discovery', exact: true })
			.getAttribute('aria-selected'),
		'true',
	);
	assert.equal(await page.locator('#navbar [tabindex="0"]').count(), 1);
	await page.keyboard.press('End');
	await page.keyboard.press('Tab');
	// The external game link follows the tablist; then Tab reaches the visible panel.
	await page.keyboard.press('Tab');
	assert.equal(
		await page.locator('#gameinfo').evaluate(e => e === document.activeElement),
		true,
		await active(),
	);
	await simulator.click();
	const input = page.locator('#simulator .ingredientpicker');
	await input.fill('Meat');
	await input.press('ArrowDown');
	const descendant = await input.getAttribute('aria-activedescendant');
	assert.equal(await page.locator(`#${descendant}`).getAttribute('aria-selected'), 'true');
	await input.press('Enter');
	assert.match(
		await page.locator('#simulator [role="status"]').textContent(),
		/The pot is full\. Remove an ingredient before adding Meat\./,
	);
	await input.press('Escape');
	assert.equal(await input.getAttribute('aria-expanded'), 'false');
	assert.equal(await page.locator('#simulator .ingredientdropdown').isVisible(), false);
	assert.equal(await input.getAttribute('aria-activedescendant'), null);
	await input.press('Enter');
	assert.equal(await page.locator('#ingredients [data-id]').count(), 4);
	await input.press('ArrowDown');
	assert.equal(await input.getAttribute('aria-expanded'), 'true');
	const slot = page.locator('#ingredients .ingredient').first();
	await slot.focus();
	await slot.press('Space');
	assert.equal(await slot.evaluate(e => e === document.activeElement), true);
	assert.equal(await slot.getAttribute('aria-label'), 'Remove Berries');
	assert.match(await page.locator('#simulator [role="status"]').textContent(), /Removed Meat/);
	await page.getByRole('tab', { name: 'Discovery', exact: true }).click();
	const meat = page.locator('#inventory [data-id="meat@together"]');
	await meat.focus();
	await meat.press('Enter');
	const berries = page.locator('#inventory [data-id="berries@together"]');
	assert.equal(await berries.evaluate(e => e === document.activeElement), true, await active());
	await berries.press('Space');
	assert.equal(
		await page.locator('#inventory .ingredient').evaluate(e => e === document.activeElement),
		true,
	);
	await page.keyboard.press('Enter');
	assert.equal(
		await page
			.locator('#discovery .ingredientpicker')
			.evaluate(e => e === document.activeElement),
		true,
	);
	// Rebuild an inventory for the analyzer using keyboard input only.
	for (const name of ['Meat', 'Berries']) {
		const search = page.locator('#discovery .ingredientpicker');
		await search.fill(name);
		await search.press('ArrowDown');
		await search.press('Enter');
	}
	const calculate = page.locator('#makable .makablebutton');
	await calculate.focus();
	await calculate.press('Enter');
	await page.waitForFunction(() => !document.querySelector('#makable .makablebutton').disabled);
	const group = page.getByRole('toolbar', { name: 'Ingredient filters', exact: true });
	assert.equal(await group.getAttribute('aria-describedby'), 'discovery-filter-help');
	assert.equal(await group.locator('[tabindex="0"]').count(), 1);
	const filter = group.locator('button:has(.icon[data-id="meat@together"])');
	await filter.focus();
	await filter.press('Enter');
	assert.equal(await filter.getAttribute('aria-label'), 'Meat: Required');
	await filter.press('Space');
	assert.equal(await filter.getAttribute('aria-label'), 'Meat: Excluded');
	await filter.press('Shift+Space');
	assert.equal(await filter.getAttribute('aria-label'), 'Meat: Required');
	await filter.press('Shift+Enter');
	assert.equal(await filter.getAttribute('aria-label'), 'Meat: Normal');
	await filter.press('ArrowRight');
	assert.equal(
		await group
			.getByRole('button', { name: 'Berries: Normal', exact: true })
			.evaluate(e => e === document.activeElement),
		true,
	);
	await page.keyboard.press('Home');
	assert.equal(
		await group
			.locator('button')
			.first()
			.evaluate(e => e === document.activeElement),
		true,
	);
	await page.keyboard.press('End');
	assert.equal(
		await group
			.locator('button')
			.last()
			.evaluate(e => e === document.activeElement),
		true,
	);
	assert.equal(await group.locator('[tabindex="0"]').count(), 1);
	const recipe = page.locator('#makable .recipeFilter button').first();
	await recipe.focus();
	await recipe.press('Shift+Enter');
	assert.match(await recipe.getAttribute('aria-label'), /: Excluded$/);
	await recipe.press('Shift+Enter');
	assert.match(await recipe.getAttribute('aria-label'), /: Normal$/);
	await page.locator('#makable .deleteButton').focus();
	await page.keyboard.press('Enter');
	assert.equal(await calculate.evaluate(e => e === document.activeElement), true, await active());
	const inventoryControl = page.locator('#inventory .ingredient').first();
	for (const theme of ['light', 'dark']) {
		await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
		await page.waitForFunction(
			theme => document.documentElement.dataset.theme === theme,
			theme,
		);
		await inventoryControl.focus();
		const colors = await inventoryControl.evaluate(e => ({
			outline: getComputedStyle(e).outlineColor,
			background: getComputedStyle(e.closest('.selectionpanel')).backgroundColor,
			style: getComputedStyle(e).outlineStyle,
			width: getComputedStyle(e).outlineWidth,
		}));
		assert.equal(colors.style, 'solid');
		assert.equal(colors.width, '2px');
		assert.ok(colorContrast(colors.outline, colors.background) >= 3, `${theme} focus contrast`);
	}
	await calculate.focus();
	await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
	assert.equal(await calculate.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
	assert.equal(await calculate.evaluate(e => getComputedStyle(e).outlineWidth), '2px');
	assert.deepEqual(diagnostics, []);
});

test('selection indicators survive forced colors and track modes, menus, columns, and matches', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [['meat', 'berries', 'berries', 'berries'], []],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.evaluate(axe.source);
	const indicatorVisible = (locator, pseudo = '::after') =>
		locator.evaluate((element, pseudo) => {
			const style = getComputedStyle(element, pseudo);
			return (
				style.content !== 'none' &&
				style.display !== 'none' &&
				parseFloat(style.width) > 0 &&
				parseFloat(style.height) > 0
			);
		}, pseudo);
	for (const theme of ['light', 'dark']) {
		await page.emulateMedia({ forcedColors: 'active', colorScheme: theme });
		if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
			await page.locator('#theme-toggle').click();
		}
		const together = page.getByRole('button', { name: "Don't Starve Together", exact: true });
		const solo = page.getByRole('button', { name: "Don't Starve", exact: true });
		assert.equal(
			await indicatorVisible(together),
			true,
			'A selected game must have a visible non-color indicator',
		);
		assert.equal(await indicatorVisible(solo), false);
		assert.equal(await together.evaluate(e => getComputedStyle(e).opacity), '1');
		await solo.click();
		assert.equal(await indicatorVisible(solo), true);
		assert.equal(await indicatorVisible(together), false);
		const dlc = page.locator('.dlc-btn[data-dlc="giants"]');
		await dlc.click();
		assert.equal(
			await indicatorVisible(dlc),
			(await dlc.getAttribute('aria-pressed')) === 'true',
		);
		await together.click();
		const warly = page.locator('.char-btn[data-character="warly"]');
		await warly.click();
		assert.equal(await indicatorVisible(warly), true);
		await warly.click();
		assert.equal(await indicatorVisible(warly), false);
		await page.locator('#simulator .clearingredientsbtn').click();
		for (const name of ['Meat', 'Berries', 'Berries', 'Berries']) {
			await page.locator('#simulator .ingredientpicker').fill(name);
			await page.getByRole('option', { name: new RegExp(`^${name}(?: \\d)?$`) }).click();
		}
		await page.locator('#simulator .clearsearchbtn').click();

		const menuButton = page.locator('#simulator .densityingredients');
		await menuButton.click();
		const cozy = page.getByRole('menuitemradio', { name: 'Cozy', exact: true });
		const compact = page.getByRole('menuitemradio', { name: 'Compact', exact: true });
		assert.equal(await indicatorVisible(compact), true);
		assert.equal(await indicatorVisible(cozy), false);
		const systemColors = await page.evaluate(() => {
			const probe = document.createElement('span');
			probe.style.background = 'Highlight';
			probe.style.color = 'HighlightText';
			document.body.appendChild(probe);
			const style = getComputedStyle(probe);
			const palette = { background: style.backgroundColor, color: style.color };
			probe.remove();
			return palette;
		});
		await compact.hover();
		await compact.focus();
		assert.deepEqual(
			await compact.evaluate(element => {
				const style = getComputedStyle(element);
				return { background: style.backgroundColor, color: style.color };
			}),
			systemColors,
			'Selected menu text must retain its system color pair during hover and focus',
		);
		await cozy.click();
		await menuButton.click();
		assert.equal(await indicatorVisible(cozy), true);
		assert.equal(await indicatorVisible(compact), false);
		await compact.click();

		const columns = page.locator('#results .column-toggle-bar').first();
		const health = columns.getByRole('button', { name: 'Health', exact: true });
		assert.equal(await indicatorVisible(health), true);
		await health.click();
		assert.equal(await indicatorVisible(health), false);
		await health.click();
		assert.equal(await indicatorVisible(health), true);
		const match = page.locator('#results tr.highlighted').first().locator('td').nth(1);
		assert.equal(await match.textContent(), 'Meatballs');
		assert.equal(
			await indicatorVisible(match, '::before'),
			true,
			'Cooking matches must remain identifiable without their background color',
		);
		assert.equal(
			await page
				.locator('#ingredients .ingredient')
				.first()
				.evaluate(e => getComputedStyle(e).backgroundImage),
			'none',
		);
		await page.locator('#simulator .ingredientpicker').fill('Meat');
		await page.keyboard.press('ArrowDown');
		const selected = page.locator('#simulator [role=option][aria-selected=true]');
		assert.equal(await selected.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
		const violations = await page.evaluate(async () =>
			(
				await window.axe.run({ runOnly: { type: 'rule', values: ['color-contrast'] } })
			).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })),
		);
		assert.deepEqual(
			violations,
			[],
			`${theme} forced-color selection contrast: ${JSON.stringify(violations)}`,
		);
	}
	assert.deepEqual(diagnostics, []);
});

test('full-pot errors remain readable with reduced motion and release temporary feedback', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{
			version: 'together',
			pickers: [['meat', 'berries', 'berries', 'berries'], []],
		},
		{ reducedMotion: 'reduce' },
	);
	await page.addInitScript(() => {
		const listeners = new WeakMap();
		const add = EventTarget.prototype.addEventListener;
		const remove = EventTarget.prototype.removeEventListener;
		EventTarget.prototype.addEventListener = function (type, listener, options) {
			if (type === 'animationend') {
				if (!listeners.has(this)) {
					listeners.set(this, new Set());
				}
				listeners.get(this).add(listener);
			}
			return add.call(this, type, listener, options);
		};
		EventTarget.prototype.removeEventListener = function (type, listener, options) {
			if (type === 'animationend') {
				listeners.get(this)?.delete(listener);
			}
			return remove.call(this, type, listener, options);
		};
		window.animationListenerCount = element => listeners.get(element)?.size || 0;
	});
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
	const panel = page.locator('#simulator');
	const search = panel.getByRole('combobox');
	const status = panel.getByRole('status');
	const readableStatus = () =>
		status.evaluate(
			e =>
				getComputedStyle(e).clipPath === 'none' &&
				e.clientWidth > 10 &&
				e.clientHeight > 10,
		);
	await search.fill('Carrot');
	const carrot = panel.getByRole('option', { name: 'Carrot', exact: true });
	for (let attempt = 0; attempt < 4; attempt++) {
		await carrot.click();
		await page.clock.runFor(500);
		assert.equal(
			await carrot.evaluate(e => window.animationListenerCount(e)),
			0,
			'A missing animationend event must not retain listeners',
		);
		assert.equal(
			await carrot.evaluate(e => e.classList.contains('ingredient-action-error')),
			false,
		);
		assert.equal(
			await readableStatus(),
			true,
			'A brief flash must not be the only visible error feedback',
		);
		assert.equal(
			await status.textContent(),
			'The pot is full. Remove an ingredient before adding Carrot.',
		);
	}
	await page.clock.runFor(2000);
	assert.equal(await readableStatus(), true);
	assert.equal(await panel.locator('.ingredient[data-id]').count(), 4);
	await panel.getByRole('button', { name: 'Remove Berries', exact: true }).first().click();
	assert.equal(await readableStatus(), false, 'A successful action clears the visible error');
	await carrot.click();
	assert.equal(await panel.locator('.ingredient[data-id]').count(), 4);
	assert.equal(await status.textContent(), 'Added Carrot.');
});

test('ingredient errors explain recovery in every language and clear on a new search', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [['meat', 'berries', 'berries', 'berries'], []],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const messages = {
		en: [
			'The pot is full. Remove an ingredient before adding Carrot.',
			'Carrot is not selected. Add it before trying to remove it.',
			'This slot is empty. Select an ingredient from the search results.',
		],
		es: [
			'La olla está llena. Quita un ingrediente antes de añadir Carrot.',
			'Carrot no está seleccionado. Añádelo antes de intentar quitarlo.',
			'Esta ranura está vacía. Selecciona un ingrediente de los resultados de búsqueda.',
		],
		zh: [
			'锅已满。请先移除一种食材，再添加 Carrot。',
			'尚未选择 Carrot。请先添加，再尝试移除。',
			'此格子为空。请从搜索结果中选择食材。',
		],
	};
	for (const [locale, [full, missing, empty]] of Object.entries(messages)) {
		await page.locator('#language-picker').selectOption(locale);
		await page.locator('#tab-simulator').click();
		const panel = page.locator('#simulator');
		const search = panel.getByRole('combobox');
		const status = panel.getByRole('status');
		await search.fill('Carrot');
		await panel.getByRole('option', { name: 'Carrot', exact: true }).click();
		assert.equal(await status.textContent(), full);
		assert.equal(await status.evaluate(e => getComputedStyle(e).clipPath), 'none');
		await search.fill('Berries');
		assert.equal(
			await status.evaluate(e => e.classList.contains('ingredient-feedback')),
			false,
		);
		await search.fill('Carrot');
		await panel.getByRole('option', { name: 'Carrot', exact: true }).click({ button: 'right' });
		assert.equal(await status.textContent(), missing);
		await page.locator('#tab-discovery').click();
		const inventory = page.locator('#discovery');
		await inventory.locator('.ingredient:not([data-id])').click({ button: 'right' });
		assert.equal(await inventory.getByRole('status').textContent(), empty);
		assert.equal(
			await inventory.getByRole('status').evaluate(e => getComputedStyle(e).clipPath),
			'none',
		);
		await inventory.getByRole('combobox').fill('Carrot');
		await inventory
			.getByRole('option', { name: 'Carrot', exact: true })
			.click({ button: 'right' });
		assert.equal(await inventory.getByRole('status').textContent(), missing);
	}
	assert.deepEqual(diagnostics, []);
});

test('picked markers and quantities survive picker rebuilds and remain distinct from keyboard highlight', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [['meat', 'meat'], ['meat']],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.evaluate(axe.source);
	for (const tab of ['simulator', 'discovery']) {
		await page.locator(`#tab-${tab}`).click();
		const panel = page.locator(`#${tab}`);
		const search = panel.getByRole('combobox');
		await search.fill('Meat');
		const meat = panel.getByRole('option', { name: /^Meat(?: \d)?$/ });
		assert.equal(
			await meat.getAttribute('aria-label'),
			tab === 'simulator' ? 'Meat 2' : 'Meat',
		);
		assert.match(await meat.getAttribute('class'), /faded/);
		assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), true);
		assert.equal(
			await meat.locator('.ingredient-picked-marker').textContent(),
			tab === 'simulator' ? '2' : '',
		);
		const pickedColors = await meat.evaluate(e => ({
			bg: getComputedStyle(e).backgroundColor,
			border: getComputedStyle(e).borderColor,
		}));
		const normalColors = await panel
			.getByRole('option', { name: 'Cooked Meat', exact: true })
			.evaluate(e => ({
				bg: getComputedStyle(e).backgroundColor,
				border: getComputedStyle(e).borderColor,
			}));
		assert.notEqual(
			pickedColors.bg,
			normalColors.bg,
			'Compact mode must preserve the picked background',
		);
		assert.notEqual(
			pickedColors.border,
			normalColors.border,
			'Compact mode must preserve the picked border',
		);
		await search.press('ArrowDown');
		assert.equal(await meat.getAttribute('aria-selected'), 'true');
		assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), true);
		await search.fill('Berries');
		await search.fill('Meat');
		assert.equal(await meat.getAttribute('aria-selected'), 'false');
		assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), true);
		await panel.getByRole('button', { name: 'Sort: Auto', exact: true }).click();
		await panel.getByRole('menuitemradio', { name: 'Sort: Health', exact: true }).click();
		assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), true);
		if (tab === 'discovery') {
			for (const [locale, description] of Object.entries({
				en: 'In your inventory.',
				es: 'En tu inventario.',
				zh: '已在背包中。',
			})) {
				await page.locator('#language-picker').selectOption(locale);
				assert.equal(await meat.getAttribute('aria-description'), description);
			}
			await page.locator('#language-picker').selectOption('en');
		}
		await meat.click();
		assert.equal(
			await meat.locator('.ingredient-picked-marker').isVisible(),
			tab === 'simulator',
		);
		assert.equal(
			await meat.locator('.ingredient-picked-marker').textContent(),
			tab === 'simulator' ? '3' : '',
		);
		assert.equal(
			await meat.getAttribute('aria-label'),
			tab === 'simulator' ? 'Meat 3' : 'Meat',
		);
		for (const colorScheme of ['light', 'dark']) {
			await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
			const violations = await page.evaluate(async () => {
				const { violations } = await window.axe.run({
					runOnly: {
						type: 'rule',
						values: ['label-content-name-mismatch', 'color-contrast'],
					},
				});
				return violations.map(({ id, nodes }) => ({
					id,
					targets: nodes.map(n => n.target),
				}));
			});
			assert.deepEqual(
				violations,
				[],
				`${tab} ${colorScheme}: ${JSON.stringify(violations)}`,
			);
		}
		for (const [locale, description] of Object.entries(
			tab === 'simulator'
				? { en: 'In the pot: 3.', es: 'En la olla: 3.', zh: '锅中数量：3。' }
				: { en: null, es: null, zh: null },
		)) {
			await page.locator('#language-picker').selectOption(locale);
			assert.equal(await meat.getAttribute('aria-description'), description);
		}
		await page.locator('#language-picker').selectOption('en');
		if (tab === 'simulator') {
			for (let i = 0; i < 2; i++) {
				await panel
					.getByRole('button', { name: 'Remove Meat', exact: true })
					.first()
					.click();
			}
			assert.equal(await meat.getAttribute('aria-label'), 'Meat');
			assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), true);
			assert.equal(await meat.locator('.ingredient-picked-marker').textContent(), '');
		}
	}
	assert.deepEqual(diagnostics, []);
});

test('picker shortcuts remove one or all copies without changing input focus or other ingredients', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [
			['meat', 'berries', 'meat', 'berries'],
			['meat', 'berries'],
		],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	for (const [tab, container] of [
		['simulator', '#ingredients'],
		['discovery', '#inventory'],
	]) {
		await page.locator(`#tab-${tab}`).click();
		const panel = page.locator(`#${tab}`);
		const search = panel.getByRole('combobox');
		const meat = panel.getByRole('option', { name: /^Meat(?: \d)?$/ });
		const keys = () =>
			page
				.locator(`${container} .ingredient[data-id]`)
				.evaluateAll(items => items.map(e => e.dataset.id));
		await search.fill('Meat');
		await search.press('ArrowDown');
		await search.dispatchEvent('keydown', { key: 'Enter', shiftKey: true, isComposing: true });
		assert.equal(
			(await keys()).length,
			tab === 'simulator' ? 4 : 2,
			'IME composition cannot remove ingredients',
		);
		await search.press('Alt+Enter');
		assert.equal((await keys()).length, tab === 'simulator' ? 4 : 2);
		await search.press('Shift+Enter');
		assert.deepEqual(
			await keys(),
			tab === 'simulator'
				? ['meat@together', 'berries@together', 'berries@together']
				: ['berries@together'],
		);
		assert.equal(await search.evaluate(e => e === document.activeElement), true);
		await search.press('Enter');
		await search.press('Control+Enter');
		assert.deepEqual(
			await keys(),
			tab === 'simulator' ? ['berries@together', 'berries@together'] : ['berries@together'],
		);
		assert.equal(
			await meat.getAttribute('aria-selected'),
			'true',
			'Removing membership preserves keyboard highlight',
		);
		assert.equal(await meat.locator('.ingredient-picked-marker').isVisible(), false);
		await search.press('Enter');
		await search.press('Meta+Enter');
		assert.equal(
			(await keys()).some(key => key.startsWith('meat')),
			false,
		);
		await search.press('Escape');
		await search.press('Enter');
		await search.press('Shift+Enter');
		await search.press('Control+Enter');
		assert.equal(
			(await keys()).some(key => key.startsWith('meat')),
			false,
			'Dismissed results do not accept shortcuts',
		);
		await search.press('ArrowDown');
		await meat.click();
		assert.equal(
			(await keys()).filter(key => key.startsWith('meat')).length,
			1,
			'An unpicked ingredient adds exactly once',
		);
		if (tab === 'simulator') {
			await meat.locator('.text').click();
		}
		await meat.locator('.ingredient-subtract').click();
		assert.equal(
			(await keys()).filter(key => key.startsWith('meat')).length,
			tab === 'simulator' ? 1 : 0,
		);
		await meat.locator('.text').click();
		assert.equal(
			(await keys()).filter(key => key.startsWith('meat')).length,
			tab === 'simulator' ? 2 : 1,
		);
		await meat.locator('.ingredient-toggle').click();
		const remaining = await keys();
		assert.equal(
			remaining.some(key => key.startsWith('meat')),
			false,
			'Unchecking removes every copy',
		);
		assert.equal(await meat.locator('.ingredient-toggle').isVisible(), false);
		assert.equal(await meat.locator('.ingredient-subtract').isVisible(), false);
		assert.equal(
			await panel
				.getByRole('status')
				.evaluate(e => e.classList.contains('ingredient-feedback')),
			false,
		);
		await page.reload({ waitUntil: 'networkidle' });
		assert.deepEqual(await keys(), remaining, 'Removal persists across reload');
	}
	assert.deepEqual(diagnostics, []);
});

test('picker errors occupy reserved space above the selection without moving slots', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{
			version: 'together',
			pickers: [['meat', 'berries', 'berries', 'berries'], []],
		},
		{ reducedMotion: 'reduce' },
	);
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	for (const width of [320, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		for (const locale of ['en', 'es', 'zh']) {
			await page.locator('#language-picker').selectOption(locale);
			await page.locator('#tab-simulator').click();
			const panel = page.locator('#simulator');
			const search = panel.getByRole('combobox');
			const status = panel.getByRole('status');
			for (const name of ['Carrot', 'Winter Koalefant Trunk', 'Roasted Juicy Berries']) {
				await search.fill(name);
				const position = () =>
					page
						.locator('#ingredients')
						.evaluate(e => e.getBoundingClientRect().top + scrollY);
				const before = await position();
				await panel.getByRole('option', { name, exact: true }).click();
				assert.ok(
					Math.abs((await position()) - before) <= 1,
					`${locale} at ${width}: full-pot error moved the slots`,
				);
				assert.equal(
					await status.evaluate(e => {
						const picker = e
							.closest('[role=tabpanel]')
							.querySelector('.ingredientdropdown');
						const selected = e
							.closest('[role=tabpanel]')
							.querySelector('.selectionpanel');
						const rect = e.getBoundingClientRect();
						return (
							rect.top >= picker.getBoundingClientRect().bottom &&
							rect.bottom <= selected.getBoundingClientRect().top &&
							e.scrollHeight <= e.clientHeight + 1
						);
					}),
					true,
					'Feedback must sit between the picker and selected ingredients without clipping',
				);
				const summary = panel.locator('.ingredient-search-summary');
				assert.equal(await summary.isVisible(), true);
				assert.equal(
					await summary.evaluate(
						e =>
							e.getBoundingClientRect().bottom <=
							e
								.closest('.ingredient-feedback-space')
								.querySelector('[role=status]')
								.getBoundingClientRect().top,
					),
					true,
					'Count and error must not overlap',
				);
				await panel.getByRole('option', { name, exact: true }).click({ button: 'right' });
				assert.ok(
					Math.abs((await position()) - before) <= 1,
					'Switching error types must preserve position',
				);
				await search.focus();
				await search.press('Escape');
				await search.press('ArrowDown');
				assert.equal(
					await panel.locator('.ingredient-search-summary').isVisible(),
					true,
					'Result counts remain visible during errors',
				);
				await page.locator('#language-picker').selectOption(locale === 'es' ? 'en' : 'es');
				assert.equal(
					await status.evaluate(e => e.classList.contains('ingredient-feedback')),
					true,
					'Changing language preserves the active error',
				);
				assert.match(
					await status.textContent(),
					locale === 'es' ? /not selected/ : /no está seleccionado/,
				);
				await page.locator('#language-picker').selectOption(locale);
				await panel.locator('.clearsearchbtn').click();
				// Clear changes the result list height; compare the cleared state before a new error.
				await search.fill(name);
				assert.equal(
					await status.evaluate(e => e.classList.contains('ingredient-feedback')),
					false,
				);
			}
			await page.locator('#tab-discovery').click();
			const emptySlot = page.locator('#inventory .ingredient:not([data-id])');
			const inventory = page.locator('#inventory');
			const before = await inventory.evaluate(e => e.getBoundingClientRect().top + scrollY);
			await emptySlot.click({ button: 'right' });
			assert.ok(
				Math.abs(
					(await inventory.evaluate(e => e.getBoundingClientRect().top + scrollY)) -
						before,
				) <= 1,
				`${locale} at ${width}: empty-slot error moved the selection`,
			);
		}
	}
	assert.deepEqual(diagnostics, []);
});

test('search feedback covers empty results, localization, composition, and action priority', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		version: 'together',
		pickers: [[], []],
	});
	const diagnostics = trackDiagnostics(page);
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
	for (const locale of ['en', 'es', 'zh']) {
		await page.locator('#language-picker').selectOption(locale);
		for (const tab of ['simulator', 'discovery']) {
			await page.locator(`#tab-${tab}`).click();
			const panel = page.locator(`#${tab}`);
			const search = panel.getByRole('combobox');
			const summary = panel.locator('.ingredient-search-summary');
			const status = panel.getByRole('status');
			await search.fill('zzzznomatches');
			assert.equal(await panel.getByRole('option').count(), 0);
			const emptyMessage = await summary.textContent();
			assert.ok(emptyMessage.length > 0);
			assert.match(emptyMessage, { en: /^No matching/, es: /^No hay/, zh: /^没有/ }[locale]);
			assert.equal(await summary.isVisible(), true);
			assert.equal(await search.evaluate(e => e === document.activeElement), true);
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), emptyMessage);
			assert.equal(await status.getAttribute('aria-atomic'), 'true');

			await search.fill('Roasted Juicy Berries');
			assert.equal(await panel.getByRole('option').count(), 1);
			const singleMessage = await summary.textContent();
			assert.match(singleMessage, /^1 /);
			assert.equal(
				await status.textContent(),
				emptyMessage,
				'Typing must not announce immediately',
			);
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), singleMessage);

			await search.fill('zzzznomatches');
			await search.fill('Meat');
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), await summary.textContent());
			assert.match(
				await status.textContent(),
				new RegExp(`^${await panel.getByRole('option').count()} `),
			);
			assert.notEqual(
				await status.textContent(),
				emptyMessage,
				'A newer search cancels the older announcement',
			);

			await search.fill('Roasted Juicy Berries');
			await search.press('Enter');
			const actionMessage = await status.textContent();
			assert.match(actionMessage, /Roasted Juicy Berries/);
			await page.clock.runFor(350);
			assert.equal(
				await status.textContent(),
				actionMessage,
				'A result count must not overwrite an ingredient action',
			);

			await search.dispatchEvent('compositionstart');
			await search.evaluate(element => {
				element.value = 'zzzznomatches';
				element.dispatchEvent(
					new InputEvent('input', { bubbles: true, isComposing: true }),
				);
			});
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), actionMessage);
			await search.dispatchEvent('compositionend');
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), emptyMessage);

			await search.fill('Meat');
			await search.press('Escape');
			await page.clock.runFor(350);
			assert.equal(await status.textContent(), emptyMessage);
			assert.equal(await summary.isVisible(), false);
			await search.press('ArrowDown');
			assert.equal(await summary.isVisible(), true);
			await search.fill('Carrot');
			await page.locator('#theme-toggle').focus();
			await page.clock.runFor(350);
			assert.equal(
				await status.textContent(),
				emptyMessage,
				'Leaving the search cancels pending feedback',
			);
		}
	}
	assert.deepEqual(diagnostics, []);
});

test('wide tables have localized names and keyboard scrolling only while overflowing', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{
			version: 'together',
			pickers: [
				['meat', 'berries', 'berries', 'berries'],
				['meat', 'berries'],
			],
		},
		{ viewport: { width: 320, height: 812 } },
	);
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.locator('#tab-crockpot').click();
	const table = page.getByRole('table', { name: 'Recipe List', exact: true });
	const wrapper = page.getByRole('region', { name: 'Recipe List', exact: true });
	await wrapper.waitFor({ state: 'visible' });
	assert.match(await wrapper.getAttribute('aria-description'), /Left and Right/);
	const sortBefore = await table.locator('th[aria-sort]').getAttribute('aria-sort');
	await page.locator('#recipes .column-toggle-bar button').last().focus();
	await page.keyboard.press('Tab');
	assert.equal(await wrapper.evaluate(e => e === document.activeElement), true);
	assert.equal(await wrapper.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
	await page.keyboard.press('ArrowRight');
	await page.waitForFunction(
		() => document.querySelector('#recipes .table-scroll-wrapper').scrollLeft > 0,
	);
	assert.equal(await table.locator('th[aria-sort]').getAttribute('aria-sort'), sortBefore);
	await wrapper.evaluate(element => {
		element.scrollLeft = 0;
		const selection = getSelection();
		selection.selectAllChildren(document.querySelector('#recipes .column-toggle-bar'));
		element.focus();
	});
	await page.keyboard.press('ArrowRight');
	assert.ok(await wrapper.evaluate(element => element.scrollLeft > 0));
	await page.keyboard.press('ArrowLeft');
	assert.equal(await wrapper.evaluate(element => element.scrollLeft), 0);
	const preventsArrow = (locator, modifiers = {}) =>
		locator.evaluate((element, modifiers) => {
			const event = new KeyboardEvent('keydown', {
				key: 'ArrowRight',
				bubbles: true,
				cancelable: true,
				...modifiers,
			});
			element.dispatchEvent(event);
			return event.defaultPrevented;
		}, modifiers);
	for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
		assert.equal(await preventsArrow(wrapper, { [modifier]: true }), false);
	}
	await page.keyboard.press('Tab');
	assert.equal(
		await table
			.locator('th[data-sort="name"] button')
			.evaluate(e => e === document.activeElement),
		true,
	);
	assert.equal(await preventsArrow(table.locator('th[data-sort="name"] button')), false);
	for (const [locale, name] of [
		['es', 'Lista de recetas'],
		['zh', '配方列表'],
		['en', 'Recipe List'],
	]) {
		await page.locator('#language-picker').selectOption(locale);
		assert.equal(await page.getByRole('table', { name, exact: true }).count(), 1);
		assert.equal(await page.getByRole('region', { name, exact: true }).count(), 1);
	}
	await page.setViewportSize({ width: 3200, height: 812 });
	await page.waitForFunction(
		() => document.querySelector('#recipes .table-scroll-wrapper').tabIndex === -1,
	);
	assert.equal(await page.getByRole('region', { name: 'Recipe List', exact: true }).count(), 0);
	assert.equal(await preventsArrow(page.locator('#recipes .table-scroll-wrapper')), false);
	assert.equal(await table.getAttribute('aria-label'), null);
	assert.equal(await table.locator('caption').textContent(), 'Recipe List');
	assert.deepEqual(diagnostics, []);
});

test('manual column choices override automatic hiding and retain the visible layout', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{ version: 'together' },
		{
			viewport: { width: 500, height: 812 },
		},
	);
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.locator('#tab-crockpot').click();
	const columns = page.locator('#recipes .column-toggle-bar');
	assert.equal(await columns.getAttribute('role'), 'group');
	assert.equal(await columns.getAttribute('aria-label'), 'Columns: Recipe List');
	const auto = columns.getByRole('button', { name: 'Auto', exact: true });
	const cookTime = columns.getByRole('button', { name: 'Cook Time', exact: true });
	const header = page.locator('#recipes th[data-sort=cooktime]');
	const visibleColumns = () => page.locator('#recipes th:not(.col-hidden)').allTextContents();
	const initialColumns = await visibleColumns();
	assert.equal(await cookTime.getAttribute('aria-pressed'), 'false');
	await cookTime.focus();
	await cookTime.press('Enter');
	assert.equal(
		await header.isVisible(),
		true,
		'A manual choice must reveal an automatically hidden column',
	);
	assert.equal(await cookTime.getAttribute('aria-pressed'), 'true');
	assert.equal(await auto.getAttribute('aria-pressed'), 'false');
	assert.deepEqual(
		(await visibleColumns()).filter(label => label !== 'Cook Time'),
		initialColumns,
	);
	assert.equal(await cookTime.evaluate(e => e === document.activeElement), true);
	await page.setViewportSize({ width: 1280, height: 812 });
	assert.equal(await header.isVisible(), true);
	await cookTime.press('Space');
	assert.equal(await header.isVisible(), false);
	await auto.click();
	assert.equal(await auto.getAttribute('aria-pressed'), 'true');
	assert.equal(
		await header.isVisible(),
		true,
		'Auto uses the recommended layout for the current width',
	);
	await page.setViewportSize({ width: 500, height: 812 });
	await header.waitFor({ state: 'hidden' });
	await auto.click();
	assert.equal(await header.isVisible(), false, 'Turning Auto off restores manual choices');
	for (const [locale, groupName, buttonName] of [
		['es', 'Columnas: Lista de recetas', 'Tiempo de cocción'],
		['zh', '列: 配方列表', '烹饪时间'],
	]) {
		await page.locator('#language-picker').selectOption(locale);
		assert.equal(await columns.getAttribute('aria-label'), groupName);
		const localizedToggle = columns.getByRole('button', { name: buttonName, exact: true });
		assert.equal(await localizedToggle.getAttribute('aria-pressed'), 'false');
		await localizedToggle.press('Space');
		assert.equal(await header.isVisible(), true);
		await localizedToggle.press('Space');
		assert.equal(await header.isVisible(), false);
	}
	assert.deepEqual(diagnostics, []);
});

test('responsive column hiding moves focus to a visible control without disrupting other focus', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, { version: 'together' });
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.locator('#tab-crockpot').click();
	const header = page.locator('#recipes th[data-sort=cooktime]');
	await header.locator('button').focus();
	await page.setViewportSize({ width: 500, height: 812 });
	await header.waitFor({ state: 'hidden' });
	const toggle = page
		.locator('#recipes .column-toggle-bar')
		.getByRole('button', { name: 'Cook Time', exact: true });
	assert.equal(
		await toggle.evaluate(e => e === document.activeElement),
		true,
		'Resizing or zooming must not strand focus in a hidden column',
	);
	await toggle.press('Space');
	assert.equal(await header.isVisible(), true);
	await page.setViewportSize({ width: 1280, height: 812 });
	await page
		.locator('#recipes .column-toggle-bar')
		.getByRole('button', { name: 'Auto', exact: true })
		.click();
	const name = page.locator('#recipes th[data-sort=name] button');
	await name.focus();
	await page.setViewportSize({ width: 500, height: 812 });
	await header.waitFor({ state: 'hidden' });
	assert.equal(await name.evaluate(e => e === document.activeElement), true);
	assert.deepEqual(diagnostics, []);
});

test('paused analysis exposes its current results and explains empty filters', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'discovery',
		version: 'together',
		pickers: [[], ['meat', 'berries', 'carrot', 'honey', 'ice', 'egg', 'fish', 'monstermeat']],
	});
	const diagnostics = trackDiagnostics(page);
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
	await page.locator('#makable .makablebutton').click();
	const pause = page.locator('#makable .pauseButton');
	await pause.click();
	const summary = page.locator('#makable .makableSummary');
	assert.match(await summary.textContent(), /Found [1-9]\d* valid recipes \(paused\)/);
	const found = Number((await summary.textContent()).match(/Found (\d+)/)[1]);
	const rows = page.locator('#makable tbody tr:not(.table-empty-row)');
	assert.equal(
		await rows.count(),
		Math.min(25, found),
		'Pausing shows a bounded snapshot of current results',
	);
	const filters = page.locator('#makable .foodFilter .analysis-filter');
	assert.ok((await filters.count()) >= 5);
	for (let index = 0; index < 5; index++) {
		await filters.nth(index).click();
	}
	assert.equal(
		await rows.count(),
		0,
		'Five required distinct ingredients cannot fit a four-slot pot',
	);
	const empty = page.locator('#makable .table-empty-row');
	assert.equal(await empty.isVisible(), true);
	assert.match(await empty.textContent(), /No matching combinations found so far/);
	const visibleColumns = () => page.locator('#makable th:not(.col-hidden)').count();
	assert.equal(await empty.locator('td').evaluate(cell => cell.colSpan), await visibleColumns());
	await page
		.locator('#makable .column-toggle-bar')
		.getByRole('button', { name: 'Health', exact: true })
		.click();
	assert.equal(await empty.locator('td').evaluate(cell => cell.colSpan), await visibleColumns());
	for (const [locale, message] of [
		['es', 'Aún no se han encontrado combinaciones coincidentes.'],
		['zh', '目前尚未找到匹配的组合。'],
		['en', 'No matching combinations found so far.'],
	]) {
		await page.locator('#language-picker').selectOption(locale);
		assert.equal(await empty.textContent(), message);
		assert.equal(await empty.isVisible(), true);
	}
	for (let index = 0; index < 5; index++) {
		await filters.nth(index).click();
		await filters.nth(index).click();
	}
	assert.ok((await rows.count()) > 0);
	assert.equal(await empty.count(), 0);
	assert.equal(await pause.textContent(), 'Resume');
	await page.locator('#makable .deleteButton').click();
	assert.equal(await page.locator('#makable .makableContainer').count(), 0);
	assert.deepEqual(diagnostics, []);
});

test('analysis that finishes during resume retains its completion message', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'discovery',
		version: 'together',
		pickers: [[], ['meat', 'berries', 'carrot', 'honey', 'ice', 'egg', 'fish', 'monstermeat']],
	});
	const diagnostics = trackDiagnostics(page);
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
	await page.locator('#makable .makablebutton').click();
	const filters = await page.locator('#makable .foodFilter .analysis-filter').count();
	assert.ok(
		filters >= 5 && filters <= 20,
		'This fixture completes in its second calculation block',
	);
	const pause = page.locator('#makable .pauseButton');
	await pause.click();
	await pause.click();
	assert.equal(await page.locator('#makable .makablebutton').isEnabled(), true);
	assert.equal(await pause.count(), 0);
	const summary = await page
		.locator('#makable .makableSummary')
		.evaluate(e => e.firstChild.textContent);
	assert.match(summary, /^Found \d+ valid recipes\.$/);
	assert.equal(await page.locator('#makable [role=status]').textContent(), summary);
	assert.equal(
		await page.locator('#makable .deleteButton').evaluate(e => e === document.activeElement),
		true,
	);
	const ingredientFilters = page.locator('#makable .foodFilter .analysis-filter');
	for (let index = 0; index < filters; index++) {
		await ingredientFilters.nth(index).click();
		await ingredientFilters.nth(index).click();
	}
	assert.equal(await page.locator('#makable td:nth-child(2)').count(), 0);
	const empty = page.locator('#makable .table-empty-row');
	for (const [locale, message] of [
		[
			'en',
			'No combinations match these filters. Try adjusting the ingredient or recipe filters.',
		],
		[
			'es',
			'Ninguna combinación coincide con estos filtros. Prueba a ajustar los filtros de ingredientes o recetas.',
		],
		['zh', '没有组合符合这些筛选条件。请尝试调整食材或食谱筛选条件。'],
	]) {
		await page.locator('#language-picker').selectOption(locale);
		assert.equal(await empty.textContent(), message);
		assert.equal(await empty.isVisible(), true);
	}
	for (let index = 0; index < filters; index++) {
		await ingredientFilters.nth(index).click();
	}
	assert.ok((await page.locator('#makable td:nth-child(2)').count()) > 0);
	assert.equal(await empty.count(), 0);
	assert.deepEqual(diagnostics, []);
});

test('accessibility audit covers visible panels, menus, and analyzer results', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const findings = [];
	let scans = 0;
	for (const options of [
		{},
		{ hasTouch: true, isMobile: true, viewport: { width: 320, height: 812 } },
		{ forcedColors: 'active' },
	]) {
		const page = await createSavedPage(
			browser,
			baseUrl,
			{
				version: 'together',
				pickers: [
					['meat', 'berries', 'berries', 'berries'],
					['meat', 'berries'],
				],
			},
			options,
		);
		page.setDefaultTimeout(15_000);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		await page.evaluate(axe.source);
		const audit = async context => {
			await page.waitForFunction(() =>
				document.getAnimations().every(animation => animation.playState !== 'running'),
			);
			const violations = await page.evaluate(async () => {
				const { violations } = await window.axe.run();
				return violations.map(({ id, nodes }) => ({
					id,
					nodes: nodes
						.slice(0, 3)
						.map(({ target, failureSummary }) => ({ target, failureSummary })),
				}));
			});
			scans++;
			if (violations.length) {
				findings.push({
					touch: !!options.hasTouch,
					forcedColors: !!options.forcedColors,
					...context,
					violations,
				});
			}
		};
		for (const theme of ['light', 'dark']) {
			await page.emulateMedia({
				colorScheme: theme,
				forcedColors: options.forcedColors || 'none',
			});
			// Media-query change events are asynchronous; let the automatic theme settle
			// before deciding whether a saved manual theme needs to be toggled.
			await page.evaluate(
				() =>
					new Promise(resolve =>
						requestAnimationFrame(() => requestAnimationFrame(resolve)),
					),
			);
			if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
				await page.locator('#theme-toggle').click();
			}
			for (const locale of options.hasTouch || options.forcedColors
				? ['en']
				: ['en', 'es', 'zh']) {
				await page.locator('#language-picker').selectOption(locale);
				for (const tab of [
					'simulator',
					'discovery',
					'foodlist',
					'crockpot',
					'statistics',
					'about',
					'gameinfo',
				]) {
					await page.locator(`#navbar [data-tab="${tab}"]`).click();
					if (tab === 'discovery') {
						await page.locator('#makable .makablebutton').click();
						await page.waitForFunction(
							() => !document.querySelector('#makable .makablebutton').disabled,
						);
						assert.equal(
							await page
								.locator('#makable .deleteButton')
								.evaluate(e => e === document.activeElement),
							true,
						);
					}
					if (tab === 'statistics') {
						await page.locator('#statistics .makablebutton').click();
						await page.locator('#statistics .pauseButton').click();
					}
					await audit({ theme, locale, tab });
					if (tab === 'discovery') {
						const filters = page.locator('#makable .foodFilter .analysis-filter');
						for (let index = 0; index < (await filters.count()); index++) {
							await filters.nth(index).click();
							await filters.nth(index).click();
						}
						assert.equal(
							await page.locator('#makable .table-empty-row').isVisible(),
							true,
						);
						await audit({ theme, locale, tab, filters: 'no matches' });
						for (let index = 0; index < (await filters.count()); index++) {
							await filters.nth(index).click();
						}
					}
					if (tab === 'simulator') {
						for (const buttonClass of [
							'searchselector',
							'displaymodeingredients:not(.densityingredients)',
							'densityingredients',
							'sortingredients',
							'groupingredients',
							'cookingingredients',
						]) {
							await page.locator(`#simulator button.${buttonClass}`).click();
							await audit({ theme, locale, tab, menu: buttonClass });
							await page.keyboard.press('Escape');
						}
						for (const grouping of ['type', 'preparation']) {
							await page.locator('#simulator .groupingredients').click();
							await page
								.locator(
									`#simulator [role=menuitemradio][data-value="${grouping}"]`,
								)
								.click();
							await audit({ theme, locale, tab, grouping });
						}
						await page.locator('#simulator .groupingredients').click();
						await page
							.locator('#simulator [role=menuitemradio][data-value="none"]')
							.click();
						for (const cooking of ['practical', 'everyday', 'all']) {
							await page.locator('#simulator .cookingingredients').click();
							await page
								.locator(`#simulator [role=menuitemradio][data-value="${cooking}"]`)
								.click();
							if (cooking !== 'all') {
								await audit({ theme, locale, tab, cooking });
							}
							if (cooking === 'everyday') {
								await page.locator('#simulator .ingredientpicker').fill('Butter');
								await audit({
									theme,
									locale,
									tab,
									cooking,
									search: 'hidden matches',
								});
								await page.locator('#simulator .clearsearchbtn').click();
							}
						}
						await page.locator('#simulator .ingredientpicker').fill('zzzznomatches');
						await audit({ theme, locale, tab, search: 'no matches' });
						await page.locator('#simulator .clearsearchbtn').click();
						await page.locator('#simulator .ingredientpicker').fill('Carrot');
						await page.locator('#simulator [role=option][aria-label="Carrot"]').click();
						await audit({ theme, locale, tab, action: 'full pot' });
						await page.locator('#simulator .clearsearchbtn').click();
					}
					if (tab === 'statistics') {
						await page.locator('#statistics .deleteButton').click();
					}
				}
			}
		}
		await page.close();
	}
	t.diagnostic(`Completed ${scans} accessibility scans`);
	assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
});

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

// CDP sends trusted input through Chromium's gesture recognizer, including scroll cancellation.
const touchPoint = async locator => {
	await locator.scrollIntoViewIfNeeded();
	const bounds = await locator.boundingBox();
	assert.ok(bounds);
	return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
};

const touchContextMenu = async (session, locator) => {
	const point = await touchPoint(locator);
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [point],
	});
	// Cover browsers whose long-press contextmenu carries no pointerType of its own.
	await locator.dispatchEvent('contextmenu', { button: 2 });
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const swipe = async (page, session, point, dx, dy) => {
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
	for (let step = 1; step <= 8; step++) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: point.x + (dx * step) / 8, y: point.y + (dy * step) / 8 }],
		});
		await page.evaluate(() => new Promise(requestAnimationFrame));
	}
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

for (const { tab, slots } of [
	{ tab: 'simulator', slots: '#ingredients' },
	{ tab: 'discovery', slots: '#inventory' },
]) {
	test(`${tab} touch input supports taps, cancellation, and scrolling without accidental changes`, async t => {
		const { baseUrl, browser } = await createBrowserFixture(t);
		const page = await createSavedPage(
			browser,
			baseUrl,
			{ activeTab: tab, version: 'together', pickers: [[], []] },
			{ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } },
		);
		page.setDefaultTimeout(10_000);
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		const session = await page.context().newCDPSession(page);
		const search = page.locator(`#${tab} .ingredientpicker`);
		const meat = page.locator(`#${tab}`).getByRole('option', { name: /^Meat(?: \d)?$/ });
		const selectedKeys = () =>
			page
				.locator(`${slots} .ingredient[data-id]`)
				.evaluateAll(items => items.map(item => item.dataset.id));
		await search.fill('Meat');
		const point = await touchPoint(meat);
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [point],
		});
		assert.deepEqual(await selectedKeys(), [], 'Pressing does not select');
		await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
		assert.deepEqual(await selectedKeys(), []);
		await touchContextMenu(session, meat);
		assert.deepEqual(
			await selectedKeys(),
			[],
			'Long press and its trailing click do not select',
		);
		await meat.dispatchEvent('click');
		assert.deepEqual(
			await selectedKeys(),
			['meat@together'],
			'Assistive clicks still work after touch input',
		);
		const slot = page.locator(`${slots} .ingredient[data-id]`).first();
		await slot.tap();
		assert.deepEqual(await selectedKeys(), []);
		await meat.tap();
		assert.deepEqual(await selectedKeys(), ['meat@together'], 'A tap selects exactly once');
		await touchContextMenu(session, slot);
		assert.deepEqual(await selectedKeys(), ['meat@together'], 'Long press does not remove');
		await slot.tap();
		assert.deepEqual(await selectedKeys(), []);
		const toggle = meat.locator('.ingredient-toggle');
		const minus = meat.locator('.ingredient-subtract');
		await meat.tap();
		if (tab === 'simulator') {
			await meat.locator('.text').tap();
		}
		const beforeControls = await selectedKeys();
		for (const control of [toggle, minus]) {
			const controlPoint = await touchPoint(control);
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [controlPoint],
			});
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchCancel',
				touchPoints: [],
			});
			await touchContextMenu(session, control);
			assert.deepEqual(
				await selectedKeys(),
				beforeControls,
				'Canceled/long-press removal leaves membership unchanged',
			);
		}
		await minus.tap();
		assert.equal((await selectedKeys()).length, tab === 'simulator' ? 1 : 0);
		if (tab === 'discovery') {
			await meat.tap();
		}
		await toggle.tap();
		assert.deepEqual(
			await selectedKeys(),
			[],
			'Touch unchecking removes all without also adding',
		);
		await page.locator(`#${tab} .clearsearchbtn`).tap();
		const dropdown = page.locator(`#${tab} .ingredientdropdown`);
		await dropdown.scrollIntoViewIfNeeded();
		const bounds = await dropdown.boundingBox();
		await swipe(
			page,
			session,
			{ x: bounds.x + bounds.width / 3, y: bounds.y + bounds.height * 0.75 },
			0,
			-160,
		);
		await page.waitForFunction(
			selector => document.querySelector(selector).scrollTop > 0,
			`#${tab} .ingredientdropdown`,
		);
		assert.deepEqual(await selectedKeys(), [], 'Swiping options scrolls without selecting');
		assert.deepEqual(diagnostics, []);
	});
}

test('grouped ingredient results retain relevance, keyboard navigation, localization, and independent preferences', async t => {
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
								pickers: [['meat', 'meat'], ['meat']],
							}),
						},
						{
							name: 'foodGuideSortPreference',
							value: JSON.stringify(['default', 'name']),
						},
					],
				},
			],
		},
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('#simulator .sortingredients').textContent(), 'Sort: Auto');
	assert.equal(await page.locator('#discovery .sortingredients').textContent(), 'Sort: Name');
	for (const tab of ['simulator', 'discovery']) {
		await page.locator(`#tab-${tab}`).click();
		const panel = page.locator(`#${tab}`);
		const search = panel.getByRole('combobox');
		await panel.locator('.sortingredients').click();
		await panel.locator('[role=menuitemradio][data-value=auto]').click();
		await search.fill('Meat');
		const menu = panel.locator('.groupingredients');
		await menu.focus();
		await menu.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		assert.equal(await menu.evaluate(e => e === document.activeElement), true);
		assert.equal(
			await panel.locator('[role=option]').first().getAttribute('data-id'),
			'meat@together',
		);
		const options = await panel.locator('[role=option]').evaluateAll(items =>
			items.map(e => ({
				id: e.id,
				key: e.dataset.id,
				position: Number(e.getAttribute('aria-posinset')),
				size: Number(e.getAttribute('aria-setsize')),
			})),
		);
		assert.equal(
			new Set(options.map(e => e.key)).size,
			options.length,
			'Every ingredient appears once',
		);
		assert.deepEqual(
			options.map(e => e.position),
			options.map((_, i) => i + 1),
		);
		assert.ok(options.every(e => e.size === options.length));
		const groups = panel.locator('.ingredient-result-group[role=group]');
		const firstCount = await groups.first().locator('[role=option]').count();
		await search.focus();
		for (let i = 0; i <= firstCount; i++) {
			await search.press('ArrowDown');
		}
		assert.equal(
			await search.getAttribute('aria-activedescendant'),
			options[firstCount].id,
			'Arrows skip headings and cross group boundaries',
		);
		assert.equal(await search.evaluate(e => e === document.activeElement), true);
		await search.press('Escape');
		await search.press('ArrowDown');
		if (tab === 'simulator') {
			await search.press('Shift+Enter');
			assert.equal(
				await panel
					.locator('[data-id="meat@together"][role=option]')
					.getAttribute('aria-label'),
				'Meat',
			);
		}
		await search.press('Control+Enter');
		assert.equal(await panel.locator('.ingredient-option-actions:visible').count(), 0);
		assert.equal(
			await panel.locator('[role=option]').first().getAttribute('data-id'),
			'meat@together',
			'Removal does not reorder groups',
		);
		for (const [locale, heading] of Object.entries({ en: 'Meat', es: 'Carne', zh: '肉类' })) {
			await page.locator('#language-picker').selectOption(locale);
			assert.ok((await groups.first().textContent()).startsWith(`${heading} (`));
		}
		await page.locator('#language-picker').selectOption('en');
		if (tab === 'discovery') {
			await menu.press('ArrowDown');
			await page.keyboard.press('End');
			await page.keyboard.press('Enter');
		}
		await search.fill('zzzznomatches');
		assert.equal(await groups.count(), 0, 'Empty searches omit group headers');
		await search.fill('Meat');
	}
	assert.deepEqual(
		await page.evaluate(() => JSON.parse(localStorage.getItem('foodGuideGroupPreference'))),
		['type', 'preparation'],
	);
	await page.reload({ waitUntil: 'networkidle' });
	assert.equal(
		await page.locator('#simulator .groupingredients').textContent(),
		'Group by: Ingredient type',
	);
	assert.equal(
		await page.locator('#discovery .groupingredients').textContent(),
		'Group by: Preparation',
	);
	assert.deepEqual(diagnostics, []);
});

test('group cards use available width across displays and densities without changing keyboard order', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	for (const hasTouch of [false, true]) {
		const page = await createSavedPage(
			browser,
			baseUrl,
			{ version: 'together', pickers: [['meat'], ['meat']] },
			{ hasTouch, viewport: { width: 1280, height: 800 } },
		);
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		for (const tab of ['simulator', 'discovery']) {
			await page.locator(`#tab-${tab}`).click();
			const panel = page.locator(`#${tab}`);
			const search = panel.getByRole('combobox');
			const select = async (selector, value) => {
				await panel.locator(selector).click();
				await panel.locator(`[role=menuitemradio][data-value="${value}"]`).click();
			};
			await select('.groupingredients', 'type');
			const groups = panel.locator('.ingredient-result-group[role=group]');
			const geometry = () =>
				panel.locator('.ingredientdropdown').evaluate(picker => ({
					overflow: picker.scrollWidth > picker.clientWidth,
					groups: [...picker.querySelectorAll('.ingredient-result-group')].map(group => ({
						rect: group.getBoundingClientRect().toJSON(),
						scrolls: ['auto', 'scroll'].includes(getComputedStyle(group).overflowY),
						overflow: group.scrollWidth > group.clientWidth + 1,
					})),
				}));
			const firstRowSizes = {};
			for (const display of ['names', 'icons', 'list']) {
				await select('.displaymodeingredients:not(.densityingredients)', display);
				for (const density of ['compact', 'normal', 'cozy']) {
					await select('.densityingredients', density);
					const layout = await geometry();
					const [first, second] = layout.groups;
					assert.ok(Math.abs(first.rect.top - second.rect.top) < 1);
					assert.ok(
						second.rect.left >= first.rect.right,
						`${tab} ${display} ${density}: Cards share a row`,
					);
					assert.equal(layout.overflow, false);
					assert.ok(
						layout.groups.every(group => !group.scrolls && !group.overflow),
						'Cards use one outer scroll area and contain their contents',
					);
					firstRowSizes[`${display}-${density}`] = layout.groups.filter(
						group => Math.abs(group.rect.top - first.rect.top) < 1,
					).length;
				}
			}
			assert.ok(firstRowSizes['names-compact'] > firstRowSizes['names-normal']);
			assert.ok(firstRowSizes['icons-compact'] > firstRowSizes['names-compact']);
			await select('.displaymodeingredients:not(.densityingredients)', 'names');
			await select('.densityingredients', 'compact');
			for (const width of [320, 1280]) {
				await page.setViewportSize({ width, height: 800 });
				for (const locale of ['en', 'es', 'zh']) {
					await page.locator('#language-picker').selectOption(locale);
					const layout = await geometry();
					assert.equal(layout.overflow, false, `${tab} ${locale}: Localized groups fit`);
					assert.ok(layout.groups.every(group => !group.overflow));
				}
			}
			await page.locator('#language-picker').selectOption('en');
			const count = await groups.first().locator('[role=option]').count();
			const firstInNextGroup = await groups
				.nth(1)
				.locator('[role=option]')
				.first()
				.elementHandle();
			await search.focus();
			for (let i = 0; i <= count; i++) {
				await search.press('ArrowDown');
			}
			const activeId = await search.getAttribute('aria-activedescendant');
			assert.equal(activeId, await firstInNextGroup.getAttribute('id'));
			for (const width of [700, 320, 768, 1280]) {
				await page.setViewportSize({ width, height: 800 });
				const { groups: cards, overflow } = await geometry();
				const [first, second] = cards;
				if (width <= 700) {
					assert.ok(
						second.rect.top >= first.rect.bottom,
						'Narrow containers stack groups',
					);
				} else {
					assert.ok(
						Math.abs(first.rect.top - second.rect.top) < 1,
						'Wide containers show groups side by side',
					);
				}
				assert.equal(overflow, false);
				assert.equal(await search.getAttribute('aria-activedescendant'), activeId);
				assert.equal(await search.evaluate(e => e === document.activeElement), true);
				assert.equal(
					await firstInNextGroup.evaluate(e => e.isConnected),
					true,
					'Resizing keeps the active option in place',
				);
			}
			await search.press('Enter');
			assert.equal(await panel.locator('.ingredientlist .icon').count(), 2);
			await select('.groupingredients', 'none');
			assert.equal(await groups.count(), 0);
			assert.equal(
				await panel
					.locator('.ingredient-result-groups')
					.evaluate(e => getComputedStyle(e).display),
				'block',
			);
		}
		assert.deepEqual(diagnostics, []);
		await page.close();
	}
});

test('cooking views preserve selections, support keyboard and touch, and persist independently', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	for (const touch of [false, true]) {
		const page = await createSavedPage(
			browser,
			baseUrl,
			{
				version: 'together',
				pickers: [
					['meat_cooked', 'butter'],
					['meat_cooked', 'butter'],
				],
			},
			touch ? { hasTouch: true, isMobile: true, viewport: { width: 320, height: 812 } } : {},
		);
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		const selectCooking = async (panel, value) => {
			const button = panel.locator('.cookingingredients');
			if (touch) {
				await button.tap();
				await panel.locator(`[role=menuitemradio][data-value="${value}"]`).tap();
			} else {
				await button.focus();
				await button.press('ArrowDown');
				await page.keyboard.press('Home');
				for (let i = 0; i < ['all', 'practical', 'everyday'].indexOf(value); i++) {
					await page.keyboard.press('ArrowDown');
				}
				await page.keyboard.press('Enter');
				assert.equal(await button.evaluate(e => e === document.activeElement), true);
			}
		};
		for (const [tab, preference] of [
			['simulator', 'practical'],
			['discovery', 'everyday'],
		]) {
			await page.locator(`#tab-${tab}`).click();
			const panel = page.locator(`#${tab}`);
			const search = panel.getByRole('combobox');
			assert.equal(await panel.locator('.cookingingredients').textContent(), 'Cooking: All');
			await search.fill('*Cooked Meat');
			assert.equal(await panel.locator('[role=option]').count(), 1);
			await selectCooking(panel, preference);
			assert.equal(await panel.locator('[role=option]').count(), 0);
			assert.equal(await panel.locator('.ingredientlist .icon').count(), 2);
			for (const [locale, hint] of [
				['en', 'Cooking: All'],
				['es', 'Cocinar: Todos'],
				['zh', '烹饪：全部'],
			]) {
				await page.locator('#language-picker').selectOption(locale);
				assert.ok(
					(await panel.locator('.ingredient-search-summary').textContent()).includes(
						hint,
					),
				);
				const help = await panel
					.locator('.cookingingredients')
					.getAttribute('aria-describedby');
				assert.equal(
					await page.locator(`#${help}`).textContent(),
					await panel.locator('.cookingingredients').getAttribute('title'),
				);
			}
			await page.locator('#language-picker').selectOption('en');
			await search.fill('*Butter');
			assert.equal(await panel.locator('[role=option]').count(), tab === 'simulator' ? 1 : 0);
			assert.equal(
				await panel.locator('[role=option][data-id="butter@together"]').count(),
				tab === 'simulator' ? 1 : 0,
			);
			await search.fill('goatmilk');
			assert.ok(
				(await panel.locator('.ingredient-search-summary').textContent()).includes(
					'Cooking: All',
				),
			);
			await panel.locator('.ingredient-show-all').click();
			assert.equal(await panel.locator('[role=option]').count(), 1);
			await selectCooking(panel, preference);
			await search.fill('zzzznomatches');
			assert.equal(
				await panel.locator('.ingredient-search-summary').textContent(),
				'No matching ingredients. Try another search or game selection.',
			);
		}
		await page.locator('#tab-simulator').click();
		const search = page.locator('#simulator .ingredientpicker');
		await search.fill('lightninggoathorn');
		assert.equal(await page.locator('#simulator [role=option]').count(), 0);
		await page.locator('.char-btn[data-character=warly]').click();
		assert.equal(await page.locator('#simulator [role=option]').count(), 1);
		await page.locator('.char-btn[data-character=warly]').click();
		assert.equal(await page.locator('#simulator [role=option]').count(), 0);
		await page.locator('.version-btn[data-version=dontstarve]').click();
		assert.equal(
			await page.locator('#simulator .ingredient-search-summary').textContent(),
			'No matching ingredients. Try another search or game selection.',
		);
		await page.locator('.version-btn[data-version=together]').click();
		await page.reload({ waitUntil: 'networkidle' });
		assert.equal(
			await page.locator('#simulator .cookingingredients').textContent(),
			'Cooking: Practical',
		);
		assert.equal(
			await page.locator('#discovery .cookingingredients').textContent(),
			'Cooking: Everyday',
		);
		assert.deepEqual(
			await page.evaluate(() =>
				JSON.parse(localStorage.getItem('foodGuideCookingPreference')),
			),
			['practical', 'everyday'],
		);
		assert.equal(await page.locator('#ingredients .icon').count(), 2);
		await page.locator('#ingredients .ingredient[data-id="meat_cooked@together"]').click();
		assert.equal(
			await page.locator('#ingredients .icon').count(),
			1,
			'A hidden selection remains removable',
		);
		await page.locator('#tab-discovery').click();
		assert.equal(await page.locator('#inventory .icon').count(), 2);
		assert.deepEqual(diagnostics, []);
		await page.close();
	}
});

test('hidden search matches offer localized keyboard and touch recovery without changing selections', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	for (const touch of [false, true]) {
		const page = await createSavedPage(
			browser,
			baseUrl,
			{ version: 'together', pickers: [['butter'], ['butter']] },
			touch ? { hasTouch: true, isMobile: true, viewport: { width: 320, height: 812 } } : {},
		);
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		await page.locator('#tab-discovery').click();
		await page.locator('#discovery .cookingingredients').click();
		await page.locator('#discovery [role=menuitemradio][data-value="practical"]').click();
		for (const tab of ['simulator', 'discovery']) {
			await page.locator(`#tab-${tab}`).click();
			const panel = page.locator(`#${tab}`);
			const search = panel.getByRole('combobox');
			const recovery = panel.locator('.ingredient-show-all');
			await panel.locator('.cookingingredients').click();
			await panel.locator('[role=menuitemradio][data-value="everyday"]').click();
			assert.equal(
				await recovery.isVisible(),
				false,
				'Browsing does not add a recovery button',
			);
			await search.fill('Butter');
			assert.equal(await panel.locator('[role=option]').count(), 1);
			assert.equal(
				await panel.locator('[role=option][data-id="butter@together"]').count(),
				0,
			);
			for (const [locale, hidden, action] of [
				['en', '1 hidden by cooking view.', 'Show all'],
				['es', 'Ocultos por la vista de cocina: 1.', 'Mostrar todos'],
				['zh', '烹饪视图隐藏了 1 项。', '显示全部'],
			]) {
				await page.locator('#language-picker').selectOption(locale);
				assert.ok(
					(await panel.locator('.ingredient-search-summary').textContent()).includes(
						hidden,
					),
				);
				assert.equal(await recovery.textContent(), action);
				assert.equal(await recovery.isVisible(), true);
			}
			await page.locator('#language-picker').selectOption('en');
			assert.equal(
				await recovery.getAttribute('aria-controls'),
				await search.getAttribute('aria-controls'),
			);
			await search.press('ArrowDown');
			await search.press('Escape');
			assert.equal(
				await recovery.isVisible(),
				false,
				'Dismissal hides recovery with the results',
			);
			await search.press('ArrowDown');
			if (touch) {
				const box = await recovery.boundingBox();
				assert.ok(box.width >= 44 && box.height >= 44);
				await recovery.tap();
			} else {
				for (
					let i = 0;
					i < 12 && !(await recovery.evaluate(e => e === document.activeElement));
					i++
				) {
					await page.keyboard.press('Tab');
				}
				assert.equal(await recovery.evaluate(e => e === document.activeElement), true);
				await page.keyboard.press('Enter');
			}
			assert.equal(await search.inputValue(), 'Butter');
			assert.equal(await panel.locator('[role=option]').count(), 2);
			assert.equal(await recovery.isVisible(), false);
			assert.equal(await search.evaluate(e => e === document.activeElement), true);
			assert.equal(await search.getAttribute('aria-activedescendant'), null);
			assert.equal(await panel.locator('.ingredientlist .icon').count(), 1);
			assert.equal(await panel.locator('.cookingingredients').textContent(), 'Cooking: All');
			const otherTab = tab === 'simulator' ? 'discovery' : 'simulator';
			assert.equal(
				await page.locator(`#${otherTab} .cookingingredients`).textContent(),
				tab === 'simulator' ? 'Cooking: Practical' : 'Cooking: All',
				'Recovery only changes the current picker',
			);
			await page.waitForFunction(
				id =>
					document.querySelector(`#${id} [role=status]`).textContent ===
					'2 matching ingredients.',
				tab,
			);
			await page.reload({ waitUntil: 'networkidle' });
			assert.equal(await panel.locator('.cookingingredients').textContent(), 'Cooking: All');
		}
		assert.deepEqual(diagnostics, []);
		await page.close();
	}
});

test('compact picker badges leave larger hit areas and an unobstructed ingredient center', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	for (const hasTouch of [false, true]) {
		const page = await createSavedPage(
			browser,
			baseUrl,
			{
				activeTab: 'simulator',
				version: 'together',
				pickers: [['meat_cooked', 'meat_cooked', 'meat_cooked', 'berries'], []],
			},
			{ hasTouch, viewport: { width: 1280, height: 812 } },
		);
		const diagnostics = trackDiagnostics(page);
		await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
		const panel = page.locator('#simulator');
		await panel.getByRole('combobox').fill('Meat');
		const meat = panel.locator('[role=option][data-id="meat_cooked@together"]');
		const activate = (locator, options) =>
			hasTouch ? locator.tap(options) : locator.click(options);
		const selectedKeys = () =>
			page
				.locator('#ingredients .ingredient[data-id]')
				.evaluateAll(items => items.map(item => item.dataset.id));
		for (const mode of ['names', 'list', 'icons']) {
			await activate(panel.locator('.displaymodeingredients:not(.densityingredients)'));
			await activate(panel.locator(`[role=menuitemradio][data-value="${mode}"]`));
			for (const density of ['compact', 'normal', 'cozy']) {
				await activate(panel.locator('.densityingredients'));
				await activate(panel.locator(`[role=menuitemradio][data-value="${density}"]`));
				await meat.scrollIntoViewIfNeeded();
				const geometry = await meat.evaluate(option => {
					const rect = option.getBoundingClientRect();
					const text = option.querySelector('.text').getBoundingClientRect();
					const icon = option.querySelector('.icon').getBoundingClientRect();
					const actions = [
						...option.querySelectorAll('.ingredient-option-actions > span'),
					];
					const controls = actions.map(action => {
						const hit = action.getBoundingClientRect();
						const badge = action.firstElementChild.getBoundingClientRect();
						const points = [
							{ x: hit.left + 1, y: hit.top + 1 },
							{ x: hit.right - 1, y: hit.bottom - 1 },
						];
						const extraHitPoint = points.find(
							({ x, y }) =>
								!(
									x >= badge.left &&
									x <= badge.right &&
									y >= badge.top &&
									y <= badge.bottom
								) &&
								document
									.elementFromPoint(x, y)
									?.closest('.ingredient-toggle, .ingredient-subtract') ===
									action,
						);
						return {
							hit: hit.toJSON(),
							badge: badge.toJSON(),
							extraHitPoint: extraHitPoint && {
								x: extraHitPoint.x - hit.left,
								y: extraHitPoint.y - hit.top,
							},
						};
					});
					return {
						rect: rect.toJSON(),
						text: text.toJSON(),
						icon: icon.toJSON(),
						controls,
						centerHasAction: !!document
							.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
							?.closest('.ingredient-toggle, .ingredient-subtract'),
					};
				});
				const context = `${hasTouch ? 'touch' : 'mouse'} ${mode} ${density}`;
				assert.equal(
					geometry.centerHasAction,
					false,
					`${context}: Center keeps the ingredient action`,
				);
				const [toggle, minus] = geometry.controls;
				assert.ok(
					toggle.hit.right <= minus.hit.left ||
						minus.hit.right <= toggle.hit.left ||
						toggle.hit.bottom <= minus.hit.top ||
						minus.hit.bottom <= toggle.hit.top,
					`${context}: Shortcut hit areas must not overlap`,
				);
				for (const { hit, badge, extraHitPoint } of geometry.controls) {
					assert.ok(
						badge.width <= 22 && badge.height <= 16,
						`${context}: Badges remain small`,
					);
					assert.ok(
						hit.width * hit.height > badge.width * badge.height * 1.2,
						`${context}: Hit area exceeds visual`,
					);
					assert.ok(
						extraHitPoint,
						`${context}: Transparent area receives the shortcut action`,
					);
					assert.ok(
						badge.left >= hit.left &&
							badge.right <= hit.right &&
							badge.top >= hit.top &&
							badge.bottom <= hit.bottom,
						`${context}: Badge fits its hit area`,
					);
					assert.ok(
						hit.left >= geometry.rect.left &&
							hit.right <= geometry.rect.right &&
							hit.top >= geometry.rect.top &&
							hit.bottom <= geometry.rect.bottom,
						`${context}: Hit area stays within its ingredient`,
					);
				}
				if (mode === 'names') {
					if (density === 'cozy') {
						assert.ok(
							geometry.icon.bottom <= geometry.text.top,
							`${context}: Cozy puts names below icons`,
						);
					} else {
						assert.ok(
							geometry.icon.right <= geometry.text.left,
							`${context}: Inline names follow icons`,
						);
					}
				}
				if (density !== 'compact') {
					continue;
				}
				if (mode === 'icons') {
					assert.ok(
						geometry.rect.width <= 50 && geometry.rect.height <= 45,
						`${context}: No action footer`,
					);
				} else if (mode === 'names') {
					assert.ok(geometry.rect.width < 160, `${context}: No wide action column`);
				}
				if (mode !== 'icons') {
					assert.ok(
						toggle.badge.right > geometry.text.left &&
							toggle.badge.left < geometry.text.right &&
							toggle.badge.bottom > geometry.text.top &&
							toggle.badge.top < geometry.text.bottom,
						`${context}: Compact badges overlay text instead of reserving space`,
					);
				}
				const layout = () =>
					panel
						.locator('[role=option]')
						.evaluateAll(items =>
							items.map(item => [
								item.dataset.id,
								item.offsetLeft,
								item.offsetTop,
								item.offsetWidth,
								item.offsetHeight,
							]),
						);
				const beforeLayout = await layout();
				const before = await selectedKeys();
				await activate(meat.locator('.ingredient-subtract'), {
					position: minus.extraHitPoint,
				});
				assert.deepEqual(
					await selectedKeys(),
					before.toSpliced(before.lastIndexOf('meat_cooked@together'), 1),
				);
				await activate(meat.locator('.ingredient-toggle'), {
					position: toggle.extraHitPoint,
				});
				assert.deepEqual(await selectedKeys(), ['berries@together']);
				assert.deepEqual(
					await layout(),
					beforeLayout,
					`${context}: Removing leaves tile positions unchanged`,
				);
				assert.equal(await meat.locator('.ingredient-option-actions').isVisible(), false);
				// The former shortcut's blank hit area now performs the ingredient action.
				await activate(meat, {
					position: {
						x: toggle.hit.left - geometry.rect.left + toggle.extraHitPoint.x,
						y: toggle.hit.top - geometry.rect.top + toggle.extraHitPoint.y,
					},
				});
				for (let i = 1; i < 3; i++) {
					await activate(meat);
				}
				assert.deepEqual(
					await layout(),
					beforeLayout,
					`${context}: Adding leaves tile positions unchanged`,
				);
				assert.deepEqual(await selectedKeys(), [
					'berries@together',
					'meat_cooked@together',
					'meat_cooked@together',
					'meat_cooked@together',
				]);
			}
		}
		assert.deepEqual(diagnostics, []);
		await page.close();
	}
});

test('touch layouts keep controls reachable across widths, languages, and picker densities', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{
			activeTab: 'simulator',
			version: 'together',
			pickers: [
				['meat', 'berries', 'berries', 'berries'],
				['meat', 'berries'],
			],
		},
		{ hasTouch: true, isMobile: true, viewport: { width: 320, height: 812 } },
	);
	page.setDefaultTimeout(10_000);
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	assert.equal(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), true);
	const checkTargets = async context => {
		const issues = await page
			.locator(
				'button:visible, select:visible, [role="option"]:visible, .game-link, .wiki-links-list a:visible',
			)
			.evaluateAll(elements =>
				elements.flatMap(element => {
					const { x, width, height } = element.getBoundingClientRect();
					const size = width < 43.99 || height < 43.99;
					const clipped =
						!element.closest('.table-scroll-wrapper') &&
						(x < -0.1 || x + width > innerWidth + 0.1);
					return size || clipped
						? [
								{
									label:
										element.getAttribute('aria-label') || element.textContent,
									x,
									width,
									height,
									clipped,
								},
							]
						: [];
				}),
			);
		assert.deepEqual(issues, [], `${context}: ${JSON.stringify(issues)}`);
		const clippedNames = await page
			.locator('.ingredientdropdown:not(.hidetext) .text:visible')
			.evaluateAll(elements =>
				elements
					.filter(
						element =>
							element.scrollWidth > element.clientWidth + 1 ||
							element.scrollHeight > element.clientHeight + 1,
					)
					.map(element => element.textContent),
			);
		assert.deepEqual(
			clippedNames,
			[],
			`${context}: Touch users need complete ingredient names`,
		);
		const actionIssues = await page
			.locator('.ingredient-option-actions:visible > span')
			.evaluateAll(elements =>
				elements.flatMap(e => {
					const r = e.getBoundingClientRect();
					const option = e.closest('[role=option]').getBoundingClientRect();
					return r.width >= 19.99 &&
						r.height >= 19.99 &&
						r.left >= option.left &&
						r.right <= option.right &&
						r.top >= option.top &&
						r.bottom <= option.bottom
						? []
						: [e.outerHTML];
				}),
			);
		assert.deepEqual(
			actionIssues,
			[],
			`${context}: Membership controls need separate, unclipped touch targets`,
		);
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			true,
			`${context}: Page content must fit without horizontal scrolling`,
		);
	};
	for (const width of [320, 375, 768, 1280]) {
		await page.setViewportSize({ width, height: 812 });
		for (const locale of ['en', 'es', 'zh']) {
			await page.locator('#language-picker').selectOption(locale);
			for (const tab of [
				'simulator',
				'discovery',
				'foodlist',
				'crockpot',
				'statistics',
				'about',
				'gameinfo',
			]) {
				await page.locator(`#navbar [data-tab="${tab}"]`).tap();
				await checkTargets(`${width}px ${locale} ${tab}`);
			}
		}
		await page.locator('#language-picker').selectOption('en');
		await page.locator('#navbar [data-tab="simulator"]').tap();
		for (const mode of ['icons', 'names', 'list']) {
			await page.locator('#simulator .displaymodeingredients:not(.densityingredients)').tap();
			await checkTargets(`${width}px display menu`);
			await page.locator(`#simulator [role="menuitemradio"][data-value="${mode}"]`).tap();
			assert.equal(
				await page.locator('#simulator [role=option] .text').first().isVisible(),
				mode !== 'icons',
				'Icon mode hides names while preserving option labels',
			);
			for (const density of ['compact', 'normal', 'cozy']) {
				await page.locator('#simulator .densityingredients').tap();
				await checkTargets(`${width}px density menu`);
				await page
					.locator(`#simulator [role="menuitemradio"][data-value="${density}"]`)
					.tap();
				await checkTargets(`${width}px ${mode} ${density}`);
			}
		}
		assert.equal(
			await page
				.locator('#simulator .ingredientpicker')
				.evaluate(e => getComputedStyle(e).fontSize),
			'16px',
		);
	}
	await page.setViewportSize({ width: 320, height: 812 });
	await page.addStyleTag({
		content: `
		* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
		p { margin-bottom: 2em !important; }
	`,
	});
	for (const locale of ['en', 'es', 'zh']) {
		await page.locator('#language-picker').selectOption(locale);
		for (const tab of [
			'simulator',
			'discovery',
			'foodlist',
			'crockpot',
			'statistics',
			'about',
			'gameinfo',
		]) {
			await page.locator(`#tab-${tab}`).tap();
			await checkTargets(`320px ${locale} ${tab} with increased text spacing`);
			if (tab === 'simulator' || tab === 'discovery') {
				const slots = page.locator(`#${tab} .ingredient[data-id]`);
				assert.ok((await slots.count()) > 0);
				const issues = await slots.evaluateAll(elements =>
					elements.flatMap(element => {
						const name = element.querySelector('.ingredient-name');
						const visible = name && getComputedStyle(name).display !== 'none';
						const fits =
							element.scrollHeight <= element.clientHeight + 1 &&
							element.scrollWidth <= element.clientWidth + 1;
						return visible &&
							fits &&
							element.getAttribute('aria-label').includes(name.textContent)
							? []
							: [element.outerHTML];
					}),
				);
				assert.deepEqual(
					issues,
					[],
					'Selected ingredient names must remain visible and unclipped',
				);
			}
		}
	}
	assert.deepEqual(diagnostics, []);
});

test('touch scrolling of recipe tables and analyzer filters does not activate their controls', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(
		browser,
		baseUrl,
		{ activeTab: 'foodlist', version: 'together', pickers: [[], ['meat', 'berries']] },
		{ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } },
	);
	page.setDefaultTimeout(10_000);
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const session = await page.context().newCDPSession(page);
	const wrapper = page.locator('#foodlist .table-scroll-wrapper');
	assert.equal(await wrapper.evaluate(e => e.scrollWidth > e.clientWidth), true);
	const sort = page.locator('#foodlist .table-sort').first();
	const point = await touchPoint(sort);
	const before = await page.locator('#foodlist th[aria-sort]').getAttribute('aria-sort');
	await swipe(page, session, point, -100, 0);
	await page.waitForFunction(
		() => document.querySelector('#foodlist .table-scroll-wrapper').scrollLeft > 0,
	);
	assert.equal(await page.locator('#foodlist th[aria-sort]').getAttribute('aria-sort'), before);
	await page.locator('#navbar [data-tab="discovery"]').tap();
	await page.locator('#makable .makablebutton').tap();
	await page.waitForFunction(() => !document.querySelector('#makable .makablebutton').disabled);
	for (const group of ['foodFilter', 'recipeFilter']) {
		const filter = page.locator(`#makable .${group} .analysis-filter`).first();
		const label = await filter.getAttribute('aria-label');
		assert.equal(await filter.locator('.analysis-filter-name').isVisible(), true);
		assert.ok(label.startsWith(await filter.locator('.analysis-filter-name').textContent()));
		await touchContextMenu(session, filter);
		assert.equal(await filter.getAttribute('aria-label'), label);
		for (const state of ['Required', 'Excluded', 'Normal']) {
			await filter.tap();
			assert.match(await filter.getAttribute('aria-label'), new RegExp(`${state}$`));
		}
	}
	const filter = page.locator('#makable .foodFilter .analysis-filter').first();
	const filterPoint = await touchPoint(filter);
	const label = await filter.getAttribute('aria-label');
	const scroll = await page.evaluate(() => scrollY);
	await swipe(page, session, filterPoint, 0, -120);
	await page.waitForFunction(previous => scrollY > previous, scroll);
	assert.equal(await filter.getAttribute('aria-label'), label);
	assert.deepEqual(diagnostics, []);
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
		const meat = page.locator(`#${tab}`).getByRole('option', { name: /^Meat(?: \d)?$/ });
		const selectedKeys = () =>
			page
				.locator(`${slots} .ingredient[data-id]`)
				.evaluateAll(items => items.map(item => item.dataset.id));
		await search.fill('Meat');
		const bounds = await meat.boundingBox();
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		await page.mouse.down();
		assert.deepEqual(await selectedKeys(), []);
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 10);
		await page.mouse.up();
		assert.deepEqual(await selectedKeys(), [], 'Dragging away cancels the selection');
		// Assistive technology may dispatch a click without preceding pointer/mouse events.
		await meat.dispatchEvent('click');
		assert.deepEqual(await selectedKeys(), ['meat@together']);
		await meat.click({ button: 'right' });
		assert.deepEqual(await selectedKeys(), []);
		await meat.locator('.text').click();
		assert.deepEqual(await selectedKeys(), ['meat@together']);
		assert.equal(await search.evaluate(e => e === document.activeElement), true);
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
		await page.locator('#navbar [data-tab="crockpot"]').getAttribute('aria-selected'),
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
	assert.equal(await page.locator('#navbar [data-tab]').count(), 7);
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
		// The option's accessible name also includes its picked quantity.
		assert.equal(
			await page
				.locator('#simulator [role="option"][aria-selected="true"] .text')
				.textContent(),
			name,
		);
		await search.press('Enter');
	}
	assert.equal(await page.locator('#ingredients .icon').count(), 4);
	await page.locator('#results a').getByText('Meatballs', { exact: true }).first().waitFor();

	await page.locator('#navbar [data-tab="foodlist"]').focus();
	await page.locator('#navbar [data-tab="foodlist"]').press('Enter');
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
			await page.locator('#navbar [data-tab="simulator"]').getAttribute('aria-selected'),
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
		await page.locator('#navbar [data-tab="about"]').getAttribute('aria-selected'),
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

test('current selections persist before unload and recover after an interrupted session', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await browser.newPage();
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('foodGuideState')));
	const pick = async (panel, name) => {
		const search = page.locator(`${panel} .ingredientpicker`);
		await search.fill(name);
		await search.press('Enter');
	};
	await pick('#simulator', 'Meat');
	assert.deepEqual((await stored()).pickers[0], ['meat@together', null, null, null]);
	await page.getByRole('tab', { name: 'Discovery', exact: true }).click();
	assert.equal((await stored()).activeTab, 'discovery');
	await pick('#discovery', 'Berries');
	await pick('#discovery', 'Carrot');
	assert.deepEqual((await stored()).pickers[1], ['berries@together', 'carrot@together']);
	await page.locator('#inventory [data-id="berries@together"]').click();
	assert.deepEqual((await stored()).pickers[1], ['carrot@together']);
	await page.locator('.version-btn[data-version="dontstarve"]').click();
	assert.equal((await stored()).version, 'dontstarve');
	assert.deepEqual((await stored()).pickers, [['meat', null, null, null], ['carrot']]);
	await page.locator('.dlc-btn[data-dlc="giants"]').click();
	assert.equal((await stored()).dlc.giants, true);
	await page.locator('.char-btn[data-character="wigfrid"]').click();
	assert.equal((await stored()).character, 'wigfrid');
	await page.locator('.char-btn[data-character="wigfrid"]').click();
	assert.equal((await stored()).character, null);
	await pick('#discovery', 'Cactus Flesh');
	await page.locator('.dlc-btn[data-dlc="giants"]').click();
	assert.deepEqual((await stored()).pickers[1], ['carrot']);
	await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
	await page.locator('#ingredients [data-id="meat"]').click();
	assert.deepEqual((await stored()).pickers[0], [null, null, null, null]);
	await pick('#simulator', 'Berries');
	await page.locator('#simulator .clearingredientsbtn').click();
	assert.deepEqual((await stored()).pickers[0], [null, null, null, null]);
	await pick('#simulator', 'Meat');
	await page.getByRole('tab', { name: 'Discovery', exact: true }).click();
	// Capture storage while the original page is still open; no unload handler can save it.
	const recovery = await browser.newContext({
		storageState: await page.context().storageState(),
	});
	t.after(() => recovery.close());
	const restored = await recovery.newPage();
	await restored.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	assert.equal(await restored.locator('#tab-discovery').getAttribute('aria-selected'), 'true');
	assert.equal(await restored.locator('#ingredients [data-id="meat"]').count(), 1);
	assert.equal(await restored.locator('#inventory [data-id="carrot"]').count(), 1);
	page.once('dialog', dialog => dialog.dismiss());
	await page.locator('#discovery .clearingredientsbtn').click();
	assert.deepEqual((await stored()).pickers[1], ['carrot']);
	page.once('dialog', dialog => dialog.accept());
	await page.locator('#discovery .clearingredientsbtn').click();
	assert.deepEqual((await stored()).pickers[1], []);
	assert.deepEqual(diagnostics, []);
});

test('completed analysis pagination follows filters and locale without discarding its limit', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'discovery',
		version: 'together',
		pickers: [
			[],
			[
				'meat',
				'berries',
				'carrot',
				'honey',
				'twigs',
				'ice',
				'bird_egg',
				'monstermeat',
				'cave_banana',
				'pumpkin',
				'tomato',
				'potato',
				'eggplant',
			],
		],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	await page.locator('#makable .makablebutton').click();
	await page.waitForFunction(() => !document.querySelector('#makable .makablebutton').disabled);
	const rows = page.locator('#makable tbody tr:not(.table-empty-row)');
	const more = page.locator('#makable .showMoreButton');
	const total = await page.evaluate(() => window.analysis.made.length);
	assert.ok(total > 1000, `Need multiple result batches, got ${total}`);
	assert.equal(await rows.count(), 500);
	await page.locator('#language-picker').selectOption('es');
	assert.equal(await more.textContent(), `Mostrar más resultados (500 de ${total})`);
	await more.click();
	assert.equal(await rows.count(), 1000);
	const meatballs = page
		.locator('#makable .recipeFilter button')
		.filter({ has: page.locator('[title="Meatballs"]') });
	await meatballs.click();
	assert.ok((await rows.count()) > 0 && (await rows.count()) < 500);
	assert.deepEqual(
		[...new Set(await page.locator('#makable tbody td:nth-child(2)').allTextContents())],
		['Meatballs'],
	);
	assert.equal(await more.isVisible(), false);
	await meatballs.click(); // Exclude Meatballs: pagination counts only the remaining matches.
	const remaining =
		total -
		(await page.evaluate(
			() => window.analysis.made.filter(row => row.recipe.name === 'Meatballs').length,
		));
	assert.equal(await rows.count(), Math.min(1000, remaining));
	assert.equal(await more.isVisible(), remaining > 1000);
	assert.equal(
		await more.textContent(),
		`Mostrar más resultados (${Math.min(1000, remaining)} de ${remaining})`,
	);
	await meatballs.click(); // Restore the original dataset and the expanded limit.
	assert.equal(await rows.count(), 1000);
	await page.locator('#language-picker').selectOption('zh');
	assert.equal(await more.textContent(), `显示更多结果(1000 / ${total})`);
	await more.focus();
	for (let limit = 1000; limit < total; limit += 500) {
		assert.equal(await more.isVisible(), true);
		await more.press('Enter');
	}
	assert.equal(await rows.count(), total);
	assert.equal(
		await page.locator('#makable .deleteButton').evaluate(e => e === document.activeElement),
		true,
	);
	await page.locator('#makable .deleteButton').click();
	assert.equal(await page.locator('#makable .makableContainer').count(), 0);
	assert.deepEqual(diagnostics, []);
});

test('Warly food tables show negative fractional changes without an extra whole unit', async t => {
	const { baseUrl, browser } = await createBrowserFixture(t);
	const page = await createSavedPage(browser, baseUrl, {
		activeTab: 'foodlist',
		version: 'dontstarve',
		character: 'warly',
		dlc: { giants: true, shipwrecked: true },
		pickers: [[], []],
	});
	const diagnostics = trackDiagnostics(page);
	await page.goto(`${baseUrl}/index.htm`, { waitUntil: 'networkidle' });
	const greenCap = page.locator('#food tbody tr').filter({
		has: page.getByRole('link', { name: 'Green Cap', exact: true }),
	});
	assert.equal(await greenCap.locator('td:nth-child(3)').textContent(), '0 (-0⅞)');
	assert.deepEqual(diagnostics, []);
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
		await page.locator('#navbar [data-tab="crockpot"]').getAttribute('aria-selected'),
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
	assert.equal(await auto.getAttribute('aria-pressed'), 'false');
	await auto.focus();
	await auto.press('Enter');
	assert.equal(await auto.getAttribute('aria-pressed'), 'true');

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
	const meat = page.locator('#food button[data-link="tag:meat"]').nth(1);
	const originalRow = await meat.evaluate(button => button.closest('tr').children[1].textContent);
	await meat.focus();
	await meat.press('Enter');
	assert.ok((await page.locator('#food .highlighted').count()) > 1);
	assert.equal(
		await page.evaluate(() => document.activeElement.closest('tr')?.children[1].textContent),
		originalRow,
	);
	await meat.press('Space');
	assert.equal(await page.locator('#food .highlighted').count(), 0);
	assert.equal(await meat.evaluate(button => button === document.activeElement), true);
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
		const observers = new Map();
		const NativeResizeObserver = window.ResizeObserver;
		window.ResizeObserver = class extends NativeResizeObserver {
			observe(target) {
				if (!observers.has(this)) {
					observers.set(this, new Set());
				}
				observers.get(this).add(target);
				super.observe(target);
			}
			disconnect() {
				observers.delete(this);
				super.disconnect();
			}
		};
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
			observers: {
				count: observers.size,
				detached: [...observers.values()]
					.flatMap(targets => [...targets])
					.filter(target => !target.isConnected).length,
			},
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
		assert.equal(audit.observers.count, audit.live, JSON.stringify(audit));
		assert.equal(audit.observers.detached, 0, JSON.stringify(audit));
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
			captionKey: 'tableCookingResults',
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
		// Browser scroll offsets round to whole pixels; row geometry can be fractional.
		const highlightVisible = rect.top >= -1 && rect.bottom <= window.innerHeight + 1;
		highlighted.dispose();
		highlighted.remove();
		const results = [];
		for (const toggleable of [false, true]) {
			const dataset = [{ name: 'Carrot' }];
			const table = makeSortableTable({
				captionKey: 'tableCookingResults',
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
		return {
			highlightVisible,
			rect: { top: rect.top, bottom: rect.bottom, viewport: innerHeight },
			disposed: results,
		};
	});
	assert.equal(result.highlightVisible, true, JSON.stringify(result.rect));
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
