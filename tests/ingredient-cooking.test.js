import assert from 'node:assert/strict';
import { test } from 'node:test';
import { food } from '../html/food.js';
import { recipes } from '../html/recipes.js';
import { AND, OR, NOT, NAME, SPECIFIC, TAG } from '../html/functions.js';
import { TOGETHER, WARLY, modes } from '../html/constants.js';
import {
	filterCookingIngredients,
	cookingIngredientReplacements,
	uncommonCookingIngredients,
} from '../html/ingredient-cooking.js';

const ingredients = food.filter(() => true);
const context = {
	ingredients,
	recipes: recipes.filter(() => true),
	modeMask: TOGETHER,
	charMask: 0,
};
const filtered = (preference, overrides = {}) =>
	filterCookingIngredients(ingredients, preference, { ...context, ...overrides });
const ids = items => items.map(item => item.id);

test('All and unknown cooking preferences preserve the input unchanged', () => {
	const items = [food.meat, food.meat_cooked, food.honeycomb, food.goatmilk];
	for (const preference of ['all', 'unknown', 'constructor']) {
		assert.equal(filterCookingIngredients(items, preference, context), items);
	}
});

test('cooking views keep everyday staples regardless of analyzer exclusion hints', () => {
	for (const preference of ['practical', 'everyday']) {
		const result = ids(filtered(preference));
		for (const id of [
			'bird_egg',
			'honey',
			'ice',
			'red_mushroom',
			'green_mushroom',
			'plantmeat',
		]) {
			assert.ok(result.includes(id), `${preference}: ${id}`);
		}
		for (const id of [
			'meat_cooked',
			'meat_dried',
			'honeycomb',
			'batwing',
			'moonbutterflywings',
		]) {
			assert.ok(!result.includes(id), `${preference}: ${id}`);
		}
	}
});

test('Practical keeps recipe specialties; Everyday omits them and both hide generic rare inputs', () => {
	const practical = ids(filtered('practical'));
	const everyday = ids(filtered('everyday'));
	for (const id of ['butter', 'mandrake', 'royal_jelly', 'tallbirdegg', 'mole', 'refined_dust']) {
		assert.ok(practical.includes(id), id);
		assert.ok(!everyday.includes(id), id);
	}
	for (const id of ['goatmilk', 'milkywhites', 'wormlight_lesser']) {
		assert.ok(!practical.includes(id), id);
		assert.ok(!everyday.includes(id), id);
	}
});

test('specialties follow applicable game and character recipes on every call', () => {
	const specialties = ['lightninggoathorn', 'nightmarefuel', 'boneshard', 'wormlight_lesser'];
	assert.ok(specialties.every(id => !ids(filtered('practical')).includes(id)));
	assert.ok(
		specialties.every(id => ids(filtered('practical', { charMask: WARLY })).includes(id)),
	);
	assert.ok(specialties.every(id => !ids(filtered('practical')).includes(id)));
	assert.ok(!ids(filtered('everyday', { charMask: WARLY })).includes('lightninggoathorn'));
	const vanilla = ids(filtered('practical', { modeMask: modes.vanilla.bit }));
	assert.ok(!vanilla.includes('tallbirdegg'), 'The DST Tall Scotch Eggs recipe is unavailable');
	assert.ok(vanilla.includes('butter'), 'Waffles is still available');
	assert.ok(!vanilla.includes('royal_jelly'));
});

test('prepared recipe inputs and butchering results remain available without duplicate alternatives', () => {
	for (const preference of ['practical', 'everyday']) {
		const together = ids(filtered(preference));
		assert.ok(together.includes('acorn_cooked'));
		assert.ok(!together.includes('acorn'));
		assert.ok(together.includes('fishmeat_small'), 'Raw Fish Morsel represents live fish');
		assert.ok(!together.includes('fishmeat_small_cooked'));
		assert.ok(!together.includes('pondfish'));
		assert.ok(!together.includes('eel_cooked'));
		assert.ok(
			together.includes('oceanfish_small_5_inv'),
			'Popperfish has a distinct corn role',
		);
		assert.ok(
			together.includes('oceanfish_medium_8_inv'),
			'Ice Bream has a distinct frozen tag',
		);
		const shipwrecked = ids(filtered(preference, { modeMask: modes.shipwrecked.bit }));
		assert.ok(shipwrecked.includes('coffeebeans_cooked'));
		assert.ok(!shipwrecked.includes('coffeebeans'));
		assert.ok(shipwrecked.includes('roe'));
		assert.ok(!shipwrecked.includes('roe_cooked'), 'Caviar accepts either form');
	}
});

test('negative and generic tag requirements do not make rare ingredients specialties', () => {
	const recipe = requirements => ({
		modeMask: TOGETHER,
		charMask: 0,
		requirements,
	});
	for (const requirements of [
		[NOT(NAME('goatmilk'))],
		[TAG('dairy')],
		[NOT(NOT(NAME('goatmilk')))],
	]) {
		assert.ok(
			!ids(filtered('practical', { recipes: [recipe(requirements)] })).includes('goatmilk'),
		);
	}
	const mixed = [OR(NOT(NAME('goatmilk')), AND(SPECIFIC('butter'), TAG('dairy')))];
	const result = ids(filtered('practical', { recipes: [recipe(mixed)] }));
	assert.ok(
		result.includes('butter'),
		'An OR composite can inherit cancel from its other branch',
	);
	assert.ok(!result.includes('goatmilk'));
	for (const excluded of [{ trash: true }, { foodtype: 'roughage' }]) {
		assert.ok(
			!ids(
				filtered('practical', {
					recipes: [{ ...recipe([NAME('goatmilk')]), ...excluded }],
				}),
			).includes('goatmilk'),
		);
	}
});

test('named alternatives share a role while separate required prepared forms are retained', () => {
	const makeRecipe = requirements => ({ modeMask: TOGETHER, charMask: 0, requirements });
	const items = [food['meat@together'], food['meat_cooked@together']];
	for (const requirements of [[NAME('meat')], [OR(SPECIFIC('meat'), SPECIFIC('meat_cooked'))]]) {
		assert.deepEqual(
			ids(
				filterCookingIngredients(items, 'practical', {
					...context,
					recipes: [makeRecipe(requirements)],
				}),
			),
			['meat'],
		);
	}
	assert.deepEqual(
		ids(
			filterCookingIngredients(items, 'practical', {
				...context,
				recipes: [makeRecipe([AND(SPECIFIC('meat'), SPECIFIC('meat_cooked'))])],
			}),
		),
		['meat', 'meat_cooked'],
	);
});

test('curated IDs resolve and substitutes remain visible when their representative is unavailable', () => {
	for (const id of [
		...Object.keys(cookingIngredientReplacements),
		...Object.values(cookingIngredientReplacements),
		...uncommonCookingIngredients,
	]) {
		assert.ok(
			ingredients.some(item => item.id === id),
			id,
		);
	}
	const items = [food['honeycomb@together']];
	assert.deepEqual(
		filterCookingIngredients(items, 'practical', { ...context, ingredients: items }),
		items,
	);
	assert.deepEqual(
		filterCookingIngredients(items, 'practical', {
			...context,
			ingredients: [...items, food.honey],
		}),
		items,
		'A representative from another game is unavailable',
	);
	const original = ingredients.slice();
	const result = filtered('practical');
	assert.deepEqual(ingredients, original);
	assert.deepEqual(
		result,
		original.filter(item => result.includes(item)),
		'Filtering preserves order and identity',
	);
	assert.ok(result.every(item => !item.uncookable));
});
