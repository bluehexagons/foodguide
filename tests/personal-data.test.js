import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	createPersonalDataStore,
	editInventory,
	emptyPersonalData,
	parsePersonalData,
	personalDataKey,
} from '../html/personal-data.js';

const valid = id => ['meat', 'carrot', 'berries', 'honey'].includes(id);
const inventory = { id: 'default', name: 'My inventory', ingredients: ['carrot'] };
const selection = {
	version: 'together',
	character: null,
	dlc: { giants: false, shipwrecked: false },
};
const data = () => ({
	...emptyPersonalData(),
	inventories: [structuredClone(inventory)],
	dishes: [
		{
			id: 'dish',
			name: 'Dinner',
			ingredients: ['meat', 'meat', 'carrot', 'honey'],
			selection: structuredClone(selection),
		},
	],
});

test('personal backups round-trip inventories, repeated dish ingredients, names and game context', () => {
	assert.deepEqual(parsePersonalData(JSON.stringify(data()), valid), data());
	const input = data();
	input.inventories[0].ingredients.push('carrot');
	assert.deepEqual(parsePersonalData(JSON.stringify(input), valid).inventories[0].ingredients, [
		'carrot',
	]);
});

test('invalid or oversized personal backups are rejected in full', () => {
	for (const change of [
		value => {
			value.version = 2;
		},
		value => {
			value.inventories[0].ingredients.push('constructor');
		},
		value => {
			value.inventories[0].name = ' ';
		},
		value => {
			value.dishes[0].id = 'default';
		},
		value => {
			value.dishes[0].ingredients.pop();
		},
		value => {
			value.dishes[0].selection.character = 'constructor';
		},
		value => {
			value.dishes[0].selection.version = 'constructor';
		},
		value => {
			value.dishes[0].selection.dlc.giants = 'true';
		},
	]) {
		const value = data();
		change(value);
		assert.throws(() => parsePersonalData(JSON.stringify(value), valid));
	}
	assert.throws(() => parsePersonalData(' '.repeat(2_000_001), valid));
});

test('serialized changes merge stale views across tabs without losing additions or other inventories', async () => {
	const saved = new Map([[personalDataKey, JSON.stringify(data())]]);
	const storage = {
		getItem: key => saved.get(key) ?? null,
		setItem: (key, value) => saved.set(key, value),
	};
	let lock = Promise.resolve();
	const withLock = change => {
		const next = lock.then(change);
		lock = next;
		return next;
	};
	const options = { getStorage: () => storage, validIngredient: valid, withLock };
	const first = createPersonalDataStore(options),
		second = createPersonalDataStore(options);
	const a = first.update(value => editInventory(value, 'default', ['meat'], []));
	const b = second.update(value => editInventory(value, 'default', ['berries'], ['carrot']));
	const c = first.update(value => {
		if (!value.inventories.some(item => item.id === 'second')) {
			value.inventories.push({ id: 'second', name: 'Other world', ingredients: ['honey'] });
		}
	});
	await Promise.all([a, b, c]);
	first.refresh();
	second.refresh();
	assert.deepEqual(first.get(), second.get());
	assert.deepEqual(first.get().inventories[0].ingredients, ['meat', 'berries']);
	assert.deepEqual(first.get().inventories[1].ingredients, ['honey']);
	assert.equal(first.get().dishes.length, 1);
});

test('incoming storage changes keep pending edits visible; deleted inventories are not resurrected', async () => {
	const saved = new Map([[personalDataKey, JSON.stringify(data())]]);
	const storage = {
		getItem: key => saved.get(key) ?? null,
		setItem: (key, value) => saved.set(key, value),
	};
	let release;
	const gate = new Promise(resolve => {
		release = resolve;
	});
	const store = createPersonalDataStore({
		getStorage: () => storage,
		validIngredient: valid,
		withLock: async change => {
			await gate;
			await change();
		},
	});
	const pending = store.update(value => editInventory(value, 'default', ['meat'], []));
	store.refresh();
	assert.deepEqual(store.get().inventories[0].ingredients, ['carrot', 'meat']);
	const removed = data();
	removed.inventories = [];
	storage.setItem(personalDataKey, JSON.stringify(removed));
	store.refresh();
	assert.equal(store.get().inventories.length, 0);
	release();
	await pending;
	assert.equal(store.get().inventories.length, 0);
});

test('storage failures retain all local edits for export and do not silently resume stale durable data', async () => {
	let errors = 0;
	const storage = {
		getItem: () => JSON.stringify(data()),
		setItem: () => {
			throw new Error('Quota');
		},
	};
	const store = createPersonalDataStore({
		getStorage: () => storage,
		validIngredient: valid,
		onError: () => errors++,
	});
	await store.update(value => editInventory(value, 'default', ['meat'], []));
	await store.update(value => editInventory(value, 'default', ['berries'], []));
	store.refresh();
	assert.deepEqual(store.get().inventories[0].ingredients, ['carrot', 'meat', 'berries']);
	assert.equal(errors, 2);
	assert.deepEqual(parsePersonalData(JSON.stringify(store.get()), valid), store.get());
	assert.equal(
		await store.update(value => editInventory(value, 'default', ['unknown'], [])),
		false,
	);
});

test('concurrent additions cannot exceed backup limits or leave unsavable data in memory', async () => {
	const value = emptyPersonalData();
	for (let i = 0; i < 199; i++) {
		value.inventories.push({ id: `inv${i}`, name: `Inventory ${i}`, ingredients: [] });
	}
	const saved = new Map([[personalDataKey, JSON.stringify(value)]]);
	const storage = {
		getItem: key => saved.get(key) ?? null,
		setItem: (key, text) => saved.set(key, text),
	};
	let lock = Promise.resolve();
	const withLock = change => {
		const next = lock.then(change);
		lock = next;
		return next;
	};
	const first = createPersonalDataStore({
		getStorage: () => storage,
		validIngredient: valid,
		withLock,
	});
	const second = createPersonalDataStore({
		getStorage: () => storage,
		validIngredient: valid,
		withLock,
	});
	const a = first.update(latest =>
		latest.inventories.push({ id: 'first', name: 'First', ingredients: [] }),
	);
	const b = second.update(latest =>
		latest.inventories.push({ id: 'second', name: 'Second', ingredients: [] }),
	);
	assert.deepEqual(await Promise.all([a, b]), [true, false]);
	assert.equal(second.get().inventories.length, 200);
	assert.equal(
		second.get().inventories.some(item => item.id === 'second'),
		false,
	);
	assert.doesNotThrow(() => parsePersonalData(JSON.stringify(second.get()), valid));
});

test('unavailable dish ingredients and malformed durable data never overwrite a backup', async () => {
	assert.throws(() => parsePersonalData(JSON.stringify(data()), valid, () => false));
	let writes = 0;
	const text = '{"broken":';
	const store = createPersonalDataStore({
		getStorage: () => ({ getItem: () => text, setItem: () => writes++ }),
		validIngredient: valid,
	});
	await store.update(value =>
		value.inventories.push({ id: 'fresh', name: 'New', ingredients: ['meat'] }),
	);
	assert.equal(writes, 0);
	assert.equal(store.get().inventories[0].name, 'New');
	assert.doesNotThrow(() => parsePersonalData(JSON.stringify(store.get()), valid));
});
