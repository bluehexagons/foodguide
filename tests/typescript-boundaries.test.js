import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSpriteManifest } from '../html/utils.js';
import { food } from '../html/food.js';
import { dry_med, total_day_time } from '../html/constants.js';
import { getCollectionItem } from '../html/collection.js';
import { groupIngredients } from '../html/ingredient-groups.js';

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

test('live fish and raw morsels share a cooked output without marking raw morsels as cooked', () => {
	const { pondfish, fishmeat_small: raw, fishmeat_small_cooked: cooked } = food;
	assert.equal(pondfish.cook, cooked);
	assert.equal(raw.cook, cooked);
	assert.equal(cooked.raw, raw);
	assert.equal(raw.raw, undefined);
	assert.ok(!raw.cooked);
	assert.equal(cooked.perish / total_day_time, 6);
	assert.deepEqual(
		groupIngredients([pondfish, raw, cooked], 'preparation').map(group => ({
			key: group.key,
			ids: group.items.map(item => item.id),
		})),
		[
			{ key: 'raw', ids: ['pondfish', 'fishmeat_small'] },
			{ key: 'cooked', ids: ['fishmeat_small_cooked'] },
		],
	);
	for (const source of [pondfish, raw]) {
		assert.equal(source.bestHealth, Math.max(source.health, cooked.health));
		assert.equal(source.bestHunger, Math.max(source.hunger, cooked.hunger));
	}
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
