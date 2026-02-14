/**
 * Core recipe matching logic extracted for testing.
 *
 * accumulateIngredients mirrors setIngredientValues in foodguide.js
 * but accepts statMultipliers as a parameter instead of closing over it.
 */

import { perish_preserved } from './constants.js';

const isStat = { hunger: true, health: true, sanity: true };
const isBestStat = { bestHunger: true, bestHealth: true, bestSanity: true };

/**
 * Accumulates ingredient properties into names and tags objects.
 * @param {Array} items - Array of ingredient objects (may contain nulls)
 * @param {Object} names - Name count accumulator (mutated)
 * @param {Object} tags - Tag value accumulator (mutated)
 * @param {Object} statMultipliers - Multipliers keyed by preparation type
 */
export const accumulateIngredients = (items, names, tags, statMultipliers) => {
	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if (item !== null) {
			names[item.id] = 1 + (names[item.id] || 0);

			for (const k in item) {
				if (Object.prototype.hasOwnProperty.call(item, k)) {
					if (k !== 'perish' && !isNaN(item[k])) {
						let val = item[k];

						if (isStat[k]) {
							val *= statMultipliers[item.preparationType];
						} else if (isBestStat[k]) {
							val *= statMultipliers[item[`${k}Type`]];
						}

						tags[k] = val + (tags[k] || 0);
					} else if (k === 'perish') {
						tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
					}
				}
			}
		}
	}
};

/**
 * Tests if accumulated ingredients satisfy a recipe.
 * Uses the recipe's test function, which is the authoritative game logic.
 * @param {Object} recipe - Recipe with a test(cooker, names, tags) function
 * @param {Object} names - Accumulated ingredient name counts
 * @param {Object} tags - Accumulated ingredient tag values
 * @returns {boolean}
 */
export const matchesRecipe = (recipe, names, tags) => {
	return !!recipe.test(null, names, tags);
};

/**
 * Finds all matching recipes for the given ingredients, sorted by priority.
 * @param {Array} recipeList - Array of recipe objects with test functions
 * @param {Array} items - Array of ingredient objects
 * @param {Object} statMultipliers - Multipliers keyed by preparation type
 * @returns {Array} Matching recipes, highest priority first
 */
export const findMatchingRecipes = (recipeList, items, statMultipliers) => {
	const names = {};
	const tags = {};

	accumulateIngredients(items, names, tags, statMultipliers);

	const matches = [];
	for (const recipe of recipeList) {
		if (matchesRecipe(recipe, names, tags)) {
			matches.push(recipe);
		}
	}

	return matches.sort((a, b) => (b.priority || 0) - (a.priority || 0));
};
