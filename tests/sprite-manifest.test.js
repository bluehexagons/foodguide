import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('sprite manifest format', () => {
	it('records row counts for every generated sheet', () => {
		const source = readFileSync(new URL('../scripts/generate-sprites.js', import.meta.url), 'utf8');

		assert.match(source, /rows: sheetRows/);
		assert.match(source, /sheetRows\.push\(rows\)/);
	});
});
