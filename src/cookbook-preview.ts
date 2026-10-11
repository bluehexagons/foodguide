import { characters, defaultStatMultipliers, dlcOptions, gameVersions } from './constants.js';
import { food } from './food.js';
import { createFoodSelectionResolver } from './food-selection.js';
import {
	calculateCharMask,
	calculateModeMask,
	getActiveMultipliers,
	getCharacterFoodModifiers,
} from './mode-utils.js';
import type { Food, Recipe } from './models.js';
import type { CookbookDish } from './personal-data.js';
import { createRecipeCalculator } from './recipe-calculator.js';

export interface CookbookPreview {
	ingredients: Food[];
	recipes: Recipe[];
}

const resolveIngredient = createFoodSelectionResolver(food);

/** Recalculate saved dishes without changing the active Simulator or storing stale recipes. */
export function previewCookbookDish(
	dish: Pick<CookbookDish, 'ingredients' | 'selection'>,
): CookbookPreview {
	const selection = dish.selection;
	const mode = calculateModeMask(
		selection.version,
		selection.dlc,
		selection.character,
		gameVersions,
		dlcOptions,
		characters,
	);
	const character = calculateCharMask(
		selection.character,
		selection.version,
		selection.dlc,
		characters,
	);
	const ingredients = dish.ingredients
		.map(id => resolveIngredient(id, mode, character))
		.filter((item): item is Food => !!item && !item.uncookable);
	if (ingredients.length !== 4) {
		return { ingredients, recipes: [] };
	}
	const calculator = createRecipeCalculator({
		getModeMask: () => mode,
		getCharMask: () => character,
		getStatMultipliers: () =>
			getActiveMultipliers(
				selection.version,
				selection.dlc,
				selection.character,
				characters,
				defaultStatMultipliers,
			),
		getItemModifiers: () =>
			getCharacterFoodModifiers(selection.character, characters).modifyItem,
	});
	const matches = calculator
		.getRecipes(ingredients)
		.filter((row): row is Recipe => 'requirements' in row);
	return {
		ingredients,
		recipes: matches.filter(recipe => recipe.priority === matches[0]?.priority),
	};
}
