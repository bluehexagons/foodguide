import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sortIngredients } from '../html/ingredient-sort.js';

const defaults = {
	statMultipliers: { raw: 1, cooked: 1 },
	modifyItem: () => ({}),
	modeMask: 0,
};

describe('ingredient sorting', () => {
	it('returns a sorted copy rather than mutating search results', () => {
		const items = [
			{ name: 'Carrot', preparationType: 'raw', hunger: 12 },
			{ name: 'Berries', preparationType: 'raw', hunger: 9 },
		];

		const result = sortIngredients(items, 'name', defaults);

		assert.deepStrictEqual(
			result.map(item => item.name),
			['Berries', 'Carrot'],
		);
		assert.deepStrictEqual(
			items.map(item => item.name),
			['Carrot', 'Berries'],
		);
	});

	it('uses character stat modifiers when ordering food', () => {
		const vegetables = { name: 'Vegetables', preparationType: 'raw', hunger: 20 };
		const meat = { name: 'Meat', preparationType: 'raw', hunger: 10 };

		const result = sortIngredients([vegetables, meat], 'hunger', {
			...defaults,
			modifyItem: item => (item === vegetables ? { hunger: 0 } : {}),
		});

		assert.deepStrictEqual(result, [meat, vegetables]);
	});

	it('sorts perishable items before items that never perish', () => {
		const result = sortIngredients(
			[
				{ name: 'Preserved', preparationType: 'raw' },
				{ name: 'Fresh', preparationType: 'raw', perish: 40 },
			],
			'perish',
			defaults,
		);

		assert.deepStrictEqual(
			result.map(item => item.name),
			['Fresh', 'Preserved'],
		);
	});
});

describe('automatic ingredient sorting', () => {
	it('keeps exact names first, then search relevance and related preparations', () => {
		const items = [
			{ name: 'Meatballs', lowerName: 'meatballs', match: 3 },
			{ name: 'Cooked Meat', lowerName: 'cooked meat', basename: 'Meat.', match: 3 },
			{ name: 'Fish Meat', lowerName: 'fish meat', match: 2 },
			{ name: 'Meat', lowerName: 'meat', match: 3 },
		];
		assert.deepEqual(
			sortIngredients(items, 'auto', { ...defaults, search: ' Meat ' }).map(
				item => item.name,
			),
			['Meat', 'Cooked Meat', 'Meatballs', 'Fish Meat'],
		);
		assert.equal(items[0].name, 'Meatballs');
	});

	it('ignores stale relevance scores while browsing and keeps preparations together', () => {
		const items = [
			{ name: 'Cooked Meat', basename: 'Meat.', match: 100 },
			{ name: 'Meat', match: 0 },
			{ name: 'Berries', match: 0 },
			{ name: 'Jerky', basename: 'Meat..', match: 50 },
		];
		assert.deepEqual(
			sortIngredients(items, 'auto', defaults).map(item => item.name),
			['Berries', 'Meat', 'Cooked Meat', 'Jerky'],
		);
	});

	it('uses tag quantities, but adapts stat searches to the active character', () => {
		const items = [
			{ name: 'Vegetable', preparationType: 'raw', hunger: 20, match: 20 },
			{ name: 'Meat', preparationType: 'raw', hunger: 10, match: 10 },
		];
		assert.deepEqual(
			sortIngredients(items, 'auto', { ...defaults, search: 'tag:meat' }),
			items,
		);
		assert.equal(
			sortIngredients(items, 'auto', {
				...defaults,
				search: 'tag:hunger',
				modifyItem: item => (item.name === 'Vegetable' ? { hunger: 0 } : {}),
			})[0].name,
			'Meat',
		);
	});
});
