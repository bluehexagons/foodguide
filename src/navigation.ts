import { characters, gameVersions } from './constants.js';
import type { GameSelection, SavedState } from './preferences.js';
import { isCharacterApplicable } from './mode-utils.js';

export const guideTabs = [
	'simulator',
	'discovery',
	'foodlist',
	'crockpot',
	'statistics',
	'about',
	'gameinfo',
] as const;
export type GuideTab = (typeof guideTabs)[number];
export interface GuideRoute {
	tab: GuideTab;
	selection?: GameSelection;
	ingredients?: (string | null)[];
	inventory?: string[];
	highlight?: string;
}
export function guideTab(value: string | undefined): GuideTab {
	return value === 'help' ? 'about' : (guideTabs.find(tab => tab === value) ?? 'simulator');
}

/** Fragment routes work with static subpath hosting and the desktop's file URL. */
export function parseGuideRoute(hash: string): GuideRoute | null {
	if (!hash.startsWith('#') || hash.length > 131072) {
		return null;
	}
	const [name, query = ''] = hash.slice(1).split('?');
	if (name !== 'help' && !guideTabs.some(tab => tab === name)) {
		return null;
	}
	const route: GuideRoute = { tab: guideTab(name) };
	const params = new URLSearchParams(query);
	const version = params.get('game');
	if (version && Object.hasOwn(gameVersions, version)) {
		const dlc = params.get('dlc')?.split(',') ?? [];
		const selection: GameSelection = {
			version,
			dlc: {
				giants: version === 'dontstarve' && dlc.includes('giants'),
				shipwrecked: version === 'dontstarve' && dlc.includes('shipwrecked'),
			},
			character: null,
		};
		const character = params.get('character');
		if (
			character &&
			Object.hasOwn(characters, character) &&
			isCharacterApplicable(character, version, selection.dlc, characters)
		) {
			selection.character = character;
		}
		route.selection = selection;
	}
	const ids = (key: string, max: number) =>
		params
			.get(key)!
			.split(',')
			.slice(0, max)
			.map(id => (id.length <= 100 ? id : ''));
	if (route.tab === 'simulator' && params.has('ingredients')) {
		route.ingredients = ids('ingredients', 4).map(id => id || null);
	}
	if (route.tab === 'discovery' && params.has('inventory')) {
		route.inventory = [...new Set(ids('inventory', 1024).filter(Boolean))];
	}
	const highlight = params.get('highlight');
	if (
		(route.tab === 'foodlist' || route.tab === 'crockpot') &&
		highlight &&
		highlight.length <= 256
	) {
		route.highlight = highlight;
	}
	return route;
}

export function formatGuideRoute(route: GuideRoute): string {
	const params = new URLSearchParams();
	if (route.selection) {
		const { version, dlc, character } = route.selection;
		params.set('game', version);
		const enabled =
			version === 'dontstarve' ? ['giants', 'shipwrecked'].filter(key => dlc[key]) : [];
		if (enabled.length) {
			params.set('dlc', enabled.join(','));
		}
		if (character) {
			params.set('character', character);
		}
	}
	if (route.tab === 'simulator' && route.ingredients) {
		params.set(
			'ingredients',
			route.ingredients
				.slice(0, 4)
				.map(id => id ?? '')
				.join(','),
		);
	}
	if (route.tab === 'discovery' && route.inventory) {
		params.set('inventory', route.inventory.join(','));
	}
	if (route.highlight && (route.tab === 'foodlist' || route.tab === 'crockpot')) {
		params.set('highlight', route.highlight);
	}
	const query = params.toString();
	return `#${route.tab}${query ? `?${query}` : ''}`;
}

/** URL state takes precedence, leaving the other picker's tab-local work intact. */
export function applyGuideRoute(state: SavedState, route: GuideRoute) {
	state.activeTab = route.tab;
	if (route.selection) {
		state.version = route.selection.version;
		// A Together/Hamlet link doesn't specify the user's inactive single-player DLCs.
		if (route.selection.version === 'dontstarve' || !state.dlc) {
			state.dlc = {
				giants: !!route.selection.dlc.giants,
				shipwrecked: !!route.selection.dlc.shipwrecked,
			};
		}
		state.character = route.selection.character;
	}
	if (route.ingredients || route.inventory) {
		state.pickers ??= [];
		if (route.ingredients) {
			state.pickers[0] = route.ingredients;
		}
		if (route.inventory) {
			state.pickers[1] = route.inventory;
		}
	}
}
