import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSavedState } from '../html/preferences.js';
import { parseSpriteManifest } from '../html/utils.js';
import { food } from '../html/food.js';
import { dry_med } from '../html/constants.js';
import { getCollectionItem } from '../html/collection.js';

test('standalone food exports have initialized helpers and numeric drying times', () => {
	assert(food.length > 300);
	assert(food.filter(item => item.key === 'carrot').includes(food.carrot));
	assert.equal(food.byName('carrot').id, 'carrot');
	assert.equal(food.batnose.drytime, dry_med);
});

test('initialization preserves negative best stats and explicit preparation links', () => {
	for (const suffix of ['', '@together']) {
		const morsel = food[`morsel${suffix}`];
		assert.equal(food[`morsel_cooked${suffix}`].raw, morsel);
		assert.equal(food[`morsel_dried${suffix}`].wet, morsel);
		assert.equal(food[`monstermeat_cooked${suffix}`].bestHealth, -3);
		assert.equal(food[`rottenegg${suffix}`].bestHunger, -10);
	}
});

test('saved state rejects incompatible values and retains legacy mode settings', () => {
	assert.deepEqual(parseSavedState('null'), {});
	assert.deepEqual(parseSavedState('[]'), {});
	assert.deepEqual(
		parseSavedState(
			JSON.stringify({
				version: [],
				character: {},
				modeMask: 23,
				baseMode: 'shipwrecked',
				dlc: { giants: true, shipwrecked: 'false' },
				pickers: [['carrot', 12, null], {}],
			}),
		),
		{
			modeMask: 23,
			baseMode: 'shipwrecked',
			dlc: { giants: true, shipwrecked: false },
			pickers: [['carrot', null, null], []],
		},
	);
	assert.throws(() => parseSavedState('{'), SyntaxError);
});

test('sprite manifests require valid sheet paths and in-bounds integer coordinates', () => {
	const manifest = {
		cellSize: 64,
		columns: 20,
		rows: [1],
		sheets: ['img/sprites/sheet-0.png'],
		images: { 'img/carrot.png': { sheet: 0, col: 1, row: 0 } },
	};
	assert.deepEqual(parseSpriteManifest(manifest), manifest);
	for (const value of [
		null,
		{},
		{ ...manifest, sheets: ['https://example.invalid/image'] },
		{ ...manifest, rows: [0] },
		{ ...manifest, images: { carrot: { sheet: 1, col: 0, row: 0 } } },
		{ ...manifest, images: { carrot: { sheet: 0, col: 20, row: 0 } } },
	]) {
		assert.throws(() => parseSpriteManifest(value), /Invalid sprite/);
	}
});

test('collection key lookup rejects helpers, indexes, and inherited names', () => {
	assert.equal(getCollectionItem(food, 'carrot'), food.carrot);
	assert.equal(
		getCollectionItem(food, 'butterflywings@together'),
		food['butterflywings@together'],
	);
	for (const key of [
		'0',
		'length',
		'filter',
		'forEach',
		'sort',
		'byName',
		'__proto__',
		'constructor',
		'missing',
	]) {
		assert.equal(getCollectionItem(food, key), undefined, key);
	}
});
