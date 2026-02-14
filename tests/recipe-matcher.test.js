/**
 * Tests for recipe matching logic.
 *
 * Tests accumulateIngredients (shared between foodguide.js and tests) and
 * exercises the real recipe test functions from recipes.js with controlled
 * ingredient inputs.
 *
 * For tests that validate requirements/test consistency across all recipes
 * and food items, see recipe-consistency.test.js.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { accumulateIngredients } from '../html/utils.js';
import { recipes } from '../html/recipes.js';
import { defaultStatMultipliers } from '../html/constants.js';

// Shorthand: build names/tags from an ingredient list
const accumulate = items => {
	const names = {};
	const tags = {};
	accumulateIngredients(items, names, tags, defaultStatMultipliers);
	return { names, tags };
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
		assert.strictEqual(!!recipes.meatballs.test(null, n1, t1), true);

		// Morsel + twigs = invalid (inedible tag present)
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'morsel', meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(!!recipes.meatballs.test(null, n2, t2), false);
	});

	it('Fishsticks: fish + exactly 1 twig', () => {
		// Fish + 1 twig = valid
		const { names: n1, tags: t1 } = accumulate([
			{ id: 'fish', fish: 1, meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(!!recipes.fishsticks.test(null, n1, t1), true);

		// Fish + 2 twigs = invalid (inedible > 1)
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'fish', fish: 1, meat: 0.5 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'twigs', inedible: 1 },
			{ id: 'ice' },
		]);
		assert.strictEqual(!!recipes.fishsticks.test(null, n2, t2), false);
	});

	it('Honey Ham vs Honey Nuggets: meat threshold at 1.5', () => {
		const honey = { id: 'honey', sweetener: 1 };
		const bigMeat = { id: 'meat', meat: 1 };
		const morsel = { id: 'morsel', meat: 0.5 };

		// honey + 2 big meat (2.0 meat > 1.5) = Honey Ham
		const { names: n1, tags: t1 } = accumulate([honey, bigMeat, bigMeat, { id: 'ice' }]);
		assert.strictEqual(!!recipes.honeyham.test(null, n1, t1), true);
		assert.strictEqual(!!recipes.honeynuggets.test(null, n1, t1), false);

		// honey + 1 big meat + 1 morsel (1.5 meat, not > 1.5) = Honey Nuggets
		const { names: n2, tags: t2 } = accumulate([honey, bigMeat, morsel, { id: 'ice' }]);
		assert.strictEqual(!!recipes.honeyham.test(null, n2, t2), false);
		assert.strictEqual(!!recipes.honeynuggets.test(null, n2, t2), true);
	});

	it('Kabobs: meat + twig, monster <= 1 allowed', () => {
		const twig = { id: 'twigs', inedible: 1 };
		const bigMeat = { id: 'meat', meat: 1 };
		const monsterMeat = { id: 'monster_meat', meat: 1, monster: 1 };

		// Meat + twig + no monster = valid
		const { names: n1, tags: t1 } = accumulate([bigMeat, twig, { id: 'ice' }, { id: 'ice' }]);
		assert.strictEqual(!!recipes.kabobs.test(null, n1, t1), true);

		// Meat + twig + 1 monster = valid (monster <= 1)
		const { names: n2, tags: t2 } = accumulate([bigMeat, twig, monsterMeat, { id: 'ice' }]);
		assert.strictEqual(!!recipes.kabobs.test(null, n2, t2), true);

		// Twig + 2 monster = invalid (monster > 1)
		const { names: n3, tags: t3 } = accumulate([monsterMeat, twig, monsterMeat, { id: 'ice' }]);
		assert.strictEqual(!!recipes.kabobs.test(null, n3, t3), false);
	});

	it('Stuffed Eggplant: cooked variant counts', () => {
		// Cooked eggplant + veggie > 1 = valid
		const { names: n1, tags: t1 } = accumulate([
			{ id: 'eggplant_cooked', veggie: 1 },
			{ id: 'carrot', veggie: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(!!recipes.stuffedeggplant.test(null, n1, t1), true);

		// Raw eggplant alone (veggie = 1, not > 1) = invalid
		const { names: n2, tags: t2 } = accumulate([
			{ id: 'eggplant', veggie: 1 },
			{ id: 'ice' },
			{ id: 'ice' },
			{ id: 'ice' },
		]);
		assert.strictEqual(!!recipes.stuffedeggplant.test(null, n2, t2), false);
	});

	it('Bacon and Eggs: egg > 1 AND meat > 1, no veggie', () => {
		const egg = { id: 'bird_egg', egg: 1 };
		const bigMeat = { id: 'meat', meat: 1 };

		// 2 eggs + 2 meat = valid
		const { names: n1, tags: t1 } = accumulate([egg, egg, bigMeat, bigMeat]);
		assert.strictEqual(!!recipes.baconeggs.test(null, n1, t1), true);

		// 1 egg + 2 meat = invalid (egg not > 1)
		const { names: n2, tags: t2 } = accumulate([egg, bigMeat, bigMeat, { id: 'ice' }]);
		assert.strictEqual(!!recipes.baconeggs.test(null, n2, t2), false);

		// 2 eggs + 2 meat + veggie = invalid
		const { names: n3, tags: t3 } = accumulate([
			egg,
			egg,
			bigMeat,
			{ id: 'carrot', meat: 1, veggie: 1 },
		]);
		assert.strictEqual(!!recipes.baconeggs.test(null, n3, t3), false);
	});
});

describe('recipe matching with priority', () => {
	it('higher priority recipe wins when multiple match', () => {
		// Honey + 2 big meat + filler: matches Honey Ham (pri 2) and Meatballs (pri -1)
		const items = [
			{ id: 'honey', sweetener: 1 },
			{ id: 'meat', meat: 1 },
			{ id: 'meat', meat: 1 },
			{ id: 'ice' },
		];
		const { names, tags } = accumulate(items);

		const candidates = [recipes.honeyham, recipes.honeynuggets, recipes.meatballs];
		const matches = candidates
			.filter(r => !!r.test(null, names, tags))
			.sort((a, b) => b.priority - a.priority);

		assert.ok(matches.length >= 2, `expected >=2 matches, got ${matches.length}`);
		assert.strictEqual(matches[0].name, 'Honey Ham');
		assert.ok(matches[0].priority >= matches[1].priority);
	});

	it('no recipes match when ingredients have no relevant tags', () => {
		const { names, tags } = accumulate([{ id: 'ice' }, { id: 'ice' }, { id: 'ice' }, { id: 'ice' }]);

		const candidates = [recipes.meatballs, recipes.fishsticks, recipes.honeyham];
		const matches = candidates.filter(r => !!r.test(null, names, tags));

		assert.strictEqual(matches.length, 0);
	});
});
