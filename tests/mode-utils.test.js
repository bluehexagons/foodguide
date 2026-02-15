import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	applyModeMetadata,
	matchesMode,
	excludesMode,
	getModeName,
	calculateModeMask,
	getActiveMultipliers,
} from '../html/mode-utils.js';
import {
	VANILLA,
	GIANTS,
	SHIPWRECKED,
	TOGETHER,
	WARLY,
	modes,
	baseModes,
	characters,
	defaultStatMultipliers,
} from '../html/constants.js';

describe('mode utility functions', () => {
	it('applyModeMetadata sets modeMask and boolean flag', () => {
		const item = { mode: 'shipwrecked' };
		applyModeMetadata(item, modes);

		assert.equal(item.modeMask, SHIPWRECKED);
		assert.equal(item.shipwrecked, true);
	});

	it('applyModeMetadata handles items without mode', () => {
		const item = {};
		applyModeMetadata(item, modes);

		assert.equal(item.modeMask, 0);
	});

	it('matchesMode returns true when bits overlap', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = VANILLA | GIANTS | SHIPWRECKED;

		assert.equal(matchesMode(itemMask, currentMask), true);
	});

	it('matchesMode returns false when no bits overlap', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = TOGETHER;

		assert.equal(matchesMode(itemMask, currentMask), false);
	});

	it('excludesMode is inverse of matchesMode', () => {
		const itemMask = SHIPWRECKED;
		const currentMask = VANILLA | GIANTS | SHIPWRECKED;

		assert.equal(excludesMode(itemMask, currentMask), !matchesMode(itemMask, currentMask));
	});

	it('getModeName returns correct name for exact match', () => {
		const mask = VANILLA | GIANTS | SHIPWRECKED;
		const name = getModeName(mask, modes);

		assert.equal(name, 'Shipwrecked');
	});

	it('calculateModeMask combines base mode and character', () => {
		const mask = calculateModeMask('shipwrecked', 'warly', baseModes, characters);

		// Should include vanilla, giants, shipwrecked, and warly bits
		assert.equal(mask, VANILLA | GIANTS | SHIPWRECKED | WARLY);
	});

	it('calculateModeMask ignores character not applicable to base mode', () => {
		// Webber is not applicable to vanilla (only RoG+)
		const mask = calculateModeMask('vanilla', 'webber', baseModes, characters);

		// Should only be vanilla bit
		assert.equal(mask, VANILLA);
	});

	it('getActiveMultipliers returns Warly multipliers for Shipwrecked', () => {
		const multipliers = getActiveMultipliers(
			'shipwrecked',
			'warly',
			baseModes,
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
			'shipwrecked',
			null,
			baseModes,
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
			'warly',
			baseModes,
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
