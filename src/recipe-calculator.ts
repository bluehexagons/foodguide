import type {
	Food,
	Recipe,
	GuideItem,
	Collection,
	CalculatorOptions,
	Requirement,
	IngredientNames,
	IngredientTags,
	SummaryRow,
	CalculatorRow,
} from './models.js';
import { food } from './food.js';
import { recipes } from './recipes.js';
import { excludesMode, matchesMode } from './mode-utils.js';
import { accumulateIngredients, numericTags } from './utils.js';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compareByMatch = (a: GuideItem, b: GuideItem) => {
	if (a.match === b.match) {
		const aname = a.basename ? a.basename : a.name;
		const bname = b.basename ? b.basename : b.name;
		if (aname !== bname) {
			return aname > bname ? 1 : -1;
		}
		return a.name === b.name ? 0 : 'raw' in a && a.raw === b ? 1 : -1;
	}
	return b.match - a.match;
};

const requirementMatchesItem = (requirements: Requirement[], item: Food) => {
	let failed = true;

	for (const requirement of requirements) {
		const result = requirement.test(null, item.nameObject, numericTags(item));
		if (requirement.cancel) {
			if (!result) {
				return false;
			}
		} else if (result) {
			failed = false;
		}
	}

	return !failed;
};

/**
 * Creates the recipe and ingredient search helpers used by the browser UI.
 *
 * State is supplied through getters so changing the selected mode, character,
 * or stat multipliers does not require rebuilding the calculator.
 */
