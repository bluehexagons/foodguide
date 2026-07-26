import assert from 'node:assert';
import { describe, it } from 'node:test';

import { defaultStatMultipliers, TOGETHER } from '../html/constants.js';
import { food } from '../html/food.js';
import { createRecipeAnalyzer } from '../html/recipe-analyzer.js';

const createScheduler = () => {
	let nextId = 0;
	const pending = new Map();

	return {
		schedule(callback) {
			const id = ++nextId;
			pending.set(id, callback);
			return id;
		},
		cancel(id) {
			pending.delete(id);
		},
		runNext() {
			const next = pending.entries().next();
			if (next.done) {
				return false;
			}
			const [id, callback] = next.value;
			pending.delete(id);
			callback();
			return true;
		},
		get size() {
			return pending.size;
		},
	};
};

const analyzerOptions = scheduler => ({
	getModeMask: () => TOGETHER,
	getCharMask: () => 0,
	getStatMultipliers: () => defaultStatMultipliers,
	schedule: callback => scheduler.schedule(callback),
	cancelSchedule: id => scheduler.cancel(id),
	now: () => 0,
});

const enoughIngredientsForMultipleBatches = [
	food.honey,
	food.meat,
	food.ice,
	food.carrot,
	food.twigs,
	food.bird_egg,
];

describe('recipe analyzer', () => {
	it('pauses and resumes scheduled combination work', () => {
		const scheduler = createScheduler();
		const { analyze } = createRecipeAnalyzer(analyzerOptions(scheduler));
		let completed = 0;

		const control = analyze(
			enoughIngredientsForMultipleBatches,
			() => {},
			() => {},
			() => completed++,
		);

		assert.strictEqual(scheduler.size, 1);
		assert.strictEqual(control.isComplete(), false);

		control.pause();
		assert.strictEqual(control.isPaused(), true);
		assert.strictEqual(scheduler.size, 0);

		control.resume();
		assert.strictEqual(control.isComplete(), true);
		assert.strictEqual(completed, 1);
	});

	it('cancels pending work without invoking completion', () => {
		const scheduler = createScheduler();
		const { analyze } = createRecipeAnalyzer(analyzerOptions(scheduler));
		let completed = 0;

		const control = analyze(
			enoughIngredientsForMultipleBatches,
			() => {},
			() => {},
			() => completed++,
		);
		control.cancel();

		assert.strictEqual(control.isCancelled(), true);
		assert.strictEqual(scheduler.size, 0);
		assert.strictEqual(scheduler.runNext(), false);
		assert.strictEqual(completed, 0);
	});

	it('finishes an empty collection synchronously', () => {
		const scheduler = createScheduler();
		const { analyze } = createRecipeAnalyzer(analyzerOptions(scheduler));
		let completed = 0;

		const control = analyze(
			[],
			() => {},
			() => {},
			() => completed++,
		);

		assert.strictEqual(control.isComplete(), true);
		assert.strictEqual(scheduler.size, 0);
		assert.strictEqual(completed, 1);
	});
});
