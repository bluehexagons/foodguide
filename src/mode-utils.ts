import type {
	ModeDefinition,
	CharacterDefinition,
	ItemModifiers,
	ModifyItem,
	StatMultipliers,
	PreparationType,
} from './models.js';

import { TOGETHER, healing_tiny, healing_small } from './constants.js';
import { t } from './strings.js';

/**
 * Mode System Utilities
 *
 * This module provides utilities for working with Don't Starve game modes and character variants.
 *
 * Architecture:
 * - Game versions: Don't Starve Together, Don't Starve (with optional DLC), Hamlet
 * - DLC toggles: Reign of Giants and Shipwrecked (only for Don't Starve version)
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
 * Applies mode metadata to a recipe or food item.
 * Sets modeMask (which game version) and charMask (which character required).
 * @param {Object} item - Recipe or food item
 * @param {Object} modes - Mode definitions
 */
export function applyModeMetadata(
	item: { mode?: string; modeMask: number; charMask: number },
	modes: Record<string, ModeDefinition>,
) {
	if (item.mode) {
		Object.assign(item, { [item.mode]: true }); // e.g., item.warly = true
		const modeDef = modes[item.mode];
		item.modeMask = modeDef.bit;
		item.charMask = modeDef.charBit || 0;
	} else {
		item.modeMask = 0;
		item.charMask = 0;
	}
}

/**
 * Checks if an item matches the current mode + character selection.
 * An item matches if its version bit overlaps with the current mode mask,
 * AND it either has no character requirement or the required character is selected.
 * @param {number} itemModeMask - Item's version mode mask
 * @param {number} currentModeMask - Current active version mode mask
 * @param {number} [itemCharMask=0] - Item's character requirement mask
 * @param {number} [currentCharMask=0] - Current active character mask
 * @returns {boolean} True if item should be included
 */
export function matchesMode(
	itemModeMask: number,
	currentModeMask: number,
	itemCharMask = 0,
	currentCharMask = 0,
) {
	if ((itemModeMask & currentModeMask) === 0) {
		return false;
	}
	// If the item has no character requirement, it matches any character selection
	if (!itemCharMask) {
		return true;
	}
	// If the item requires a character, check that the character is selected
	return (itemCharMask & (currentCharMask || 0)) !== 0;
}

/**
 * Checks if an item does not match the current mode + character selection.
 * @param {number} itemModeMask - Item's version mode mask
 * @param {number} currentModeMask - Current active version mode mask
 * @param {number} [itemCharMask=0] - Item's character requirement mask
 * @param {number} [currentCharMask=0] - Current active character mask
 * @returns {boolean} True if item should be excluded
 */
export function excludesMode(
	itemModeMask: number,
	currentModeMask: number,
	itemCharMask = 0,
	currentCharMask = 0,
) {
	return !matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask);
}

/**
 * Get the display name for a mode combination
 * @param {number} mask - Mode mask
 * @param {Object} modes - Mode definitions
 * @returns {string} Display name
 */
