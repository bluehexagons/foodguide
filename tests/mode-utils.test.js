import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	applyModeMetadata,
	matchesMode,
	excludesMode,
	getModeName,
	calculateModeMask,
	calculateCharMask,
	getActiveMultipliers,
	isCharacterApplicable,
} from '../html/mode-utils.js';
import {
	VANILLA,
	GIANTS,
	SHIPWRECKED,
	TOGETHER,
	HAMLET,
	WARLY,
	WEBBER,
	modes,
	baseModes,
	characters,
	defaultStatMultipliers,
	gameVersions,
	dlcOptions,
} from '../html/constants.js';

describe('mode utility functions', () => {
	it('applyModeMetadata sets modeMask and boolean flag', () => {
		const item = { mode: 'shipwrecked' };
		applyModeMetadata(item, modes);

		assert.equal(item.modeMask, SHIPWRECKED);
		assert.equal(item.charMask, 0);
		assert.equal(item.shipwrecked, true);
	});

	it('applyModeMetadata sets charMask for character-specific modes', () => {
		const warlyItem = { mode: 'warly' };
		applyModeMetadata(warlyItem, modes);

		assert.equal(warlyItem.modeMask, SHIPWRECKED);
		assert.equal(warlyItem.charMask, WARLY);
		assert.equal(warlyItem.warly, true);

		const warlyDstItem = { mode: 'warlydst' };
		applyModeMetadata(warlyDstItem, modes);

		assert.equal(warlyDstItem.modeMask, TOGETHER);
		assert.equal(warlyDstItem.charMask, WARLY);
		assert.equal(warlyDstItem.warlydst, true);
	});

	it('applyModeMetadata handles items without mode', () => {
		const item = {};
		applyModeMetadata(item, modes);

		assert.equal(item.modeMask, 0);
		assert.equal(item.charMask, 0);
	});

	it('matchesMode returns true when version bits overlap (no character)', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = VANILLA | GIANTS | SHIPWRECKED;

		assert.equal(matchesMode(itemMask, currentMask), true);
	});

	it('matchesMode returns false when no version bits overlap', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = TOGETHER;

		assert.equal(matchesMode(itemMask, currentMask), false);
	});

	it('matchesMode with charMask: matches when version overlaps and character selected', () => {
		// Warly Shipwrecked recipe: needs SHIPWRECKED version + WARLY character
		const itemModeMask = SHIPWRECKED;
		const itemCharMask = WARLY;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = WARLY;

		assert.equal(matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask), true);
	});

	it('matchesMode with charMask: excludes when version matches but character not selected', () => {
		// Warly recipe but no character selected
		const itemModeMask = SHIPWRECKED;
		const itemCharMask = WARLY;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = 0;

		assert.equal(matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask), false);
	});

	it('matchesMode with charMask: excludes when character selected but version wrong', () => {
		// DST Warly recipe, but user is in Shipwrecked mode
		const itemModeMask = TOGETHER;
		const itemCharMask = WARLY;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = WARLY;

		assert.equal(matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask), false);
	});

	it('matchesMode with charMask: non-character items match regardless of charMask', () => {
		// Regular recipe (no character requirement) still matches even if character selected
		const itemModeMask = SHIPWRECKED;
		const itemCharMask = 0;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = WARLY;

		assert.equal(matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask), true);
	});

	it('matchesMode with charMask: wrong character selected does not match', () => {
		// Warly recipe but Webber is selected
		const itemModeMask = SHIPWRECKED;
		const itemCharMask = WARLY;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = WEBBER;

		assert.equal(matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask), false);
	});

	it('excludesMode is inverse of matchesMode (2 args)', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = VANILLA | GIANTS | SHIPWRECKED;

		assert.equal(excludesMode(itemMask, currentMask), !matchesMode(itemMask, currentMask));
	});

	it('excludesMode is inverse of matchesMode (4 args)', () => {
		const itemModeMask = SHIPWRECKED;
		const itemCharMask = WARLY;
		const currentModeMask = VANILLA | GIANTS | SHIPWRECKED;
		const currentCharMask = WARLY;

		assert.equal(
			excludesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask),
			!matchesMode(itemModeMask, currentModeMask, itemCharMask, currentCharMask),
		);
	});

	it('getModeName returns correct name for exact match', () => {
		const mask = VANILLA | GIANTS | SHIPWRECKED;
		const name = getModeName(mask, modes);

		assert.equal(name, 'Shipwrecked');
	});

	it('calculateModeMask returns version mask without character bits', () => {
		const dlc = { giants: true, shipwrecked: true };
		const mask = calculateModeMask('dontstarve', dlc, 'warly', gameVersions, dlcOptions, characters);

		// Should include vanilla + giants + shipwrecked but NOT warly bit
		assert.equal(mask, VANILLA | GIANTS | SHIPWRECKED);
	});

	it('calculateModeMask for dontstarve with partial DLC', () => {
		const dlc = { giants: true, shipwrecked: false };
		const mask = calculateModeMask('dontstarve', dlc, null, gameVersions, dlcOptions, characters);

		assert.equal(mask, VANILLA | GIANTS);
	});

	it('calculateModeMask for DST ignores DLC', () => {
		const dlc = { giants: true, shipwrecked: true };
		const mask = calculateModeMask('together', dlc, null, gameVersions, dlcOptions, characters);

		assert.equal(mask, TOGETHER);
	});

	it('calculateModeMask for hamlet includes all single-player content', () => {
		const dlc = {};
		const mask = calculateModeMask('hamlet', dlc, 'webber', gameVersions, dlcOptions, characters);

		// Character bits are NOT in modeMask; only version bits
		assert.equal(mask, VANILLA | GIANTS | SHIPWRECKED | HAMLET);
	});

	it('calculateModeMask for vanilla only', () => {
		const dlc = { giants: false, shipwrecked: false };
		const mask = calculateModeMask('dontstarve', dlc, null, gameVersions, dlcOptions, characters);

		assert.equal(mask, VANILLA);
	});

	it('calculateCharMask returns character bit when applicable', () => {
		const charMask = calculateCharMask(
			'warly',
			'dontstarve',
			{ giants: true, shipwrecked: true },
			characters,
		);

		assert.equal(charMask, WARLY);
	});

	it('calculateCharMask returns 0 when character not applicable', () => {
		// Warly needs shipwrecked DLC in dontstarve mode
		const charMask = calculateCharMask(
			'warly',
			'dontstarve',
			{ giants: true, shipwrecked: false },
			characters,
		);

		assert.equal(charMask, 0);
	});

	it('calculateCharMask returns 0 when no character selected', () => {
		const charMask = calculateCharMask(null, 'together', {}, characters);

		assert.equal(charMask, 0);
	});

	it('calculateCharMask returns character bit for DST', () => {
		const charMask = calculateCharMask('warly', 'together', {}, characters);

		assert.equal(charMask, WARLY);
	});

	it('calculateCharMask returns character bit for hamlet', () => {
		const charMask = calculateCharMask('webber', 'hamlet', {}, characters);

		assert.equal(charMask, WEBBER);
	});

	it('isCharacterApplicable checks DLC requirements', () => {
		// Warly requires shipwrecked under dontstarve
		assert.equal(
			isCharacterApplicable('warly', 'dontstarve', { giants: false, shipwrecked: true }, characters),
			true,
		);
		assert.equal(
			isCharacterApplicable('warly', 'dontstarve', { giants: true, shipwrecked: false }, characters),
			false,
		);
		// Webber requires giants or shipwrecked
		assert.equal(
			isCharacterApplicable('webber', 'dontstarve', { giants: true, shipwrecked: false }, characters),
			true,
		);
		assert.equal(
			isCharacterApplicable('webber', 'dontstarve', { giants: false, shipwrecked: false }, characters),
			false,
		);
	});

	it('isCharacterApplicable works for hamlet and together', () => {
		assert.equal(isCharacterApplicable('warly', 'hamlet', {}, characters), true);
		assert.equal(isCharacterApplicable('warly', 'together', {}, characters), true);
		assert.equal(isCharacterApplicable('webber', 'hamlet', {}, characters), true);
		assert.equal(isCharacterApplicable('webber', 'together', {}, characters), true);
	});

	it('getActiveMultipliers returns Warly multipliers for dontstarve with shipwrecked DLC', () => {
		const multipliers = getActiveMultipliers(
			'dontstarve',
			{ giants: true, shipwrecked: true },
			'warly',
			characters,
			defaultStatMultipliers,
		);

		assert.equal(multipliers.raw, 0.7);
		assert.equal(multipliers.dried, 0.8);
		assert.equal(multipliers.cooked, 0.9);
		assert.equal(multipliers.recipe, 1.2);
	});

	it('getActiveMultipliers returns defaults when no character selected', () => {
		const multipliers = getActiveMultipliers(
			'dontstarve',
			{ giants: true, shipwrecked: true },
			null,
			characters,
			defaultStatMultipliers,
		);

		assert.equal(multipliers.raw, 1);
		assert.equal(multipliers.dried, 1);
		assert.equal(multipliers.cooked, 1);
		assert.equal(multipliers.recipe, 1);
	});

	it('getActiveMultipliers returns defaults for Warly in DST (no multipliers)', () => {
		const multipliers = getActiveMultipliers(
			'together',
			{},
			'warly',
			characters,
			defaultStatMultipliers,
		);

		// Warly only has multipliers in Shipwrecked, not DST
		assert.equal(multipliers.raw, 1);
		assert.equal(multipliers.dried, 1);
		assert.equal(multipliers.cooked, 1);
		assert.equal(multipliers.recipe, 1);
	});
});
