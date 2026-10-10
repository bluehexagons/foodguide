import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupConsecutiveRows, pageRange } from '../html/table-pagination.js';

test('a long recipe run cannot consume the overview or truncate its count', () => {
	const rows = Array.from({ length: 620 }, (_, index) => ({ recipe: 'stew', index }));
	rows.push({ recipe: 'pie', index: 620 }, { recipe: 'stew', index: 621 });
	const groups = groupConsecutiveRows(rows, row => row.recipe);
	assert.deepEqual(
		groups.map(group => [group.key, group.items.length]),
		[
			['stew', 620],
			['pie', 1],
			['stew', 1],
		],
	);
	const overview = pageRange(groups.length, 0, 25);
	assert.equal(overview.end, 3);
	const last = pageRange(groups[0].items.length, 10000, 25);
	assert.deepEqual(
		groups[0].items.slice(last.start, last.end).map(row => row.index),
		Array.from({ length: 20 }, (_, index) => index + 600),
	);
});

test('all filtered combinations remain reachable in their sorted order across both page levels', () => {
	const rows = Array.from({ length: 9100 }, (_, index) => ({
		recipe: String(Math.floor(index / 37) % 13),
		index,
	}));
	const matches = row => row.index % 7 !== 0;
	const groups = groupConsecutiveRows(rows, row => row.recipe, matches);
	const visited = [];
	for (let page = 0; page < Math.ceil(groups.length / 25); page++) {
		const range = pageRange(groups.length, page, 25);
		for (const group of groups.slice(range.start, range.end)) {
			for (
				let detailPage = 0;
				detailPage < Math.ceil(group.items.length / 25);
				detailPage++
			) {
				const details = pageRange(group.items.length, detailPage, 25);
				visited.push(...group.items.slice(details.start, details.end));
			}
		}
	}
	assert.deepEqual(visited, rows.filter(matches));
});

test('filtering joins newly consecutive recipes and handles empty or out-of-range pages', () => {
	const first = { recipe: 'stew' };
	const last = { recipe: 'stew' };
	const groups = groupConsecutiveRows(
		[first, { recipe: 'pie' }, last],
		row => row.recipe,
		row => row.recipe !== 'pie',
	);
	assert.deepEqual(
		groups.map(group => group.items),
		[[first, last]],
	);
	assert.deepEqual(pageRange(0, 20, 25), { page: 0, pages: 1, start: 0, end: 0 });
	assert.deepEqual(pageRange(51, -1, 25), { page: 0, pages: 3, start: 0, end: 25 });
	assert.deepEqual(pageRange(51, 2, 25), { page: 2, pages: 3, start: 50, end: 51 });
});
