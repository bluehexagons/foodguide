import type { AnalysisRow } from './models.js';

export type FilterState = 'normal' | 'required' | 'excluded';
interface InitialFilters {
	excludedIngredients?: Iterable<string>;
	excludedRecipes?: Iterable<string>;
}

/** Analyzer filter state is independent of the icons that display it. */
export function createAnalysisFilters({
	excludedIngredients = [],
	excludedRecipes = [],
}: InitialFilters = {}) {
	const requiredIngredients = new Set<string>();
	const blockedIngredients = new Set(excludedIngredients);
	const blockedRecipes = new Set(excludedRecipes);
	let requiredRecipe: string | null = null;

	const ingredientState = (id: string): FilterState =>
		requiredIngredients.has(id)
			? 'required'
			: blockedIngredients.has(id)
				? 'excluded'
				: 'normal';
	const recipeState = (id: string): FilterState =>
		requiredRecipe === id ? 'required' : blockedRecipes.has(id) ? 'excluded' : 'normal';

	return {
		ingredientState,
		recipeState,
		cycleIngredient(id: string, reverse = false) {
			const cycle: FilterState[] = reverse
				? ['normal', 'excluded', 'required']
				: ['normal', 'required', 'excluded'];
			const next = cycle[(cycle.indexOf(ingredientState(id)) + 1) % cycle.length];
			requiredIngredients.delete(id);
			blockedIngredients.delete(id);
			if (next === 'required') {
				requiredIngredients.add(id);
			}
			if (next === 'excluded') {
				blockedIngredients.add(id);
			}
		},
		cycleRecipe(id: string) {
			if (blockedRecipes.has(id)) {
				blockedRecipes.delete(id);
				requiredRecipe = null;
			} else if (requiredRecipe === id) {
				requiredRecipe = null;
				blockedRecipes.add(id);
			} else {
				blockedRecipes.clear();
				requiredRecipe = id;
			}
		},
		toggleRecipeExclusion(id: string) {
			requiredRecipe = null;
			blockedRecipes.has(id) ? blockedRecipes.delete(id) : blockedRecipes.add(id);
		},
		matches({ recipe, ingredients }: Pick<AnalysisRow, 'recipe' | 'ingredients'>) {
			return (
				(!requiredRecipe || recipe.id === requiredRecipe) &&
				!blockedRecipes.has(recipe.id) &&
				!ingredients.some(item => blockedIngredients.has(item.key)) &&
				[...requiredIngredients].every(id => ingredients.some(item => item.key === id))
			);
		},
	};
}
