import { food } from './food.js';
import { recipes } from './recipes.js';
import { excludesMode, matchesMode } from './mode-utils.js';
import { accumulateIngredients } from './utils.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compareByMatch = (a, b) => {
	if (a.match === b.match) {
		const aname = a.basename ? a.basename : a.name;
		const bname = b.basename ? b.basename : b.name;
		if (aname !== bname) {
			return aname > bname ? 1 : -1;
		}
		return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
	}
	return b.match - a.match;
};

const requirementMatchesItem = (requirements, item) => {
	let failed = true;

	for (const requirement of requirements) {
		const result = requirement.test(null, item.nameObject, item);
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
export const createRecipeCalculator = ({ getModeMask, getCharMask, getStatMultipliers }) => {
	const matchingNames = (collection, search, includeUncookable) => {
		let name = search.toLowerCase();
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
					element.match = Number(element[value]) || 0;
					return searchType === 'tag' ? element.match : !element.match;
				});
			} else if (searchType === 'recipe') {
				const recipe = recipes.byName(value);
				if (!recipe) {
					return [];
				}
				matches = matches.filter(element => {
					element.match = requirementMatchesItem(recipe.requirements, element) ? 1 : 0;
					return element.match;
				});
			} else {
				const ingredient = food.byName(value);
				if (!ingredient) {
					return [];
				}
				matches = matches.filter(recipe => {
					recipe.match = requirementMatchesItem(recipe.requirements, ingredient) ? 1 : 0;
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
						(element.raw && element.raw.lowerName === name) ||
						(element.cook && element.cook.lowerName === name)
							? 1
							: 0;
					return element.match;
				})
				.sort(compareByMatch);
		}

		const escapedName = escapeRegExp(name);
		const wordStarts = new RegExp(`\\b${escapedName}.*`);
		const anywhere = new RegExp(`\\b${[...name].map(escapeRegExp).join('.*')}.*`);

		return matches
			.filter(element => {
				if (
					element.lowerName.startsWith(name) ||
					(element.raw && element.raw.lowerName.startsWith(name))
				) {
					element.match = 3;
				} else if (wordStarts.test(element.lowerName)) {
					element.match = 2;
				} else if (anywhere.test(element.lowerName)) {
					element.match = 1;
				} else {
					element.match = 0;
				}
				return element.match;
			})
			.sort(compareByMatch);
	};

	const getSuggestions = (recipeList, items, exclude, itemComplete) => {
		/** @type {Record<string, number>} */
		const names = {};
		/** @type {Record<string, number>} */
		const tags = {};

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

	const recipeList = [];
	const getRecipes = items => {
		/** @type {Record<string, number>} */
		const names = {};
		/** @type {Record<string, number>} */
		const tags = {};

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

		const potential = /** @type {any} */ ({
			...tags,
			hunger: tags.bestHunger,
			health: tags.bestHealth,
			sanity: tags.bestSanity,
			img: '',
			name: 'Sum:Potential',
			priority: ' ',
			perish: 0,
			cooktime: 0,
		});
		delete potential.cook;

		const total = /** @type {any} */ ({
			...tags,
			bestHunger: tags.hunger,
			bestHealth: tags.health,
			bestSanity: tags.sanity,
			img: '',
			name: 'Sum:Total',
			priority: ' ',
			perish: 0,
			cooktime: 0,
		});
		delete total.cook;

		recipeList.unshift(total, potential);
		return recipeList;
	};

	return { matchingNames, getSuggestions, getRecipes };
};

/**
 * Iterates over unordered four-item combinations in bounded batches.
 *
 * @returns {(batch: number) => boolean} A function that returns whether more
 * combinations remain.
 */
export const combinationGenerator = (length, callback, startPos) => {
	const size = 4;
	const current = startPos || [0, 0, 0, 0];

	if (length <= 0) {
		return () => false;
	}

	return batch => {
		while (batch--) {
			callback(current);
			current[0]++;
			let overflow = 0;

			while (current[overflow] >= length) {
				overflow++;
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

			if (overflow === size) {
				return false;
			}
		}

		return true;
	};
};