export function getModeName(mask: number, modes: Record<string, ModeDefinition>) {
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
 * Calculates the effective version mode mask for a game version + DLC.
 * Does NOT include character bits — use calculateCharMask for that.
 *
 * @param {string} version - Game version key ('together', 'dontstarve', 'hamlet')
 * @param {Object} activeDlc - Object with DLC keys set to true/false (e.g., {giants: true, shipwrecked: false})
 * @param {string|null} character - Character key (unused, kept for API compatibility)
 * @param {Object} gameVersions - Game version definitions
 * @param {Object} dlcOptions - DLC option definitions
 * @param {Object} characters - Character definitions (unused)
 * @returns {number} Version mode mask
 */
export function calculateModeMask(
	version: string,
	activeDlc: Record<string, boolean>,
	_character: string | null,
	gameVersions: Record<string, { baseMask: number }>,
	dlcOptions: Record<string, { bit: number }>,
	_characters: Record<string, CharacterDefinition>,
) {
	let mask = gameVersions[version].baseMask;

	// Add enabled DLC bits (only meaningful for 'dontstarve')
	if (version === 'dontstarve') {
		for (const dlcKey in activeDlc) {
			if (activeDlc[dlcKey] && dlcOptions[dlcKey]) {
				mask |= dlcOptions[dlcKey].bit;
			}
		}
	}

	return mask;
}

/**
 * Calculates the character mask for the current selection.
 *
 * @param {string|null} character - Character key (e.g., 'warly') or null
 * @param {string} version - Game version key
 * @param {Object} activeDlc - Active DLC toggles
 * @param {Object} characters - Character definitions
 * @returns {number} Character mask (0 if no character selected or not applicable)
 */
export function calculateCharMask(
	character: string | null,
	version: string,
	activeDlc: Record<string, boolean>,
	characters: Record<string, CharacterDefinition>,
) {
	if (!character || !characters[character]) {
		return 0;
	}
	if (!isCharacterApplicable(character, version, activeDlc, characters)) {
		return 0;
	}
	return characters[character].bit;
}

/**
 * Checks if a character is applicable to the current game version + DLC configuration.
 *
 * @param {string} charName - Character key
 * @param {string} version - Game version key
 * @param {Object} activeDlc - Active DLC toggles
 * @param {Object} characters - Character definitions
 * @returns {boolean} True if the character can be selected
 */
export function isCharacterApplicable(
	charName: string,
	version: string,
	activeDlc: Record<string, boolean>,
	characters: Record<string, CharacterDefinition>,
) {
	const charDef = characters[charName];
	if (!charDef) {
		return false;
	}

	if (version === 'together' || version === 'hamlet') {
		return charDef.applicableModes.includes(version);
	}

	// For 'dontstarve', check if any enabled DLC (or vanilla) is in applicableModes
	if (version === 'dontstarve') {
		// Check vanilla applicability
		if (charDef.applicableModes.includes('vanilla')) {
			return true;
		}
		// Check each enabled DLC
		for (const dlcKey in activeDlc) {
			if (activeDlc[dlcKey] && charDef.applicableModes.includes(dlcKey)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Gets the active multipliers for the current mode selection.
 *
 * For Warly in Shipwrecked-compatible modes, this applies his food multipliers.
 *
 * @param {string} version - Game version key
 * @param {Object} activeDlc - Active DLC toggles
 * @param {string|null} character - Character key or null
 * @param {Object} characters - Character definitions
 * @param {Object} defaultMultipliers - Default stat multipliers
 * @returns {Object} Stat multipliers object
 */
export function getActiveMultipliers(
	version: string,
	activeDlc: Record<string, boolean>,
	character: string | null,
	characters: Record<string, CharacterDefinition>,
	defaultMultipliers: StatMultipliers,
) {
	const result = { ...defaultMultipliers };

	if (!character || !characters[character]) {
		return result;
	}

	const charDef = characters[character];

	// For 'dontstarve', check each enabled DLC for multipliers
	if (version === 'dontstarve') {
		for (const dlcKey in activeDlc) {
			if (activeDlc[dlcKey] && charDef.multipliers?.[dlcKey]) {
				const mults = charDef.multipliers[dlcKey];
				for (const foodtype of Object.keys(mults) as PreparationType[]) {
					if (Object.prototype.hasOwnProperty.call(mults, foodtype)) {
						result[foodtype] *= mults[foodtype] ?? 1;
					}
				}
			}
		}
	} else {
		// For 'hamlet' and 'together', check directly by version key
		const modeSpecificMults = charDef.multipliers?.[version];
		if (modeSpecificMults) {
			for (const foodtype of Object.keys(modeSpecificMults) as PreparationType[]) {
				if (Object.prototype.hasOwnProperty.call(modeSpecificMults, foodtype)) {
					result[foodtype] *= modeSpecificMults[foodtype] ?? 1;
				}
			}
		}
	}

	return result;
}

/**
 * Gets character-specific food modifiers.
 * Returns an object with a modifyItem function that applies character-specific changes.
 *
 * @param {string|null} character - Character key or null
 * @param {Object} characters - Character definitions
 * @returns {Object} Character food modifiers { modifyItem: function }
 */
export function getCharacterFoodModifiers(
	character: string | null,
	characters: Record<string, CharacterDefinition>,
): { modifyItem: ModifyItem } {
	if (!character || !characters[character]) {
		return {
			modifyItem: () => ({}),
		};
	}

	const charDef = characters[character];
	const abilities = charDef.abilities;

	if (!abilities) {
		return {
			modifyItem: () => ({}),
		};
	}

	// Return modifier function that handles both Webber and Wigfrid
	return {
		modifyItem: (item, currentModeMask) => {
			const mods: ItemModifiers = {};

			// Webber: negate monster food penalties, make raw meat like cooked
			if (abilities.noMonsterPenalty && item.monster) {
				if ((item.health ?? 0) < 0) {
					mods.health = 0;
				}
				if ((item.sanity ?? 0) < 0) {
					mods.sanity = 0;
				}
			}

			// Webber can eat raw meat like cooked meat
			// Raw meat: health=healing_tiny (1), sanity=-sanity_small (-10)
			// Cooked meat: health=healing_small (3), sanity=0
			// Apply multipliers to make raw stats equal cooked stats
			if (
				abilities.rawMeatIsCooked &&
				item.preparationType === 'raw' &&
				item.ismeat &&
				!item.monster
			) {
				// Neutralize the sanity penalty - set to 0
				if (item.sanity !== undefined && (item.sanity ?? 0) < 0) {
					mods.sanity = 0;
				}
				// Apply cooked meat health bonus
				// Raw meat has healing_tiny (1), cooked has healing_small (3)
				if (item.health === healing_tiny) {
					mods.health = healing_small;
				}
			}

			// Wigfrid: can only eat meat and goodies (goodies only in DST)
			if (abilities.meatOnly) {
				// Check if item is meat: food items have 'ismeat', recipes have 'foodtype'
				const isMeat = item.ismeat || item.foodtype === 'meat';
				const isGoodie = item.foodtype === 'goodies';
				const canEatGoodies = abilities.canEatGoodies && currentModeMask & TOGETHER;

				// If it's not meat and (not a goodie OR can't eat goodies), multiply stats by 0
				if (!isMeat && !(isGoodie && canEatGoodies)) {
					if (item.health !== undefined) {
						mods.health = 0;
					}
					if (item.hunger !== undefined) {
						mods.hunger = 0;
					}
					if (item.sanity !== undefined) {
						mods.sanity = 0;
					}
				}
			}

			return mods;
		},
	};
}

/**
 * Gets the ability descriptions for a character.
 * Returns an array of description strings for UI display.
 *
 * @param {string|null} character - Character key or null
 * @param {Object} characters - Character definitions
 * @returns {Array<string>} Array of ability description strings
 */
export function getCharacterAbilities(
	character: string | null,
	characters: Record<string, CharacterDefinition>,
) {
	if (!character || !characters[character]) {
		return [];
	}

	const charDef = characters[character];
	const abilities = charDef.abilities;

	if (!abilities) {
		return [];
	}

	const descriptions = [];

	if (abilities.noMonsterPenalty) {
		descriptions.push(t('abilityNoMonsterPenalty'));
	}

	if (abilities.rawMeatIsCooked) {
		descriptions.push(t('abilityRawMeatIsCooked'));
	}

	if (abilities.meatOnly) {
		if (abilities.canEatGoodies) {
			descriptions.push(t('abilityMeatAndGoodies'));
		} else {
			descriptions.push(t('abilityMeatOnly'));
		}
	}

	return descriptions;
}
