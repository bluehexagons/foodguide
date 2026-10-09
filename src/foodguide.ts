import type {
	Food,
	Recipe,
	GuideItem,
	CalculatorRow,
	ModifyItem,
	AnalysisRow,
	RecipeData,
	FoodCollection,
	RecipeCollection,
} from './models.js';
import type { SortableTable } from './sortable-table.js';
import type { StringKey } from './strings.js';
import type { DropdownItem } from './dropdown.js';
import { createSavedStateStore, restoreGameSelection } from './preferences.js';
import { createFoodSelectionResolver } from './food-selection.js';
import { getCollectionItem } from './collection.js';

declare global {
	interface Window {
		food: FoodCollection;
		recipes: RecipeCollection;
		recipeCrunchData: RecipeData;
		analysis: { made: AnalysisRow[] };
		matchingNames: ReturnType<typeof createRecipeCalculator>['matchingNames'];
	}
}
const requireElement = (id: string): HTMLElement => {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing guide element: ${id}`);
	}
	return element;
};
const eventElement = (event: Event): HTMLElement => {
	if (!(event.target instanceof HTMLElement)) {
		throw new Error('Expected an element event target');
	}
	return event.target;
};

/*
 * Don't Starve Food Guide — main browser entry point.
 *
 * Wires up tabs, ingredient pickers, recipe tables, the statistics
 * analyzer, and mode/character/theme selectors. Pure data and helper
 * modules live in separate files (see html/foodguide-data.js for the
 * library entry point); this file is the DOM glue.
 *
 * Licensed under the Apache License, Version 2.0. See LICENSE.
 */

import {
	base_cook_time,
	characters,
	defaultStatMultipliers,
	dlcOptions,
	gameVersions,
	headings,
	modes,
	perish_fridge_mult,
	perish_ground_mult,
	perish_summer_mult,
	perish_winter_mult,
	sanity_small,
	spoiled_food_hunger,
	stale_food_health,
	stale_food_hunger,
	TOGETHER,
	WARLY,
	total_day_time,
} from './constants.js';
import { food } from './food.js';
import { createDropdownFactory } from './dropdown.js';
import { createRecipeCalculator } from './recipe-calculator.js';
import { createRecipeAnalyzer } from './recipe-analyzer.js';
import { sortIngredients } from './ingredient-sort.js';
import { createThemeController } from './theme-controller.js';
import { createSortableTableFactory } from './sortable-table.js';
import { recipes, updateFoodRecipes, updateRecipeText } from './recipes.js';
import { makeImage, makeLinkable, makeElement } from './utils.js';
import {
	matchesMode,
	getActiveMultipliers,
	calculateModeMask,
	calculateCharMask,
	isCharacterApplicable,
	getCharacterFoodModifiers,
	getCharacterAbilities,
} from './mode-utils.js';
import {
	t,
	applyTranslations,
	formatDuration,
	durationUnit,
	initLocale,
	setLocale,
	getLocale,
	listLocales,
	localeName,
} from './strings.js';
import './locales/index.js';

(() => {
	const createDropdown = createDropdownFactory({
		documentRef: document,
		translate: t,
		getStorage: () => window.localStorage,
	});

	/** If the click landed on an icon element, return its parent; otherwise return the target itself. */
	const resolveIconTarget = (el: EventTarget | null): HTMLElement => {
		if (!(el instanceof HTMLElement)) {
			throw new Error('Expected an icon or element');
		}
		return el.tagName === 'IMG' || el.classList.contains('icon') ? el.parentElement || el : el;
	};

	const modeRefreshers: (() => void)[] = [];
	const localeTables = new Set<SortableTable>();
	const responsiveTables = new Set<SortableTable>();
	let tableResizeTimeout: ReturnType<typeof setTimeout> | undefined;

	window.addEventListener('resize', () => {
		clearTimeout(tableResizeTimeout);
		tableResizeTimeout = setTimeout(() => {
			for (const tableContainer of Array.from(responsiveTables)) {
				if (!tableContainer.isConnected) {
					responsiveTables.delete(tableContainer);
				} else {
					tableContainer.updateResponsive?.();
				}
			}
		}, 150);
	});
	let simulatorLocaleRefresh: (() => void) | null = null;
	let discoveryLocaleRefresh: (() => void) | null = null;

	let statMultipliers = defaultStatMultipliers;
	let characterFoodModifiers: { modifyItem: ModifyItem } = { modifyItem: () => ({}) };

	// Mode state: game version + DLC toggles + optional character
	const preferences = createSavedStateStore({
		getStorage: () => window.localStorage,
		onError: error => console.warn('Unable to access saved preferences', error),
	});
	const savedState = preferences.load();
	const selection = restoreGameSelection(savedState);
	let currentVersion = selection.version;
	const activeDlc = selection.dlc;
	let currentCharacter = selection.character;
	let modeMask = calculateModeMask(
		currentVersion,
		activeDlc,
		currentCharacter,
		gameVersions,
		dlcOptions,
		characters,
	);
	let charMask = calculateCharMask(currentCharacter, currentVersion, activeDlc, characters);
	const resolveIngredient = createFoodSelectionResolver(food);

	const themeController = createThemeController({
		getStorage: () => window.localStorage,
		mediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),
		rootElement: document.documentElement,
		toggleButton: document.getElementById('theme-toggle'),
		translate: t,
	});

	// Initialise the i18n layer: pick a locale (storage > navigator > en),
	// populate the language picker, and apply translations to the static HTML.
	initLocale();
	updateRecipeText();
	updateFoodRecipes(recipes.filter(r => matchesMode(r.modeMask, modeMask, r.charMask, charMask)));

	const langPicker = document.querySelector<HTMLSelectElement>('#language-picker');
	if (langPicker) {
		const localeFlags: Record<string, string> = { en: '🇺🇸', es: '🇪🇸', zh: '🇨🇳' };
		const codes = listLocales();
		for (const code of codes) {
			const opt = document.createElement('option');
			opt.value = code;
			const flag = localeFlags[code];
			opt.textContent = flag ? `${flag} ${localeName(code)}` : localeName(code);
			langPicker.appendChild(opt);
		}
		langPicker.value = getLocale();
		langPicker.addEventListener('change', () => {
			setLocale(langPicker.value);
		});
	}

	applyTranslations();
	themeController.updateLabel();

	// Re-apply translations whenever the locale changes so static strings
	// (and any newly-injected DOM that uses data-i18n) update in place.
	document.addEventListener('foodguide:localechange', () => {
		applyTranslations();
		themeController.updateLabel();
		if (langPicker) {
			langPicker.value = getLocale();
		}
		updateRecipeText();
		// Rebuild per-food info (tag chips, "dry in N days") so localized
		// labels appear without changing the active mode/character.
		updateFoodRecipes(
			recipes.filter(r => matchesMode(r.modeMask, modeMask, r.charMask, charMask)),
		);
		if (simulatorLocaleRefresh) {
			simulatorLocaleRefresh();
		}
		if (discoveryLocaleRefresh) {
			discoveryLocaleRefresh();
		}
		for (const tableContainer of Array.from(localeTables)) {
			if (!tableContainer.isConnected) {
				localeTables.delete(tableContainer);
			} else if (tableContainer.updateLocale) {
				tableContainer.updateLocale();
			}
		}
	});

	/**
	 * Determines if the Mode column should be shown in tables.
	 * In DST mode, the Mode column is hidden unless Warly is selected.
	 * In other game modes, the Mode column is always shown.
	 */
	const shouldShowModeColumn = () => {
		// Check if we're in DST mode
		const isDST = (modeMask & TOGETHER) !== 0 && currentVersion === 'together';
		// Check if Warly is selected
		const isWarlySelected = (charMask & WARLY) !== 0;

		// Show Mode column if: not in DST, OR in DST with Warly selected
		return !isDST || isWarlySelected;
	};

	/**
	 * Returns autoHide array for tables, conditionally including 'Mode' column.
	 */
	const getAutoHideColumns = (baseColumns: string[]) => {
		const columns = [...baseColumns];
		if (!shouldShowModeColumn() && !columns.includes('Mode')) {
			columns.push('Mode');
		}
		return columns;
	};

	const tableLabelKeys: Record<string, StringKey> = {
		Name: 'tableName',
		Info: 'tableInfo',
		Mode: 'tableMode',
		Health: 'tableHealth',
		'Health+': 'tableHealthGain',
		Hunger: 'tableHunger',
		'Hunger+': 'tableHungerGain',
		Sanity: 'tableSanity',
		Perish: 'tablePerish',
		'Cook Time': 'tableCookTime',
		Priority: 'tablePriority',
		Notes: 'tableNotes',
		Requires: 'tableRequires',
		Ingredients: 'tableIngredients',
	};

	const tableHintKeys: Record<string, StringKey> = {
		'Health restored (change if cooked)': 'tableHealthHint',
		'Health gained compared to ingredients': 'tableHealthGainHint',
		'Hunger restored (change if cooked)': 'tableHungerHint',
		'Hunger gained compared to ingredients': 'tableHungerGainHint',
		'Sanity restored (change if cooked)': 'tableSanityHint',
		'Time to turn to rot (change if cooked)': 'tablePerishHint',
		'One of the highest priority recipes for a combination will be made': 'tablePriorityHint',
		'Dim, struck items cannot be used': 'tableRequiresHint',
		'Dim+struck items cannot be used': 'tableRequiresHint',
		'DLC or Game Mode required': 'tableModeHint',
	};

	const summaryLabelKeys: Record<string, StringKey> = {
		Total: 'simulatorSummaryTotal',
		Potential: 'simulatorSummaryPotential',
	};

	const translateTableLabel = (label: string) => {
		const key = tableLabelKeys[label];
		return key ? t(key) : label;
	};

	const translateSummaryLabel = (label: string) => {
		const key = summaryLabelKeys[label];
		return key ? t(key) : label;
	};

	const translateTableHint = (hint: string) => {
		const key = tableHintKeys[hint];
		return key ? t(key) : hint;
	};

	const setModeButtonSelected = (button: HTMLElement, selected: boolean) => {
		button.classList.toggle('selected', selected);
		button.setAttribute('aria-pressed', String(selected));
	};

	/**
	 * Sets game mode and updates UI accordingly.
	 * Called when the user selects a version, toggles DLC, or toggles a character.
	 */
	const setMode = () => {
		modeMask = calculateModeMask(
			currentVersion,
			activeDlc,
			currentCharacter,
			gameVersions,
			dlcOptions,
			characters,
		);
		charMask = calculateCharMask(currentCharacter, currentVersion, activeDlc, characters);
		statMultipliers = getActiveMultipliers(
			currentVersion,
			activeDlc,
			currentCharacter,
			characters,
			defaultStatMultipliers,
		);
		characterFoodModifiers = getCharacterFoodModifiers(currentCharacter, characters);

		updateFoodRecipes(
			recipes.filter(r => matchesMode(r.modeMask, modeMask, r.charMask, charMask)),
		);

		if (document.getElementById('statistics')?.hasChildNodes()) {
			requireElement('statistics').replaceChildren(makeRecipeGrinder(null, true));
		}

		// Update version button states
		const versionButtons = modePanel.querySelectorAll<HTMLElement>('.version-btn');
		for (const btn of versionButtons) {
			const ver = gameVersions[btn.dataset.version || ''];
			if (!ver) {
				continue;
			}
			setModeButtonSelected(btn, btn.dataset.version === currentVersion);
		}

		// Show/hide DLC section (only visible for 'dontstarve')
		const dlcSection = modePanel.querySelector<HTMLElement>('.dlc-section');
		const dlcDivider = modePanel.querySelector<HTMLElement>('.dlc-divider');
		if (dlcSection) {
			dlcSection.classList.toggle('hidden', currentVersion !== 'dontstarve');
		}
		if (dlcDivider) {
			dlcDivider.style.display = currentVersion === 'dontstarve' ? '' : 'none';
		}

		// Update DLC toggle states
		const dlcButtons = modePanel.querySelectorAll<HTMLElement>('.dlc-btn');
		for (const btn of dlcButtons) {
			const dlcKey = btn.dataset.dlc;
			setModeButtonSelected(btn, !!activeDlc[dlcKey || '']);
		}

		// Update character button states and visibility
		const charSection = modePanel.querySelector<HTMLElement>('.char-section');
		const charDivider = modePanel.querySelector<HTMLElement>('.char-divider');
		const charButtons = modePanel.querySelectorAll<HTMLElement>('.char-btn');
		let anyCharApplicable = false;
		for (const btn of charButtons) {
			const charName = btn.dataset.character || '';
			const applicable = isCharacterApplicable(
				charName,
				currentVersion,
				activeDlc,
				characters,
			);
			if (applicable) {
				anyCharApplicable = true;
			}
			btn.classList.toggle('hidden', !applicable);
			setModeButtonSelected(btn, applicable && charName === currentCharacter);
		}
		if (charSection) {
			charSection.classList.toggle('hidden', !anyCharApplicable);
		}
		if (charDivider) {
			charDivider.style.display = anyCharApplicable ? '' : 'none';
		}

		for (let i = 0; i < modeRefreshers.length; i++) {
			modeRefreshers[i]();
		}
	};

	const { matchingNames, getSuggestions, getRecipes } = createRecipeCalculator({
		getModeMask: () => modeMask,
		getCharMask: () => charMask,
		getStatMultipliers: () => statMultipliers,
	});

	const mainElement = requireElement('main');
	const foodElement = requireElement('food');
	const recipesElement = requireElement('recipes');
	const navbar = requireElement('navbar');

	const populateGameInfoNumbers = () => {
		const set = (id: string, text: string) => {
			const el = document.getElementById(id);
			if (!el) {
				return;
			}
			el.textContent = '';
			el.appendChild(document.createTextNode(text));
		};
		const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
		set('stalehealth', pct(stale_food_health));
		set('stalehunger', pct(stale_food_hunger));
		set('spoiledhunger', pct(spoiled_food_hunger));
		set('spoiledsanity', String(sanity_small));
		set('perishground', pct(perish_ground_mult));
		set('perishwinter', pct(perish_winter_mult));
		set('perishsummer', pct(perish_summer_mult));
		set('perishfridge', pct(perish_fridge_mult));
	};
	populateGameInfoNumbers();
	// Re-populate after a locale change, since applyTranslations() rewrites
	// the parent paragraph's innerHTML and recreates the placeholder spans.
	document.addEventListener('foodguide:localechange', populateGameInfoNumbers);

	const recipeAnalyzer = createRecipeAnalyzer({
		getModeMask: () => modeMask,
		getCharMask: () => charMask,
		getStatMultipliers: () => statMultipliers,
		onRecipeData: data => {
			window.recipeCrunchData = data;
		},
	});
	const getRealRecipesFromCollection = recipeAnalyzer.analyze;

	let setTab: (id: string) => void;

	(() => {
		const navtabs = navbar.getElementsByTagName('li');
		const tabs: Record<string, HTMLElement> = {};
		const elements: Record<string, HTMLElement> = {};
		let activePage: HTMLElement;
		let activeTab: HTMLElement;

		const showTab = (e: Event) => {
			setTab(e.currentTarget instanceof HTMLElement ? e.currentTarget.dataset.tab || '' : '');
		};

		setTab = tabID => {
			activeTab.className = '';
			activeTab.setAttribute('aria-pressed', 'false');
			activeTab = tabs[tabID];
			activePage.style.display = 'none';
			activePage = elements[tabID];
			activeTab.className = 'selected';
			activeTab.setAttribute('aria-pressed', 'true');
			activePage.style.display = 'block';

			// Initialize statistics tab content on first visit
			if (tabID === 'statistics' && !activePage.hasChildNodes()) {
				activePage.appendChild(makeRecipeGrinder(null, true));
			}
		};

		for (let i = 0; i < navtabs.length; i++) {
			const navtab = navtabs[i];

			if (navtab.dataset.tab) {
				navtab.setAttribute('role', 'button');
				navtab.setAttribute('aria-controls', navtab.dataset.tab);
				navtab.setAttribute('aria-pressed', 'false');
				navtab.tabIndex = 0;
				tabs[navtab.dataset.tab] = navtab;
				elements[navtab.dataset.tab] = requireElement(navtab.dataset.tab);
				elements[navtab.dataset.tab].style.display = 'none';
				navtab.addEventListener(
					'selectstart',
					e => {
						e.preventDefault();
					},
					false,
				);
				navtab.addEventListener('click', showTab, false);
				navtab.addEventListener('keydown', event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						showTab(event);
					}
				});
			}
		}

		activeTab = tabs['simulator'];
		activePage = elements['simulator'];

		if (savedState.activeTab && Object.hasOwn(tabs, savedState.activeTab)) {
			activeTab = tabs[savedState.activeTab];
			activePage = elements[savedState.activeTab];
		} else if (savedState.activeTab === 'help') {
			// The old help tab was split into About and Game Info.
			activeTab = tabs['about'];
			activePage = elements['about'];
		}

		activeTab.className = 'selected';
		activeTab.setAttribute('aria-pressed', 'true');
		activePage.style.display = 'block';

		window.addEventListener('beforeunload', () => {
			preferences.update(state => {
				state.activeTab = activeTab.dataset.tab;
				state.version = currentVersion;
				state.dlc = { giants: !!activeDlc.giants, shipwrecked: !!activeDlc.shipwrecked };
				state.character = currentCharacter;
				// Keep modeMask for backward compatibility during migration.
				state.modeMask = modeMask;
			});
		});
	})();

	const { cells, fandomHref, makeSortableTable } = createSortableTableFactory({
		mainElement,
		translate: t,
		translateTableLabel,
		translateTableHint,
		translateSummaryLabel,
		localeTables,
		responsiveTables,
	});

	const fractionChars = ['\u215b', '\u00bc', '\u215c', '\u00bd', '\u215d', '\u00be', '\u215e'];

	const sign = (input: number | string | undefined) => {
		let n = Number(input);
		if (isNaN(n)) {
			return '';
		}

		const nEights = ((Math.abs(n) % 1) * 8) | 0;
		const fractStr = nEights < 1 || nEights > 7 ? '' : fractionChars[nEights - 1] || '';

		n = Math.floor(n);
		return (n > 0 ? `+${n}` : n) + fractStr;
	};

	const rawpct = (base: number, val: number) => {
		return base < val
			? (val - base) / Math.abs(base)
			: base > val
				? -(base - val) / Math.abs(base)
				: 0;
	};

	const pct = (base: number, val: number) => {
		if (isNaN(base) || base === val) {
			return '';
		}
		let percentChange;
		if (base < val) {
			percentChange = (val - base) / Math.abs(base);
		} else if (base > val) {
			percentChange = -(base - val) / Math.abs(base);
		} else {
			percentChange = 0;
		}
		const result = ` (${sign((percentChange * 100).toFixed(0))}%)`;
		return result.indexOf('Infinity') === -1 ? result : ` (${sign(val - base)})`;
	};

	const formatDays = (value: number) => formatDuration('day', value);

	const formatSeconds = (value: number) => formatDuration('sec', value);

	const formatPerish = (value?: number) =>
		isNaN(Number(value)) ? t('durationNever') : formatDays(Number(value) / total_day_time);

	const formatToDays = (value: number) =>
		t('durationToDays', { count: value, unit: durationUnit('day', value) });

	const makeFoodRow = (item: Food) => {
		const mult = statMultipliers[item.preparationType];
		const itemMods =
			'preparationType' in item ? characterFoodModifiers.modifyItem(item, modeMask) : {};
		let health = sign((itemMods.health ?? item.health ?? NaN) * mult);
		let hunger = sign((itemMods.hunger ?? item.hunger ?? NaN) * mult);
		let sanity = isNaN(Number(item.sanity))
			? ''
			: (itemMods.sanity ?? item.sanity ?? NaN) * mult;
		let perish = formatPerish(item.perish);

		if (item.cook) {
			const cookmult = statMultipliers[item.cook.preparationType];
			const cookMods = characterFoodModifiers.modifyItem(item.cook, modeMask);

			if ((item.cook.health || 0) !== (item.health || 0)) {
				const rawHealth = ((itemMods.health ?? item.health) || 0) * mult;
				const cookedHealth = ((cookMods.health ?? item.cook.health) || 0) * cookmult;
				health = `${health === '' ? '0' : health} (${sign(cookedHealth - rawHealth)})`;
			}
			if ((item.cook.hunger || 0) !== (item.hunger || 0)) {
				const rawHunger = ((itemMods.hunger ?? item.hunger) || 0) * mult;
				const cookedHunger = ((cookMods.hunger ?? item.cook.hunger) || 0) * cookmult;
				hunger = `${hunger === '' ? '0' : hunger} (${sign(cookedHunger - rawHunger)})`;
			}
			if ((item.cook.sanity || 0) !== (item.sanity || 0)) {
				const rawSanity = ((itemMods.sanity ?? item.sanity) || 0) * mult;
				const cookedSanity = ((cookMods.sanity ?? item.cook.sanity) || 0) * cookmult;
				sanity = `${sanity === '' ? '0' : sanity} (${sign(cookedSanity - rawSanity)})`;
			}
			if ((item.cook.perish || 0) !== (item.perish || 0)) {
				const dayDifference =
					((item.cook.perish || 0) - (item.perish || 0)) / total_day_time;
				if (isNaN(dayDifference)) {
					perish += ` (${t('durationToNever')})`;
				} else {
					perish += ` (${
						item.perish
							? sign(dayDifference)
							: formatToDays(Number(item.cook.perish) / total_day_time)
					})`;
				}
			}
		}

		return cells(
			'td',
			item.img ? `${item.img}:${item.name}` : '',
			fandomHref(item.name),
			health,
			hunger,
			sanity,
			perish,
			item.info || '',
			('modeNode' in item && item.modeNode) || '',
		);
	};

	const makeRecipeRow = (item: CalculatorRow, health = NaN, hunger = NaN, sanity = NaN) => {
		const mult = 'preparationType' in item ? statMultipliers[item.preparationType] || 1 : 1;
		const itemMods =
			'preparationType' in item ? characterFoodModifiers.modifyItem(item, modeMask) : {};
		const ihealth = (itemMods.health ?? item.health ?? NaN) * mult;
		const ihunger = (itemMods.hunger ?? item.hunger ?? NaN) * mult;
		const isanity = (itemMods.sanity ?? item.sanity ?? NaN) * mult;

		return cells(
			'td',
			item.img ? `${item.img}:${item.name}` : '',
			fandomHref(item.name),
			sign(ihealth) + pct(health, ihealth),
			sign(ihunger) + pct(hunger, ihunger),
			isNaN(isanity) ? '' : sign(isanity) + pct(sanity, isanity),
			formatPerish(item.perish),
			formatSeconds((item.cooktime * base_cook_time + 0.5) | 0),
			item.priority || '0',
			('requires' in item && item.requires) || '',
			('note' in item && item.note) || '',
			('modeNode' in item && item.modeNode) || '',
		);
	};

	// food list, recipe list
	let foodHighlight: string | undefined;
	let foodHighlighted: Food[] = [];
	let recipeHighlighted: Recipe[] = [];

	const highlightKey = (input: Event | string) =>
		typeof input === 'string' ? input : resolveIconTarget(input.target).dataset.link || '';

	const highlightFoods = (name: string, { toggle = false } = {}) => {
		if (toggle && foodHighlight === name) {
			foodHighlight = '';
			foodHighlighted = [];
		} else {
			foodHighlight = name;
			foodHighlighted = matchingNames(food, name);
		}
		foodTable.update(true);
	};

	const highlightRecipes = (name: string) => {
		recipeHighlighted = matchingNames(recipes, name);
		recipeTable.update(true);
	};

	const setHighlight = (input: Event | string, { navigateToFood = true } = {}) => {
		const name = highlightKey(input);
		if (name.startsWith('recipe:') || name.startsWith('ingredient:')) {
			setTab('crockpot');
			highlightRecipes(name.startsWith('recipe:') ? `*${name.slice(7)}` : name);
		} else {
			if (navigateToFood) {
				setTab('foodlist');
			}
			highlightFoods(name, { toggle: true });
		}
	};

	const setFoodHighlight = (event: Event) => setHighlight(event, { navigateToFood: false });

	const setRecipeHighlight = (event: Event) => {
		const name = highlightKey(event);
		const modeName = name.slice(name.indexOf(':') + 1);
		if (Object.hasOwn(modes, modeName)) {
			highlightRecipes(name);
		} else {
			setTab('foodlist');
			highlightFoods(name);
		}
	};

	const testFoodHighlight = (item: Food) => {
		return foodHighlighted.includes(item);
	};

	const testRecipeHighlight = (item: Recipe) => {
		return recipeHighlighted.includes(item);
	};

	const testmode = (item: GuideItem) => {
		return matchesMode(item.modeMask, modeMask, item.charMask, charMask);
	};

	const foodTable = makeSortableTable({
		headers: {
			'': '',
			Name: 'name',
			Health: 'health',
			Hunger: 'hunger',
			Sanity: 'sanity',
			Perish: 'perish',
			Info: '',
			Mode: 'modeMask',
		},
		dataset: Array.from(food),
		rowGenerator: makeFoodRow,
		defaultSort: 'name',
		linkCallback: setFoodHighlight,
		highlightCallback: testFoodHighlight,
		filterCallback: testmode,
		columnConfig: {
			toggleable: true,
			columns: ['Health', 'Hunger', 'Sanity', 'Perish', 'Info', 'Mode'],
			autoHide: getAutoHideColumns(['Sanity']),
		},
	});

	const recipeTable = makeSortableTable({
		headers: {
			'': '',
			Name: 'name',
			Health: 'health',
			Hunger: 'hunger',
			Sanity: 'sanity',
			Perish: 'perish',
			'Cook Time': 'cooktime',
			'Priority:One of the highest priority recipes for a combination will be made':
				'priority',
			'Requires:Dim+struck items cannot be used': '',
			Notes: '',
			Mode: 'modeMask',
		},
		dataset: Array.from(recipes),
		rowGenerator: makeRecipeRow,
		defaultSort: 'name',
		linkCallback: setRecipeHighlight,
		highlightCallback: testRecipeHighlight,
		filterCallback: testmode,
		columnConfig: {
			toggleable: true,
			columns: [
				'Health',
				'Hunger',
				'Sanity',
				'Perish',
				'Cook Time',
				'Priority',
				'Notes',
				'Mode',
			],
			autoHide: getAutoHideColumns(['Sanity', 'Cook Time', 'Notes']),
		},
	});

	foodElement.appendChild(foodTable);
	recipesElement.appendChild(recipeTable);

	modeRefreshers.push(() => {
		foodTable.update();
		recipeTable.update();
		// Update auto-hide columns based on new mode
		if (foodTable.updateAutoHide) {
			foodTable.updateAutoHide(getAutoHideColumns(['Sanity']));
		}
		if (recipeTable.updateAutoHide) {
			recipeTable.updateAutoHide(getAutoHideColumns(['Sanity', 'Cook Time', 'Notes']));
		}
	});

	// statistics analyzer
	const ingredientToIcon = (a: string, b: Food) => {
		return `${a}[ingredient:${food[b.id].name}|${food[b.id].img}]`;
	};

	const makeRecipeGrinder = (ingredients: Food[] | null, excludeDefault = false) => {
		const makableButton = document.createElement('button');
		let hasTable = false;
		let isCalculating = false;

		const updateMakableButtonLabel = () => {
			makableButton.textContent = isCalculating ? t('calculating') : t('calculateRecipes');
		};
		updateMakableButtonLabel();
		makableButton.className = 'makablebutton';
		document.addEventListener('foodguide:localechange', updateMakableButtonLabel);
		const initializeGrinder = () =>
			(() => {
				const idealIngredients: Food[] = [];
				const makableRecipes: string[] = [];
				const usedIngredients = new Set<string>();
				const excludedIngredients = new Set<string>();
				const excludedRecipes = new Set<string>();

				let i = ingredients ? ingredients.length : 0;

				let selectedRecipe: string | null = null;
				let selectedRecipeElement: HTMLElement | null = null;
				let made: AnalysisRow[] = [];

				const deleteButton = document.createElement('button');
				deleteButton.appendChild(document.createTextNode(t('clearResults')));
				deleteButton.className = 'deleteButton';
				deleteButton.addEventListener('click', () => {
					calculationControl?.cancel();
					makableDiv.remove();
					hasTable = false;
					isCalculating = false;
					if (updateMakableTexts) {
						document.removeEventListener('foodguide:localechange', updateMakableTexts);
					}
					if (updateMakableControls) {
						document.removeEventListener(
							'foodguide:localechange',
							updateMakableControls,
						);
					}
					updateMakableButtonLabel();
					makableButton.disabled = false;
				});
				if (hasTable) {
					makableButton.nextSibling?.remove();
				}
				hasTable = true;

				const checkExcludes = (item: Food) => excludedIngredients.has(item.key);
				const checkIngredient = function (this: Food[], item: string) {
					return this.includes(food[item]);
				};

				// Cycle through filter states: normal -> required -> excluded -> normal
				const cycleFilterState = (target: HTMLElement, reverse = false) => {
					const id = target.dataset.id || '';
					const isRequired = usedIngredients.has(id);
					const isExcluded = excludedIngredients.has(id);

					// Determine current state
					let currentState = 'normal';
					if (isRequired) {
						currentState = 'required';
					} else if (isExcluded) {
						currentState = 'excluded';
					}

					// Cycle to next state
					let nextState;
					if (reverse) {
						// Reverse cycle for right-click: normal -> excluded -> required -> normal
						if (currentState === 'normal') {
							nextState = 'excluded';
						} else if (currentState === 'excluded') {
							nextState = 'required';
						} else {
							nextState = 'normal';
						}
					} else {
						// Forward cycle for left-click: normal -> required -> excluded -> normal
						if (currentState === 'normal') {
							nextState = 'required';
						} else if (currentState === 'required') {
							nextState = 'excluded';
						} else {
							nextState = 'normal';
						}
					}

					// Clear current state
					usedIngredients.delete(id);
					excludedIngredients.delete(id);
					target.classList.remove('selected', 'excluded');

					// Apply next state
					if (nextState === 'required') {
						usedIngredients.add(id);
						target.classList.add('selected');
					} else if (nextState === 'excluded') {
						excludedIngredients.add(id);
						target.classList.add('excluded');
					}

					makableTable.update();
				};

				const toggleFilter = (e: Event) => {
					cycleFilterState(eventElement(e), false);
				};

				const toggleExclude = (e: Event) => {
					cycleFilterState(eventElement(e), true);
					e.preventDefault();
				};

				const setRecipe = (e: Event) => {
					const target = eventElement(e);
					const recipeId = target.dataset.recipe || '';

					// Clear all recipe selections first
					for (const el of makableRecipe.querySelectorAll<HTMLElement>('.icon')) {
						el.classList.remove('selected', 'excluded');
					}

					// Cycle through: normal -> selected -> excluded -> normal
					if (excludedRecipes.has(recipeId)) {
						// Currently excluded -> go to normal
						excludedRecipes.delete(recipeId);
						selectedRecipeElement = null;
						selectedRecipe = null;
					} else if (selectedRecipe === recipeId) {
						// Currently selected -> go to excluded
						excludedRecipes.add(recipeId);
						target.classList.add('excluded');
						selectedRecipeElement = null;
						selectedRecipe = null;
					} else {
						// Normal or other recipe selected -> select this one
						excludedRecipes.clear();
						selectedRecipe = recipeId;
						selectedRecipeElement = target;
						target.classList.add('selected');
					}

					makableTable.update();
				};

				const excludeRecipe = (e: Event) => {
					const target = eventElement(e);
					const recipeId = target.dataset.recipe || '';

					// Clear selection
					if (selectedRecipeElement) {
						selectedRecipeElement.classList.remove('selected');
						selectedRecipeElement = null;
						selectedRecipe = null;
					}

					// Toggle excluded state (shortcut for right-click)
					if (excludedRecipes.has(recipeId)) {
						excludedRecipes.delete(recipeId);
						target.classList.remove('excluded');
					} else {
						excludedRecipes.add(recipeId);
						target.classList.add('excluded');
					}

					makableTable.update();

					e.preventDefault();
				};

				//TODO: optimize so much around this
				ingredients ||= Array.from(food);
				ingredients = ingredients.filter(f =>
					matchesMode(f.modeMask, modeMask, f.charMask, charMask),
				);
				i = ingredients!.length;

				if (excludeDefault) {
					for (const ingredient of ingredients
						.filter(ingredient => ingredient.defaultExclude)
						.map(ingredient => ingredient.key)) {
						excludedIngredients.add(ingredient);
					}

					for (const recipe of recipes
						.filter(recipe => recipe.defaultExclude)
						.map(recipe => recipe.id)) {
						excludedRecipes.add(recipe);
					}
				}

				const tryPush = (ingredient: Food) => {
					if (!ingredient.uncookable && !ingredient.skip) {
						idealIngredients.push(ingredient);
					}
				};

				while (i--) {
					const ingredient = ingredients![i];
					const cook = ingredient.cook,
						dry = ingredient.dry,
						raw = ingredient.raw,
						wet = ingredient.wet;
					if (!ingredient.skip) {
						if (
							!ingredient.uncookable &&
							(!ingredient.cooked || ingredient.ideal) &&
							idealIngredients.indexOf(ingredient) === -1
						) {
							tryPush(ingredient);
						}
					} else {
						if (
							cook &&
							!cook.uncookable &&
							!cook.skip &&
							idealIngredients.indexOf(cook) === -1
						) {
							tryPush(cook);
						} else if (
							dry &&
							!dry.uncookable &&
							!dry.skip &&
							idealIngredients.indexOf(dry) === -1
						) {
							tryPush(dry);
						}
					}

					if (
						ingredient.cooked &&
						raw &&
						!raw.uncookable &&
						!raw.skip &&
						idealIngredients.indexOf(raw) === -1
					) {
						tryPush(raw);
					}

					if (
						ingredient.rackdried &&
						wet &&
						!wet.uncookable &&
						!wet.skip &&
						idealIngredients.indexOf(wet) === -1
					) {
						tryPush(wet);
					}
				}

				made = [];

				const makableTable = makeSortableTable({
					headers: {
						'': '',
						Name: 'name',
						[headings.health]: 'health',
						'Health+:Health gained compared to ingredients': 'healthpls',
						[headings.hunger]: 'hunger',
						'Hunger+:Hunger gained compared to ingredients': 'hungerpls',
						Ingredients: '',
					},
					dataset: made,
					rowGenerator: data => {
						const item = data.recipe;

						return cells(
							'td',
							item.img ? item.img : '',
							item.name,
							sign(item.health),
							`${sign(data.healthpls)} (${sign((data.healthpct * 100) | 0)}%)`,
							sign(item.hunger),
							`${sign(data.hungerpls)} (${sign((data.hungerpct * 100) | 0)}%)`,
							makeLinkable(
								data.ingredients.reduce(ingredientToIcon, '') +
									(data.multiple ? '*' : ''),
							),
						);
					},
					defaultSort: 'hungerpls',
					filterCallback: data =>
						(!selectedRecipe || data.recipe.id === selectedRecipe) &&
						!excludedRecipes.has(data.recipe.id) &&
						(excludedIngredients.size === 0 || !data.ingredients.some(checkExcludes)) &&
						[...usedIngredients].every(checkIngredient, data.ingredients),
					maxRows: 25,
					columnConfig: {
						toggleable: true,
						columns: ['Health', 'Health+', 'Hunger', 'Hunger+', 'Ingredients'],
						autoHide: ['Health+', 'Hunger+'],
					},
				});
				const updateMakableControls = () => {
					deleteButton.textContent = t('clearResults');
					customFilterInput.placeholder = t('customFilterPlaceholder');
					pauseButton.textContent =
						calculationControl && calculationControl.isPaused()
							? t('resume')
							: t('pause');
					makableTable.updateLocale();
				};

				const makableDiv = document.createElement('div');
				makableDiv.className = 'makableContainer';

				const makableSummary = document.createElement('div');
				makableSummary.className = 'makableSummary';
				const makableSummaryText = document.createTextNode(t('computingCombinations'));
				makableSummary.appendChild(makableSummaryText);

				const makableFootnote = document.createElement('div');
				makableFootnote.className = 'makableFootnote';
				const makableFootnoteText = document.createTextNode(t('multipleResultsNote'));
				makableFootnote.appendChild(makableFootnoteText);

				const filterHelp = document.createElement('div');
				filterHelp.className = 'makableFilterHelp';
				const filterHelpText = document.createTextNode(t('filterCycleHelp'));
				filterHelp.appendChild(filterHelpText);
				const updateMakableTexts = () => {
					makableSummaryText.textContent = t('computingCombinations');
					makableFootnoteText.textContent = t('multipleResultsNote');
					filterHelpText.textContent = t('filterCycleHelp');
				};
				document.addEventListener('foodguide:localechange', updateMakableTexts);

				makableDiv.appendChild(makableSummary);
				makableDiv.appendChild(makableFootnote);
				makableDiv.appendChild(filterHelp);

				const makableRecipe = document.createElement('div');
				makableRecipe.className = 'recipeFilter';
				makableDiv.appendChild(makableRecipe);

				const makableFilter = document.createElement('div');
				makableFilter.className = 'foodFilter';

				idealIngredients.forEach(item => {
					const img = makeImage(item.img);
					img.dataset.id = item.key;
					img.addEventListener('click', toggleFilter, false);
					img.addEventListener('contextmenu', toggleExclude, false);
					if (excludedIngredients.has(item.key)) {
						img.className = 'excluded';
					}
					img.title = item.name;
					makableFilter.appendChild(img);
				});

				makableDiv.appendChild(makableFilter);

				const customFilterHolder = document.createElement('div');

				const customFilterInput = document.createElement('input');
				customFilterInput.type = 'text';
				customFilterInput.placeholder = t('customFilterPlaceholder');
				customFilterInput.className = 'customFilterInput';
				customFilterHolder.appendChild(customFilterInput);

				makableDiv.appendChild(makableTable);
				makableButton.after(makableDiv);
				makableDiv.appendChild(makableFootnote);

				updateFoodRecipes(
					recipes.filter(r => matchesMode(r.modeMask, modeMask, r.charMask, charMask)),
				);

				// Create pause button upfront
				const pauseButton = document.createElement('button');
				pauseButton.appendChild(document.createTextNode(t('pause')));
				pauseButton.className = 'pauseButton';
				isCalculating = true;

				// Set button state BEFORE starting calculation
				updateMakableButtonLabel();
				makableButton.disabled = true;
				makableSummary.appendChild(deleteButton);

				const calculationControl = getRealRecipesFromCollection(
					idealIngredients,
					data => {
						// row update
						if (makableRecipes.indexOf(data.recipe.id) === -1) {
							let i = 0;

							for (i = 0; i < makableRecipes.length; i++) {
								if (data.recipe.id < makableRecipes[i]) {
									break;
								}
							}

							makableRecipes.splice(i, 0, data.recipe.id);

							const img = makeImage(recipes[makableRecipes[i].toLowerCase()].img);

							img.dataset.recipe = makableRecipes[i];
							img.addEventListener('click', setRecipe, false);
							img.addEventListener('contextmenu', excludeRecipe, false);
							if (excludedRecipes.has(data.recipe.id)) {
								img.className = 'excluded';
							}
							img.title = data.recipe.name;

							if (i < makableRecipe.childNodes.length) {
								makableRecipe.insertBefore(img, makableRecipe.childNodes[i]);
							} else {
								makableRecipe.appendChild(img);
							}
						}

						const row: AnalysisRow = {
							...data,
							name: data.recipe.name,
							health: data.recipe.health || 0,
							hunger: data.recipe.hunger || 0,
							ihealth: data.tags.health,
							ihunger: data.tags.hunger,
							healthpls: (data.recipe.health || 0) - data.tags.health,
							hungerpls: (data.recipe.hunger || 0) - data.tags.hunger,
							healthpct: rawpct(data.tags.health, data.recipe.health || 0),
							hungerpct: rawpct(data.tags.hunger, data.recipe.hunger || 0),
							sanity: data.recipe.sanity,
							perish: data.recipe.perish,
						};
						made.push(row);
					},
					() => {
						// Chunk callback - show pause button if this is called (meaning async operation)
						if (isCalculating && !pauseButton.parentNode) {
							makableSummary.appendChild(pauseButton);
						}
						makableSummaryText.textContent = t('foundValidRecipesInProgress', {
							count: made.length,
						});
					},
					() => {
						//computation finished
						isCalculating = false;

						// Remove pause button if it exists
						if (pauseButton.parentNode) {
							pauseButton.parentNode.removeChild(pauseButton);
						}

						window.analysis = {
							made,
						};

						// Start with a reasonable batch size
						makableTable.setMaxRows(500);

						// Add "Show more" functionality if there are many results
						const showMoreButton = document.createElement('button');
						showMoreButton.appendChild(document.createTextNode(t('showMoreResults')));
						showMoreButton.className = 'showMoreButton';
						let currentLimit = 500;
						showMoreButton.addEventListener('click', () => {
							currentLimit += 500;
							makableTable.setMaxRows(currentLimit);
							if (currentLimit >= made.length) {
								showMoreButton.style.display = 'none';
							}
							showMoreButton.textContent = t('showMoreResultsCount', {
								shown: Math.min(currentLimit, made.length),
								total: made.length,
							});
						});

						const summaryText = t('foundValidRecipes', { count: made.length });
						makableSummaryText.textContent = summaryText;

						if (made.length > 500) {
							showMoreButton.textContent = t('showMoreResultsCount', {
								shown: 500,
								total: made.length,
							});
							makableSummary.appendChild(showMoreButton);
						}

						makableSummary.appendChild(deleteButton);
						isCalculating = false;
						updateMakableButtonLabel();
						makableButton.disabled = false;
					},
				);
				document.addEventListener('foodguide:localechange', updateMakableControls);

				// Add pause/resume button functionality
				pauseButton.addEventListener('click', () => {
					if (calculationControl.isPaused()) {
						calculationControl.resume();
						pauseButton.textContent = t('pause');
						makableSummaryText.textContent = t('foundValidRecipesInProgress', {
							count: made.length,
						});
					} else {
						calculationControl.pause();
						pauseButton.textContent = t('resume');
						makableSummaryText.textContent = t('foundValidRecipesPaused', {
							count: made.length,
						});
					}
				});
			})();

		makableButton.addEventListener('click', initializeGrinder, false);

		return makableButton;
	};

	// Initialize statistics content after the grinder factory is available.
	const statisticsEl = document.getElementById('statistics');
	if (savedState.activeTab === 'statistics' && statisticsEl && !statisticsEl.hasChildNodes()) {
		statisticsEl.appendChild(makeRecipeGrinder(null, true));
	}

	const highestPriority = (array: CalculatorRow[]) => {
		return array.reduce((previous, current) => {
			return Math.max(previous, Number(current.priority) || 0);
		}, -100000);
	};

	window.food = food;
	window.recipes = recipes;
	window.matchingNames = matchingNames;

	const setSlot = (slotElement: HTMLElement, item: GuideItem | null) => {
		if (item !== null) {
			slotElement.dataset.id = item.key;
		} else {
			if (
				slotElement.nextElementSibling &&
				getSlot(slotElement.nextElementSibling) !== null
			) {
				setSlot(slotElement, getSlot(slotElement.nextElementSibling));
				setSlot(slotElement.nextElementSibling as HTMLElement, null);

				return;
			} else {
				delete slotElement.dataset.id;
			}
		}

		if (item !== null) {
			const img = makeImage(item.img);
			img.title = item.name;
			if (slotElement.firstChild) {
				slotElement.replaceChild(img, slotElement.firstChild);
			} else {
				slotElement.appendChild(img);
			}
		} else {
			if (slotElement.firstChild) {
				slotElement.removeChild(slotElement.firstChild);
			}
		}

		slotElement.title = item ? item.name : '';
	};

	const getSlot = (slotElement: Element | null): GuideItem | null => {
		const id = slotElement instanceof HTMLElement ? slotElement.dataset.id : undefined;
		return id ? getCollectionItem(food, id) || getCollectionItem(recipes, id) || null : null;
	};

	(() => {
		const pickers = document.querySelectorAll<HTMLInputElement>('.ingredientpicker');
		let i = pickers.length;

		while (i--) {
			const dropdown = document.createElement('div');
			let ul: HTMLElement = document.createElement('ul');
			const picker = pickers[i];
			const index = i;
			const from: import('./models.js').Collection<GuideItem> =
				picker.dataset.type === 'recipes' ? recipes : food;
			const allowUncookable = !picker.dataset.cookable;
			let list = picker.nextElementSibling;
			while (list && !list.classList.contains('ingredientlist')) {
				list =
					list.querySelector && list.querySelector('.ingredientlist')
						? list.querySelector('.ingredientlist')
						: list.nextElementSibling;
			}
			if (!(list instanceof HTMLElement)) {
				throw new Error('Ingredient list not found for picker');
			}
			const parent = list;
			if (!parent.parentElement!.classList.contains('selectionpanel')) {
				const panel = document.createElement('div');
				panel.className = 'selectionpanel';
				const title = document.createElement('div');
				title.className = 'selectionpanel-title';
				title.setAttribute(
					'data-i18n',
					picker.dataset.cookable
						? 'simulatorSelectedIngredients'
						: 'discoverySelectedIngredients',
				);
				title.textContent = t(
					picker.dataset.cookable
						? 'simulatorSelectedIngredients'
						: 'discoverySelectedIngredients',
				);
				parent.parentElement!.insertBefore(panel, parent);
				panel.appendChild(title);
				panel.appendChild(parent);
			}
			const fixedSlots = Array.from(parent.querySelectorAll<HTMLElement>('.ingredient'));
			const slots: string[] = [];

			const searchRow = document.createElement('div');
			searchRow.className = 'ingredient-search-row';

			const searchInputGroup = document.createElement('div');
			searchInputGroup.className = 'ingredient-search-input-group';
			searchRow.appendChild(searchInputGroup);

			picker.parentElement!.insertBefore(searchRow, picker);
			searchInputGroup.appendChild(picker);

			let limited: boolean;
			let ingredients: (Food | null)[] = [];
			let updateRecipes: () => void = () => {};
			const suggestions: Recipe[] = [];
			const inventoryrecipes: Recipe[] = [];
			let loaded = false;
			let selectedResult = -1;
			const results = requireElement('results');
			const discoverfood = requireElement('discoverfood');
			const discover = requireElement('discover');
			const makable = requireElement('makable');
			const clearSearchBtn = document.createElement('button');
			const clearIngredientsBtn = document.createElement('button');

			const ingredientActionTimers = new WeakMap<
				HTMLElement,
				ReturnType<typeof setTimeout>
			>();
			const flashIngredientActionError = (target: HTMLElement | null) => {
				if (!target) {
					return;
				}

				target.classList.remove('ingredient-action-error');
				void target.offsetWidth;
				target.classList.add('ingredient-action-error');
				const clearError = () => target.classList.remove('ingredient-action-error');
				target.addEventListener('animationend', clearError, { once: true });
				window.clearTimeout(ingredientActionTimers.get(target));
				ingredientActionTimers.set(target, window.setTimeout(clearError, 400));
			};

			const removeSlotById = (id?: string) => {
				if (!id) {
					return -1;
				}

				if (limited) {
					for (let i = fixedSlots.length - 1; i >= 0; i--) {
						if (getSlot(fixedSlots[i])?.key === id) {
							setSlot(fixedSlots[i], null);
							if (loaded) {
								updateRecipes();
							}

							return i;
						}
					}

					return -1;
				}

				const i = slots.indexOf(id);
				if (i === -1) {
					return -1;
				}

				const existingSlot = Array.from(parent.children).find(
					child => child instanceof HTMLElement && child.dataset.id === id,
				);
				if (existingSlot) {
					parent.removeChild(existingSlot);
				}
				slots.splice(i, 1);
				ensureEmptySlot();
				if (loaded) {
					updateRecipes();
				}

				return i;
			};

			const pickItem = (e: MouseEvent) => {
				const target = e.currentTarget;
				if (!(target instanceof HTMLElement)) {
					throw new Error('Expected an ingredient option');
				}
				const id = target.dataset.id || '';
				const isRemoval = e.button === 2;
				let result;

				if (e.button !== 0 && !isRemoval) {
					return;
				}

				if (isRemoval) {
					result = removeSlotById(id);
				} else if (!limited && slots.indexOf(id) !== -1) {
					result = removeSlotById(id);
				} else {
					result = appendSlot(id);
				}

				if (result !== -1) {
					e.preventDefault();
				} else {
					flashIngredientActionError(target);
					e.preventDefault();
				}
			};

			const suppressIngredientContextMenu = (e: Event) => {
				e.preventDefault();
			};

			let displaying = false;

			const ensureEmptySlot = () => {
				// Only for unlimited mode (Discovery page)
				if (limited) {
					return;
				}

				// Remove all existing empty slots first
				const existingEmptySlots =
					parent.querySelectorAll<HTMLElement>('.ingredient:empty');
				existingEmptySlots.forEach(slot => {
					// Only remove if it has no dataset.id (our placeholder slots)
					if (!slot.dataset.id) {
						parent.removeChild(slot);
					}
				});

				// Add a single empty slot at the end
				const emptySlot = document.createElement('span');
				emptySlot.className = 'ingredient';
				emptySlot.addEventListener('click', () => {
					picker.focus();
				});
				emptySlot.addEventListener('contextmenu', removeSlot, false);
				parent.appendChild(emptySlot);
			};

			const appendSlot = (id?: string) => {
				const item = id
					? getCollectionItem(food, id) || getCollectionItem(recipes, id) || null
					: null;

				if (!id) {
					console.warn('ID not set');
					return -1;
				}
				if (!item) {
					console.warn('Item not found', id);
					return -1;
				}

				if (limited) {
					for (let i = 0; i < fixedSlots.length; i++) {
						if (getSlot(fixedSlots[i]) === null) {
							setSlot(fixedSlots[i], item);
							if (loaded) {
								updateRecipes();
							}

							return i;
						}
					}

					return -1;
				} else {
					if (slots.indexOf(id) === -1) {
						slots.push(id);
						const i = document.createElement('span');
						i.className = 'ingredient';
						setSlot(i, item);
						i.addEventListener('click', removeSlot, false);
						i.addEventListener('contextmenu', removeSlot, false);
						parent.appendChild(i);

						// Ensure there's always an empty "+" slot at the end
						ensureEmptySlot();

						if (loaded) {
							updateRecipes();
						}

						return 1;
					}

					return -1;
				}
			};

			const liIntoPicker = function (this: HTMLElement, item: GuideItem) {
				const img = makeImage(item.img);

				img.title = item.name;

				const li = document.createElement('span');
				li.classList.add('item');
				li.appendChild(img);

				const name = document.createElement('span');
				name.classList.add('text');
				name.appendChild(document.createTextNode(item.name));
				li.appendChild(name);

				li.dataset.id = item.key;
				li.id = `ingredient-result-${index}-${this.dataset.length}`;
				li.setAttribute('role', 'option');
				li.setAttribute('aria-label', item.name);
				li.setAttribute('aria-selected', 'false');

				li.addEventListener('mousedown', pickItem, false);
				li.addEventListener('contextmenu', suppressIngredientContextMenu, false);
				this.appendChild(li);

				this.dataset.length = String(Number(this.dataset.length) + 1);
			};

			const updateFaded = (el: HTMLElement) => {
				if (ingredients.includes(food[el.dataset.id || ''])) {
					if (!el.classList.contains('faded')) {
						el.classList.add('faded');
					}
				} else if (el.classList.contains('faded')) {
					el.classList.remove('faded');
				}
			};

			const removeSlot = (e: Event) => {
				const target = resolveIconTarget(e.target);
				e.preventDefault();

				if (limited) {
					if (getSlot(target) !== null) {
						const removedId = target.dataset.id;
						setSlot(target, null);
						updateRecipes();

						return removedId;
					} else {
						// Empty slot clicked - focus the search bar
						if (e.type === 'contextmenu') {
							flashIngredientActionError(target);
						} else {
							picker.focus();
						}
						return null;
					}
				} else {
					const i = slots.indexOf(target.dataset.id || '');
					if (i === -1) {
						flashIngredientActionError(target);
						return null;
					}
					const removedId = target.dataset.id;

					slots.splice(i, 1);
					parent.removeChild(target);

					// Ensure there's always an empty "+" slot at the end
					ensureEmptySlot();

					updateRecipes();

					return removedId;
				}
			};

			const refreshPicker = () => {
				selectedResult = -1;
				picker.removeAttribute('aria-activedescendant');
				searchSelectorControls.splitTag();
				let names = matchingNames(
					from,
					searchSelectorControls.getSearch(),
					allowUncookable,
				);

				// Apply additional sorting based on user preference
				const sortType = sortControls.getValue();
				if (sortType !== 'default') {
					names = sortIngredients(names, sortType, {
						statMultipliers,
						modifyItem: characterFoodModifiers.modifyItem,
						modeMask,
					});
				}

				dropdown.removeChild(ul);

				ul = document.createElement('div');
				ul.dataset.length = '0';
				names.forEach(liIntoPicker, ul);

				dropdown.appendChild(ul);
			};

			const searchFor = (e: Event) => {
				const target = resolveIconTarget(e.target);
				const name = target.dataset.link || '';
				const matches = matchingNames(from, name, allowUncookable);

				if (matches.length === 1) {
					const result = appendSlot(matches[0].key);
					if (result === -1) {
						flashIngredientActionError(target);
					}
				} else {
					picker.value = name;
					refreshPicker();
				}
			};

			if (parent.id === 'ingredients') {
				//simulator
				updateRecipes = () => {
					ingredients = fixedSlots.map(slot => {
						const item = getSlot(slot);
						return item && 'nameObject' in item ? item : null;
					});

					const cooking = getRecipes(ingredients);
					const health = cooking[0].health;
					const hunger = cooking[0].hunger;
					const sanity = cooking[0].sanity;

					let table = makeSortableTable({
						headers: {
							'': '',
							Name: 'name',
							[headings.health]: 'health',
							[headings.hunger]: 'hunger',
							[headings.sanity]: 'sanity',
							[headings.perish]: 'perish',
							'Cook Time': 'cooktime',
							'Priority:One of the highest priority recipes for a combination will be made':
								'priority',
							'Requires:Dim, struck items cannot be used': '',
							Notes: '',
							'Mode:DLC or Game Mode required': 'modeMask',
						},
						dataset: cooking,
						rowGenerator: item => {
							return makeRecipeRow(item, health, hunger, sanity);
						},
						defaultSort: 'priority',
						summaryRows: 2,
						linkCallback: searchFor,
						highlightCallback: (item, array) => {
							return array.length > 0 && item.priority === highestPriority(array);
						},
						columnConfig: {
							toggleable: true,
							columns: [
								'Health',
								'Hunger',
								'Sanity',
								'Perish',
								'Cook Time',
								'Priority',
								'Notes',
								'Mode',
							],
							autoHide: getAutoHideColumns(['Sanity', 'Cook Time', 'Notes']),
						},
					});

					while (results.firstChild) {
						results.removeChild(results.firstChild);
					}

					results.appendChild(table);
					simulatorLocaleRefresh = updateRecipes;

					results.appendChild(makeElement('p', t('discoveryHighlightsNote')));

					if (ingredients[0] !== null) {
						getSuggestions(suggestions, ingredients, cooking);

						if (suggestions.length > 0) {
							results.appendChild(makeElement('p', t('discoveryMoreSuggestions')));
							table = makeSortableTable({
								headers: {
									'': '',
									Name: 'name',
									'Health:(% more than ingredients)': 'health',
									'Hunger:(% more than ingredients)': 'hunger',
									[headings.sanity]: 'sanity',
									[headings.perish]: 'perish',
									'Cook Time': 'cooktime',
									'Priority:One of the highest priority recipes for a combination will be made':
										'priority',
									'Requires:Dim, struck items cannot be used': '',
									Notes: '',
									'Mode:DLC or Game Mode required': 'modeMask',
								},
								dataset: suggestions,
								rowGenerator: item => {
									return makeRecipeRow(item, health, hunger, sanity);
								},
								defaultSort: 'priority',
								linkCallback: searchFor,
								columnConfig: {
									toggleable: true,
									columns: [
										'Health',
										'Hunger',
										'Sanity',
										'Perish',
										'Cook Time',
										'Priority',
										'Notes',
										'Mode',
									],
									autoHide: getAutoHideColumns(['Sanity', 'Cook Time', 'Notes']),
								},
							});
							results.appendChild(table);
						}
					}

					ul &&
						ul.firstChild &&
						Array.prototype.forEach.call(ul.getElementsByTagName('span'), updateFaded);
				};
			} else if (parent.id === 'inventory') {
				//discovery
				updateRecipes = () => {
					ingredients = Array.from(parent.querySelectorAll<HTMLElement>('.ingredient'))
						.map(slot => {
							const item = getSlot(slot);
							return item && 'nameObject' in item ? item : null;
						})
						.filter((item): item is Food => item !== null); // Filter out empty slots

					if (discoverfood.firstChild) {
						discoverfood.removeChild(discoverfood.firstChild);
					}
					if (discover.firstChild) {
						discover.removeChild(discover.firstChild);
					}
					while (makable.firstChild) {
						makable.removeChild(makable.firstChild);
					}

					if (ingredients.length > 0) {
						const foodTable = makeSortableTable({
							headers: {
								'': '',
								Name: 'name',
								[headings.health]: 'health',
								[headings.hunger]: 'hunger',
								[headings.sanity]: 'sanity',
								[headings.perish]: 'perish',
								Info: '',
								'Mode:DLC or Game Mode required': 'modeMask',
							},
							dataset: ingredients.filter((item): item is Food => item !== null),
							rowGenerator: makeFoodRow,
							defaultSort: 'name',
							linkCallback: setHighlight,
							columnConfig: {
								toggleable: true,
								columns: ['Health', 'Hunger', 'Sanity', 'Perish', 'Info', 'Mode'],
								autoHide: getAutoHideColumns(['Sanity']),
							},
						});

						discoverfood.appendChild(foodTable);
						getSuggestions(inventoryrecipes, ingredients, null, true);

						if (inventoryrecipes.length > 0) {
							const table = makeSortableTable({
								headers: {
									'': '',
									Name: 'name',
									[headings.health]: 'health',
									[headings.hunger]: 'hunger',
									[headings.sanity]: 'sanity',
									[headings.perish]: 'perish',
									'Cook Time': 'cooktime',
									'Priority:One of the highest priority recipes for a combination will be made':
										'priority',
									'Requires:Dim, struck items cannot be used': '',
									Notes: '',
									'Mode:DLC or Game Mode required': 'modeMask',
								},
								dataset: inventoryrecipes,
								rowGenerator: makeRecipeRow,
								defaultSort: 'name',
								linkCallback: setHighlight,
								columnConfig: {
									toggleable: true,
									columns: [
										'Health',
										'Hunger',
										'Sanity',
										'Perish',
										'Cook Time',
										'Priority',
										'Notes',
										'Mode',
									],
									autoHide: getAutoHideColumns(['Sanity', 'Cook Time', 'Notes']),
								},
							});

							discover.appendChild(table);

							makable.appendChild(
								makeRecipeGrinder(
									ingredients.filter((item): item is Food => item !== null),
								),
							);
						}
					}

					if (ul && ul.firstChild) {
						Array.prototype.forEach.call(ul.getElementsByTagName('span'), updateFaded);
					}
				};
				discoveryLocaleRefresh = updateRecipes;
			}

			if (fixedSlots.length !== 0) {
				limited = true;

				fixedSlots.forEach(slot => {
					setSlot(slot, null);
					slot.addEventListener('click', removeSlot, false);
					slot.addEventListener('contextmenu', removeSlot, false);
				});
			} else {
				limited = false;
			}

			for (const id of savedState.pickers?.[index] ?? []) {
				const item = id ? resolveIngredient(id, modeMask, charMask) : undefined;
				if (item) {
					appendSlot(item.key);
				}
			}

			loaded = true;

			// Ensure Discovery page starts with an empty "+" slot
			ensureEmptySlot();
			// Sort controls for ingredient picker
			const sortControls = createDropdown({
				items: [
					{ value: 'default', key: 'sortDefault' },
					{ value: 'name', key: 'sortName' },
					{ value: 'health', key: 'sortHealth' },
					{ value: 'hunger', key: 'sortHunger' },
					{ value: 'sanity', key: 'sortSanity' },
					{ value: 'perish', key: 'sortPerish' },
				],
				initialValue: 'default',
				buttonClass: 'sortingredients',
				storageKey: 'foodGuideSortPreference',
				storageIndex: index,
				onSelect: () => refreshPicker(),
			});
			// Search controls
			const searchTypeKeys: (DropdownItem & { prefix: string; placeholderKey: StringKey })[] =
				[
					{
						value: 'name',
						key: 'searchTypeName',
						prefix: '',
						placeholderKey: 'searchPlaceholderName',
					},
					{
						value: 'tag',
						key: 'searchTypeTag',
						prefix: 'tag:',
						placeholderKey: 'searchPlaceholderTag',
					},
					{
						value: 'recipe',
						key: 'searchTypeRecipe',
						prefix: 'recipe:',
						placeholderKey: 'searchPlaceholderRecipe',
					},
				];
			const baseSearchControls = createDropdown({
				items: searchTypeKeys,
				initialValue: 'name',
				buttonClass: 'searchselector',
				onSelect: item => {
					picker.placeholder = t(item.placeholderKey);
					refreshPicker();
				},
			});
			picker.placeholder = t(
				(
					searchTypeKeys.find(k => k.value === baseSearchControls.getValue()) ||
					searchTypeKeys[0]
				).placeholderKey,
			);

			searchInputGroup.insertBefore(baseSearchControls.container, picker);

			const getSearch = () => (baseSearchControls.getItem()?.prefix || '') + picker.value;
			const splitTag = () => {
				const parts = picker.value.split(/: */);
				if (parts.length === 2) {
					const tag = `${parts[0].toLowerCase()}:`;
					const name = parts[1];
					const found = searchTypeKeys.find(k => k.prefix === tag);
					if (found) {
						baseSearchControls.setValue(found.value);
						picker.value = name;
					}
				}
			};
			const setSearchType = (idx: number) => {
				baseSearchControls.setValue(searchTypeKeys[idx].value);
				picker.placeholder = t(searchTypeKeys[idx].placeholderKey);
			};

			const searchSelectorControls = Object.assign(baseSearchControls, {
				getSearch,
				splitTag,
				setSearchType,
			});
			dropdown.className = 'ingredientdropdown';
			dropdown.id = `ingredient-results-${index}`;
			dropdown.setAttribute('role', 'listbox');
			picker.setAttribute('role', 'combobox');
			picker.setAttribute('data-i18n-attr-aria-label', 'searchPlaceholderName');
			picker.setAttribute('aria-label', t('searchPlaceholderName'));
			picker.setAttribute('aria-autocomplete', 'list');
			picker.setAttribute('aria-expanded', 'true');
			picker.setAttribute('aria-controls', dropdown.id);
			dropdown.appendChild(ul);
			dropdown.addEventListener(
				'mousedown',
				e => {
					e.preventDefault();
				},
				false,
			);

			(() => {
				const names = matchingNames(
					from,
					searchSelectorControls.getSearch(),
					allowUncookable,
				);

				dropdown.removeChild(ul);
				ul = document.createElement('div');
				ul.dataset.length = '0';
				names.forEach(liIntoPicker, ul);
				dropdown.appendChild(ul);
			})();

			clearSearchBtn.className = 'clearingredients clearsearchbtn';
			clearSearchBtn.title = t('clearSearch');
			// Use an inline SVG for clear search or just an X
			clearSearchBtn.innerHTML = '<span>×</span>';

			clearSearchBtn.addEventListener('click', () => {
				picker.value = '';
				searchSelectorControls.setSearchType(0);
				refreshPicker();
			});

			clearIngredientsBtn.className = 'clearingredients clearingredientsbtn';
			clearIngredientsBtn.title = t('clearIngredients');
			// Use a trash can icon or similar
			clearIngredientsBtn.innerHTML = '<span>🗑</span>'; // Using a trash emoji, or we can use SVG

			clearIngredientsBtn.addEventListener('click', () => {
				// Check if there are any ingredients to clear
				let hasIngredients = false;
				for (let i = 0; i < parent.children.length; i++) {
					if (getSlot(parent.children[i])) {
						hasIngredients = true;
						break;
					}
				}

				if (!hasIngredients) {
					return;
				}

				// Warn user on Discovery tab (unlimited mode) before clearing
				if (!limited && !confirm(t('confirmClearInventory'))) {
					return;
				}

				// Clear all ingredients - handle limited vs unlimited mode differently
				if (limited) {
					// Limited mode: clear from last to first to avoid
					// setSlot's shift-left logic moving items around
					for (let i = fixedSlots.length - 1; i >= 0; i--) {
						if (getSlot(fixedSlots[i])) {
							setSlot(fixedSlots[i], null);
						}
					}
					updateRecipes();
				} else {
					// Unlimited mode: remove elements directly, then rebuild
					const children = Array.from(parent.children);
					children.forEach(child => {
						if (getSlot(child)) {
							parent.removeChild(child);
						}
					});
					slots.length = 0;
					ensureEmptySlot();
					updateRecipes();
				}
			});
			// Display mode controls (Icons / Names / List)
			const displayModeControls = createDropdown({
				items: [
					{ value: 'names', key: 'displayModeNames' },
					{ value: 'icons', key: 'displayModeIcons' },
					{ value: 'list', key: 'displayModeList' },
				],
				initialValue: 'names',
				buttonClass: 'displaymodeingredients',
				storageKey: 'foodGuideDisplayMode',
				storageIndex: index,
				onSelect: (_, mode) => {
					dropdown.classList.remove('hidetext', 'listmode');
					if (mode === 'icons') {
						dropdown.classList.add('hidetext');
					} else if (mode === 'list') {
						dropdown.classList.add('listmode');
					}
				},
			});
			{
				const mode = displayModeControls.getValue();
				if (mode === 'icons') {
					dropdown.classList.add('hidetext');
				} else if (mode === 'list') {
					dropdown.classList.add('listmode');
				}
			}

			// Density controls
			const densityControls = createDropdown({
				items: [
					{ value: 'cozy', key: 'densityCozy' },
					{ value: 'normal', key: 'densityNormal' },
					{ value: 'compact', key: 'densityCompact' },
				],
				initialValue: 'compact',
				buttonClass: 'displaymodeingredients densityingredients',
				storageKey: 'foodGuideDensityMode',
				storageIndex: index,
				onSelect: (_, mode) => {
					dropdown.classList.remove('density-cozy', 'density-normal', 'density-compact');
					dropdown.classList.add(`density-${mode}`);
				},
			});
			dropdown.classList.add(`density-${densityControls.getValue()}`);

			const controlsGroup = document.createElement('div');
			controlsGroup.className = 'ingredient-search-controls';

			const controlsLeft = document.createElement('div');
			controlsLeft.className = 'ingredient-search-controls-left';

			const controlsRight = document.createElement('div');
			controlsRight.className = 'ingredient-search-controls-right';

			controlsLeft.appendChild(displayModeControls.container);
			controlsLeft.appendChild(densityControls.container);
			controlsLeft.appendChild(sortControls.container);

			controlsRight.appendChild(clearSearchBtn);
			controlsRight.appendChild(clearIngredientsBtn);

			controlsGroup.appendChild(controlsLeft);
			controlsGroup.appendChild(controlsRight);
			searchRow.appendChild(controlsGroup);

			searchRow.parentNode!.insertBefore(dropdown, parent.parentElement!);

			picker.addEventListener('input', refreshPicker);
			picker.addEventListener('keydown', event => {
				if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
					return;
				}
				const options = Array.from(ul.children);
				if (event.key === 'Enter' && options.length) {
					event.preventDefault();
					const target = options[Math.max(0, selectedResult)];
					target.dispatchEvent(
						new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }),
					);
					return;
				}
				if (event.key === 'Escape') {
					selectedResult = -1;
				} else if (event.key === 'ArrowDown' && options.length) {
					selectedResult = (selectedResult + 1) % options.length;
				} else if (event.key === 'ArrowUp' && options.length) {
					selectedResult = selectedResult <= 0 ? options.length - 1 : selectedResult - 1;
				} else {
					return;
				}
				event.preventDefault();
				options.forEach((option, optionIndex) => {
					const selected = optionIndex === selectedResult;
					option.classList.toggle('selected', selected);
					option.setAttribute('aria-selected', String(selected));
				});
				const activeOption = options[selectedResult];
				if (activeOption) {
					picker.setAttribute('aria-activedescendant', activeOption.id);
					activeOption.scrollIntoView({ block: 'nearest' });
				} else {
					picker.removeAttribute('aria-activedescendant');
				}
			});

			picker.addEventListener(
				'focus',
				() => {
					if (!displaying) {
						displaying = true;
					}
				},
				false,
			);

			picker.addEventListener(
				'blur',
				() => {
					if (displaying) {
						displaying = false;
					}
				},
				false,
			);

			updateRecipes();

			window.addEventListener('beforeunload', () => {
				preferences.update(state => {
					state.pickers ??= [];
					state.pickers[index] = limited
						? fixedSlots.map(slot => getSlot(slot)?.key ?? null)
						: slots;
				});
			});

			const refreshSelection = () => {
				if (limited) {
					for (const slot of fixedSlots) {
						const item = getSlot(slot);
						if (item && 'nameObject' in item) {
							setSlot(slot, resolveIngredient(item.key, modeMask, charMask) ?? null);
						}
					}
				} else {
					slots.length = 0;
					for (const slot of parent.querySelectorAll<HTMLElement>(
						'.ingredient[data-id]',
					)) {
						const item = resolveIngredient(slot.dataset.id || '', modeMask, charMask);
						if (item && !slots.includes(item.key)) {
							slots.push(item.key);
							setSlot(slot, item);
						} else {
							slot.remove();
						}
					}
					ensureEmptySlot();
				}
			};
			modeRefreshers.push(refreshSelection, refreshPicker, updateRecipes);
		}
	})();

	// --- Mode selector UI ---

	const selectVersion = (e: Event) => {
		const target = resolveIconTarget(e.target);
		const versionName = target.dataset.version;
		if (!versionName || !gameVersions[versionName]) {
			return;
		}
		currentVersion = versionName;
		// Clear character if not applicable to the new version
		if (
			currentCharacter &&
			!isCharacterApplicable(currentCharacter, currentVersion, activeDlc, characters)
		) {
			currentCharacter = null;
		}
		setMode();
	};

	const toggleDlc = (e: Event) => {
		const target = resolveIconTarget(e.target);
		const dlcKey = target.dataset.dlc;
		if (!dlcKey || !dlcOptions[dlcKey]) {
			return;
		}
		activeDlc[dlcKey || ''] = !activeDlc[dlcKey || ''];
		// Clear character if no longer applicable
		if (
			currentCharacter &&
			!isCharacterApplicable(currentCharacter, currentVersion, activeDlc, characters)
		) {
			currentCharacter = null;
		}
		setMode();
	};

	const selectCharacter = (e: Event) => {
		const target = resolveIconTarget(e.target);
		const charName = target.dataset.character || '';
		if (!charName || !characters[charName]) {
			return;
		}
		if (!isCharacterApplicable(charName, currentVersion, activeDlc, characters)) {
			return;
		}
		currentCharacter = currentCharacter === charName ? null : charName;
		setMode();
	};

	// Build mode selectors into the header
	const headerTop = document.querySelector<HTMLElement>('.header-top');
	if (!headerTop) {
		throw new Error('Missing guide header');
	}
	const modePanel = headerTop; // mode buttons are injected directly into header-top

	const updateModeButtonTitles = () => {
		for (const btn of modePanel.querySelectorAll<HTMLElement>('.dlc-btn')) {
			const dlcKey = btn.dataset.dlc;
			if (!dlcKey || !dlcOptions[dlcKey]) {
				continue;
			}
			btn.title = `${dlcOptions[dlcKey].name}\n${t('dlcToggleHint')}`;
		}

		for (const btn of modePanel.querySelectorAll<HTMLElement>('.char-btn')) {
			const charName = btn.dataset.character || '';
			if (!charName || !characters[charName]) {
				continue;
			}
			const charAbilities = getCharacterAbilities(charName, characters);
			const abilityText = charAbilities.length > 0 ? `\n${charAbilities.join('\n')}` : '';
			btn.title = `${characters[charName].name}\n${t('characterToggleHint')}${abilityText}`;
		}
	};
	document.addEventListener('foodguide:localechange', updateModeButtonTitles);

	// Section: Game version
	const versionSection = document.createElement('div');
	versionSection.className = 'mode-section';

	const versionLabel = document.createElement('span');
	versionLabel.className = 'mode-label';
	versionLabel.setAttribute('data-i18n', 'modeLabelGame');
	versionLabel.textContent = t('modeLabelGame');
	versionSection.appendChild(versionLabel);

	for (const name in gameVersions) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('aria-label', gameVersions[name].name);
		btn.className = 'mode-btn version-btn';
		btn.dataset.version = name;
		btn.addEventListener('click', selectVersion, false);
		btn.title = gameVersions[name].name;

		const img = makeImage(`img/${gameVersions[name].img}`);
		img.title = gameVersions[name].name;
		img.dataset.version = name;
		btn.appendChild(img);

		versionSection.appendChild(btn);
	}

	headerTop.appendChild(versionSection);

	// Divider (DLC)
	const divider1 = document.createElement('div');
	divider1.className = 'mode-divider dlc-divider';
	headerTop.appendChild(divider1);

	// Section: DLC toggles (only for 'dontstarve')
	const dlcSection = document.createElement('div');
	dlcSection.className = 'mode-section dlc-section';

	const dlcLabel = document.createElement('span');
	dlcLabel.className = 'mode-label';
	dlcLabel.setAttribute('data-i18n', 'modeLabelDlc');
	dlcLabel.textContent = t('modeLabelDlc');
	dlcSection.appendChild(dlcLabel);

	for (const name in dlcOptions) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('aria-label', dlcOptions[name].name);
		btn.className = 'mode-btn dlc-btn';
		btn.dataset.dlc = name;
		btn.addEventListener('click', toggleDlc, false);
		btn.title = `${dlcOptions[name].name}\n${t('dlcToggleHint')}`;

		const img = makeImage(`img/${dlcOptions[name].img}`);
		img.title = dlcOptions[name].name;
		img.dataset.dlc = name;
		btn.appendChild(img);

		dlcSection.appendChild(btn);
	}

	headerTop.appendChild(dlcSection);

	// Divider (Character)
	const divider2 = document.createElement('div');
	divider2.className = 'mode-divider char-divider';
	headerTop.appendChild(divider2);

	// Section: Character selection
	const charSection = document.createElement('div');
	charSection.className = 'mode-section char-section';

	const charLabel = document.createElement('span');
	charLabel.className = 'mode-label';
	charLabel.setAttribute('data-i18n', 'modeLabelCharacter');
	charLabel.textContent = t('modeLabelCharacter');
	charSection.appendChild(charLabel);

	for (const name in characters) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('aria-label', characters[name].name);
		btn.className = 'mode-btn char-btn';
		btn.dataset.character = name;
		btn.addEventListener('click', selectCharacter, false);
		const charAbilities = getCharacterAbilities(name, characters);
		const abilityText = charAbilities.length > 0 ? `\n${charAbilities.join('\n')}` : '';
		btn.title = `${characters[name].name}\n${t('characterToggleHint')}${abilityText}`;

		const img = makeImage(`img/${characters[name].img}`);
		img.dataset.character = name;
		btn.appendChild(img);

		charSection.appendChild(btn);
	}

	headerTop.appendChild(charSection);

	setMode();
})();
