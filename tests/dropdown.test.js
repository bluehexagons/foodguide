import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDropdownFactory } from '../html/dropdown.js';

const createClassList = () => {
	const values = new Set();
	return {
		add: (...names) => names.forEach(name => values.add(name)),
		remove: (...names) => names.forEach(name => values.delete(name)),
		toggle: (name, force) => {
			const enabled = force ?? !values.has(name);
			enabled ? values.add(name) : values.delete(name);
			return enabled;
		},
		has: name => values.has(name),
	};
};

const createElement = () => {
	const listeners = new Map();
	return {
		children: [],
		classList: createClassList(),
		dataset: {},
		style: {},
		textContent: '',
		innerHTML: '',
		listeners,
		appendChild(child) {
			this.children.push(child);
			return child;
		},
		addEventListener(type, handler) {
			listeners.set(type, handler);
		},
		contains(target) {
			return target === this || this.children.some(child => child.contains?.(target));
		},
	};
};

const createHarness = (stored = null) => {
	const documentListeners = new Map();
	const values = new Map(stored ? [['preference', stored]] : []);
	const documentRef = {
		createElement,
		addEventListener(type, handler) {
			documentListeners.set(type, handler);
		},
	};
	const storage = {
		getItem: key => values.get(key) || null,
		setItem: (key, value) => values.set(key, value),
	};
	const createDropdown = createDropdownFactory({
		documentRef,
		translate: key => key,
		getStorage: () => storage,
	});
	return { createDropdown, documentListeners, values };
};

describe('dropdown control', () => {
	it('restores an indexed preference and falls back to a valid item', () => {
		const { createDropdown } = createHarness(JSON.stringify(['name']));
		const dropdown = createDropdown({
			items: [
				{ value: 'default', key: 'default' },
				{ value: 'name', key: 'name' },
			],
			initialValue: 'default',
			storageKey: 'preference',
			storageIndex: 0,
		});

		assert.strictEqual(dropdown.getValue(), 'name');
		assert.strictEqual(dropdown.button.textContent, 'name');
	});

	it('persists selections and closes after an option click', () => {
		const { createDropdown, values } = createHarness();
		let selected;
		const dropdown = createDropdown({
			items: [
				{ value: 'default', key: 'default' },
				{ value: 'name', key: 'name' },
			],
			initialValue: 'default',
			storageKey: 'preference',
			onSelect: (_item, value) => {
				selected = value;
			},
		});

		dropdown.button.listeners.get('click')({ stopPropagation() {} });
		dropdown.dropdown.children[1].listeners.get('click')({ stopPropagation() {} });

		assert.strictEqual(dropdown.getValue(), 'name');
		assert.strictEqual(selected, 'name');
		assert.strictEqual(dropdown.dropdown.style.display, 'none');
		assert.strictEqual(values.get('preference'), JSON.stringify('name'));
	});

	it('still creates a usable control when preference storage is blocked', () => {
		const createDropdown = createDropdownFactory({
			documentRef: {
				createElement,
				addEventListener() {},
			},
			translate: key => key,
			getStorage: () => {
				throw new Error('storage blocked');
			},
		});
		const warn = console.warn;
		console.warn = () => {};
		try {
			const dropdown = createDropdown({
				items: [{ value: 'default', key: 'default' }],
				initialValue: 'default',
				storageKey: 'preference',
			});
			assert.strictEqual(dropdown.getValue(), 'default');
		} finally {
			console.warn = warn;
		}
	});
});
