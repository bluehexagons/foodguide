import type { StringKey } from './strings.js';
export interface DropdownItem {
	value: string;
	labelKey?: StringKey;
	key?: StringKey;
	iconHTML?: string;
}
interface FactoryOptions {
	documentRef: Document;
	translate: (key: StringKey) => string;
	getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
}
interface DropdownOptions<T extends DropdownItem> {
	items: T[];
	initialValue: string;
	labelKey?: StringKey;
	buttonClass?: string;
	dropdownClass?: string;
	containerClass?: string;
	onSelect?: (item: T, value: string) => void;
	storageKey?: string;
	storageIndex?: string | number;
}
let nextDropdownId = 0;
/**
 * Creates the small localized dropdown controls used by the ingredient picker.
 *
 * DOM, translations, and storage are injected to keep preference failures from
 * affecting the control and to make its state transitions independently testable.
 */
export const createDropdownFactory =
	({ documentRef, translate, getStorage }: FactoryOptions) =>
	<T extends DropdownItem>({
		items,
		initialValue,
		labelKey,
		buttonClass = 'ui-dropdown-btn',
		dropdownClass = 'ui-dropdown-list',
		containerClass = 'ui-dropdown-container',
		onSelect,
		storageKey,
		storageIndex,
	}: DropdownOptions<T>) => {
		if (!items.length) {
			throw new Error('Dropdown requires at least one item');
		}
		const container = documentRef.createElement('div');
		container.className = containerClass;
		const button = documentRef.createElement('button');
		button.id = `picker-menu-button-${nextDropdownId++}`;
		button.type = 'button';
		button.setAttribute('aria-haspopup', 'menu');
		button.setAttribute('aria-expanded', 'false');
		button.className =
			buttonClass === 'ui-dropdown-btn' ? buttonClass : `ui-dropdown-btn ${buttonClass}`;
		const dropdown = documentRef.createElement('div');
		dropdown.id = `${button.id}-options`;
		button.setAttribute('aria-controls', dropdown.id);
		dropdown.setAttribute('aria-labelledby', button.id);
		dropdown.setAttribute('role', 'menu');
		dropdown.className = dropdownClass;
		dropdown.style.display = 'none';
		let currentValue = initialValue;
		let isOpen = false;
		const options: HTMLButtonElement[] = [];

		const getItem = () => items.find(item => item.value === currentValue);
		const loadStoredValue = () => {
			if (!storageKey) {
				return;
			}
			try {
				const stored = getStorage().getItem(storageKey);
				if (stored) {
					const saved: unknown = JSON.parse(stored);
					const value =
						storageIndex === undefined
							? saved
							: saved && typeof saved === 'object'
								? (saved as Record<string | number, unknown>)[storageIndex]
								: undefined;
					if (typeof value === 'string' && items.some(item => item.value === value)) {
						currentValue = value;
					}
				}
			} catch (error) {
				console.warn('Unable to load preference', error);
			}
		};
		const saveValue = () => {
			if (!storageKey) {
				return;
			}
			try {
				const storage = getStorage();
				let saved: unknown = currentValue;
				if (storageIndex !== undefined) {
					const stored = storage.getItem(storageKey);
					try {
						saved = stored ? JSON.parse(stored) : null;
					} catch {
						// Replace malformed preferences when the user makes a new selection.
						saved = null;
					}
					const indexedArray = typeof storageIndex === 'number';
					if (
						!saved ||
						typeof saved !== 'object' ||
						Array.isArray(saved) !== indexedArray
					) {
						saved = indexedArray ? [] : {};
					}
					(saved as Record<string | number, unknown>)[storageIndex] = currentValue;
				}
				storage.setItem(storageKey, JSON.stringify(saved));
			} catch (error) {
				console.warn('Unable to save preference', error);
			}
		};
		const setText = (element: HTMLElement, item?: T) => {
			if (!item) {
				return;
			}
			element.textContent =
				item.labelKey || item.key ? translate((item.labelKey || item.key)!) : item.value;
			if (item.iconHTML) {
				element.innerHTML = item.iconHTML + element.innerHTML;
			}
		};
		const updateLabels = () => {
			setText(button, getItem());
			if (labelKey) {
				button.setAttribute('aria-label', `${translate(labelKey)}: ${button.textContent}`);
			}
			for (const child of options) {
				const item = items.find(option => option.value === child.dataset.value);
				if (item) {
					setText(child, item);
				}
			}
		};
		const updateSelectionState = () => {
			for (const child of options) {
				const selected = child.dataset.value === currentValue;
				child.classList.toggle('is-selected', selected);
				child.setAttribute('aria-checked', String(selected));
			}
		};
		const close = (restoreFocus = false) => {
			dropdown.style.display = 'none';
			isOpen = false;
			button.setAttribute('aria-expanded', 'false');
			container.classList.remove('is-open');
			if (restoreFocus) {
				button.focus();
			}
		};
		const open = (index = items.findIndex(item => item.value === currentValue)) => {
			dropdown.style.display = 'block';
			isOpen = true;
			button.setAttribute('aria-expanded', 'true');
			container.classList.add('is-open');
			options[index]?.focus();
		};

		loadStoredValue();
		if (!getItem()) {
			currentValue = items[0].value;
		}

		items.forEach((item, index) => {
			const option = documentRef.createElement('button');
			option.type = 'button';
			option.tabIndex = -1;
			option.setAttribute('role', 'menuitemradio');
			option.dataset.value = item.value;
			option.dataset.index = String(index);
			setText(option, item);
			option.addEventListener('click', event => {
				event.stopPropagation();
				currentValue = item.value;
				updateLabels();
				updateSelectionState();
				close(true);
				saveValue();
				onSelect?.(item, currentValue);
			});
			option.addEventListener('keydown', event => {
				let nextIndex;
				switch (event.key) {
					case 'ArrowDown':
						nextIndex = (index + 1) % options.length;
						break;
					case 'ArrowUp':
						nextIndex = (index + options.length - 1) % options.length;
						break;
					case 'Home':
						nextIndex = 0;
						break;
					case 'End':
						nextIndex = options.length - 1;
						break;
					case 'Escape':
						event.preventDefault();
						close(true);
						return;
					case 'Tab':
						close(true);
						return;
					default:
						return;
				}
				event.preventDefault();
				options[nextIndex].focus();
			});
			options.push(option);
			dropdown.appendChild(option);
		});

		updateLabels();
		updateSelectionState();
		documentRef.addEventListener('foodguide:localechange', updateLabels);
		button.addEventListener('click', event => {
			event.stopPropagation();
			if (isOpen) {
				close();
			} else {
				open();
			}
		});
		button.addEventListener('keydown', event => {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				open(event.key === 'ArrowDown' ? 0 : options.length - 1);
			}
		});
		documentRef.addEventListener('click', event => {
			if (isOpen && !container.contains(event.target as Node | null)) {
				close();
			}
		});
		documentRef.addEventListener('focusin', event => {
			if (isOpen && !container.contains(event.target as Node | null)) {
				close();
			}
		});

		container.appendChild(button);
		container.appendChild(dropdown);
		return {
			container,
			button,
			dropdown,
			getValue: () => currentValue,
			setValue: (value: string, { persist = false }: { persist?: boolean } = {}) => {
				if (items.some(item => item.value === value)) {
					currentValue = value;
					updateLabels();
					updateSelectionState();
					if (persist) {
						saveValue();
					}
				}
			},
			getItem,
			getIndex: () => items.findIndex(item => item.value === currentValue),
		};
	};
