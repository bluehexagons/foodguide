import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foodguideSource = readFileSync(new URL('../html/foodguide.js', import.meta.url), 'utf8');
const componentsCss = readFileSync(
	new URL('../html/style/components.css', import.meta.url),
	'utf8',
);
const sortableTableSource = readFileSync(
	new URL('../html/sortable-table.js', import.meta.url),
	'utf8',
);
const dropdownSource = readFileSync(new URL('../html/dropdown.js', import.meta.url), 'utf8');

describe('foodguide UI regressions', () => {
	it('ingredient picker refresh reads the sort dropdown through the shared dropdown API', () => {
		assert.match(foodguideSource, /const sortType = sortControls\.getValue\(\);/);
		assert.doesNotMatch(foodguideSource, /sortControls\.getSortType\(\)/);
	});

	it('refreshes ingredient results once for every value change, including pasted text', () => {
		assert.match(foodguideSource, /picker\.addEventListener\('input', refreshPicker\);/);
		assert.doesNotMatch(foodguideSource, /picker\.addEventListener\('keydown'/);
		assert.doesNotMatch(foodguideSource, /picker\.addEventListener\('keyup'/);
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

	it('cancels an in-progress statistics calculation when results are cleared', () => {
		assert.match(foodguideSource, /calculationControl\?\.cancel\(\);/);
		assert.match(foodguideSource, /makableSummary\.appendChild\(deleteButton\);/);
	});

	it('shares one resize listener across rebuilt responsive tables', () => {
		const resizeListeners = foodguideSource.match(/window\.addEventListener\('resize'/g) || [];

		assert.strictEqual(resizeListeners.length, 1);
		assert.match(foodguideSource, /const responsiveTables = new Set\(\);/);
		assert.match(foodguideSource, /responsiveTables\.delete\(tableContainer\);/);
	});

	it('keeps the shared table renderer outside the page controller', () => {
		assert.match(
			foodguideSource,
			/import \{ createSortableTableFactory \} from '\.\/sortable-table\.js';/,
		);
		assert.match(foodguideSource, /createSortableTableFactory\(\{/);
		assert.doesNotMatch(foodguideSource, /const makeSortableTable = \(/);
		assert.match(sortableTableSource, /export const createSortableTableFactory =/);
	});

	it('keeps dropdown state and guarded preference storage outside the page controller', () => {
		assert.match(
			foodguideSource,
			/import \{ createDropdownFactory \} from '\.\/dropdown\.js';/,
		);
		assert.match(foodguideSource, /const createDropdown = createDropdownFactory\(\{/);
		assert.doesNotMatch(foodguideSource, /const createDropdown = \(options\) =>/);
		assert.match(dropdownSource, /export const createDropdownFactory/);
		assert.match(dropdownSource, /Unable to save preference/);
	});

	it('applies raw and cooked stat multipliers when showing cooking deltas', () => {
		assert.match(
			foodguideSource,
			/const rawHealth = \(\(itemMods\.health \?\? item\.health\) \|\| 0\) \* mult;/,
		);
		assert.match(
			foodguideSource,
			/const rawHunger = \(\(itemMods\.hunger \?\? item\.hunger\) \|\| 0\) \* mult;/,
		);
		assert.match(
			foodguideSource,
			/const rawSanity = \(\(itemMods\.sanity \?\? item\.sanity\) \|\| 0\) \* mult;/,
		);
	});
});
