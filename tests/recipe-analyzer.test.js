import assert from 'node:assert';
import { describe, it } from 'node:test';

import { defaultStatMultipliers, TOGETHER, VANILLA, baseModes } from '../html/constants.js';
import { food } from '../html/food.js';
import { createRecipeAnalyzer } from '../html/recipe-analyzer.js';
import { combinationGenerator, createRecipeCalculator } from '../html/recipe-calculator.js';

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
	it('agrees with the Simulator on winning priorities and alternate outcomes', () => {
		for (const mode of Object.values(baseModes).map(mode => mode.mask)) {
			const scheduler = createScheduler();
			const options = { ...analyzerOptions(scheduler), getModeMask: () => mode };
			const { getRecipes } = createRecipeCalculator(options);
			const items = [
				...enoughIngredientsForMultipleBatches,
				food.butterflywings,
				food.dragonfruit,
			];
			const expected = [];
			const next = combinationGenerator(items.length, combination => {
				const ingredients = combination.map(index => items[index]);
				const candidates = getRecipes(ingredients).filter(
					recipe => 'id' in recipe && !recipe.trash && recipe.foodtype !== 'roughage',
				);
				const winners = candidates.filter(
					recipe => recipe.priority === candidates[0]?.priority,
				);
				for (const recipe of winners) {
					expected.push({
						recipe: recipe.id,
						ingredients: ingredients.map(item => item.key),
						multiple: winners.length > 1,
					});
				}
			});
			while (next(20)) {}
			const results = [];
			createRecipeAnalyzer(options).analyze(items, result =>
				results.push({
					recipe: result.recipe.id,
					ingredients: result.ingredients.map(item => item.key),
					multiple: result.multiple,
				}),
			);
			while (scheduler.runNext()) {}
			assert.deepStrictEqual(results, expected);
			assert.ok(results.length > 0);
		}
	});

	it('reports every checked combination, including combinations with no valid recipe', () => {
		const scheduler = createScheduler();
		const snapshots = [];
		const results = [];
		let completed = 0;
		const control = createRecipeAnalyzer(analyzerOptions(scheduler)).analyze(
			[food.twigs],
			result => results.push(result),
			progress => snapshots.push(progress),
			() => completed++,
		);
		assert.strictEqual(control.isComplete(), true);
		assert.deepStrictEqual(results, []);
		assert.deepStrictEqual(snapshots, [{ checked: 1, total: 1 }]);
		assert.strictEqual(completed, 1);
	});

	it('yields between combinations when its time budget expires and resumes at the same position', () => {
		const scheduler = createScheduler();
		let clock = 0;
		const snapshots = [];
		const analyzer = createRecipeAnalyzer({
			...analyzerOptions(scheduler),
			now: () => clock++,
		});
		const control = analyzer.analyze(
			enoughIngredientsForMultipleBatches,
			() => {},
			progress => snapshots.push(progress),
		);
		assert.ok(snapshots[0].checked <= 16);
		control.pause();
		assert.strictEqual(scheduler.size, 0);
		control.resume();
		while (scheduler.runNext()) {}
		assert.strictEqual(control.isComplete(), true);
		assert.deepStrictEqual(snapshots.at(-1), { checked: 126, total: 126 });
		for (let index = 1; index < snapshots.length; index++) {
			assert.ok(snapshots[index].checked > snapshots[index - 1].checked);
			assert.ok(snapshots[index].checked - snapshots[index - 1].checked <= 16);
		}
	});

	it('honors cancellation from a result or progress callback without scheduling or completing', () => {
		for (const cancelFrom of ['result', 'progress']) {
			const scheduler = createScheduler();
			let completed = 0;
			let control = null;
			const cancel = () => control?.cancel();
			control = createRecipeAnalyzer(analyzerOptions(scheduler)).analyze(
				enoughIngredientsForMultipleBatches,
				cancelFrom === 'result' ? cancel : () => {},
				cancelFrom === 'progress' ? cancel : () => {},
				() => completed++,
			);
			assert.strictEqual(scheduler.runNext(), true);
			assert.strictEqual(control.isCancelled(), true);
			assert.strictEqual(scheduler.size, 0);
			assert.strictEqual(control.isComplete(), false);
			assert.strictEqual(completed, 0);
		}
	});

	it('snapshots mode and mutable multipliers across a pause', () => {
		const run = changeConfiguration => {
			const scheduler = createScheduler();
			const multipliers = { ...defaultStatMultipliers };
			let mode = TOGETHER;
			let modifyItem = () => ({ health: 2, hunger: 3, sanity: 4 });
			const results = [];
			const control = createRecipeAnalyzer({
				...analyzerOptions(scheduler),
				getModeMask: () => mode,
				getStatMultipliers: () => multipliers,
				getItemModifiers: () => modifyItem,
			}).analyze(enoughIngredientsForMultipleBatches, result => results.push(result));
			control.pause();
			if (changeConfiguration) {
				mode = VANILLA;
				multipliers.raw = 0.1;
				multipliers.cooked = 0.1;
				modifyItem = () => ({ health: 0, hunger: 0, sanity: 0 });
			}
			control.resume();
			while (scheduler.runNext()) {}
			assert.strictEqual(control.isComplete(), true);
			return results;
		};
		assert.deepStrictEqual(run(true), run(false));
	});

	it('honors a pause from progress without leaving scheduled work behind', () => {
		const scheduler = createScheduler();
		let control = null;
		let completed = 0;
		control = createRecipeAnalyzer(analyzerOptions(scheduler)).analyze(
			[...enoughIngredientsForMultipleBatches, food.monstermeat, food.dragonfruit],
			() => {},
			() => control?.pause(),
			() => completed++,
		);
		assert.strictEqual(scheduler.runNext(), true);
		assert.strictEqual(control.isPaused(), true);
		assert.strictEqual(scheduler.size, 0);
		control.resume();
		assert.strictEqual(control.isComplete(), true);
		assert.strictEqual(control.isPaused(), false);
		assert.strictEqual(completed, 1);
	});

	it('delivers each result once in order across many drained batches', () => {
		const run = smallBatches => {
			const scheduler = createScheduler();
			let clock = 0;
			let batches = 0;
			const results = [];
			const { analyze } = createRecipeAnalyzer({
				...analyzerOptions(scheduler),
				...(smallBatches ? { desiredBlockTime: 1, now: () => (clock += 10) } : {}),
			});
			const control = analyze(
				enoughIngredientsForMultipleBatches,
				result => results.push(result),
				() => batches++,
			);
			while (scheduler.runNext()) {
				assert.ok(batches < 1000);
			}
			assert.equal(control.isComplete(), true);
			return { batches, results };
		};
		const baseline = run(false);
		const batched = run(true);
		assert.ok(batched.batches > baseline.batches);
		assert.ok(batched.results.length > 0);
		assert.deepEqual(batched.results, baseline.results);
		const ids = batched.results.map(
			result => `${result.recipe.id}:${result.ingredients.map(item => item.key).join(',')}`,
		);
		assert.equal(new Set(ids).size, ids.length);
	});

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
