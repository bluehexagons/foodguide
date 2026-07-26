import assert from 'node:assert';
import { describe, it } from 'node:test';

import { createThemeController } from '../html/theme-controller.js';

const createHarness = ({ savedTheme = null, prefersDark = false, storageThrows = false } = {}) => {
	const attributes = new Map();
	const buttonListeners = new Map();
	const mediaListeners = new Map();
	const writes = [];
	const storage = {
		getItem() {
			if (storageThrows) {
				throw new Error('storage unavailable');
			}
			return savedTheme;
		},
		setItem(key, value) {
			if (storageThrows) {
				throw new Error('storage unavailable');
			}
			writes.push([key, value]);
		},
	};
	const rootElement = {
		setAttribute(key, value) {
			attributes.set(key, value);
		},
	};
	const toggleButton = {
		textContent: '',
		addEventListener(type, listener) {
			buttonListeners.set(type, listener);
		},
	};
	const mediaQuery = {
		matches: prefersDark,
		addEventListener(type, listener) {
			mediaListeners.set(type, listener);
		},
	};
	const controller = createThemeController({
		getStorage: () => storage,
		mediaQuery,
		rootElement,
		toggleButton,
		translate: key => key,
	});

	return {
		attributes,
		buttonListeners,
		controller,
		mediaListeners,
		mediaQuery,
		toggleButton,
		writes,
	};
};

describe('theme controller', () => {
	it('falls back to the system theme when storage is unavailable', () => {
		const harness = createHarness({ prefersDark: true, storageThrows: true });

		assert.strictEqual(harness.controller.getTheme(), 'auto');
		assert.strictEqual(harness.attributes.get('data-theme'), 'dark');
		assert.strictEqual(harness.toggleButton.textContent, 'themeToggleToLight');
	});

	it('switches themes even when the preference cannot be saved', () => {
		const harness = createHarness({ prefersDark: true, storageThrows: true });

		assert.doesNotThrow(() => harness.buttonListeners.get('click')());
		assert.strictEqual(harness.controller.getTheme(), 'light');
		assert.strictEqual(harness.attributes.get('data-theme'), 'light');
	});

	it('tracks system changes only while using the automatic theme', () => {
		const harness = createHarness();

		harness.mediaQuery.matches = true;
		harness.mediaListeners.get('change')();
		assert.strictEqual(harness.attributes.get('data-theme'), 'dark');

		harness.controller.toggle();
		harness.mediaQuery.matches = false;
		harness.mediaListeners.get('change')();
		assert.strictEqual(harness.attributes.get('data-theme'), 'light');
		assert.deepStrictEqual(harness.writes, [['foodGuideTheme', 'light']]);
	});
});
