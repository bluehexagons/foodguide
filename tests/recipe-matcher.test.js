/**
 * Tests for recipe matching logic.
 *
 * Tests the extracted recipe-matcher module (accumulateIngredients, matchesRecipe,
 * findMatchingRecipes) using inline recipe test functions that match recipes.js.
 * This verifies the matching logic in isolation with controlled inputs.
 *
 * For tests that import the real recipes.js and food.js data, see
 * recipe-consistency.test.js.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
	accumulateIngredients,
	matchesRecipe,
	findMatchingRecipes,
} from '../html/recipe-matcher.js';
import { defaultStatMultipliers } from '../html/constants.js';

// Shorthand: build names/tags from an ingredient list
const accumulate = items => {
	const names = {};
	const tags = {};
	accumulateIngredients(items, names, tags, defaultStatMultipliers);
	return { names, tags };
};

// Recipe test functions copied from recipes.js — these are the authoritative game logic.
const recipes = {
	butterflymuffin: {
		name: 'Butter Muffin',
		test: (_cooker, names, tags) => names.butterflywings && !tags.meat && tags.veggie,
		priority: 1,
	},
	meatballs: {
		name: 'Meatballs',
		test: (_cooker, _names, tags) => tags.meat && !tags.inedible,
		priority: -1,
	},
	taffy: {
		name: 'Taffy',
		test: (_cooker, _names, tags) => tags.sweetener && tags.sweetener >= 3 && !tags.meat,
		priority: 10,
	},
	fishsticks: {
		name: 'Fishsticks',
		test: (_cooker, names, tags) => tags.fish && names.twigs && tags.inedible && tags.inedible <= 1,
		priority: 10,
	},
	stuffedeggplant: {
		name: 'Stuffed Eggplant',
		test: (_cooker, names, tags) =>
			(names.eggplant || names.eggplant_cooked) && tags.veggie && tags.veggie > 1,
		priority: 1,
	},
	honeyham: {
		name: 'Honey Ham',
		test: (_cooker, names, tags) => names.honey && tags.meat && tags.meat > 1.5 && !tags.inedible,
		priority: 2,
	},
	honeynuggets: {
		name: 'Honey Nuggets',
		test: (_cooker, names, tags) => names.honey && tags.meat && tags.meat <= 1.5 && !tags.inedible,
		priority: 2,
	},
	kabobs: {
		name: 'Kabobs',
		test: (_cooker, names, tags) =>
			tags.meat &&
			names.twigs &&
			(!tags.monster || tags.monster <= 1) &&
			tags.inedible &&
			tags.inedible <= 1,
		priority: 5,
	},
	baconeggs: {
		name: 'Bacon and Eggs',
		test: (_cooker, _names, tags) =>
			tags.egg && tags.egg > 1 && tags.meat && tags.meat > 1 && !tags.veggie,
		priority: 10,
	},
};

describe('accumulateIngredients', () => {
	it('sums fractional tag values across items', () => {
		const { tags } = accumulate([
			{ id: 'fish', meat: 0.5, fish: 1 },
			{ id: 'fish', meat: 0.5, fish: 1 },
			{ id: 'fish', meat: 0.5, fish: 1 },
			{ id: 'ice' },
		]);

		assert.strictEqual(tags.meat, 1.5);
		assert.strictEqual(tags.fish, 3);
	});

	it('counts ingredient names independently', () => {
		const { names } = accumulate([
			{ id: 'meat', meat: 1 },
			{ id: 'meat', meat: 1 },
			{ id: 'honey', sweetener: 1 },
			{ id: 'ice' },
		]);

		assert.strictEqual(names.meat, 2);
		assert.strictEqual(names.honey, 1);
		assert.strictEqual(names.ice, 1);
	});

	it('takes minimum perish time across items', () => {
		const { tags } = accumulate([
			{ id: 'a', perish: 2880 },
			{ id: 'b', perish: 480 },
			{ id: 'c', perish: 576 },
			{ id: 'd' },
		]);

		assert.strictEqual(tags.perish, 480);
	});

	it('skips null slots', () => {
		const { names, tags } = accumulate([{ id: 'meat', meat: 1 }, null, null, null]);

		assert.strictEqual(names.meat, 1);
		assert.strictEqual(tags.meat, 1);
	});
});

describe('recipe test functions', () => {
	it('Meatballs: any meat, no twigs', () => {
		// Morsel (0.5 meat) + 3 filler = valid
		const { names: n1, tags: t1 } = accumulate([
			{ id: 'morsel', meat: 0.5 },
			{ id: 'ice' },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.meatballs, n1, t1), true);

		// Morsel + twigs = invalid (inedible tag present)
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'morsel', meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.meatballs, n2, t2), false);
	});

	it('Fishsticks: fish + exactly 1 twig', () => {
		// Fish + 1 twig = valid
		const { names: n1, tags: t1 } = accumulate([
			{ id: 'fish', fish: 1, meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.fishsticks, n1, t1), true);

		// Fish + 2 twigs = invalid (inedible > 1)
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'fish', fish: 1, meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.fishsticks, n2, t2), false);
	});

	it('Honey Ham vs Honey Nuggets: meat threshold at 1.5', () => {
		const honey = { id: 'honey', sweetener: 1 };
		const bigMeat = { id: 'meat', meat: 1 };
		const morsel = { id: 'morsel', meat: 0.5 };

		// honey + 2 big meat (2.0 meat > 1.5) = Honey Ham
		const { names: n1, tags: t1 } = accumulate([honey, bigMeat, bigMeat, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.honeyham, n1, t1), true);
		assert.strictEqual(matchesRecipe(recipes.honeynuggets, n1, t1), false);

		// honey + 1 big meat + 1 morsel (1.5 meat, not > 1.5) = Honey Nuggets
		const { names: n2, tags: t2 } = accumulate([honey, bigMeat, morsel, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.honeyham, n2, t2), false);
		assert.strictEqual(matchesRecipe(recipes.honeynuggets, n2, t2), true);
	});

	it('Kabobs: meat + twig, monster <= 1 allowed', () => {
		const twig = { id: 'twigs', inedible: 1 };
		const bigMeat = { id: 'meat', meat: 1 };
		const monsterMeat = { id: 'monster_meat', meat: 1, monster: 1 };

		// Meat + twig + no monster = valid
		const { names: n1, tags: t1 } = accumulate([bigMeat, twig, { id: 'ice' }, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.kabobs, n1, t1), true);

		// Meat + twig + 1 monster = valid (monster <= 1)
		const { names: n2, tags: t2 } = accumulate([bigMeat, twig, monsterMeat, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.kabobs, n2, t2), true);

		// Twig + 2 monster = invalid (monster > 1)
		const { names: n3, tags: t3 } = accumulate([monsterMeat, twig, monsterMeat, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.kabobs, n3, t3), false);
	});

	it('Stuffed Eggplant: cooked variant counts', () => {
		// Cooked eggplant + veggie > 1 = valid
		const { names: n1, tags: t1 } = accumulate([
			{ id: 'eggplant_cooked', veggie: 1 },
			{ id: 'carrot', veggie: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.stuffedeggplant, n1, t1), true);

		// Raw eggplant alone (veggie = 1, not > 1) = invalid
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'eggplant', veggie: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(matchesRecipe(recipes.stuffedeggplant, n2, t2), false);
	});

	it('Bacon and Eggs: egg > 1 AND meat > 1, no veggie', () => {
		const egg = { id: 'bird_egg', egg: 1 };
		const bigMeat = { id: 'meat', meat: 1 };

		// 2 eggs + 2 meat = valid
		const { names: n1, tags: t1 } = accumulate([egg, egg, bigMeat, bigMeat]);
		assert.strictEqual(matchesRecipe(recipes.baconeggs, n1, t1), true);

		// 1 egg + 2 meat = invalid (egg not > 1)
		const { names: n2, tags: t2 } = accumulate([egg, bigMeat, bigMeat, { id: 'ice' }]);
		assert.strictEqual(matchesRecipe(recipes.baconeggs, n2, t2), false);

		// 2 eggs + 2 meat + veggie = invalid
		const { names: n3, tags: t3 } = accumulate([
			egg,
			egg,
			bigMeat,
			{ id: 'carrot', meat: 1, veggie: 1 },
		]);
		assert.strictEqual(matchesRecipe(recipes.baconeggs, n3, t3), false);
	});
});

describe('findMatchingRecipes', () => {
	it('returns highest priority match first', () => {
		const allRecipes = Object.values(recipes);
		// Honey + 2 big meat + filler: matches both Honey Ham (pri 2) and Meatballs (pri -1)
		const items = [
			{ id: 'honey', sweetener: 1 },
			{ id: 'meat', meat: 1 },
			{ id: 'meat', meat: 1 },
			{ id: 'ice' },
		];

		const matches = findMatchingRecipes(allRecipes, items, defaultStatMultipliers);

		assert.ok(matches.length >= 2, `expected >=2 matches, got ${matches.length}`);
		assert.strictEqual(matches[0].name, 'Honey Ham');
		assert.ok(matches[0].priority >= matches[1].priority);
	});

	it('excludes recipes that do not match', () => {
		const allRecipes = Object.values(recipes);
		// 4 ice = nothing matches (no meat, no veggie, no sweetener, etc.)
		const items = [{ id: 'ice' }, { id: 'ice' }, { id: 'ice' }, { id: 'ice' }];

		const matches = findMatchingRecipes(allRecipes, items, defaultStatMultipliers);

		assert.strictEqual(matches.length, 0);
	});
});
