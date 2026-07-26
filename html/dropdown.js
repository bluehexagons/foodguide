/**
 * Creates the small localized dropdown controls used by the ingredient picker.
 *
 * DOM, translations, and storage are injected to keep preference failures from
 * affecting the control and to make its state transitions independently testable.
 */
export const createDropdownFactory =
	({ documentRef, translate, getStorage }) =>
	({
		items,
		initialValue,
		buttonClass = 'ui-dropdown-btn',
		dropdownClass = 'ui-dropdown-list',
		containerClass = 'ui-dropdown-container',
		onSelect,
		storageKey,
		storageIndex,
	}) => {
		const container = documentRef.createElement('div');
		container.className = containerClass;
		const button = documentRef.createElement('span');
		button.className =
			buttonClass === 'ui-dropdown-btn' ? buttonClass : `ui-dropdown-btn ${buttonClass}`;
		const dropdown = documentRef.createElement('div');
		dropdown.className = dropdownClass;
		dropdown.style.display = 'none';
		let currentValue = initialValue;
		let isOpen = false;

		const getItem = () => items.find(item => item.value === currentValue);
		const loadStoredValue = () => {
			if (!storageKey) {
				return;
			}
			try {
				const stored = getStorage().getItem(storageKey);
				if (stored) {
					const saved = JSON.parse(stored);
					if (
						saved &&
						(storageIndex === undefined || saved[storageIndex] !== undefined)
					) {
						currentValue = storageIndex === undefined ? saved : saved[storageIndex];
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
				let saved = currentValue;
				if (storageIndex !== undefined) {
					const stored = storage.getItem(storageKey);
					saved = stored
						? JSON.parse(stored)
						: typeof storageIndex === 'number'
							? []
							: {};
					saved[storageIndex] = currentValue;
				}
				storage.setItem(storageKey, JSON.stringify(saved));
			} catch (error) {
				console.warn('Unable to save preference', error);
			}
		};
		const setText = (element, item) => {
			element.textContent = translate(item.labelKey || item.key);
			if (item.iconHTML) {
				element.innerHTML = item.iconHTML + element.innerHTML;
			}
		};
		const updateLabels = () => {
			setText(button, getItem());
			for (const child of dropdown.children) {
				const item = items.find(option => option.value === child.dataset.value);
				if (item) {
					setText(child, item);
				}
			}
		};
		const updateSelectionState = () => {
			for (const child of dropdown.children) {
				child.classList.toggle('is-selected', child.dataset.value === currentValue);
			}
		};
		const close = () => {
			dropdown.style.display = 'none';
			isOpen = false;
			container.classList.remove('is-open');
		};

		loadStoredValue();
		if (!getItem()) {
			currentValue = items[0].value;
		}

		items.forEach((item, index) => {
			const option = documentRef.createElement('div');
			option.dataset.value = item.value;
			option.dataset.index = index;
			setText(option, item);
			option.addEventListener('click', event => {
				event.stopPropagation();
				currentValue = item.value;
				updateLabels();
				updateSelectionState();
				close();
				saveValue();
				onSelect?.(item, currentValue);
			});
			dropdown.appendChild(option);
		});

		updateLabels();
		updateSelectionState();
		documentRef.addEventListener('foodguide:localechange', updateLabels);
		button.addEventListener('click', event => {
			event.stopPropagation();
			isOpen = !isOpen;
			dropdown.style.display = isOpen ? 'block' : 'none';
			container.classList.toggle('is-open', isOpen);
		});
		documentRef.addEventListener('click', event => {
			if (isOpen && !dropdown.contains(event.target) && event.target !== button) {
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
			setValue: value => {
				if (items.some(item => item.value === value)) {
					currentValue = value;
					updateLabels();
					updateSelectionState();
				}
			},
			getItem,
			getIndex: () => items.findIndex(item => item.value === currentValue),
		};
	};
