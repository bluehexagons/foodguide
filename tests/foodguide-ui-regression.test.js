import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foodguideSource = readFileSync(new URL('../html/foodguide.js', import.meta.url), 'utf8');
const componentsCss = readFileSync(new URL('../html/style/components.css', import.meta.url), 'utf8');

describe('foodguide UI regressions', () => {
	it('ingredient picker refresh reads the sort dropdown through the shared dropdown API', () => {
		assert.match(foodguideSource, /const sortType = sortControls\.getValue\(\);/);
		assert.doesNotMatch(foodguideSource, /sortControls\.getSortType\(\)/);
	});

	it('ingredient picker supports right-click remove without opening the browser context menu', () => {
		assert.match(foodguideSource, /const isRemoval = e\.button === 2;/);
		assert.match(foodguideSource, /result = removeSlotById\(id\);/);
		assert.match(
			foodguideSource,
			/else if \(!limited && slots\.indexOf\(id\) !== -1\) {\s+result = removeSlotById\(id\);/m,
		);
		assert.match(
			foodguideSource,
			/li\.addEventListener\('contextmenu', suppressIngredientContextMenu, false\);/,
		);
	});

	it('ingredient picker flashes an item-level error when add or remove cannot apply', () => {
		assert.match(foodguideSource, /const flashIngredientActionError = target =>/);
		assert.match(foodguideSource, /flashIngredientActionError\(target\);/);
		assert.match(componentsCss, /\.ingredient-action-error/);
		assert.match(componentsCss, /@keyframes ingredient-action-error/);
	});
});
