import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnalysisFilters } from '../html/analysis-filters.js';

const row = (recipeId, ...keys) => ({
	recipe: { id: recipeId },
	ingredients: keys.map(key => ({ key })),
});

test('ingredient filters cycle in both directions and apply required and excluded states', () => {
	for (const reverse of [false, true]) {
		const filters = createAnalysisFilters();
		assert.equal(filters.ingredientState('meat'), 'normal');
		for (const state of reverse
			? ['excluded', 'required', 'normal']
			: ['required', 'excluded', 'normal']) {
			filters.cycleIngredient('meat', reverse);
			assert.equal(filters.ingredientState('meat'), state);
			assert.equal(
				filters.matches(row('meatballs', 'meat', 'berries')),
				state !== 'excluded',
			);
			assert.equal(filters.matches(row('jam', 'berries')), state !== 'required');
		}
	}
});

test('required ingredients are combined and distinguish game variants', () => {
	const filters = createAnalysisFilters();
	filters.cycleIngredient('meat@together');
	filters.cycleIngredient('berries@together');
	assert.equal(filters.matches(row('meatballs', 'meat@together', 'berries@together')), true);
	assert.equal(filters.matches(row('meatballs', 'meat@together')), false);
	assert.equal(filters.matches(row('meatballs', 'meat', 'berries')), false);
});

test('default exclusions apply immediately and can be cycled independently', () => {
	const filters = createAnalysisFilters({
		excludedIngredients: ['honey', 'ice'],
		excludedRecipes: ['wetgoop', 'monsterlasagna'],
	});
	assert.equal(filters.ingredientState('honey'), 'excluded');
	assert.equal(filters.recipeState('wetgoop'), 'excluded');
	assert.equal(filters.matches(row('meatballs', 'meat')), true);
	assert.equal(filters.matches(row('meatballs', 'meat', 'honey')), false);
	assert.equal(filters.matches(row('wetgoop', 'meat')), false);
	filters.cycleIngredient('honey');
	filters.cycleRecipe('wetgoop');
	assert.equal(filters.matches(row('wetgoop', 'honey')), true);
	assert.equal(filters.matches(row('wetgoop', 'ice')), false);
	assert.equal(filters.matches(row('monsterlasagna', 'meat')), false);
});

test('recipe selection cycles and selecting another recipe clears prior exclusions', () => {
	const filters = createAnalysisFilters();
	for (const state of ['required', 'excluded', 'normal']) {
		filters.cycleRecipe('meatballs');
		assert.equal(filters.recipeState('meatballs'), state);
		assert.equal(filters.matches(row('meatballs')), state !== 'excluded');
		assert.equal(filters.matches(row('jam')), state !== 'required');
	}
	filters.toggleRecipeExclusion('wetgoop');
	filters.cycleRecipe('meatballs');
	assert.equal(filters.recipeState('wetgoop'), 'normal');
	filters.cycleRecipe('jam');
	assert.equal(filters.recipeState('meatballs'), 'normal');
	assert.equal(filters.recipeState('jam'), 'required');
});

test('clearing one recipe exclusion preserves other exclusions and their filter states', () => {
	const filters = createAnalysisFilters();
	filters.toggleRecipeExclusion('meatballs');
	filters.toggleRecipeExclusion('jam');
	filters.cycleRecipe('meatballs');
	assert.equal(filters.recipeState('meatballs'), 'normal');
	assert.equal(filters.recipeState('jam'), 'excluded');
	assert.equal(filters.matches(row('meatballs')), true);
	assert.equal(filters.matches(row('jam')), false);
	filters.toggleRecipeExclusion('jam');
	assert.equal(filters.matches(row('jam')), true);
});

test('right-click recipe exclusion clears any required recipe', () => {
	const filters = createAnalysisFilters();
	filters.cycleRecipe('meatballs');
	filters.toggleRecipeExclusion('jam');
	assert.equal(filters.recipeState('meatballs'), 'normal');
	assert.equal(filters.recipeState('jam'), 'excluded');
	assert.equal(filters.matches(row('meatballs')), true);
	assert.equal(filters.matches(row('wetgoop')), true);
	assert.equal(filters.matches(row('jam')), false);
});

test('reset restores the initial exclusions and clears ingredient and recipe requirements', () => {
	const filters = createAnalysisFilters({
		excludedIngredients: ['honey'],
		excludedRecipes: ['wetgoop'],
	});
	filters.cycleIngredient('honey');
	filters.cycleIngredient('meat');
	filters.cycleIngredient('ice', true);
	filters.cycleRecipe('meatballs');
	filters.reset();
	assert.equal(filters.ingredientState('honey'), 'excluded');
	assert.equal(filters.ingredientState('meat'), 'normal');
	assert.equal(filters.ingredientState('ice'), 'normal');
	assert.equal(filters.recipeState('wetgoop'), 'excluded');
	assert.equal(filters.recipeState('meatballs'), 'normal');
	assert.equal(filters.matches(row('jam', 'berries')), true);
	assert.equal(filters.matches(row('jam', 'honey')), false);
});
