import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	applyGuideRoute,
	formatGuideRoute,
	guideTab,
	parseGuideRoute,
} from '../html/navigation.js';

const selection = {
	version: 'dontstarve',
	dlc: { giants: true, shipwrecked: true },
	character: 'warly',
};

test('section links round-trip game context and repeated ingredients without appearance preferences', () => {
	const route = { tab: 'simulator', selection, ingredients: ['meat', 'meat', 'carrot', null] };
	assert.deepEqual(parseGuideRoute(formatGuideRoute(route)), route);
	assert.deepEqual(parseGuideRoute('#help'), { tab: 'about' });
	assert.equal(guideTab('constructor'), 'simulator');
	assert.deepEqual(parseGuideRoute('#statistics'), { tab: 'statistics' });
	assert.equal(parseGuideRoute('#constructor?game=together'), null);
	assert.equal(parseGuideRoute(`#simulator?${'a'.repeat(8192)}`), null);
});

test('URL state overrides only the matching saved picker and validates game and character names', () => {
	const state = {
		activeTab: 'about',
		version: 'hamlet',
		character: 'warly',
		pickers: [['meat'], ['carrot']],
	};
	applyGuideRoute(
		state,
		parseGuideRoute('#simulator?game=together&character=constructor&ingredients='),
	);
	assert.deepEqual(state, {
		activeTab: 'simulator',
		version: 'together',
		character: null,
		dlc: { giants: false, shipwrecked: false },
		pickers: [[null], ['carrot']],
	});
	assert.deepEqual(parseGuideRoute('#about?game=constructor'), { tab: 'about' });
	assert.equal(
		parseGuideRoute('#about?game=together&character=warly').selection.character,
		'warly',
	);
	assert.equal(
		parseGuideRoute('#about?game=dontstarve&character=warly').selection.character,
		null,
	);
	assert.equal(
		parseGuideRoute('#about?game=together&dlc=giants,shipwrecked').selection.dlc.giants,
		false,
	);
});

test('inventory and highlights preserve text safely, with bounded and deduplicated URL inputs', () => {
	const inventory = { tab: 'discovery', selection, inventory: ['meat', 'carrot'] };
	assert.deepEqual(parseGuideRoute(formatGuideRoute(inventory)), inventory);
	assert.deepEqual(parseGuideRoute('#discovery?inventory=meat,meat,,carrot').inventory, [
		'meat',
		'carrot',
	]);
	assert.equal(
		parseGuideRoute(
			`#discovery?inventory=${Array(300)
				.fill('meat')
				.map((_, i) => `meat${i}`)
				.join(',')}`,
		).inventory.length,
		256,
	);
	const route = { tab: 'crockpot', highlight: 'ingredient:Fish & Chips' };
	assert.deepEqual(parseGuideRoute(formatGuideRoute(route)), route);
	assert.equal(parseGuideRoute(`#foodlist?highlight=${'x'.repeat(257)}`).highlight, undefined);
	assert.equal(
		parseGuideRoute('#simulator?ingredients=meat,meat,meat,meat,meat').ingredients.length,
		4,
	);
});
