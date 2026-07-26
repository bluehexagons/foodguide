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
