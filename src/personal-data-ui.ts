import { formatShareUrl, type SharePreferences } from './share-link.js';
import type { GuideRoute } from './navigation.js';
import type { GameSelection } from './preferences.js';
import { characters, dlcOptions, gameVersions } from './constants.js';
import { createHeaderActions } from './header-actions.js';
import type { CookbookPreview } from './cookbook-preview.js';
import { makeImage } from './utils.js';
import {
	createPersonalDataStore,
	editInventory,
	maxPersonalDataBytes,
	parsePersonalData,
	personalDataKey,
	type CookbookDish,
	type Inventory,
} from './personal-data.js';
import { t, getLocale, listLocales, localeName, setLocale, type StringKey } from './strings.js';
import { createIcon, type IconName } from './ui-icons.js';
import type { createThemeController, ThemePreference } from './theme-controller.js';

interface PersonalUIOptions {
	theme: Pick<ReturnType<typeof createThemeController>, 'getTheme' | 'setTheme' | 'subscribe'>;
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
	previewDish: (dish: CookbookDish) => CookbookPreview;
	getShareRoute: () => GuideRoute;
}

export function createPersonalDataUI(options: PersonalUIOptions) {
	const element = <K extends keyof HTMLElementTagNameMap>(tag: K, parent?: HTMLElement) => {
		const node = document.createElement(tag);
		parent?.append(node);
		return node;
	};
	const labels: (() => void)[] = [];
	const text = (node: HTMLElement, key: StringKey) => {
		const target = ['LABEL', 'BUTTON'].includes(node.tagName) ? element('span', node) : node;
		const update = () => {
			target.textContent = t(key);
			if (node.closest('.personal-toolbar')) {
				node.title = t(key);
			}
		};
		labels.push(update);
		update();
	};
	const button = (parent: HTMLElement, key: StringKey, action: () => void) => {
		const node = element('button', parent);
		node.type = 'button';
		if (parent.closest('li')) {
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
	let storageUnavailable = false;
	const renderStatus = () => {
		if (!statusKey) {
			return;
		}
		status.classList.toggle(
			'sr-only',
			!storageUnavailable && statusKey !== 'personalLimitError',
		);
		status.textContent =
			(storageUnavailable && statusKey !== 'personalStorageError'
				? `${t('personalStorageError')} `
				: '') + t(statusKey);
	};
	const announce = (key: StringKey) => {
		// The store retains unsaved edits in memory for the rest of this session.
		// Loading a dish must not hide the reminder to export them before closing.
		storageUnavailable ||= key === 'personalStorageError';
		statusKey = key;
		renderStatus();
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
	const withIcon = <T extends HTMLElement>(node: T, name: IconName) => {
		node.prepend(createIcon(name));
		return node;
	};
	const dialog = (key: StringKey, icon: IconName) => {
		const node = element('dialog', document.getElementById('content')!);
		node.className = 'personal-dialog';
		const top = element('div', node);
		top.className = 'personal-dialog-heading';
		const title = element('div', top);
		title.className = 'personal-dialog-title';
		title.append(createIcon(icon));
		const heading = element('h2', title);
		heading.id = `personal-dialog-${key}`;
		text(heading, key);
		node.setAttribute('aria-labelledby', heading.id);
		const close = button(top, 'personalClose', () => node.close());
		close.className = 'personal-dialog-close';
		close.querySelector('span')!.className = 'sr-only';
		close.prepend(createIcon('close'));
		const body = element('div', node);
		body.className = 'personal-dialog-body';
		let backdropPress = false;
		const outside = (event: MouseEvent) => {
			const rect = node.getBoundingClientRect();
			return (
				event.clientX < rect.left ||
				event.clientX > rect.right ||
				event.clientY < rect.top ||
				event.clientY > rect.bottom
			);
		};
		node.addEventListener('pointerdown', event => {
			backdropPress = event.target === node && outside(event);
		});
		node.addEventListener('pointercancel', () => {
			backdropPress = false;
		});
		node.addEventListener('click', event => {
			if (backdropPress && event.target === node && outside(event)) {
				node.close();
			}
			backdropPress = false;
		});
		return { node, body };
	};
	const { node: deleteDialog, body: deleteBody } = dialog('personalDeleteTitle', 'trash');
	const deletePrompt = element('p', deleteBody);
	const deleteActions = element('div', deleteBody);
	deleteActions.className = 'dialog-actions';
	button(deleteActions, 'personalCancel', () => deleteDialog.close());
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
	button(deleteActions, 'personalDelete', () => {
		deleteAction();
		deleteDialog.close();
	}).classList.add('button-danger');
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
	text(element('span', summary), 'cookbookTitle');
	const dishCount = element('span', summary);
	dishCount.className = 'cookbook-count';
	const cookbookHelp = element('p', cookbook);
	cookbookHelp.className = 'personal-help';
	text(cookbookHelp, 'cookbookHelp');
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
			const focused = document.activeElement;
			const focusedCard =
				focused instanceof HTMLElement && dishList.contains(focused)
					? focused.closest<HTMLElement>('.cookbook-card')
					: null;
			let nextFocus: HTMLElement = summary;
			cookbookSignature = signature;
			dishList.replaceChildren();
			dishCount.textContent = `(${data.dishes.length})`;
			if (!data.dishes.length) {
				const empty = element('li', dishList);
				empty.className = 'cookbook-empty';
				empty.textContent = t('cookbookEmpty');
			}
			for (const [index, dish] of data.dishes.entries()) {
				const preview = options.previewDish(dish);
				const row = element('li', dishList);
				row.className = 'cookbook-card';
				row.dataset.dishId = dish.id;
				const load = element('button', row);
				load.type = 'button';
				load.className = 'cookbook-load';
				load.addEventListener('click', () => {
					options.loadDish(dish);
					announce('cookbookLoaded');
				});
				const titleRow = element('span', load);
				titleRow.className = 'cookbook-title-row';
				const title = element('span', titleRow);
				title.className = 'cookbook-dish-name';
				title.textContent = dish.name;
				const loadHint = element('span', titleRow);
				loadHint.className = 'cookbook-load-hint';
				loadHint.textContent = ` ${t('cookbookLoad')}`;
				const outcomes = element('span', load);
				outcomes.className = 'cookbook-outcomes';
				const label = element('span', outcomes);
				label.className = 'cookbook-outcome-label';
				label.textContent = `${t(preview.recipes.length > 1 ? 'cookbookPossibleResults' : 'cookbookMakes')}: `;
				for (const recipe of preview.recipes) {
					const result = element('span', outcomes);
					result.className = 'cookbook-recipe';
					const icon = makeImage(recipe.img);
					icon.setAttribute('aria-hidden', 'true');
					result.append(icon, document.createTextNode(recipe.name));
				}
				if (!preview.recipes.length) {
					element('span', outcomes).textContent = t('cookbookUnavailable');
				}
				const ingredients = element('span', load);
				ingredients.className = 'cookbook-ingredients';
				for (const item of preview.ingredients) {
					const icon = makeImage(item.img);
					icon.title = item.name;
					icon.setAttribute('aria-hidden', 'true');
					ingredients.append(icon);
				}
				const description = element('span', row);
				description.className = 'sr-only';
				description.id = `cookbook-description-${index}`;
				description.textContent = t('cookbookDishDescription', {
					recipes:
						preview.recipes.map(recipe => recipe.name).join(' / ') ||
						t('cookbookUnavailable'),
					ingredients: preview.ingredients.map(item => item.name).join(', '),
				});
				const footer = element('div', row);
				footer.className = 'cookbook-card-footer';
				const context = element('span', footer);
				context.id = `cookbook-context-${index}`;
				context.textContent = gameName(dish.selection);
				load.setAttribute('aria-describedby', `${description.id} ${context.id}`);
				const remove = button(footer, 'personalDelete', () =>
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
				if (dish.id === focusedCard?.dataset.dishId) {
					nextFocus = focused?.classList.contains('cookbook-load') ? load : remove;
				}
			}
			// Synchronized edits can replace the focused card without a local action.
			if (focusedCard && document.activeElement === document.body) {
				nextFocus.focus({ preventScroll: true });
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

	const { node: shareDialog, body: shareBody } = dialog('personalShareTitle', 'share');
	const shareHelp = element('p', shareBody);
	shareHelp.className = 'dialog-intro';
	text(shareHelp, 'personalShareHelp');
	shareHelp.id = 'personal-share-description';
	shareDialog.setAttribute('aria-describedby', shareHelp.id);
	const destinationLabel = element('label', shareBody);
	destinationLabel.htmlFor = 'personal-share-destination';
	text(destinationLabel, 'shareDestination');
	const destination = element('select', shareBody);
	destination.id = 'personal-share-destination';
	for (const [value, key] of [
		['current', 'shareCurrentSite'],
		['development', 'shareDevelopmentSite'],
		['repository', 'shareRepository'],
	] as const) {
		const option = element('option', destination);
		option.value = value;
		text(option, key);
	}
	const destinationHelp = element('p', shareBody);
	destinationHelp.id = 'personal-share-destination-help';
	destinationHelp.className = 'option-help';
	destination.setAttribute('aria-describedby', destinationHelp.id);
	const includes = element('fieldset', shareBody);
	includes.className = 'share-includes';
	text(element('legend', includes), 'shareIncludes');
	const shareChoice = (id: string, key: StringKey, helpKey?: StringKey) => {
		const label = element('label', includes);
		label.className = 'share-choice';
		const input = element('input', label);
		input.id = id;
		input.type = 'checkbox';
		input.checked = true;
		const caption = element('span', label);
		text(element('strong', caption), key);
		if (helpKey) {
			const help = element('small', caption);
			help.id = `${id}-help`;
			text(help, helpKey);
			input.setAttribute('aria-describedby', help.id);
		}
		return { input, label, caption };
	};
	const sectionChoice = shareChoice('share-section', 'shareSection', 'shareSectionHelp');
	const selectionChoice = shareChoice('share-selection', 'shareGame');
	const snapshotChoice = shareChoice('share-snapshot', 'sharePot', 'personalSnapshotHelp');
	const highlightChoice = shareChoice('share-highlight', 'shareHighlight');
	const detailHelp = element('p', includes);
	detailHelp.className = 'option-help';
	detailHelp.id = 'share-detail-help';
	text(detailHelp, 'shareDetailsHelp');
	for (const input of [snapshotChoice.input, highlightChoice.input]) {
		input.setAttribute(
			'aria-describedby',
			[input.getAttribute('aria-describedby'), detailHelp.id].filter(Boolean).join(' '),
		);
	}
	const remember = element('p', shareBody);
	remember.className = 'option-help';
	text(remember, 'shareRemember');
	const linkLabel = element('label', shareBody);
	linkLabel.htmlFor = 'personal-share-link';
	text(linkLabel, 'personalShareLink');
	const linkRow = element('div', shareBody);
	linkRow.className = 'share-link-field';
	const link = element('input', linkRow);
	link.type = 'text';
	link.readOnly = true;
	link.id = 'personal-share-link';
	let copyStatusKey: StringKey | undefined;
	let copyRequest = 0;
	const copyStatus = element('p', shareBody);
	copyStatus.className = 'dialog-status';
	copyStatus.setAttribute('role', 'status');
	const showCopyStatus = (key?: StringKey) => {
		copyStatusKey = key;
		copyStatus.textContent = key ? t(key) : '';
	};
	labels.push(() => showCopyStatus(copyStatusKey));
	shareDialog.addEventListener('close', () => {
		copyRequest++;
	});
	withIcon(
		button(linkRow, 'personalCopyLink', () => {
			const request = ++copyRequest;
			const value = link.value;
			const copied = (key: StringKey) => {
				if (request === copyRequest && shareDialog.open && value === link.value) {
					showCopyStatus(key);
				}
			};
			link.focus();
			link.select();
			if (navigator.clipboard) {
				void navigator.clipboard
					.writeText(value)
					.then(() => copied('personalLinkCopied'))
					.catch(() => copied('personalCopyManually'));
			} else {
				showCopyStatus('personalCopyManually');
			}
		}),
		'copy',
	).classList.add('button-primary');
	// These controls belong to this document, never to shared localStorage preferences.
	const updateShare = () => {
		copyRequest++;
		const route = options.getShareRoute();
		const repository = destination.value === 'repository';
		includes.disabled = repository;
		includes.hidden = repository;
		destinationHelp.textContent = t(
			repository
				? 'shareRepositoryHelp'
				: destination.value === 'development'
					? 'shareDevelopmentHelp'
					: 'shareCurrentHelp',
		);
		snapshotChoice.label.hidden = !route.ingredients && !route.inventory;
		snapshotChoice.caption.querySelector('strong')!.textContent = t(
			route.inventory ? 'shareInventory' : 'sharePot',
		);
		highlightChoice.label.hidden = !route.highlight;
		const details = sectionChoice.input.checked && selectionChoice.input.checked;
		snapshotChoice.input.disabled = !details;
		highlightChoice.input.disabled = !details;
		detailHelp.hidden =
			details || (snapshotChoice.label.hidden && highlightChoice.label.hidden);
		const choices: SharePreferences = {
			destination: destination.value as SharePreferences['destination'],
			section: sectionChoice.input.checked,
			selection: selectionChoice.input.checked,
			snapshot: snapshotChoice.input.checked,
			highlight: highlightChoice.input.checked,
		};
		link.value = formatShareUrl(window.location.href, route, choices);
		showCopyStatus();
	};
	destination.addEventListener('change', updateShare);
	includes.addEventListener('change', updateShare);
	labels.push(updateShare);
	withIcon(
		button(toolbar, 'personalShare', () => {
			updateShare();
			shareDialog.showModal();
			shareBody.scrollTop = 0;
			destination.focus();
		}),
		'share',
	).id = 'personal-share-button';

	const { node: dataDialog, body: dataBody } = dialog('personalData', 'options');
	dataDialog.classList.add('options-dialog');
	const section = (parent: HTMLElement, key: StringKey) => {
		const node = element('section', parent);
		node.className = 'options-section';
		text(element('h3', node), key);
		return node;
	};
	const appearance = section(dataBody, 'optionsAppearance');
	const languageLabel = element('label', appearance);
	languageLabel.className = 'option-label';
	text(languageLabel, 'languagePickerLabel');
	const language = element('select', languageLabel);
	language.id = 'options-language';
	for (const code of listLocales()) {
		const option = element('option', language);
		option.value = code;
		option.textContent = localeName(code);
	}
	language.value = getLocale();
	language.addEventListener('change', () => setLocale(language.value));
	const languageHelp = element('p', appearance);
	languageHelp.className = 'option-help';
	languageHelp.id = 'options-language-help';
	text(languageHelp, 'optionsLanguageHelp');
	language.setAttribute('aria-describedby', languageHelp.id);
	labels.push(() => {
		language.value = getLocale();
	});
	const themes = element('fieldset', appearance);
	themes.className = 'theme-options';
	text(element('legend', themes), 'optionsTheme');
	const themeInputs: HTMLInputElement[] = [];
	for (const [value, key, icon] of [
		['auto', 'themeAuto', 'device'],
		['light', 'themeLight', 'sun'],
		['dark', 'themeDark', 'moon'],
	] as const) {
		const label = element('label', themes);
		const radio = element('input', label);
		radio.type = 'radio';
		radio.name = 'options-theme';
		radio.value = value;
		radio.addEventListener('change', () => options.theme.setTheme(value as ThemePreference));
		label.append(createIcon(icon));
		text(element('span', label), key);
		themeInputs.push(radio);
	}
	const updateTheme = () => {
		for (const radio of themeInputs) {
			radio.checked = radio.value === options.theme.getTheme();
		}
	};
	options.theme.subscribe(updateTheme);
	updateTheme();
	const themeHelp = element('p', appearance);
	themeHelp.className = 'option-help';
	themeHelp.id = 'options-theme-help';
	text(themeHelp, 'optionsThemeHelp');
	themes.setAttribute('aria-describedby', themeHelp.id);

	const backups = section(dataBody, 'optionsDataHeading');
	const dataHelp = element('p', backups);
	dataHelp.className = 'option-help';
	text(dataHelp, 'personalDataHelp');
	const backupCards = element('div', backups);
	backupCards.className = 'backup-cards';
	const exportCard = element('div', backupCards);
	exportCard.className = 'backup-card';
	text(element('h4', exportCard), 'optionsExportHeading');
	text(element('p', exportCard), 'optionsExportHelp');
	const importCard = element('div', backupCards);
	importCard.className = 'backup-card';
	text(element('h4', importCard), 'optionsImportHeading');
	text(element('p', importCard), 'optionsImportHelp');
	const dataStatus = element('p', backups);
	dataStatus.className = 'dialog-status';
	dataStatus.setAttribute('role', 'status');
	let dataFeedback: { key: StringKey; params?: Record<string, string | number> } | undefined;
	const showDataStatus = (key?: StringKey, params?: Record<string, string | number>) => {
		dataFeedback = key ? { key, params } : undefined;
		dataStatus.textContent = key ? t(key, params) : '';
		dataStatus.dataset.tone = key === 'personalImportError' ? 'error' : 'success';
	};
	labels.push(() => showDataStatus(dataFeedback?.key, dataFeedback?.params));
	withIcon(
		button(exportCard, 'personalExport', () => {
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
				showDataStatus('personalExported');
			});
		}),
		'download',
	);
	const importButton = withIcon(
		button(importCard, 'personalImport', () => file.click()),
		'upload',
	);
	const file = element('input', importCard);
	file.type = 'file';
	file.accept = '.json,application/json';
	file.id = 'personal-import';
	file.hidden = true;
	file.addEventListener('change', () => {
		void (async () => {
			try {
				const input = file.files?.[0];
				if (!input) {
					return;
				}
				importButton.disabled = true;
				showDataStatus('personalImporting', { name: input.name });
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
				showDataStatus('personalImported', {
					inventories: imported.inventories.length,
					dishes: imported.dishes.length,
				});
			} catch {
				showDataStatus('personalImportError');
			} finally {
				file.value = '';
				importButton.disabled = false;
			}
		})();
	});
	const privacy = element('p', dataBody);
	privacy.className = 'options-privacy';
	privacy.append(createIcon('shield'));
	text(element('span', privacy), 'optionsPrivacy');
	const done = element('div', dataBody);
	done.className = 'dialog-actions';
	button(done, 'personalDone', () => dataDialog.close()).classList.add('button-primary');
	withIcon(
		button(toolbar, 'personalData', () => {
			showDataStatus();
			language.value = getLocale();
			updateTheme();
			dataDialog.showModal();
			language.focus();
		}),
		'options',
	).id = 'personal-options-button';
	document.addEventListener('foodguide:localechange', () => {
		for (const update of labels) {
			update();
		}
		renderStatus();
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
