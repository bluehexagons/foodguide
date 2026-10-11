import type { GameSelection } from './preferences.js';
import { characters, dlcOptions, gameVersions } from './constants.js';
import { createHeaderActions } from './header-actions.js';
import {
	createPersonalDataStore,
	editInventory,
	maxPersonalDataBytes,
	parsePersonalData,
	personalDataKey,
	type CookbookDish,
	type Inventory,
} from './personal-data.js';
import { t, type StringKey } from './strings.js';

interface PersonalUIOptions {
	getTabStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
	legacyInventory: string[];
	validIngredient: (id: string) => boolean;
	validDish: (dish: CookbookDish) => boolean;
	projectIngredient: (id: string) => string | undefined;
	showInventory: (ids: string[]) => void;
	getPot: () => string[];
	getSelection: () => GameSelection;
	getDishName: () => string;
	loadDish: (dish: CookbookDish) => void;
	ingredientName: (id: string) => string;
	shareUrl: (snapshot: boolean) => string;
	canShareSnapshot: () => boolean;
}

export function createPersonalDataUI(options: PersonalUIOptions) {
	const element = <K extends keyof HTMLElementTagNameMap>(tag: K, parent?: HTMLElement) => {
		const node = document.createElement(tag);
		parent?.append(node);
		return node;
	};
	const labels: (() => void)[] = [];
	const text = (node: HTMLElement, key: StringKey) => {
		const target = node.tagName === 'LABEL' ? element('span', node) : node;
		const update = () => {
			target.textContent = t(key);
		};
		labels.push(update);
		update();
	};
	const button = (parent: HTMLElement, key: StringKey, action: () => void) => {
		const node = element('button', parent);
		node.type = 'button';
		if (parent.tagName === 'LI') {
			node.textContent = t(key);
		} else {
			text(node, key);
		}
		node.addEventListener('click', action);
		return node;
	};
	const toolbar = createHeaderActions(document, window.matchMedia('(max-width: 767px)'));
	const status = element('p', document.querySelector('header')!);
	status.id = 'personal-data-status';
	status.className = 'personal-status sr-only';
	status.setAttribute('role', 'status');
	let statusKey: StringKey | undefined;
	const announce = (key: StringKey) => {
		statusKey = key;
		status.classList.toggle(
			'sr-only',
			key !== 'personalStorageError' && key !== 'personalLimitError',
		);
		status.textContent = t(key);
	};
	const store = createPersonalDataStore({
		getStorage: () => window.localStorage,
		validIngredient: options.validIngredient,
		validDish: options.validDish,
		withLock: navigator.locks
			? change => navigator.locks.request(personalDataKey, change)
			: undefined,
		onError: reason =>
			announce(reason === 'limit' ? 'personalLimitError' : 'personalStorageError'),
	});
	const id = () => crypto.randomUUID();
	const activeKey = 'foodGuideActiveInventory';
	let activeId = '';
	try {
		activeId = options.getTabStorage().getItem(activeKey) ?? '';
	} catch {
		/* Memory selection remains usable. */
	}
	let baseline: string[] = [];
	let rendering = false;
	const persistActive = () => {
		try {
			options.getTabStorage().setItem(activeKey, activeId);
		} catch {
			announce('personalStorageError');
		}
	};
	if (!store.get().inventories.length) {
		// A fixed ID and the lock make first-run migration safe in simultaneous tabs.
		void store.update(data => {
			if (!data.inventories.length) {
				data.inventories.push({
					id: 'default',
					name: t('inventoryDefault'),
					ingredients: [
						...new Set(options.legacyInventory.filter(options.validIngredient)),
					],
				});
			}
		});
	}
	const inventoryControls = element('form');
	inventoryControls.className = 'personal-controls';
	inventoryControls.id = 'inventory-controls';
	document.querySelector('#discovery > .ingredient-search-row')!.before(inventoryControls);
	const inventoryLabel = element('label', inventoryControls);
	text(inventoryLabel, 'inventoryLabel');
	const select = element('select', inventoryLabel);
	select.id = 'inventory-select';
	const nameLabel = element('label', inventoryControls);
	text(nameLabel, 'inventoryName');
	const name = element('input', nameLabel);
	name.type = 'text';
	name.maxLength = 150;
	name.required = true;
	name.id = 'inventory-name';
	button(inventoryControls, 'inventoryRename', () => inventoryControls.requestSubmit());
	inventoryControls.addEventListener('submit', event => {
		event.preventDefault();
		if (!name.value.trim()) {
			return;
		}
		const currentId = activeId,
			nextName = name.value.trim();
		void store.update(data => {
			const current = data.inventories.find(item => item.id === currentId);
			if (current) {
				current.name = nextName;
			}
		});
	});
	const addInventory = (ingredients: string[], title: string) => {
		if (store.get().inventories.length >= 200) {
			announce('personalLimitError');
			return;
		}
		const inventory: Inventory = { id: id(), name: title.slice(0, 150), ingredients };
		activeId = inventory.id;
		persistActive();
		void store.update(data => {
			if (!data.inventories.some(item => item.id === inventory.id)) {
				data.inventories.push(inventory);
			}
		});
	};
	button(inventoryControls, 'inventoryNew', () => {
		addInventory([], `${t('inventoryNewName')} ${store.get().inventories.length + 1}`);
		name.focus();
		name.select();
	}).id = 'inventory-new';
	button(inventoryControls, 'inventoryDuplicate', () => {
		const current = store.get().inventories.find(item => item.id === activeId);
		if (current) {
			addInventory([...current.ingredients], `${current.name} (${t('personalCopy')})`);
		}
	});
	const dialog = (key: StringKey) => {
		const node = element('dialog', document.getElementById('content')!);
		node.className = 'personal-dialog';
		const top = element('div', node);
		top.className = 'personal-dialog-heading';
		const heading = element('h2', top);
		heading.id = `personal-dialog-${key}`;
		text(heading, key);
		node.setAttribute('aria-labelledby', heading.id);
		const close = button(top, 'personalClose', () => node.close());
		close.className = 'personal-dialog-close';
		return node;
	};
	const deleteDialog = dialog('personalDeleteTitle');
	const deletePrompt = element('p', deleteDialog);
	let deleteAction = () => {};
	let deleteTrigger: HTMLElement | null = null;
	let deleteFallback: HTMLElement = select;
	deleteDialog.addEventListener('close', () => {
		if (
			!deleteTrigger?.isConnected ||
			(deleteTrigger instanceof HTMLButtonElement && deleteTrigger.disabled)
		) {
			deleteFallback.focus();
		}
	});
	button(deleteDialog, 'personalDelete', () => {
		deleteAction();
		deleteDialog.close();
	});
	button(deleteDialog, 'personalCancel', () => deleteDialog.close());
	const confirmDelete = (title: string, action: () => void, fallback: HTMLElement = select) => {
		deleteTrigger =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		deleteFallback = fallback;
		deletePrompt.textContent = t('personalDeletePrompt', { name: title });
		deleteAction = action;
		deleteDialog.showModal();
	};
	const deleteInventory = button(inventoryControls, 'personalDelete', () => {
		const current = store.get().inventories.find(item => item.id === activeId);
		if (current) {
			confirmDelete(current.name, () => {
				void store.update(data => {
					if (data.inventories.length > 1) {
						data.inventories = data.inventories.filter(item => item.id !== current.id);
					}
				});
			});
		}
	});
	const inventoryHelp = element('p', inventoryControls);
	inventoryHelp.className = 'personal-help';
	text(inventoryHelp, 'inventorySyncHelp');
	select.addEventListener('change', () => {
		activeId = select.value;
		persistActive();
		refresh();
	});

	const potPanel = document.querySelector<HTMLElement>('#ingredients')!.parentElement!;
	const saveForm = element('form', potPanel);
	saveForm.className = 'personal-controls';
	saveForm.id = 'cookbook-save';
	const dishLabel = element('label', saveForm);
	text(dishLabel, 'cookbookDishName');
	const dishName = element('input', dishLabel);
	dishName.type = 'text';
	dishName.maxLength = 150;
	dishName.id = 'cookbook-dish-name';
	const saveDish = element('button', saveForm);
	saveDish.type = 'submit';
	text(saveDish, 'cookbookSave');
	const saveHelp = element('span', saveForm);
	saveHelp.className = 'personal-help';
	text(saveHelp, 'cookbookSaveHelp');
	saveHelp.id = 'cookbook-save-help';
	saveDish.setAttribute('aria-describedby', saveHelp.id);
	const cookbook = element('details', potPanel);
	cookbook.id = 'personal-cookbook';
	const summary = element('summary', cookbook);
	text(summary, 'cookbookTitle');
	const dishList = element('ul', cookbook);
	dishList.className = 'cookbook-list';
	let cookbookSignature = '';
	const updatePot = () => {
		saveDish.disabled = options.getPot().length !== 4;
		dishName.placeholder = options.getDishName();
	};
	saveForm.addEventListener('submit', event => {
		event.preventDefault();
		const ingredients = options.getPot();
		if (ingredients.length !== 4) {
			return;
		}
		if (store.get().dishes.length >= 2000) {
			announce('personalLimitError');
			return;
		}
		const dish: CookbookDish = {
			id: id(),
			name: (
				dishName.value.trim() ||
				options.getDishName() ||
				t('cookbookDishDefault')
			).slice(0, 150),
			ingredients,
			selection: options.getSelection(),
		};
		void store.update(data => {
			if (!data.dishes.some(item => item.id === dish.id)) {
				data.dishes.push(dish);
			}
		});
		dishName.value = '';
		cookbook.open = true;
		announce('cookbookSaved');
	});
	const refresh = () => {
		const data = store.get();
		if (!data.inventories.some(item => item.id === activeId)) {
			activeId = data.inventories[0]?.id ?? '';
			persistActive();
		}
		const inventory = data.inventories.find(item => item.id === activeId);
		select.replaceChildren(
			...data.inventories.map(item => {
				const option = document.createElement('option');
				option.value = item.id;
				option.textContent = item.name;
				return option;
			}),
		);
		select.value = activeId;
		if (document.activeElement !== name) {
			name.value = inventory?.name ?? '';
		}
		deleteInventory.disabled = data.inventories.length <= 1;
		baseline = inventory?.ingredients ?? [];
		rendering = true;
		try {
			options.showInventory(baseline);
		} finally {
			rendering = false;
		}
		const signature = JSON.stringify(data.dishes);
		if (signature !== cookbookSignature) {
			cookbookSignature = signature;
			dishList.replaceChildren();
			if (!data.dishes.length) {
				const empty = element('li', dishList);
				empty.textContent = t('cookbookEmpty');
			}
			for (const dish of data.dishes) {
				const row = element('li', dishList);
				const load = button(row, 'cookbookLoad', () => {
					options.loadDish(dish);
					announce('cookbookLoaded');
				});
				load.textContent = dish.name;
				load.setAttribute('aria-label', t('cookbookLoadNamed', { name: dish.name }));
				const ingredients = element('span', row);
				ingredients.textContent = `${dish.ingredients.map(options.ingredientName).join(' + ')} · ${gameName(dish.selection)}`;
				const remove = button(row, 'personalDelete', () =>
					confirmDelete(
						dish.name,
						() => {
							void store.update(latest => {
								latest.dishes = latest.dishes.filter(item => item.id !== dish.id);
							});
						},
						summary,
					),
				);
				remove.setAttribute('aria-label', t('personalDeleteNamed', { name: dish.name }));
			}
		}
		updatePot();
	};
	const gameName = (selection: GameSelection) => {
		const names = [gameVersions[selection.version].name];
		if (selection.version === 'dontstarve') {
			for (const key of ['giants', 'shipwrecked']) {
				if (selection.dlc[key]) {
					names.push(dlcOptions[key].name);
				}
			}
		}
		if (selection.character) {
			names.push(characters[selection.character].name);
		}
		return names.join(' / ');
	};
	store.subscribe(refresh);
	window.addEventListener('storage', event => {
		if (
			event.storageArea === window.localStorage &&
			(event.key === personalDataKey || event.key === null)
		) {
			store.refresh();
		}
	});
	// A tab coming back after suspension should not keep a stale inventory view.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			store.refresh();
		}
	});

	const shareDialog = dialog('personalShare');
	const shareHelp = element('p', shareDialog);
	text(shareHelp, 'personalShareHelp');
	const snapshotLabel = element('label', shareDialog);
	const snapshot = element('input', snapshotLabel);
	snapshot.type = 'checkbox';
	snapshot.checked = true;
	const snapshotText = element('span', snapshotLabel);
	text(snapshotText, 'personalShareSnapshot');
	const linkLabel = element('label', shareDialog);
	text(linkLabel, 'personalShareLink');
	const link = element('input', linkLabel);
	link.type = 'text';
	link.readOnly = true;
	link.id = 'personal-share-link';
	const copyStatus = element('p', shareDialog);
	copyStatus.setAttribute('role', 'status');
	button(shareDialog, 'personalCopyLink', () => {
		link.focus();
		link.select();
		if (navigator.clipboard) {
			void navigator.clipboard
				.writeText(link.value)
				.then(() => {
					copyStatus.textContent = t('personalLinkCopied');
				})
				.catch(() => {
					copyStatus.textContent = t('personalCopyManually');
				});
		} else {
			copyStatus.textContent = t('personalCopyManually');
		}
	});
	snapshot.addEventListener('change', () => {
		link.value = options.shareUrl(snapshot.checked);
	});
	button(toolbar, 'personalShare', () => {
		snapshotLabel.hidden = !options.canShareSnapshot();
		link.value = options.shareUrl(snapshot.checked);
		copyStatus.textContent = '';
		shareDialog.showModal();
		link.focus();
		link.select();
	}).id = 'personal-share-button';

	const dataDialog = dialog('personalData');
	const dataHelp = element('p', dataDialog);
	text(dataHelp, 'personalDataHelp');
	const dataStatus = element('p', dataDialog);
	dataStatus.setAttribute('role', 'status');
	button(dataDialog, 'personalExport', () => {
		void store.settled().then(() => {
			const blob = new Blob([JSON.stringify(store.get(), null, 2)], {
				type: 'application/json',
			});
			const url = URL.createObjectURL(blob);
			const anchor = element('a', dataDialog);
			anchor.href = url;
			anchor.download = 'foodguide-personal-data.json';
			anchor.click();
			anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		});
	});
	const importLabel = element('label', dataDialog);
	text(importLabel, 'personalImport');
	const file = element('input', importLabel);
	file.type = 'file';
	file.accept = '.json,application/json';
	file.id = 'personal-import';
	file.addEventListener('change', () => {
		void (async () => {
			try {
				const input = file.files?.[0];
				if (!input) {
					return;
				}
				if (input.size > maxPersonalDataBytes) {
					throw new Error('Too large');
				}
				const imported = parsePersonalData(
					await input.text(),
					options.validIngredient,
					options.validDish,
				);
				for (const item of [...imported.inventories, ...imported.dishes]) {
					item.id = id();
				}
				const preview = store.get();
				preview.inventories.push(...imported.inventories);
				preview.dishes.push(...imported.dishes);
				parsePersonalData(
					JSON.stringify(preview),
					options.validIngredient,
					options.validDish,
				);
				const applied = await store.update(data => {
					for (const inventory of imported.inventories) {
						if (!data.inventories.some(item => item.id === inventory.id)) {
							data.inventories.push(inventory);
						}
					}
					for (const dish of imported.dishes) {
						if (!data.dishes.some(item => item.id === dish.id)) {
							data.dishes.push(dish);
						}
					}
				});
				if (!applied) {
					throw new Error('Import could not be applied');
				}
				dataStatus.textContent = t('personalImported', {
					inventories: imported.inventories.length,
					dishes: imported.dishes.length,
				});
			} catch {
				dataStatus.textContent = t('personalImportError');
			} finally {
				file.value = '';
			}
		})();
	});
	button(toolbar, 'personalData', () => {
		dataStatus.textContent = '';
		dataDialog.showModal();
	});
	document.addEventListener('foodguide:localechange', () => {
		for (const update of labels) {
			update();
		}
		if (statusKey) {
			status.textContent = t(statusKey);
		}
		cookbookSignature = '';
		refresh();
	});
	refresh();
	return {
		updatePot,
		refreshInventory: refresh,
		inventorySnapshot: () => [...baseline],
		clearInventory() {
			const inventoryId = activeId,
				removed = [...baseline];
			void store.update(data => editInventory(data, inventoryId, [], removed));
		},
		shareInventory(ids: string[]) {
			addInventory([...new Set(ids.filter(options.validIngredient))], t('inventoryShared'));
		},
		saveInventory(visible: string[]) {
			if (rendering) {
				return;
			}
			const previous = new Set(baseline.map(options.projectIngredient).filter(Boolean));
			const next = new Set(visible);
			const added = visible.filter(item => !previous.has(item));
			const removed = baseline.filter(item => {
				const projected = options.projectIngredient(item);
				return projected !== undefined && !next.has(projected);
			});
			if (added.length || removed.length) {
				const inventoryId = activeId;
				void store.update(data => editInventory(data, inventoryId, added, removed));
			}
		},
	};
}
