import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatShareUrl, developmentGuideUrl, repositoryUrl } from '../html/share-link.js';
import { parseGuideRoute } from '../html/navigation.js';

const selection = {
	version: 'together',
	dlc: { giants: false, shipwrecked: false },
	character: 'warly',
};
const route = {
	tab: 'simulator',
	selection,
	ingredients: ['meat@together', 'meat@together', null, 'honey@together'],
};
const defaults = {
	destination: 'current',
	section: true,
	selection: true,
	snapshot: true,
	highlight: true,
};
const current = 'https://example.com/preview/index.html?unrelated=private#about';

test('share choices preserve repeated ingredients only with their section and game context', () => {
	const link = new URL(formatShareUrl(current, route, defaults));
	assert.equal(link.pathname, '/preview/');
	assert.equal(link.search, '');
	assert.deepEqual(parseGuideRoute(link.hash), route);
	assert.equal(
		parseGuideRoute(
			new URL(formatShareUrl(current, route, { ...defaults, snapshot: false })).hash,
		).ingredients,
		undefined,
	);
	const sectionOnly = parseGuideRoute(
		new URL(formatShareUrl(current, route, { ...defaults, selection: false })).hash,
	);
	assert.deepEqual(sectionOnly, { tab: 'simulator' });
	const settingsOnly = parseGuideRoute(
		new URL(
			formatShareUrl(
				current,
				{ ...route, tab: 'discovery', inventory: ['meat@together'] },
				{ ...defaults, section: false },
			),
		).hash,
	);
	assert.deepEqual(settingsOnly, { tab: 'simulator', selection });
});

test('sharing nothing produces a plain site URL including desktop and static subpath entries', () => {
	const choices = { ...defaults, section: false, selection: false };
	assert.equal(formatShareUrl(current, route, choices), 'https://example.com/preview/');
	assert.equal(
		formatShareUrl('https://example.com/index.htm?old=true#discovery', route, choices),
		'https://example.com/',
	);
	assert.equal(
		formatShareUrl('file:///opt/foodguide/index.html#about', route, choices),
		'https://foodguide.bluehexagons.com/',
	);
	assert.equal(
		formatShareUrl(current, route, { ...choices, destination: 'development' }),
		developmentGuideUrl,
	);
});

test('development links keep selected state and repository links never include guide state', () => {
	const inventory = {
		tab: 'discovery',
		selection,
		inventory: ['meat@together', 'honey@together'],
	};
	const link = new URL(
		formatShareUrl(current, inventory, { ...defaults, destination: 'development' }),
	);
	assert.equal(link.origin + link.pathname, developmentGuideUrl);
	assert.deepEqual(parseGuideRoute(link.hash), inventory);
	assert.equal(
		formatShareUrl(current, inventory, { ...defaults, destination: 'repository' }),
		repositoryUrl,
	);
});

test('highlighted entries can be omitted without losing section or game settings', () => {
	const highlight = { tab: 'foodlist', selection, highlight: 'meat' };
	assert.deepEqual(
		parseGuideRoute(new URL(formatShareUrl(current, highlight, defaults)).hash),
		highlight,
	);
	assert.deepEqual(
		parseGuideRoute(
			new URL(formatShareUrl(current, highlight, { ...defaults, highlight: false })).hash,
		),
		{ tab: 'foodlist', selection },
	);
	assert.deepEqual(
		parseGuideRoute(
			new URL(formatShareUrl(current, highlight, { ...defaults, selection: false })).hash,
		),
		{ tab: 'foodlist' },
	);
});
