const validThemes = new Set(['auto', 'light', 'dark']);

const readTheme = getStorage => {
	try {
		const savedTheme = getStorage().getItem('foodGuideTheme');
		return validThemes.has(savedTheme) ? savedTheme : 'auto';
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
}) => {
	let currentTheme = readTheme(getStorage);

	const isDark = () => (currentTheme === 'auto' ? mediaQuery.matches : currentTheme === 'dark');

	const updateLabel = () => {
		if (toggleButton) {
			toggleButton.textContent = translate(
				isDark() ? 'themeToggleToLight' : 'themeToggleToDark',
			);
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
