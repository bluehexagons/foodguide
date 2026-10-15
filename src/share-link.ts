import { formatGuideRoute, type GuideRoute } from './navigation.js';

export const developmentGuideUrl = 'https://bluehexagons.github.io/foodguide/';
export const repositoryUrl = 'https://github.com/bluehexagons/foodguide';

export interface SharePreferences {
	destination: 'current' | 'development' | 'repository';
	section: boolean;
	selection: boolean;
	snapshot: boolean;
	highlight: boolean;
}

/** Build only the state the user selected, with no unrelated query parameters. */
export function formatShareUrl(currentUrl: string, route: GuideRoute, choices: SharePreferences) {
	if (choices.destination === 'repository') {
		return repositoryUrl;
	}
	const url = new URL(
		choices.destination === 'development'
			? developmentGuideUrl
			: currentUrl.startsWith('file:')
				? 'https://foodguide.bluehexagons.com/'
				: currentUrl,
	);
	url.pathname = url.pathname.replace(/\/index\.html?$/, '/');
	url.search = '';
	const details = choices.section && choices.selection;
	url.hash =
		choices.section || choices.selection
			? formatGuideRoute({
					tab: choices.section ? route.tab : 'simulator',
					selection: choices.selection ? route.selection : undefined,
					ingredients: details && choices.snapshot ? route.ingredients : undefined,
					inventory: details && choices.snapshot ? route.inventory : undefined,
					highlight: details && choices.highlight ? route.highlight : undefined,
				})
			: '';
	return url.href;
}