export const createRecipeCalculator = ({
	getModeMask,
	getCharMask,
	getStatMultipliers,
}: CalculatorOptions) => {
	const matchingNames = <T extends GuideItem>(
		collection: { filter: (predicate: (item: T) => unknown) => T[] },
		search: string,
		includeUncookable = false,
	) => {
		let name = search.trim().toLowerCase();
		const modeMask = getModeMask();
		const charMask = getCharMask();
		let matches = collection.filter(element => {
			const allowed =
				(includeUncookable || !element.uncookable) &&
				!excludesMode(element.modeMask, modeMask, element.charMask, charMask);
			if (!allowed) {
				element.match = 0;
			}
			return allowed;
		});

		const specialSearch = name.match(/^(tagnot|tag|recipe|ingredient)(?::| ) */);
		if (specialSearch) {
			const [, searchType] = specialSearch;
			const value = name.slice(specialSearch[0].length);

			if (searchType === 'tag' || searchType === 'tagnot') {
				matches = matches.filter(element => {
					element.match = Number(numericTags(element)[value]) || 0;
					return searchType === 'tag' ? element.match : !element.match;
				});
			} else if (searchType === 'recipe') {
				const recipe = recipes.byName(value);
				if (!recipe) {
					return [];
				}
				matches = matches.filter(element => {
					element.match =
						'nameObject' in element &&
						requirementMatchesItem(recipe.requirements, element)
							? 1
							: 0;
					return element.match;
				});
			} else {
				const ingredient = food.byName(value);
				if (!ingredient) {
					return [];
				}
				matches = matches.filter(recipe => {
					recipe.match =
						'requirements' in recipe &&
						requirementMatchesItem(recipe.requirements, ingredient)
							? 1
							: 0;
					return recipe.match;
				});
			}

			return matches.sort(compareByMatch);
		}

		if (name.startsWith('*')) {
			name = name.slice(1);
			return matches
				.filter(element => {
					element.match = element.lowerName === name ? 1 : 0;
					return element.match;
				})
				.sort(compareByMatch);
		}

		if (name.startsWith('~')) {
			name = name.slice(1);
			return matches
				.filter(element => {
					element.match =
						element.lowerName === name ||
						('raw' in element && element.raw && element.raw.lowerName === name) ||
						('cook' in element && element.cook && element.cook.lowerName === name)
							? 1
							: 0;
					return element.match;
				})
				.sort(compareByMatch);
		}

		name = name.replaceAll('_', ' ');
		const escapedName = escapeRegExp(name);
		const wordStarts = new RegExp(`\\b${escapedName}.*`);
		const anywhere = new RegExp(`\\b${[...name].map(escapeRegExp).join('.*')}.*`);

		return matches
			.filter(element => {
				const alias = element.id?.replaceAll('_', ' ') || '';
				if (
					element.lowerName.startsWith(name) ||
					('raw' in element && element.raw && element.raw.lowerName.startsWith(name))
				) {
					element.match = 3;
				} else if (wordStarts.test(element.lowerName) || wordStarts.test(alias)) {
					element.match = 2;
				} else if (anywhere.test(element.lowerName) || anywhere.test(alias)) {
					element.match = 1;
				} else {
					element.match = 0;
				}
				return element.match;
			})
			.sort(compareByMatch);
	};

	const getSuggestions = (
		recipeList: Recipe[],
		items: (GuideItem | null)[],
		exclude?: CalculatorRow[] | null,
		itemComplete = false,
	) => {
		/** @type {Record<string, number>} */
		const names: IngredientNames = {};
		/** @type {Record<string, number>} */
		const tags: IngredientTags = {};

		recipeList.length = 0;
		accumulateIngredients(items, names, tags, getStatMultipliers());

		outer: for (let i = 0; i < recipes.length; i++) {
			const recipe = recipes[i];
			let valid = false;

			if (excludesMode(recipe.modeMask, getModeMask(), recipe.charMask, getCharMask())) {
				continue;
			}

			for (const requirement of recipe.requirements) {
				if (requirement.test(null, names, tags)) {
					if (!requirement.cancel) {
						valid = true;
					}
				} else if (!itemComplete && requirement.cancel) {
					continue outer;
				} else if (itemComplete && !requirement.cancel) {
					continue outer;
				}
			}

			if (valid && (!exclude || !exclude.includes(recipe))) {
				recipeList.push(recipe);
			}
		}

		return recipeList;
	};

	const recipeList: Recipe[] = [];
	const getRecipes = (items: (GuideItem | null)[]): CalculatorRow[] => {
		/** @type {Record<string, number>} */
		const names: IngredientNames = {};
		/** @type {Record<string, number>} */
		const tags: IngredientTags = {};

		recipeList.length = 0;
		accumulateIngredients(items, names, tags, getStatMultipliers());

		for (let i = 0; i < recipes.length; i++) {
			const recipe = recipes[i];
			if (
				matchesMode(recipe.modeMask, getModeMask(), recipe.charMask, getCharMask()) &&
				recipe.test(null, names, tags)
			) {
				recipeList.push(recipe);
			}
		}

		recipeList.sort((a, b) => b.priority - a.priority);

		const potential: SummaryRow = {
			...tags,
			hunger: tags.bestHunger || 0,
			health: tags.bestHealth || 0,
			sanity: tags.bestSanity || 0,
			img: '',
			name: 'Sum:Potential',
			priority: ' ',
			perish: 0,
			cooktime: 0,
		};

		const total: SummaryRow = {
			...tags,
			bestHunger: tags.hunger,
			bestHealth: tags.health,
			bestSanity: tags.sanity,
			img: '',
			name: 'Sum:Total',
			health: tags.health || 0,
			hunger: tags.hunger || 0,
			sanity: tags.sanity || 0,
			priority: ' ',
			perish: 0,
			cooktime: 0,
		};

		return [total, potential, ...recipeList];
	};

	return { matchingNames, getSuggestions, getRecipes };
};

/**
 * Iterates over unordered four-item combinations in bounded batches.
 *
 * @returns {(batch: number) => boolean} A function that returns whether more
 * combinations remain.
 */
export const combinationGenerator = (
	length: number,
	callback: (combination: number[]) => void,
	startPos?: number[],
) => {
	const size = 4;
	const current = startPos || [0, 0, 0, 0];
	let complete = length <= 0;

	return (batch: number) => {
		if (complete) {
			return false;
		}
		while (batch--) {
			callback(current);
			current[0]++;
			let overflow = 0;

			while (current[overflow] >= length) {
				overflow++;
				if (overflow === size) {
					complete = true;
					return false;
				}
				current[overflow]++;
			}

			let check = size;
			let max = 0;

			while (check--) {
				if (current[check] >= length) {
					current[check] = max;
				} else if (current[check] > max) {
					max = current[check];
				}
			}
		}

		return true;
	};
};
