import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	createSavedStateStore,
	parseSavedState,
	restoreGameSelection,
} from '../html/preferences.js';

const defaultSelection = {
	version: 'together',
	dlc: { giants: false, shipwrecked: false },
	character: null,
};

test('saved state rejects incompatible values and retains legacy mode settings', () => {
	for (const value of ['null', '[]', '42', '"settings"']) {
		assert.deepEqual(parseSavedState(value), {});
	}
	assert.deepEqual(
		parseSavedState(
			JSON.stringify({
				version: [],
				character: {},
				modeMask: 23,
				baseMode: 'shipwrecked',
				dlc: { giants: true, shipwrecked: 'false' },
				pickers: [['carrot', 12, null], {}],
			}),
		),
		{
			modeMask: 23,
			baseMode: 'shipwrecked',
			dlc: { giants: true, shipwrecked: false },
			pickers: [['carrot', null, null], []],
		},
	);
	assert.throws(() => parseSavedState('{'), SyntaxError);
});

test('current game settings take precedence over both legacy formats', () => {
	assert.deepEqual(
		restoreGameSelection({
			version: 'dontstarve',
			dlc: { giants: true, shipwrecked: false },
			character: 'webber',
			baseMode: 'hamlet',
			modeMask: 136,
		}),
		{
			version: 'dontstarve',
			dlc: { giants: true, shipwrecked: false },
			character: 'webber',
		},
	);
	assert.deepEqual(
		restoreGameSelection({ version: 'together', character: null }),
		defaultSelection,
	);
});

test('named legacy modes restore their game and DLC selection before numeric masks', () => {
	for (const [baseMode, version, giants, shipwrecked] of [
		['vanilla', 'dontstarve', false, false],
		['giants', 'dontstarve', true, false],
		['shipwrecked', 'dontstarve', true, true],
		['hamlet', 'hamlet', false, false],
		['together', 'together', false, false],
	]) {
		assert.deepEqual(
			restoreGameSelection({ baseMode, character: 'warly', modeMask: 1 }),
			{ version, dlc: { giants, shipwrecked }, character: 'warly' },
			baseMode,
		);
	}
});

test('historical numeric masks retain their original version and character meanings', () => {
	for (const [modeMask, version, giants, shipwrecked, character] of [
		[1, 'dontstarve', false, false, null],
		[3, 'dontstarve', true, false, null],
		[7, 'dontstarve', true, true, null],
		[8, 'together', false, false, null],
		[23, 'dontstarve', true, true, 'warly'],
		[39, 'hamlet', false, false, null],
		[119, 'hamlet', false, false, 'warly'],
		[136, 'together', false, false, 'warly'],
	]) {
		assert.deepEqual(
			restoreGameSelection({ modeMask }),
			{ version, dlc: { giants, shipwrecked }, character },
			String(modeMask),
		);
	}
});

test('unknown and inherited settings fall back without blocking valid legacy settings', () => {
	for (const name of ['__proto__', 'constructor', 'toString', 'missing']) {
		assert.deepEqual(restoreGameSelection({ version: name, baseMode: name }), defaultSelection);
		assert.deepEqual(
			restoreGameSelection({ version: 'together', character: name }),
			defaultSelection,
		);
		assert.deepEqual(restoreGameSelection({ version: name, baseMode: name, modeMask: 23 }), {
			version: 'dontstarve',
			dlc: { giants: true, shipwrecked: true },
			character: 'warly',
		});
	}
	for (const modeMask of [null, 0, -1, 999, Infinity]) {
		assert.deepEqual(restoreGameSelection({ modeMask }), defaultSelection);
	}
});

test('restored DLC settings do not share mutable state with their input or other loads', () => {
	const state = { version: 'dontstarve', dlc: { giants: true, shipwrecked: false } };
	const restored = restoreGameSelection(state);
	restored.dlc.giants = false;
	assert.equal(state.dlc.giants, true);
	const legacy = restoreGameSelection({ baseMode: 'shipwrecked' });
	legacy.dlc.shipwrecked = false;
	assert.equal(restoreGameSelection({ baseMode: 'shipwrecked' }).dlc.shipwrecked, true);
});

function makeStorage(initial) {
	const values = new Map(initial === undefined ? [] : [['foodGuideState', initial]]);
	return {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: key => values.delete(key),
	};
}

test('saved preference updates merge tabs and multiple pickers from the latest stored state', () => {
	const storage = makeStorage(JSON.stringify({ version: 'hamlet' }));
	const store = createSavedStateStore({ getStorage: () => storage });
	const snapshot = store.load();
	store.update(state => {
		state.activeTab = 'discovery';
	});
	for (const [index, picker] of [['carrot'], ['meat', 'berries']].entries()) {
		store.update(state => {
			state.pickers ??= [];
			state.pickers[index] = picker;
		});
	}
	assert.deepEqual(snapshot, { version: 'hamlet' });
	assert.deepEqual(store.load(), {
		activeTab: 'discovery',
		version: 'hamlet',
		pickers: [['carrot'], ['meat', 'berries']],
	});
});

test('malformed stored JSON is reported, cleared, and replaced by the next update', () => {
	const storage = makeStorage('{');
	const errors = [];
	const store = createSavedStateStore({
		getStorage: () => storage,
		onError: error => errors.push(error),
	});
	assert.deepEqual(store.load(), {});
	assert.equal(storage.getItem('foodGuideState'), null);
	assert(errors[0] instanceof SyntaxError);
	storage.setItem('foodGuideState', '{');
	store.update(state => {
		state.activeTab = 'about';
	});
	assert.deepEqual(store.load(), { activeTab: 'about' });
	assert.equal(errors.length, 2);
});

test('blocked storage and failed writes do not prevent the guide from working', () => {
	const failure = new Error('Storage is unavailable');
	const errors = [];
	const store = createSavedStateStore({
		getStorage: () => {
			throw failure;
		},
		onError: error => errors.push(error),
	});
	assert.deepEqual(store.load(), {});
	assert.doesNotThrow(() => store.update(() => assert.fail('Cannot update unavailable storage')));
	assert.deepEqual(errors, [failure, failure]);
	const storage = makeStorage();
	const readOnly = createSavedStateStore({
		getStorage: () => ({
			...storage,
			setItem: () => {
				throw failure;
			},
		}),
	});
	assert.doesNotThrow(() =>
		readOnly.update(state => {
			state.activeTab = 'about';
		}),
	);
	assert.deepEqual(readOnly.load(), {});
});
