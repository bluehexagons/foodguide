import type {
	CalculatorOptions,
	Food,
	RecipeData,
	AnalysisResult,
	AnalysisProgress,
	Recipe,
	IngredientNames,
	IngredientTags,
	GuideItem,
	ItemModifiers,
	ModifyItem,
} from './models.js';
interface AnalyzerOptions extends CalculatorOptions {
	onRecipeData?: (data: RecipeData) => void;
	schedule?: (callback: () => void, delay: number) => number;
	cancelSchedule?: (id: number) => void;
	now?: () => number;
	desiredBlockTime?: number;
}
import { recipes } from './recipes.js';
import { matchesMode } from './mode-utils.js';
import { combinationGenerator, countCombinations } from './recipe-calculator.js';
import { accumulateIngredients } from './utils.js';

/**
 * Creates the batched recipe-combination analyzer used by the statistics UI.
 *
 * Mode and multiplier state is captured when an analysis starts, ensuring a
 * run cannot mix settings if the user changes modes while it is in progress.
 */
export const createRecipeAnalyzer = ({
	getModeMask,
	getCharMask,
	getStatMultipliers,
	getItemModifiers,
	onRecipeData,
	schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
	cancelSchedule = timeoutId => globalThis.clearTimeout(timeoutId),
	now = () => performance.now(),
	desiredBlockTime = 16,
}: AnalyzerOptions) => {
	const analyze = (
		items: Food[],
		mainCallback: (result: AnalysisResult) => void,
		chunkCallback?: (progress: AnalysisProgress) => void,
		endCallback?: () => void,
	) => {
		const modeMask = getModeMask();
		const charMask = getCharMask();
		const statMultipliers = { ...getStatMultipliers() };
		const modifier = getItemModifiers?.();
		const modifiers = new Map<GuideItem, ItemModifiers>();
		// Character rules depend only on the captured configuration, not each combination.
		const modifyItem: ModifyItem | undefined = modifier
			? item => {
					let result = modifiers.get(item);
					if (!result) {
						result = modifier(item, modeMask);
						modifiers.set(item, result);
					}
					return result;
				}
			: undefined;
		const availableRecipes = recipes
			.filter(
				item =>
					!item.trash &&
					matchesMode(item.modeMask, modeMask, item.charMask, charMask) &&
					item.foodtype !== 'roughage',
			)
			.sort((a, b) => b.priority - a.priority);
		const recipeData: RecipeData = {
			recipes: availableRecipes,
			test: availableRecipes.map(recipe => recipe.test),
			tests: availableRecipes.map(recipe => recipe.test.toString()),
			priority: availableRecipes.map(recipe => recipe.priority || 0),
		};
		onRecipeData?.(recipeData);

		const pendingResults: AnalysisResult[] = [];
		const total = countCombinations(items.length);
		let checked = 0;
		let blockSize = 100;
		let paused = false;
		let cancelled = false;
		let complete = false;
		let timeoutId: number | null = null;

		const callback = (combination: number[]) => {
			checked++;
			const ingredients = combination.map(index => items[index]);
			/** @type {Record<string, number>} */
			const names: IngredientNames = {};
			/** @type {Record<string, number>} */
			const tags: IngredientTags = {};

			accumulateIngredients(ingredients, names, tags, statMultipliers, {
				modifyItem,
				modeMask,
			});
			tags.hunger = tags.bestHunger;
			tags.health = tags.bestHealth;
			tags.sanity = tags.bestSanity;

			const matches: Recipe[] = [];
			// Recipes are sorted by priority. Once one matches, only its ties can win.
			for (const recipe of recipeData.recipes) {
				if (matches.length && recipe.priority < matches[0].priority) {
					break;
				}
				if (recipe.test(null, names, tags)) {
					matches.push(recipe);
				}
			}

			for (const recipe of matches) {
				pendingResults.push({
					recipe,
					ingredients,
					tags: { health: tags.health, hunger: tags.hunger },
					multiple: matches.length > 1,
				});
			}
		};

		const getCombinations = combinationGenerator(items.length, callback);

		const computeNextBlock = () => {
			timeoutId = null;
			if (paused || cancelled || complete) {
				return;
			}

			const start = now();
			let processed = 0;
			let hasMore: boolean;
			do {
				hasMore = getCombinations(1);
				processed++;
			} while (hasMore && processed < blockSize && now() - start < desiredBlockTime);

			for (const result of pendingResults) {
				mainCallback(result);
			}
			// The consumer owns delivered results; retain only the current batch here.
			pendingResults.length = 0;
			if (cancelled) {
				return;
			}

			const elapsed = Math.max(1, now() - start);
			// Cap growth and retain a clock-independent bound on each batch.
			blockSize = Math.max(
				1,
				Math.min(
					10_000,
					blockSize * 2,
					Math.floor((desiredBlockTime / elapsed) * processed),
				),
			);

			chunkCallback?.({ checked, total });
			if (cancelled) {
				return;
			}

			if (hasMore) {
				if (!paused) {
					timeoutId = schedule(computeNextBlock, 0);
				}
			} else {
				complete = true;
				paused = false;
				endCallback?.();
			}
		};

		computeNextBlock();

		return {
			pause: () => {
				if (cancelled || complete) {
					return;
				}
				paused = true;
				if (timeoutId !== null) {
					cancelSchedule(timeoutId);
					timeoutId = null;
				}
			},
			resume: () => {
				if (paused && !cancelled && !complete) {
					paused = false;
					computeNextBlock();
				}
			},
			cancel: () => {
				if (cancelled || complete) {
					return;
				}
				cancelled = true;
				paused = false;
				pendingResults.length = 0;
				if (timeoutId !== null) {
					cancelSchedule(timeoutId);
					timeoutId = null;
				}
			},
			isPaused: () => paused,
			isCancelled: () => cancelled,
			isComplete: () => complete,
		};
	};

	return { analyze };
};
