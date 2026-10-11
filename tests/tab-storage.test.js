import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTabStorage } from '../html/tab-storage.js';
import { createSavedStateStore } from '../html/preferences.js';

const storage = () => {
	const values = new Map();
	return {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: key => values.delete(key),
	};
};

test('tabs seed from durable defaults and independently restore snapshots after competing writes', () => {
	const defaults = storage();
	defaults.setItem(
		'foodGuideState',
		JSON.stringify({ version: 'together', pickers: [['meat'], ['carrot']] }),
	);
	const firstSession = storage();
	const secondSession = storage();
	const first = createSavedStateStore({
		getStorage: () =>
			createTabStorage(
				() => firstSession,
				() => defaults,
			),
	});
	const second = createSavedStateStore({
		getStorage: () =>
			createTabStorage(
				() => secondSession,
				() => defaults,
			),
	});
	assert.deepEqual(first.load(), second.load());
	first.update(state => {
		state.version = 'hamlet';
		state.pickers[0] = ['berries'];
	});
	second.update(state => {
		state.pickers[1] = ['honey'];
	});
	assert.equal(first.load().version, 'hamlet');
	assert.equal(second.load().version, 'together');
	assert.deepEqual(first.load().pickers, [['berries'], ['carrot']]);
	assert.deepEqual(second.load().pickers, [['meat'], ['honey']]);
	const fresh = createTabStorage(storage, () => defaults);
	assert.equal(JSON.parse(fresh.getItem('foodGuideState')).version, 'together');
});

test('tab-local view settings ignore defaults written by another tab, including across reloads', () => {
	const defaults = storage();
	const session = storage();
	defaults.setItem('foodGuideDensity', '["compact"]');
	const tab = createTabStorage(
		() => session,
		() => defaults,
	);
	assert.equal(tab.getItem('foodGuideDensity'), '["compact"]');
	defaults.setItem('foodGuideDensity', '["cozy"]');
	assert.equal(
		createTabStorage(
			() => session,
			() => defaults,
		).getItem('foodGuideDensity'),
		'["compact"]',
	);
	tab.setItem('foodGuideDensity', '["normal"]');
	assert.equal(defaults.getItem('foodGuideDensity'), '["normal"]');
});

test('blocked storage retains independent in-memory work and one failing store does not block the other', () => {
	const blocked = () => {
		throw new Error('blocked');
	};
	const tab = createTabStorage(blocked, blocked);
	tab.setItem('foodGuideState', '{}');
	assert.equal(tab.getItem('foodGuideState'), '{}');
	tab.removeItem('foodGuideState');
	assert.equal(tab.getItem('foodGuideState'), null);
	const defaults = storage();
	createTabStorage(blocked, () => defaults).setItem('foodGuideState', '{"version":"hamlet"}');
	assert.equal(defaults.getItem('foodGuideState'), '{"version":"hamlet"}');
	const session = storage();
	createTabStorage(() => session, blocked).setItem('foodGuideState', '{"version":"together"}');
	assert.equal(session.getItem('foodGuideState'), '{"version":"together"}');
});
