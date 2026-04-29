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
 * The `utils.js` module contains DOM helpers (icon rendering, link parsing)
 * and is intentionally *not* re-exported here so that Node consumers can
 * pull in just the data without dragging in browser-only code paths.
 * Import it directly via `foodguide/utils` when running in a browser.
 */

export * from './constants.js';
export * from './functions.js';
export * from './mode-utils.js';
export { food } from './food.js';
export { recipes, updateFoodRecipes } from './recipes.js';
