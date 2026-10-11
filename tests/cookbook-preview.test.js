import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { previewCookbookDish } from '../html/cookbook-preview.js';
import { recipes } from '../html/recipes.js';

const selection = {
	version: 'together',
	dlc: { giants: false, shipwrecked: false },
	character: null,
};

describe('saved cookbook previews', () => {
	it('resolves saved ingredient variants and predicts recipes regardless of the dish name', () => {
		const dish = {
			name: 'Camp dinner',
			ingredients: ['fig', 'asparagus', 'asparagus', 'asparagus'],
			selection,
		};
		const before = JSON.stringify(dish);
		const preview = previewCookbookDish(dish);
		assert.deepEqual(
			preview.ingredients.map(item => item.key),
			['fig', 'asparagus@together', 'asparagus@together', 'asparagus@together'],
		);
		assert.deepEqual(
			preview.recipes.map(recipe => recipe.name),
			['Figatoni'],
		);
		assert.equal(JSON.stringify(dish), before);
	});

	it('returns every equally likely highest-priority result', () => {
		const preview = previewCookbookDish({
			ingredients: ['butterflywings', 'bird_egg', 'carrot', 'honey'],
			selection,
		});
		assert.deepEqual(
			preview.recipes.map(recipe => recipe.name),
			['Butter Muffin', 'Breakfast Skillet'],
		);
	});

	it('uses the saved game rather than recipes from another game', () => {
		const ingredients = ['butterflywings', 'bird_egg', 'carrot', 'honey'];
		const preview = previewCookbookDish({
			ingredients,
			selection: { ...selection, version: 'dontstarve' },
		});
		assert.deepEqual(
			preview.recipes.map(recipe => recipe.name),
			['Butter Muffin'],
		);
		assert.ok(preview.ingredients.every(item => !item.key.endsWith('@together')));
	});

	it('includes character recipes only for the saved character', () => {
		const dish = { ingredients: ['butter', 'honey', 'dragonfruit', 'dragonfruit'], selection };
		assert.deepEqual(
			previewCookbookDish(dish).recipes.map(recipe => recipe.name),
			['Dragonpie'],
		);
		assert.deepEqual(
			previewCookbookDish({
				...dish,
				selection: { ...selection, character: 'warly' },
			}).recipes.map(recipe => recipe.name),
			['Fresh Fruit Crepes'],
		);
	});

	it('re-evaluates recipes after data changes instead of caching a stored outcome', () => {
		const dish = { ingredients: ['fig', 'asparagus', 'asparagus', 'asparagus'], selection };
		const goop = recipes.byName('wet goop');
		const priority = goop.priority;
		try {
			assert.equal(previewCookbookDish(dish).recipes[0].name, 'Figatoni');
			goop.priority = 1000;
			assert.equal(previewCookbookDish(dish).recipes[0].name, 'Wet Goop');
		} finally {
			goop.priority = priority;
		}
	});

	it('does not predict a meal with incomplete or unavailable ingredients', () => {
		for (const ingredients of [
			['meat', 'meat', 'carrot'],
			['missing', 'meat', 'carrot', 'twigs'],
		]) {
			assert.deepEqual(previewCookbookDish({ ingredients, selection }).recipes, []);
		}
	});
});
