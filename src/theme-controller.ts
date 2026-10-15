import type { StringKey } from './strings.js';
interface ThemeOptions {
	getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
	mediaQuery: MediaQueryList;
	rootElement: HTMLElement;
	toggleButton: HTMLElement | null;
	translate: (key: StringKey) => string;
}
const validThemes = new Set(['auto', 'light', 'dark']);
export type ThemePreference = 'auto' | 'light' | 'dark';

const readTheme = (getStorage: ThemeOptions['getStorage']): ThemePreference => {
	try {
		const savedTheme = getStorage().getItem('foodGuideTheme');
		return savedTheme !== null && validThemes.has(savedTheme)
			? (savedTheme as ThemePreference)
			: 'auto';
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
	const listeners = new Set<() => void>();

	const isDark = () => (currentTheme === 'auto' ? mediaQuery.matches : currentTheme === 'dark');

	const updateLabel = () => {
		if (toggleButton) {
			const label = translate(isDark() ? 'themeSwitchToLight' : 'themeSwitchToDark');
			toggleButton.setAttribute('aria-label', label);
			toggleButton.title = label;
		}
	};

	const apply = () => {
		rootElement.setAttribute('data-theme', isDark() ? 'dark' : 'light');
		updateLabel();
		for (const listener of listeners) {
			listener();
		}
	};

	const setTheme = (theme: ThemePreference) => {
		currentTheme = theme;
		try {
			getStorage().setItem('foodGuideTheme', currentTheme);
		} catch {
			// Theme switching should still work when storage is unavailable.
		}
		apply();
	};
	const toggle = () => setTheme(isDark() ? 'light' : 'dark');

	toggleButton?.addEventListener('click', toggle);
	mediaQuery.addEventListener('change', () => {
		if (currentTheme === 'auto') {
			apply();
		}
	});
	apply();

	return {
		refresh: () => {
			currentTheme = readTheme(getStorage);
			apply();
		},
		apply,
		updateLabel,
		toggle,
		setTheme,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getTheme: () => currentTheme,
	};
};
