import type { StringKey } from './strings.js';
interface ThemeOptions {
	getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
	mediaQuery: MediaQueryList;
	rootElement: HTMLElement;
	toggleButton: HTMLElement | null;
	translate: (key: StringKey) => string;
}
const validThemes = new Set(['auto', 'light', 'dark']);

const readTheme = (getStorage: ThemeOptions['getStorage']) => {
	try {
		const savedTheme = getStorage().getItem('foodGuideTheme');
		return savedTheme !== null && validThemes.has(savedTheme) ? savedTheme : 'auto';
	} catch {
		return 'auto';
	}
};

/**
 * Creates the light/dark theme controller without coupling it to global DOM
 * objects, making storage and system-preference failures independently testable.
 */
export const createThemeController = ({
	getStorage,
	mediaQuery,
	rootElement,
	toggleButton,
	translate,
}: ThemeOptions) => {
	let currentTheme = readTheme(getStorage);

	const isDark = () => (currentTheme === 'auto' ? mediaQuery.matches : currentTheme === 'dark');

	const updateLabel = () => {
		if (toggleButton) {
			toggleButton.textContent = translate(
				isDark() ? 'themeToggleToLight' : 'themeToggleToDark',
			);
			const label = translate(isDark() ? 'themeSwitchToLight' : 'themeSwitchToDark');
			toggleButton.setAttribute('aria-label', label);
			toggleButton.title = label;
		}
	};

	const apply = () => {
		rootElement.setAttribute('data-theme', isDark() ? 'dark' : 'light');
		updateLabel();
	};

	const toggle = () => {
		currentTheme =
			currentTheme === 'auto'
				? mediaQuery.matches
					? 'light'
					: 'dark'
				: currentTheme === 'light'
					? 'dark'
					: 'light';

		try {
			getStorage().setItem('foodGuideTheme', currentTheme);
		} catch {
			// Theme switching should still work when storage is unavailable.
		}
		apply();
	};

	toggleButton?.addEventListener('click', toggle);
	mediaQuery.addEventListener('change', () => {
		if (currentTheme === 'auto') {
			apply();
		}
	});
	apply();

	return {
		apply,
		updateLabel,
		toggle,
		getTheme: () => currentTheme,
	};
};
