import type { Food, GuideItem, Recipe, Requirement } from './models.js';
import { matchesMode } from './mode-utils.js';

// These are picker suggestions, not cooking rules or analyzer exclusions.
// IDs apply to every game variant; a substitute is hidden only when its
// preferred ingredient is cookable and available in the current game.
export const cookingIngredientReplacements: Readonly<Record<string, string>> = {
	acorn: 'acorn_cooked', // Prefer the form used for Trail Mix.
	coffeebeans: 'coffeebeans_cooked',
	honeycomb: 'honey',
	batwing: 'morsel',
	moonbutterflywings: 'butterflywings',
	pondfish: 'fishmeat_small',
	pondeel: 'eel',
	tropical_fish: 'fish_raw',
	fish_med: 'fish_raw',
	crab: 'fish_raw_small',
	jellyfish: 'jellyfish_dead',
	rainbowjellyfish: 'rainbowjellyfish_dead',
	oceanfish_small_1_inv: 'fishmeat_small',
	oceanfish_small_2_inv: 'fishmeat_small',
	oceanfish_small_3_inv: 'fishmeat_small',
	oceanfish_small_4_inv: 'fishmeat_small',
	oceanfish_small_6_inv: 'fishmeat_small',
	oceanfish_small_7_inv: 'fishmeat_small',
	oceanfish_small_8_inv: 'fishmeat_small',
	oceanfish_small_9_inv: 'fishmeat_small',
	oceanfish_medium_1_inv: 'fishmeat',
	oceanfish_medium_2_inv: 'fishmeat',
	oceanfish_medium_3_inv: 'fishmeat',
	oceanfish_medium_4_inv: 'fishmeat',
	oceanfish_medium_6_inv: 'fishmeat',
	oceanfish_medium_7_inv: 'fishmeat',
	oceanfish_medium_9_inv: 'fishmeat',
};

// Less routine inputs, often worth saving for another use. Practical restores
// them when an applicable recipe explicitly calls for them; Everyday does not.
export const uncommonCookingIngredients: readonly string[] = [
	'butter',
	'goatmilk',
	'mandrake',
	'mole',
	'tallbirdegg',
	'trunk_summer',
	'trunk_winter',
	'lobster',
	'wobster',
	'shark_fin',
	'fish3',
	'fish4',
	'fish5',
	'royal_jelly',
	'cactusflower',
	'lightninggoathorn',
	'nightmarefuel',
	'boneshard',
	'snake_bone',
	'wormlight',
	'wormlight_lesser',
	'forgetmelots',
	'batnose',
	'refined_dust',
	'milkywhites',
];
const uncommon = new Set(uncommonCookingIngredients);

/** Positive named requirements identify specialties; tags and prohibitions do not. */
const namedRequirements = (requirement: Requirement): Requirement[][] => {
	if (requirement.item) {
		return requirement.cancel ? [] : namedRequirements(requirement.item);
	}
	if (requirement.item1 && requirement.item2) {
		// A composite can inherit cancel from one child; inspect both branches.
		const groups = [
			...namedRequirements(requirement.item1),
			...namedRequirements(requirement.item2),
		];
		// Alternatives share a role: cooking roe is redundant when raw roe
		// satisfies the same Caviar requirement. AND keeps separate roles.
		return requirement.operator === 'or' ? [groups.flat()] : groups;
	}
	return requirement.name && !requirement.cancel ? [[requirement]] : [];
};

/** Narrow picker results without changing order, selection, food data, or recipes. */
export function filterCookingIngredients<T extends GuideItem>(
	items: T[],
	preference: string,
	{
		ingredients,
		recipes,
		modeMask,
		charMask,
	}: {
		ingredients: readonly Food[];
		recipes: readonly Recipe[];
		modeMask: number;
		charMask: number;
	},
): T[] {
	if (preference !== 'practical' && preference !== 'everyday') {
		return items;
	}
	const available = (item: GuideItem) =>
		!item.uncookable && matchesMode(item.modeMask, modeMask, item.charMask, charMask);
	const availableById = new Map(ingredients.filter(available).map(item => [item.id, item]));
	const requirements = recipes
		.filter(recipe => available(recipe) && !recipe.trash && recipe.foodtype !== 'roughage')
		.flatMap(recipe => recipe.requirements.flatMap(namedRequirements));
	const replacementFor = (id: string) => {
		const replacement = Object.hasOwn(cookingIngredientReplacements, id)
			? cookingIngredientReplacements[id]
			: undefined;
		return replacement ? availableById.get(replacement) : undefined;
	};
	return items.filter(item => {
		if (!('nameObject' in item) || !available(item) || replacementFor(item.id)) {
			return false;
		}
		const base = item.rackdried ? item.wet : item.cooked ? item.raw : undefined;
		const named = requirements.filter(group =>
			group.some(requirement => requirement.test(null, item.nameObject, {})),
		);
		if (uncommon.has(item.id) || (base && uncommon.has(base.id))) {
			if (preference === 'everyday' || named.length === 0) {
				return false;
			}
		}
		const preferredBase = base && (replacementFor(base.id) ?? base);
		if (preferredBase && available(preferredBase) && preferredBase.id !== item.id) {
			// Keep a prepared form only when a recipe needs it specifically.
			return named.some(
				group =>
					!group.some(requirement =>
						requirement.test(null, preferredBase.nameObject, {}),
					),
			);
		}
		return true;
	});
}
