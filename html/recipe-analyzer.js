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
	schedule = (callback, delay) => setTimeout(callback, delay),
	cancelSchedule = timeoutId => clearTimeout(timeoutId),
	now = () => Date.now(),
	desiredBlockTime = 100,
}) => {
	const analyze = (items, mainCallback, chunkCallback, endCallback) => {
		const modeMask = getModeMask();
		const charMask = getCharMask();
		const statMultipliers = getStatMultipliers();
		const recipeData = {};

		recipeData.recipes = recipes
			.filter(
				item =>
					!item.trash &&
					matchesMode(item.modeMask, modeMask, item.charMask, charMask) &&
					item.foodtype !== 'roughage',
			)
			.sort((a, b) => b.priority - a.priority);
		recipeData.test = recipeData.recipes.map(recipe => recipe.test);
		recipeData.tests = recipeData.recipes.map(recipe => recipe.test.toString());
		recipeData.priority = recipeData.recipes.map(recipe => recipe.priority || 0);
		onRecipeData?.(recipeData);

		const built = [];
		let renderedTo = 0;
		let previousElapsed;
		let blockSize = 100;
		let paused = false;
		let cancelled = false;
		let complete = false;
		let timeoutId = null;

		const callback = combination => {
			const ingredients = combination.map(index => items[index]);
			/** @type {Record<string, number>} */
			const names = {};
			/** @type {Record<string, number>} */
			const tags = {};
			let created = null;
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
				built.push(created);
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

			for (; renderedTo < built.length; renderedTo++) {
				mainCallback(built[renderedTo]);
			}

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
				built.length = 0;
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
