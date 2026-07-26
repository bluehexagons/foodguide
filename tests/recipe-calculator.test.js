import assert from 'node:assert';
import { describe, it } from 'node:test';

import { defaultStatMultipliers, TOGETHER } from '../html/constants.js';
import { food } from '../html/food.js';
import { combinationGenerator, createRecipeCalculator } from '../html/recipe-calculator.js';

const createTogetherCalculator = () =>
	createRecipeCalculator({
		getModeMask: () => TOGETHER,
		getCharMask: () => 0,
		getStatMultipliers: () => defaultStatMultipliers,
	});

describe('recipe calculator', () => {
	it('returns matching recipes in priority order with summary rows', () => {
		const { getRecipes } = createTogetherCalculator();
		const matches = getRecipes([food.honey, food.meat, food.meat, food.ice]);

		assert.deepStrictEqual(
			matches.slice(0, 5).map(item => item.name),
			['Sum:Total', 'Sum:Potential', 'Honey Ham', 'Meatballs', 'Wet Goop'],
		);
	});

	it('supports ingredient and tag search syntax', () => {
		const { matchingNames } = createTogetherCalculator();

		assert.ok(matchingNames(food, 'tag:meat').every(item => item.meat));
		assert.ok(
			matchingNames(food, 'recipe:butter muffin').some(
				item => item.key === 'butterflywings@together',
			),
		);
	});

	it('treats regular-expression punctuation as literal search text', () => {
		const { matchingNames } = createTogetherCalculator();

		assert.doesNotThrow(() => matchingNames(food, '['));
		assert.deepStrictEqual(matchingNames(food, '['), []);
	});
});

describe('combination generator', () => {
	const collect = length => {
		const combinations = [];
		const next = combinationGenerator(length, combination => {
			combinations.push([...combination]);
		});

		while (next(2)) {
			// Consume the iterator in deliberately small batches.
		}
		return combinations;
	};

	it('produces each unordered four-slot combination once', () => {
		assert.deepStrictEqual(collect(2), [
			[0, 0, 0, 0],
			[1, 0, 0, 0],
			[1, 1, 0, 0],
			[1, 1, 1, 0],
			[1, 1, 1, 1],
		]);
	});

	it('finishes immediately for an empty collection', () => {
		assert.deepStrictEqual(collect(0), []);
	});
});
