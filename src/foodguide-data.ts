/**
 * Default entry point when this package is imported as a library.
 *
 * The Food Guide is primarily a static web app served from `html/index.htm`,
 * but its data tables and helpers can be reused by other tools (mod
 * companion sites, calculators, bots, etc). This module re-exports the
 * pure-data and pure-logic surface so consumers can do:
 *
 *   import { food, recipes, modes, AND, NAME } from 'foodguide';
 *   import { food } from 'foodguide/food';
 *   import { matchesMode } from 'foodguide/mode-utils';
 *
 * Data initialization uses presentation helpers from `utils.js`, which guard
 * against a missing browser document. DOM helpers are not re-exported here;
 * import them directly via `foodguide/utils` when running in a browser.
 */

import './locales/index.js';

export * from './constants.js';
export * from './functions.js';
export * from './mode-utils.js';
export { food } from './food.js';
export { recipes, updateFoodRecipes } from './recipes.js';
export {
	t,
	setLocale,
	registerLocale,
	getLocale,
	listLocales,
	localeName,
	initLocale,
	applyTranslations,
	strings,
} from './strings.js';

export type * from './models.js';
export type { LocaleDict, StringKey } from './strings.js';
