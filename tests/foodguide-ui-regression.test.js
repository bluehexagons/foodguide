import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foodguideSource = readFileSync(new URL('../html/foodguide.js', import.meta.url), 'utf8');

describe('foodguide UI regressions', () => {
	it('ingredient picker refresh reads the sort dropdown through the shared dropdown API', () => {
		assert.match(foodguideSource, /const sortType = sortControls\.getValue\(\);/);
		assert.doesNotMatch(foodguideSource, /sortControls\.getSortType\(\)/);
	});
});
