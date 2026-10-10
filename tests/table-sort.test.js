import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareItemNames, sortTableRows } from '../html/table-sort.js';
import { food } from '../html/food.js';

test('numeric table sorting preserves negative values and puts missing values after results', () => {
	const missing = { name: 'Missing' };
	const rows = [
		missing,
		{ name: 'Negative', health: -5 },
		{ name: 'Zero', health: 0 },
		{ name: 'Largest', health: 20 },
		{ name: 'Numeric text', health: '10' },
	];
	sortTableRows(rows, 'health');
	assert.deepEqual(
		rows.map(row => row.name),
		['Largest', 'Numeric text', 'Zero', 'Negative', 'Missing'],
	);
	assert.equal(rows.at(-1), missing);
});

test('sorting keeps summary rows fixed in both directions and preserves the shared array', () => {
	const total = { name: 'Sum:Total', health: 900 };
	const potential = { name: 'Sum:Potential', health: 1000 };
	const rows = [total, potential, { name: 'Low', health: 1 }, { name: 'High', health: 10 }];
	const shared = rows;
	sortTableRows(rows, 'health', { summaryRows: 2 });
	assert.deepEqual(
		rows.map(row => row.name),
		['Sum:Total', 'Sum:Potential', 'High', 'Low'],
	);
	sortTableRows(rows, 'health', { summaryRows: 2, invert: true });
	assert.deepEqual(
		rows.map(row => row.name),
		['Sum:Total', 'Sum:Potential', 'Low', 'High'],
	);
	assert.equal(rows, shared);
	assert.equal(rows[0], total);
	assert.equal(rows[1], potential);
});

test('name sorting groups preparation variants and orders raw food before its cooked form', () => {
	const raw = { name: 'Berries' };
	const cooked = { name: 'Roasted Berries', basename: 'Berries', raw };
	const rows = [cooked, { name: 'Carrot' }, raw, { name: 'Apple' }];
	sortTableRows(rows, 'name');
	assert.deepEqual(
		rows.map(row => row.name),
		['Apple', 'Berries', 'Roasted Berries', 'Carrot'],
	);
	assert.equal(compareItemNames(raw, cooked), -1);
	assert.equal(compareItemNames(cooked, raw), 1);
	assert.equal(compareItemNames(raw, raw), 0);
});

test('numeric sorting uses adjusted values while preserving summaries and missing values', () => {
	const summary = { name: 'Sum:Total', health: 900 };
	const rows = [
		summary,
		{ name: 'Raw', health: 10, multiplier: 0.7 },
		{ name: 'Prepared', health: 8, multiplier: 0.9 },
		{ name: 'Cannot eat', health: 20, multiplier: 0 },
		{ name: 'Missing', multiplier: 0.7 },
	];
	const numericValue = (item, key) => item[key] * item.multiplier;
	sortTableRows(rows, 'health', { summaryRows: 1, numericValue });
	assert.deepEqual(
		rows.map(row => row.name),
		['Sum:Total', 'Prepared', 'Raw', 'Cannot eat', 'Missing'],
	);
	sortTableRows(rows, 'health', { summaryRows: 1, invert: true, numericValue });
	assert.deepEqual(
		rows.map(row => row.name),
		['Sum:Total', 'Cannot eat', 'Raw', 'Prepared', 'Missing'],
	);
	assert.equal(rows[0], summary);
});

test('empty tables and tables containing only summary rows remain sortable', () => {
	const empty = [];
	sortTableRows(empty, 'name');
	assert.deepEqual(empty, []);
	const rows = [{ name: 'Sum:Total' }, { name: 'Sum:Potential' }];
	const original = [...rows];
	sortTableRows(rows, 'name', { summaryRows: 2, invert: true });
	assert.deepEqual(rows, original);
});

test('repeated sorting preserves tied rows and leaves missing values last in both directions', () => {
	for (const sortBy of ['name', 'health']) {
		const first = { name: 'Tied', health: 5 };
		const second = { name: 'Tied', health: 5 };
		const rows = [first, { name: 'Other', health: 10 }, second, { name: 'Missing' }];
		for (const invert of [false, true]) {
			sortTableRows(rows, sortBy, { invert });
			const sorted = [...rows];
			sortTableRows(rows, sortBy, { invert });
			assert.deepEqual(rows, sorted);
			assert.ok(rows.indexOf(first) < rows.indexOf(second));
			if (sortBy === 'health') {
				assert.equal(rows.at(-1).name, 'Missing');
			}
		}
	}
});

test('sibling preparation variants have a consistent order regardless of their input order', () => {
	const raw = { name: 'Berries' };
	const cooked = { name: 'Roasted Berries', basename: 'Berries', raw };
	const otherCooked = { name: 'Grilled Berries', basename: 'Berries', raw };
	for (const rows of [
		[cooked, raw, otherCooked],
		[otherCooked, cooked, raw],
		[raw, otherCooked, cooked],
	]) {
		sortTableRows(rows, 'name');
		assert.deepEqual(rows, [raw, otherCooked, cooked]);
	}
});

test('the name comparator orders actual food variants consistently in both directions', () => {
	const items = Array.from(food);
	for (const a of items) {
		for (const b of items) {
			assert.equal(
				Math.sign(compareItemNames(a, b)) + Math.sign(compareItemNames(b, a)),
				0,
				`${a.key} and ${b.key}`,
			);
		}
	}
});
