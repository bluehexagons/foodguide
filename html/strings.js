/**
 * UI strings used by the Food Guide front-end.
 *
 * All user-facing strings emitted from JavaScript are collected here so a
 * future translation can swap them out without touching the rest of the
 * code. Each string is a function of the active locale via the `t()`
 * helper; for now there is only one locale ("en") so `t(strings.foo)` is
 * equivalent to reading `strings.foo` directly.
 *
 * To translate the UI, register a locale with `registerLocale(code, dict)`
 * and call `setLocale(code)`. `dict` should be a partial copy of the
 * default `strings` object; missing keys fall back to English.
 *
 * Static HTML strings (in `index.htm`) are not yet covered here. Each
 * `data-i18n` candidate would need a corresponding key; that migration is
 * left for a follow-up.
 */

const defaultStrings = {
	// Theme toggle button (shown as an emoji)
	themeToggleToDark: '🌙',
	themeToggleToLight: '☀️',
	themeToggleTitle: 'Toggle dark/light theme',

	// Mode selector labels in the header
	modeLabelGame: 'Game',
	modeLabelDlc: 'DLC',
	modeLabelCharacter: 'Char',
	dlcToggleHint: 'click to toggle',
	characterToggleHint: 'click to toggle',

	// Character ability descriptions (used by mode-utils.getCharacterAbilities)
	abilityNoMonsterPenalty: 'Can safely eat Monster Foods',
	abilityRawMeatIsCooked: 'Can safely eat Raw Meat',
	abilityMeatOnly: 'Only eats meat',
	abilityMeatAndGoodies: 'Only eats meat and goodies',

	// Ingredient picker controls
	clearSearchOrIngredients: 'Clear search or remove all ingredients',
	confirmClearInventory: 'Are you sure you want to clear all ingredients from your inventory?',
	displayModeNames: 'Display: Names',
	displayModeIcons: 'Display: Icons',
	displayModeList: 'Display: List',
	sortDefault: 'Sort: Default',
	sortName: 'Sort: Name',
	sortHealth: 'Sort: Health',
	sortHunger: 'Sort: Hunger',
	sortSanity: 'Sort: Sanity',
	sortPerish: 'Sort: Perish',
	searchTypeName: 'name',
	searchTypeTag: 'tag',
	searchTypeRecipe: 'recipe',
	searchPlaceholderName: 'Filter ingredients',
	searchPlaceholderTag: 'Meat, veggie, fruit, egg, monster...',
	searchPlaceholderRecipe: 'Find ingredients used in a recipe',

	// Statistics analyzer ("recipe grinder")
	calculateRecipes: 'Calculate efficient recipes (may take some time)',
	clearResults: 'Clear results',
	calculating: 'Calculating...',
	pause: 'Pause',
	resume: 'Resume',
	computingCombinations: 'Computing combinations..',
	multipleResultsNote: '* combination has multiple possible results',
	filterCycleHelp:
		'Click ingredients/recipes to cycle: normal → required (✓) → excluded (✕). Right-click for quick exclude.',
	customFilterPlaceholder: 'use custom filter',

	// Table column-toggle controls
	columns: 'Columns',
	autoColumns: 'Auto',
	autoColumnsTitle: 'Automatically hide less-important columns on narrow screens',
};

/** @type {Record<string, Partial<typeof defaultStrings>>} */
const locales = {
	en: defaultStrings,
};

let activeLocale = 'en';

/**
 * Register a translation dictionary. Missing keys fall back to English.
 * @param {string} code - BCP-47-style language tag (e.g. "es", "pt-BR").
 * @param {Partial<typeof defaultStrings>} dict - Partial overrides.
 */
export function registerLocale(code, dict) {
	locales[code] = dict;
}

/**
 * Switch the active locale. Unknown codes silently fall back to English.
 * @param {string} code
 */
export function setLocale(code) {
	if (locales[code]) {
		activeLocale = code;
	}
}

/**
 * Read a translated string by key.
 * @param {keyof typeof defaultStrings} key
 * @returns {string}
 */
export function t(key) {
	const localeDict = locales[activeLocale];
	if (localeDict && localeDict[key] !== undefined) {
		return localeDict[key];
	}
	return defaultStrings[key];
}

/**
 * The full English string table; useful as a base for new locale dicts.
 */
export const strings = defaultStrings;
