import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

describe('sprite assets', () => {
	it('image filenames are unique on case-insensitive filesystems', () => {
		const filenames = readdirSync(new URL('../html/img/', import.meta.url), {
			withFileTypes: true,
		})
			.filter(entry => entry.isFile())
			.map(entry => entry.name.toLowerCase());
		assert.equal(new Set(filenames).size, filenames.length);
	});
});

describe('sprite manifest format', () => {
	it('records row counts for every generated sheet', () => {
		const source = readFileSync(
			new URL('../scripts/generate-sprites.js', import.meta.url),
			'utf8',
		);

		assert.match(source, /rows: sheetRows/);
		assert.match(source, /sheetRows\.push\(rows\)/);
	});
});
