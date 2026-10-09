import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VANILLA, GIANTS, TOGETHER } from '../html/constants.js';
import { food } from '../html/food.js';
import { createFoodSelectionResolver } from '../html/food-selection.js';

const resolve = createFoodSelectionResolver(food);

test('available selections preserve their existing variant and object identity', () => {
	assert.equal(resolve('meat', VANILLA, 0), food.meat);
	assert.equal(resolve('meat@together', TOGETHER, 0), food['meat@together']);
	assert.equal(resolve('mole', VANILLA | GIANTS, 0), food.mole);
});

test('shared raw, cooked, and dried ingredients follow the active game', () => {
	for (const id of ['meat', 'meat_cooked', 'meat_dried', 'butterflywings']) {
		assert.equal(resolve(id, TOGETHER, 0), food[`${id}@together`]);
		assert.equal(resolve(`${id}@together`, VANILLA, 0), food[id]);
	}
});

test('legacy DST identifiers resolve before selecting the active variant', () => {
	assert.equal(resolve('butterflywings_dst', TOGETHER, 0), food['butterflywings@together']);
	assert.equal(resolve('butterflywings_dst', VANILLA, 0), food.butterflywings);
});

test('unavailable ingredients and invalid collection keys cannot become selections', () => {
	assert.equal(resolve('batnose', VANILLA, 0), undefined);
	assert.equal(resolve('mole', VANILLA, 0), undefined);
	for (const id of ['missing', '0', 'length', 'filter', '__proto__', 'constructor']) {
		assert.equal(resolve(id, TOGETHER, 0), undefined, id);
	}
});
