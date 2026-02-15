// @ts-nocheck
'use strict';

/**
 * Mode System Utilities
 *
 * This module provides utilities for working with Don't Starve game modes and character variants.
 *
 * Architecture:
 * - Base modes: Vanilla, RoG, Shipwrecked, Hamlet, DST (the core game versions)
 * - Character variants: Warly, Webber, etc. (characters with special food mechanics)
 *
 * Characters can have mode-specific multipliers. For example:
 * - Warly in Shipwrecked has reduced effectiveness for raw/dried/cooked foods
 *   but increased effectiveness for recipes (he's a chef!)
 * - Warly in DST and Hamlet has no such multipliers
 * - Webber has no food multipliers in any mode
 *
 * The system uses bit flags for efficient filtering:
 * - Each mode/character has a unique bit (power of 2)
 * - Mode masks combine multiple bits with bitwise OR
 * - Filtering uses bitwise AND to check overlap
 */

/**
 * Applies mode metadata to a recipe or food item
 * Sets the modeMask bit and creates a boolean flag for the mode
 * @param {Object} item - Recipe or food item
 * @param {Object} modes - Mode definitions
 */
export function applyModeMetadata(item, modes) {
	if (item.mode) {
		item[item.mode] = true; // e.g., item.warly = true
		item.modeMask = modes[item.mode].bit;
	} else {
		item.modeMask = 0;
	}
}

/**
 * Checks if an item matches the current mode mask
 * @param {number} itemModeMask - Item's mode mask
 * @param {number} currentModeMask - Current active mode mask
 * @returns {boolean} True if item should be included
 */
export function matchesMode(itemModeMask, currentModeMask) {
	return (itemModeMask & currentModeMask) !== 0;
}

/**
 * Checks if an item does not match the current mode mask
 * @param {number} itemModeMask - Item's mode mask
 * @param {number} currentModeMask - Current active mode mask
 * @returns {boolean} True if item should be excluded
 */
export function excludesMode(itemModeMask, currentModeMask) {
	return (itemModeMask & currentModeMask) === 0;
}

/**
 * Get the display name for a mode combination
 * @param {number} mask - Mode mask
 * @param {Object} modes - Mode definitions
 * @returns {string} Display name
 */
export function getModeName(mask, modes) {
	// Check for exact match first
	for (const key in modes) {
		if (modes[key].mask === mask) {
			return modes[key].name;
		}
	}

	// Build combined name
	const parts = [];
	for (const key in modes) {
		if ((mask & modes[key].bit) !== 0) {
			parts.push(modes[key].name);
		}
	}
	return parts.join(' + ');
}

/**
 * Calculates the effective mode mask for a base game mode + optional character
 * @param {string} baseMode - Base game mode key (e.g., 'shipwrecked')
 * @param {string|null} character - Character key (e.g., 'warly') or null
 * @param {Object} modes - Mode definitions
 * @param {Object} characters - Character definitions
 * @returns {number} Combined mode mask
 */
export function calculateModeMask(baseMode, character, modes, characters) {
	let mask = modes[baseMode].mask;

	if (character && characters[character]) {
		const charDef = characters[character];
		// Add character bit if applicable to this base mode
		if (charDef.applicableModes.includes(baseMode)) {
			mask |= charDef.bit;
		}
	}

	return mask;
}

/**
 * Gets the active multipliers for the current mode selection
 * @param {string} baseMode - Base game mode key
 * @param {string|null} character - Character key or null
 * @param {Object} modes - Mode definitions
 * @param {Object} characters - Character definitions
 * @param {Object} defaultMultipliers - Default stat multipliers
 * @returns {Object} Stat multipliers object
 */
export function getActiveMultipliers(baseMode, character, modes, characters, defaultMultipliers) {
	const result = { ...defaultMultipliers };

	// Check if character has multipliers for this base mode
	if (character && characters[character]) {
		const charDef = characters[character];
		const modeSpecificMults = charDef.multipliers?.[baseMode];

		if (modeSpecificMults) {
			for (const foodtype in modeSpecificMults) {
				if (Object.prototype.hasOwnProperty.call(modeSpecificMults, foodtype)) {
					result[foodtype] *= modeSpecificMults[foodtype];
				}
			}
		}
	}

	return result;
}
