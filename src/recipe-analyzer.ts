import type {
	CalculatorOptions,
	Food,
	RecipeData,
	AnalysisResult,
	IngredientNames,
	IngredientTags,
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
import { combinationGenerator } from './recipe-calculator.js';
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
	onRecipeData,
	schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
	cancelSchedule = timeoutId => globalThis.clearTimeout(timeoutId),
	now = () => Date.now(),
	desiredBlockTime = 100,
}: AnalyzerOptions) => {
	const analyze = (
		items: Food[],
		mainCallback: (result: AnalysisResult) => void,
		chunkCallback?: () => void,
		endCallback?: () => void,
	) => {
		const modeMask = getModeMask();
		const charMask = getCharMask();
		const statMultipliers = getStatMultipliers();
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
		let previousElapsed: number | undefined;
		let blockSize = 100;
		let paused = false;
		let cancelled = false;
		let complete = false;
		let timeoutId: number | null = null;

		const callback = (combination: number[]) => {
			const ingredients = combination.map(index => items[index]);
			/** @type {Record<string, number>} */
			const names: IngredientNames = {};
			/** @type {Record<string, number>} */
			const tags: IngredientTags = {};
			let created: AnalysisResult | null = null;
			let multiple = false;

			accumulateIngredients(ingredients, names, tags, statMultipliers);
			tags.hunger = tags.bestHunger;
			tags.health = tags.bestHealth;
			tags.sanity = tags.bestSanity;

			const matches = recipeData.recipes.filter(recipe => recipe.test(null, names, tags));
			const maxPriority = matches.reduce(
				(max, recipe) => Math.max(recipe.priority, max),
				-Infinity,
			);

			for (const recipe of matches.filter(recipe => recipe.priority >= maxPriority)) {
				if (created !== null) {
					multiple = true;
					created.multiple = true;
				}

				created = {
					recipe,
					ingredients,
					tags: { health: tags.health, hunger: tags.hunger },
					multiple,
				};
				pendingResults.push(created);
			}
		};

		const getCombinations = combinationGenerator(items.length, callback);

		const computeNextBlock = () => {
			timeoutId = null;
			if (paused || cancelled || complete) {
				return;
			}

			const start = now();
			const hasMore = getCombinations(blockSize);

			for (const result of pendingResults) {
				mainCallback(result);
			}
			// The consumer owns delivered results; retain only the current batch here.
			pendingResults.length = 0;

			const elapsed = Math.max(1, now() - start);
			if (previousElapsed !== elapsed) {
				previousElapsed = elapsed;
				blockSize = Math.max(1, ((desiredBlockTime / elapsed) * blockSize + 1) | 0);
			}

			chunkCallback?.();

			if (hasMore) {
				timeoutId = schedule(computeNextBlock, 0);
			} else {
				complete = true;
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
