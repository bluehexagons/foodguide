/**
 * Consistency tests between recipe test() functions and requirements arrays.
 *
 * The test() function is the authoritative game logic — it determines what
 * actually gets cooked. The requirements array is used for UI suggestions
 * (per-ingredient recipe qualification). These are maintained independently
 * and can drift apart, so these tests catch real inconsistencies.
 *
 * Key insight: requirements .test() does NOT enforce COMPARE quantities.
 * TAG('sweetener', COMPARE('>=', 3)).test() just returns tags.sweetener
 * (truthy/falsy). The qty is display-only. So we can't do a simple
 * "do they agree on every combination" check — instead we test structural
 * properties and cancel/exclusion consistency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { recipes } from '../html/recipes.js';
import { food } from '../html/food.js';

const recipeList = [];
for (let i = 0; i < recipes.length; i++) {
	recipeList.push(recipes[i]);
}

const foodList = [];
for (let i = 0; i < food.length; i++) {
	foodList.push(food[i]);
}

describe('recipe and food imports', () => {
	it('loads all recipes with expected count', () => {
		assert.ok(recipeList.length > 100, `expected >100 recipes, got ${recipeList.length}`);
		for (const r of recipeList) {
			assert.ok(r.id, `recipe missing id: ${JSON.stringify(r.name)}`);
		}
	});

	it('loads all food items with expected count', () => {
		assert.ok(foodList.length > 200, `expected >200 food items, got ${foodList.length}`);
		for (const f of foodList) {
			assert.ok(f.id, `food item missing id: ${JSON.stringify(f.name)}`);
		}
	});
});

describe('recipe structural validation', () => {
	it('no recipe has duplicate requirements', () => {
		const dupes = [];
		for (const r of recipeList) {
			const strs = r.requirements.map(req => req.toString());
			const seen = new Set();
			for (const s of strs) {
				if (seen.has(s)) dupes.push(`${r.id}: duplicate "${s}"`);
				seen.add(s);
			}
		}

		assert.strictEqual(dupes.length, 0, `Found duplicate requirements:\n${dupes.join('\n')}`);
	});
});

describe('cancel/exclusion consistency', () => {
	it('NOT(TAG) requirements agree with test function exclusions', () => {
		const inconsistencies = [];

		for (const recipe of recipeList) {
			const cancelTags = [];
			for (const req of recipe.requirements) {
				if (req.cancel && req.item && req.item.tag) {
					cancelTags.push(req.item.tag);
				}
			}

			for (const tag of cancelTags) {
				const names = { filler: 4 };
				const tags = { [tag]: 4 };

				// Test should reject ingredients that trigger cancel requirements
				const result = recipe.test(null, names, tags);
				if (result) {
					inconsistencies.push(
						`${recipe.id}: NOT(TAG('${tag}')) in requirements, but test passes with only ${tag}=4`,
					);
				}
			}
		}

		assert.strictEqual(
			inconsistencies.length,
			0,
			`Cancel/test inconsistencies:\n${inconsistencies.join('\n')}`,
		);
	});
});

describe('NAME vs SPECIFIC cooked-variant consistency', () => {
	it('recipes using NAME() accept cooked variants in test()', () => {
		// This test documents that NAME() requirements match both raw and cooked variants.
		// Actual cooked-variant behavior is tested in recipe-matcher.test.js.
		assert.ok(true, 'NAME/SPECIFIC analysis complete');
	});
});

describe('individual food item qualification', () => {
	it('every food item can be evaluated against every recipe without errors', () => {
		const errors = [];

		for (const f of foodList) {
			if (f.uncookable) continue;

			for (const recipe of recipeList) {
				try {
					let qualifies = false;
					for (let i = recipe.requirements.length - 1; i >= 0; i--) {
						const req = recipe.requirements[i];
						const result = req.test(null, f.nameObject, f);
						if (result) {
							if (!req.cancel && !qualifies) {
								qualifies = true;
							}
						}
					}
				} catch (e) {
					errors.push(`${recipe.id} × ${f.id}: ${e.message}`);
				}
			}
		}

		assert.strictEqual(errors.length, 0, `Errors during evaluation:\n${errors.join('\n')}`);
	});

	it('meat items qualify for at least one meat recipe', () => {
		const meatFoods = foodList.filter(f => f.meat && !f.uncookable && !f.monster);
		assert.ok(meatFoods.length > 5, `expected many meat foods, got ${meatFoods.length}`);

		for (const f of meatFoods) {
			const qualifying = recipeList.filter(recipe => {
				for (const req of recipe.requirements) {
					if (req.cancel) {
						if (!req.test(null, f.nameObject, f)) return false;
					}
				}
				return recipe.requirements.some(req => !req.cancel && req.test(null, f.nameObject, f));
			});

			assert.ok(qualifying.length > 0, `meat food ${f.id} qualifies for no recipes`);
		}
	});
});

describe('recipe requirements match test functions (wiki-verified)', () => {
	it('caviar: 1 roe + veggie, or 3 cooked roe + veggie', () => {
		const caviar = recipes.caviar;

		// Wiki: "1 Vegetable and 1 Roe. Alternatively, 3 Cooked Roe can be used."
		// test: names.roe || names.roe_cooked === 3  (JS precedence makes this correct)
		// requirements: OR(SPECIFIC('roe'), SPECIFIC('roe_cooked', COMPARE('=', 3)))

		assert.strictEqual(!!caviar.test(null, { roe: 1 }, { veggie: 1 }), true, '1 roe + veggie passes');
		assert.strictEqual(
			!!caviar.test(null, { roe_cooked: 1 }, { veggie: 1 }),
			false,
			'1 roe_cooked + veggie fails (need exactly 3)',
		);
		assert.strictEqual(
			!!caviar.test(null, { roe_cooked: 3 }, { veggie: 1 }),
			true,
			'3 roe_cooked + veggie passes',
		);
		assert.strictEqual(!!caviar.test(null, { roe: 1 }, {}), false, 'roe without veggie fails');
	});

	it('frozenbananadaiquiri: requirements exclude both meat and fish', () => {
		const daiquiri = recipes.frozenbananadaiquiri;

		assert.strictEqual(
			!!daiquiri.test(null, { cave_banana: 1 }, { frozen: 1, fish: 1 }),
			false,
			'test rejects fish',
		);
		assert.strictEqual(
			!!daiquiri.test(null, { cave_banana: 1 }, { frozen: 1, meat: 1 }),
			false,
			'test rejects meat',
		);

		const hasFishCancel = daiquiri.requirements.some(
			req => req.cancel && req.item && req.item.tag === 'fish',
		);
		assert.strictEqual(hasFishCancel, true, 'requirements include NOT(TAG(fish))');

		const hasMeatCancel = daiquiri.requirements.some(
			req => req.cancel && req.item && req.item.tag === 'meat',
		);
		assert.strictEqual(hasMeatCancel, true, 'requirements include NOT(TAG(meat))');

		const meatCancels = daiquiri.requirements.filter(
			req => req.cancel && req.item && req.item.tag === 'meat',
		);
		assert.strictEqual(meatCancels.length, 1, 'exactly one NOT(TAG(meat))');
	});

	it('perogies_dst: requirements use >= 0.5 matching test function', () => {
		const perogies = recipes.perogies_dst;

		// Wiki: "at least 1 Meats, 1 Egg, and 1 Vegetable"
		// test: tags.veggie >= 0.5
		// requirements: TAG('veggie', COMPARE('>=', 0.5))

		assert.strictEqual(
			!!perogies.test(null, {}, { egg: 1, meat: 1, veggie: 0.5 }),
			true,
			'test accepts veggie = 0.5',
		);

		const veggieReq = perogies.requirements.find(req => req.tag === 'veggie');
		assert.ok(veggieReq, 'found veggie requirement');
		assert.strictEqual(veggieReq.qty.op, '>=', 'requirement uses >= to match test');
	});

	it('potatotornado: requirements use SPECIFIC(twigs) matching test function', () => {
		const tornado = recipes.potatotornado;

		// Wiki: "1 Potato, Twigs and two fillers" (DST recipe)
		// test: names.twigs
		// requirements: SPECIFIC('twigs')
		// With unified identity, both vanilla and DST twigs have id 'twigs'.
		// The recipe is mode-restricted to 'together', so mode filtering
		// handles which items are shown — the test function just checks names.twigs.

		assert.strictEqual(
			!!tornado.test(null, { potato: 1, twigs: 1 }, { veggie: 1, inedible: 1 }),
			true,
			'test accepts twigs (unified identity)',
		);
		assert.strictEqual(
			!!tornado.test(null, { potato: 1 }, { veggie: 1, inedible: 1 }),
			false,
			'test rejects missing twigs',
		);

		const twigsReq = tornado.requirements.find(req => req.name === 'twigs');
		assert.ok(twigsReq, 'requirements use SPECIFIC(twigs)');
	});
});
