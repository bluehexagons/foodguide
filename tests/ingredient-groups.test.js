import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupIngredients } from '../html/ingredient-groups.js';

test('ingredient type grouping assigns mixed tags once and preserves the chosen order', () => {
	const items = [
		{ name: 'Berries', fruit: 1 },
		{ name: 'Fish', fish: 1, meat: 0.5 },
		{ name: 'Monster Fish', monster: 1, fish: 1, meat: 1 },
		{ name: 'Cooked Berries', fruit: 1, monster: false },
		{ name: 'Unknown', meat: 0 },
	];
	const grouped = groupIngredients(items, 'type');
	assert.deepEqual(
		grouped.map(group => group.key),
		['fish', 'fruit', 'monster', 'other'],
	);
	assert.deepEqual(
		grouped.flatMap(group => group.items).map(item => item.name),
		['Fish', 'Berries', 'Cooked Berries', 'Monster Fish', 'Unknown'],
	);
	assert.deepEqual(
		items.map(item => item.name),
		['Berries', 'Fish', 'Monster Fish', 'Cooked Berries', 'Unknown'],
	);
});

test('search relevance can put the group containing the strongest match first', () => {
	const items = [
		{ name: 'Meat', meat: 1 },
		{ name: 'Fish Meat', fish: 1, meat: 0.5 },
	];
	assert.deepEqual(
		groupIngredients(items, 'type', true).map(group => group.key),
		['meat', 'fish'],
	);
});

test('preparation groups omit empty sections and invalid preferences fall back to no grouping', () => {
	const items = [
		{ name: 'Jerky', preparationType: 'dried' },
		{ name: 'Meat', preparationType: 'raw' },
	];
	assert.deepEqual(
		groupIngredients(items, 'preparation').map(group => group.key),
		['raw', 'dried'],
	);
	assert.deepEqual(groupIngredients([], 'type'), []);
	for (const preference of ['none', 'constructor', 'missing']) {
		assert.deepEqual(groupIngredients(items, preference), [{ key: 'all', items }]);
	}
});
