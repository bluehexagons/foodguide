import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnalysisInspector } from '../html/console-api.js';

const context = () => ({
	selection: {
		version: 'together',
		dlc: { giants: false, shipwrecked: false },
		character: 'warly',
	},
	modeMask: 32,
	charMask: 1,
	multipliers: { raw: 1, cooked: 1, dried: 1, recipe: 1 },
	ingredients: ['meat', 'carrot'],
});
const row = (id = 'meatballs') => ({
	recipe: { key: id, test: () => true },
	ingredients: [{ key: 'meat' }, { key: 'carrot' }],
	tags: { health: 1, hunger: 2 },
	multiple: false,
	name: id,
	health: 3,
	hunger: 4,
	ihealth: 1,
	ihunger: 2,
	healthpls: 2,
	hungerpls: 2,
	healthpct: 200,
	hungerpct: 100,
});

test('console summaries capture context but read live UI result counts and lifecycle', () => {
	const inspector = createAnalysisInspector();
	const setup = context(),
		rows = [];
	const run = inspector.register('discovery', setup, rows, () => true);
	setup.selection.dlc.giants = true;
	setup.ingredients.push('honey');
	setup.multipliers.recipe = 2;
	rows.push(row());
	run.update({ checked: 10, total: 20 }, 'paused');
	const summary = inspector.summaries()[0];
	assert.equal(summary.resultCount, 1);
	assert.equal(summary.status, 'paused');
	assert.equal(summary.checked, 10);
	assert.equal(summary.selection.dlc.giants, false);
	assert.equal(summary.multipliers.recipe, 1);
	assert.deepEqual(summary.ingredients, ['meat', 'carrot']);
	summary.selection.character = 'webber';
	assert.equal(inspector.summaries()[0].selection.character, 'warly');
	run.update({ checked: 20, total: 20 }, 'complete');
	assert.equal(inspector.summaries()[0].status, 'complete');
	run.clear();
	assert.deepEqual(inspector.summaries(), []);
	assert.deepEqual(inspector.rows('discovery'), []);
});

test('console pages are bounded detached JSON data and optionally apply current UI filters', () => {
	const inspector = createAnalysisInspector();
	const rows = Array.from({ length: 125 }, (_, i) => row(i % 2 ? 'stew' : 'meatballs'));
	let selected = 'meatballs';
	inspector.register('statistics', context(), rows, row => row.recipe.key === selected);
	assert.equal(inspector.rows('statistics').length, 100);
	const page = inspector.rows('statistics', { offset: 1, limit: 2 });
	assert.deepEqual(
		page.map(row => row.recipe),
		['stew', 'meatballs'],
	);
	assert.equal('tags' in page[0], false);
	assert.deepEqual(JSON.parse(JSON.stringify(page)), page);
	page[0].ingredients[0] = 'changed';
	page[0].health = 999;
	assert.equal(rows[1].ingredients[0].key, 'meat');
	assert.equal(rows[1].health, 3);
	assert.equal(inspector.rows('statistics', { limit: 10000, filtered: true }).length, 63);
	selected = 'stew';
	assert.equal(inspector.rows('statistics', { limit: 10000, filtered: true }).length, 62);
	assert.equal(inspector.rows('statistics', { offset: 124 }).length, 1);
	assert.equal(inspector.rows('statistics', { limit: 0 }).length, 0);
	for (const options of [
		{ limit: 10001 },
		{ limit: Infinity },
		{ limit: -1 },
		{ offset: NaN },
		{ offset: 0.5 },
		{ offset: -1 },
	]) {
		assert.throws(() => inspector.rows('statistics', options), RangeError);
	}
});

test('clearing an older run cannot erase a replacement or the other analysis source', () => {
	const inspector = createAnalysisInspector();
	const old = inspector.register('discovery', context(), [row()], () => true);
	inspector.register('statistics', context(), [row(), row()], () => true);
	inspector.register('discovery', context(), [], () => true);
	old.clear();
	assert.equal(inspector.summaries().length, 2);
	assert.equal(inspector.summaries().find(run => run.source === 'discovery').resultCount, 0);
	assert.equal(inspector.rows('statistics').length, 2);
});
