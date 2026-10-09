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

	it('finds mushroom caps and their cooked variants by ingredient identity', () => {
		const { matchingNames } = createTogetherCalculator();
		const matches = matchingNames(food, '  MUSHROOM  ');
		for (const id of [
			'red_mushroom',
			'green_mushroom',
			'blue_mushroom',
			'red_mushroom_cooked',
			'green_mushroom_cooked',
			'blue_mushroom_cooked',
		]) {
			assert.ok(
				matches.some(item => item.id === id),
				`missing ${id}`,
			);
		}
		assert.deepStrictEqual(
			matchingNames(food, 'red_mushroom').map(item => item.id),
			matchingNames(food, 'red mushroom').map(item => item.id),
		);
		assert.ok(matchingNames(food, '*red cap').every(item => item.name === 'Red Cap'));
		assert.strictEqual(matchingNames(food, 'meat')[0].name, 'Meat');
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

	it('stays exhausted without emitting invalid combinations', () => {
		const combinations = [];
		const next = combinationGenerator(1, combination => combinations.push([...combination]));
		assert.strictEqual(next(1), false);
		assert.strictEqual(next(10), false);
		assert.deepStrictEqual(combinations, [[0, 0, 0, 0]]);
	});
});
