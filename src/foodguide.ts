import type {
	Food,
	Recipe,
	GuideItem,
	CalculatorRow,
	ModifyItem,
	AnalysisRow,
	AnalysisProgress,
	RecipeData,
	FoodCollection,
	RecipeCollection,
} from './models.js';
import type { SortableTable } from './sortable-table.js';
import type { StringKey } from './strings.js';
import type { DropdownItem } from './dropdown.js';
import { createSavedStateStore, restoreGameSelection, type SavedState } from './preferences.js';
import { createFoodSelectionResolver } from './food-selection.js';
import { createAnalysisFilters } from './analysis-filters.js';
import { formatSignedValue, formatStatGain, percentageGain } from './number-format.js';
import { getCollectionItem } from './collection.js';
import { bindActivation } from './activation.js';

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
const eventControl = (event: Event): HTMLElement => {
	if (!(event.currentTarget instanceof HTMLElement)) {
		throw new Error('Expected an element event listener');
	}
	return event.currentTarget;
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
import { createFilterControls } from './filter-controls.js';
import { createRecipeCalculator } from './recipe-calculator.js';
import { createRecipeAnalyzer } from './recipe-analyzer.js';
import { sortIngredients } from './ingredient-sort.js';
import { groupIngredients } from './ingredient-groups.js';
import { filterCookingIngredients } from './ingredient-cooking.js';
import { createThemeController } from './theme-controller.js';
import { createSortableTableFactory } from './sortable-table.js';
import { recipes, updateFoodRecipes, updateRecipeText } from './recipes.js';
import { makeImage, makeElement } from './utils.js';
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

	const modeRefreshers: (() => void)[] = [];
	const localeTables = new Set<SortableTable>();
	const responsiveTables = new Set<SortableTable>();
	let tableResizeTimeout: ReturnType<typeof setTimeout> | undefined;

	window.addEventListener('resize', () => {
		clearTimeout(tableResizeTimeout);
		tableResizeTimeout = setTimeout(() => {
			for (const tableContainer of Array.from(responsiveTables)) {
				if (!tableContainer.isConnected) {
					tableContainer.dispose();
				} else {
					tableContainer.updateResponsive?.();
				}
			}
		}, 150);
	});
	let simulatorLocaleRefresh: (() => void) | null = null;

	let statMultipliers = defaultStatMultipliers;
	let characterFoodModifiers: { modifyItem: ModifyItem } = { modifyItem: () => ({}) };

	// Mode state: game version + DLC toggles + optional character
	const preferences = createSavedStateStore({
		getStorage: () => window.localStorage,
		onError: error => console.warn('Unable to access saved preferences', error),
	});
	const stateWriters: ((state: SavedState) => void)[] = [];
	let initialized = false;
	// Capture all controllers together, including selections pruned by a game change.
	const saveState = () => {
		if (initialized) {
			preferences.update(state => {
				for (const write of stateWriters) {
					write(state);
				}
			});
		}
	};
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
	stateWriters.push(state => {
		state.version = currentVersion;
		state.dlc = { giants: !!activeDlc.giants, shipwrecked: !!activeDlc.shipwrecked };
		state.character = currentCharacter;
		// Keep modeMask for backward compatibility during migration.
		state.modeMask = modeMask;
	});
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
		for (const tableContainer of Array.from(localeTables)) {
			if (!tableContainer.isConnected) {
				tableContainer.dispose();
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
		Image: 'tableImage',
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
			statisticsGrinder?.dispose();
			statisticsGrinder = makeRecipeGrinder(null, true);
			requireElement('statistics').replaceChildren(statisticsGrinder.button);
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
		saveState();
	};

	const { matchingNames, getSuggestions, getRecipes } = createRecipeCalculator({
		getModeMask: () => modeMask,
		getCharMask: () => charMask,
		getStatMultipliers: () => statMultipliers,
	});

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
	let statisticsGrinder: ReturnType<typeof makeRecipeGrinder> | undefined;

	(() => {
		const navtabs = Array.from(navbar.querySelectorAll<HTMLElement>('[data-tab]'));
		const tabs: Record<string, HTMLElement> = {};
		const elements: Record<string, HTMLElement> = {};
		let activePage: HTMLElement;
		let activeTab: HTMLElement;

		const showTab = (e: Event) => {
			setTab(e.currentTarget instanceof HTMLElement ? e.currentTarget.dataset.tab || '' : '');
		};

		setTab = tabID => {
			if (!Object.hasOwn(tabs, tabID)) {
				return;
			}
			const moveFocus =
				activePage !== elements[tabID] && activePage.contains(document.activeElement);
			activeTab.className = '';
			activeTab.setAttribute('aria-selected', 'false');
			activeTab.tabIndex = -1;
			activeTab = tabs[tabID];
			activePage.hidden = true;
			activePage = elements[tabID];
			activeTab.className = 'selected';
			activeTab.setAttribute('aria-selected', 'true');
			activeTab.tabIndex = 0;
			activePage.hidden = false;

			// Initialize statistics tab content on first visit
			if (tabID === 'statistics' && !activePage.hasChildNodes()) {
				statisticsGrinder = makeRecipeGrinder(null, true);
				activePage.appendChild(statisticsGrinder.button);
			}
			if (moveFocus) {
				activePage.focus();
			}
			saveState();
		};

		for (let i = 0; i < navtabs.length; i++) {
			const navtab = navtabs[i];

			if (navtab.dataset.tab) {
				navtab.setAttribute('role', 'tab');
				navtab.id = `tab-${navtab.dataset.tab}`;
				navtab.setAttribute('aria-controls', navtab.dataset.tab);
				navtab.setAttribute('aria-selected', 'false');
				navtab.tabIndex = -1;
				tabs[navtab.dataset.tab] = navtab;
				elements[navtab.dataset.tab] = requireElement(navtab.dataset.tab);
				const panel = elements[navtab.dataset.tab];
				panel.hidden = true;
				panel.tabIndex = 0;
				panel.setAttribute('role', 'tabpanel');
				panel.setAttribute('aria-labelledby', navtab.id);
				navtab.addEventListener(
					'selectstart',
					e => {
						e.preventDefault();
					},
					false,
				);
				navtab.addEventListener('click', showTab, false);
				navtab.addEventListener('keydown', event => {
					if (event.altKey || event.ctrlKey || event.metaKey) {
						return;
					}
					let next;
					if (event.key === 'ArrowRight') {
						next = (i + 1) % navtabs.length;
					} else if (event.key === 'ArrowLeft') {
						next = (i + navtabs.length - 1) % navtabs.length;
					} else if (event.key === 'Home') {
						next = 0;
					} else if (event.key === 'End') {
						next = navtabs.length - 1;
					}
					if (next !== undefined) {
						event.preventDefault();
						setTab(navtabs[next].dataset.tab!);
						navtabs[next].focus();
						return;
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
		activeTab.setAttribute('aria-selected', 'true');
		activeTab.tabIndex = 0;
		activePage.hidden = false;

		stateWriters.push(state => {
			state.activeTab = activeTab.dataset.tab;
		});
	})();

	const { cells, fandomHref, makeSortableTable } = createSortableTableFactory({
		translate: t,
		translateTableLabel,
		translateTableHint,
		translateSummaryLabel,
		localeTables,
		responsiveTables,
	});

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
		const result = ` (${formatSignedValue((percentChange * 100).toFixed(0))}%)`;
		return result.indexOf('Infinity') === -1 ? result : ` (${formatSignedValue(val - base)})`;
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
		let health = formatSignedValue((itemMods.health ?? item.health ?? NaN) * mult);
		let hunger = formatSignedValue((itemMods.hunger ?? item.hunger ?? NaN) * mult);
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
				health = `${health === '' ? '0' : health} (${formatSignedValue(cookedHealth - rawHealth)})`;
			}
			if ((item.cook.hunger || 0) !== (item.hunger || 0)) {
				const rawHunger = ((itemMods.hunger ?? item.hunger) || 0) * mult;
				const cookedHunger = ((cookMods.hunger ?? item.cook.hunger) || 0) * cookmult;
				hunger = `${hunger === '' ? '0' : hunger} (${formatSignedValue(cookedHunger - rawHunger)})`;
			}
			if ((item.cook.sanity || 0) !== (item.sanity || 0)) {
				const rawSanity = ((itemMods.sanity ?? item.sanity) || 0) * mult;
				const cookedSanity = ((cookMods.sanity ?? item.cook.sanity) || 0) * cookmult;
				sanity = `${sanity === '' ? '0' : sanity} (${formatSignedValue(cookedSanity - rawSanity)})`;
			}
			if ((item.cook.perish || 0) !== (item.perish || 0)) {
				const dayDifference =
					((item.cook.perish || 0) - (item.perish || 0)) / total_day_time;
				if (isNaN(dayDifference)) {
					perish += ` (${t('durationToNever')})`;
				} else {
					perish += ` (${
						item.perish
							? formatSignedValue(dayDifference)
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
			formatSignedValue(ihealth) + pct(health, ihealth),
			formatSignedValue(ihunger) + pct(hunger, ihunger),
			isNaN(isanity) ? '' : formatSignedValue(isanity) + pct(sanity, isanity),
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

	const setHighlight = (name: string, { navigateToFood = true } = {}) => {
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

	const setFoodHighlight = (name: string) => setHighlight(name, { navigateToFood: false });

	const setRecipeHighlight = (name: string) => {
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
		captionKey: 'tabFoodList',
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
		captionKey: 'tabRecipeList',
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
	let loadSimulatorIngredients: (items: Food[]) => void;

	const makeRecipeGrinder = (ingredients: Food[] | null, excludeDefault = false) => {
		const makableButton = document.createElement('button');
		let isCalculating = false;
		let clearResults = () => {};

		const updateMakableButtonLabel = () => {
			makableButton.textContent = isCalculating ? t('calculating') : t('calculateRecipes');
		};
		updateMakableButtonLabel();
		makableButton.className = 'makablebutton';
		document.addEventListener('foodguide:localechange', updateMakableButtonLabel);
		const initializeGrinder = () =>
			(() => {
				clearResults();
				const availableIngredients = (ingredients ?? Array.from(food)).filter(testmode);
				const idealIngredients: Food[] = [];
				const makableRecipes: string[] = [];
				const recipeControls = new Map<string, HTMLButtonElement>();
				const ingredientControls = new Map<string, HTMLButtonElement>();
				const filters = createAnalysisFilters({
					excludedIngredients: excludeDefault
						? availableIngredients
								.filter(item => item.defaultExclude)
								.map(item => item.key)
						: [],
					excludedRecipes: excludeDefault
						? recipes.filter(item => item.defaultExclude).map(item => item.id)
						: [],
				});
				let made: AnalysisRow[] = [];

				const deleteButton = document.createElement('button');
				deleteButton.appendChild(document.createTextNode(t('clearResults')));
				deleteButton.className = 'deleteButton';
				deleteButton.addEventListener('click', () => clearResults());

				const updateRecipeFilters = () => {
					for (const [id, button] of recipeControls) {
						recipeFilterControls.update(button, filters.recipeState(id));
					}
					makableTable.update();
				};

				const tryPush = (ingredient: Food) => {
					if (!ingredient.uncookable && !ingredient.skip) {
						idealIngredients.push(ingredient);
					}
				};

				for (let i = availableIngredients.length - 1; i >= 0; i--) {
					const ingredient = availableIngredients[i];
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
				let paused = false;
				const resultCount = document.createElement('p');
				resultCount.className = 'analysis-result-count';
				const progressContainer = document.createElement('div');
				progressContainer.className = 'analysis-progress';
				const progressBar = document.createElement('progress');
				const progressText = document.createElement('span');
				let progress: AnalysisProgress = { checked: 0, total: 0 };
				const updateProgress = () => {
					const percent = progress.total
						? Math.floor((progress.checked / progress.total) * 100)
						: 100;
					progressBar.max = progress.total || 1;
					progressBar.value = progress.total ? progress.checked : 1;
					progressBar.setAttribute('aria-label', t('analysisProgressLabel'));
					progressText.textContent = t('analysisProgressCount', {
						checked: progress.checked.toLocaleString(getLocale()),
						total: progress.total.toLocaleString(getLocale()),
						percent,
					});
					progressBar.setAttribute('aria-valuetext', progressText.textContent);
				};
				progressContainer.append(progressBar, progressText);
				const snapshotNotice = document.createElement('p');
				snapshotNotice.className = 'analysis-snapshot-notice';
				snapshotNotice.textContent = t('analysisSnapshotNotice');
				const resetFiltersButton = document.createElement('button');
				resetFiltersButton.type = 'button';
				resetFiltersButton.className = 'resetAnalysisFiltersButton';
				resetFiltersButton.textContent = t('analysisResetFilters');
				resetFiltersButton.title = t('analysisResetFiltersHelp');
				resetFiltersButton.addEventListener('click', () => {
					filters.reset();
					for (const [id, button] of ingredientControls) {
						ingredientFilterControls.update(button, filters.ingredientState(id));
					}
					updateRecipeFilters();
					analysisStatus.textContent = `${t('analysisFiltersReset')} ${resultCount.textContent}`;
				});

				const makableTable = makeSortableTable({
					captionKey: 'tableEfficientRecipes',
					onRender: ({ total, groups }) => {
						resultCount.textContent = t('analysisResultCount', {
							first: groups!.first,
							last: groups!.last,
							groups: groups!.total,
							total,
						});
					},
					emptyMessage: () =>
						t(isCalculating ? 'analysisNoResultsYet' : 'analysisNoMatchingResults'),
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
						const combination = document.createElement('button');
						combination.type = 'button';
						combination.className = 'analysis-ingredients';
						combination.dataset.tableAction = 'simulate';
						combination.setAttribute(
							'aria-label',
							t('analysisTryCombination', {
								name: item.name,
								ingredients: data.ingredients
									.map(ingredient => ingredient.name)
									.join(', '),
							}),
						);
						for (const ingredient of data.ingredients) {
							const icon = makeImage(ingredient.img);
							icon.dataset.id = ingredient.key;
							icon.title = ingredient.name;
							icon.setAttribute('aria-hidden', 'true');
							combination.appendChild(icon);
						}
						if (data.multiple) {
							combination.setAttribute('aria-description', t('multipleResultsNote'));
							const marker = document.createElement('span');
							marker.textContent = '*';
							marker.title = t('multipleResultsNote');
							marker.setAttribute('aria-hidden', 'true');
							combination.appendChild(marker);
						}

						const row = cells(
							'td',
							item.img ? item.img : '',
							item.name,
							formatSignedValue(item.health),
							formatStatGain(data.healthpls, data.healthpct),
							formatSignedValue(item.hunger),
							formatStatGain(data.hungerpls, data.hungerpct),
							combination,
						);
						row.dataset.recipe = item.id;
						const ingredientCell = row.cells[6];
						ingredientCell.className = 'analysis-ingredients-cell';
						ingredientCell.addEventListener('click', () =>
							loadSimulatorIngredients(data.ingredients),
						);
						return row;
					},
					defaultSort: 'hungerpls',
					filterCallback: filters.matches,
					groupRows: {
						key: data => data.recipe.id,
						toggleLabel: (data, count, expanded) =>
							t(expanded ? 'analysisHideCombinations' : 'analysisShowCombinations', {
								name: data.recipe.name,
								count,
							}),
						description: () => t('analysisGroupingHelp'),
					},
					columnConfig: {
						toggleable: true,
						columns: ['Health', 'Health+', 'Hunger', 'Hunger+', 'Ingredients'],
						autoHide: ['Health+', 'Hunger+'],
					},
				});
				const updateMakableControls = () => {
					deleteButton.textContent = t('clearResults');
					resetFiltersButton.textContent = t('analysisResetFilters');
					resetFiltersButton.title = t('analysisResetFiltersHelp');
					snapshotNotice.textContent = t('analysisSnapshotNotice');
					updateProgress();
					ingredientFilterControls.updateLocale();
					recipeFilterControls.updateLocale();
					makableFilter.setAttribute('aria-label', t('filterIngredients'));
					makableRecipe.setAttribute('aria-label', t('filterRecipes'));
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
				filterHelp.id = ingredients ? 'discovery-filter-help' : 'statistics-filter-help';
				const filterHelpText = document.createTextNode(t('filterCycleHelp'));
				filterHelp.appendChild(filterHelpText);
				const groupingHelp = document.createElement('p');
				groupingHelp.className = 'makableGroupingHelp';
				groupingHelp.textContent = t('analysisGroupingHelp');
				const updateMakableTexts = () => {
					makableSummaryText.textContent = t(
						!isCalculating
							? 'foundValidRecipes'
							: calculationControl.isPaused()
								? 'foundValidRecipesPaused'
								: 'foundValidRecipesInProgress',
						{ count: made.length },
					);
					makableFootnoteText.textContent = t('multipleResultsNote');
					filterHelpText.textContent = t('filterCycleHelp');
					groupingHelp.textContent = t('analysisGroupingHelp');
				};
				document.addEventListener('foodguide:localechange', updateMakableTexts);

				makableDiv.append(makableSummary, progressContainer);
				makableDiv.appendChild(makableFootnote);
				makableDiv.appendChild(filterHelp);
				makableDiv.appendChild(groupingHelp);
				const analysisStatus = document.createElement('div');
				analysisStatus.className = 'sr-only';
				analysisStatus.setAttribute('role', 'status');
				makableDiv.appendChild(analysisStatus);

				const makableRecipe = document.createElement('div');
				makableRecipe.className = 'recipeFilter';
				makableRecipe.setAttribute('aria-label', t('filterRecipes'));
				const recipeFilterControls = createFilterControls(makableRecipe, filterHelp.id);
				makableDiv.appendChild(makableRecipe);

				const makableFilter = document.createElement('div');
				makableFilter.className = 'foodFilter';
				makableFilter.setAttribute('aria-label', t('filterIngredients'));
				const ingredientFilterControls = createFilterControls(makableFilter, filterHelp.id);

				idealIngredients.forEach(item => {
					const img = makeImage(item.img);
					img.dataset.id = item.key;
					const button = ingredientFilterControls.add(img, item.name, reverse => {
						filters.cycleIngredient(item.key, reverse);
						ingredientFilterControls.update(button, filters.ingredientState(item.key));
						makableTable.update();
						analysisStatus.textContent = `${button.getAttribute('aria-label')} ${resultCount.textContent}`;
					});
					ingredientFilterControls.update(button, filters.ingredientState(item.key));
					ingredientControls.set(item.key, button);
					img.title = item.name;
					makableFilter.appendChild(button);
				});

				makableDiv.appendChild(makableFilter);

				makableDiv.append(snapshotNotice, resultCount, makableTable);
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
				const calculationFocused = document.activeElement === makableButton;
				updateMakableButtonLabel();
				makableButton.disabled = true;
				makableSummary.append(resetFiltersButton, deleteButton);
				if (calculationFocused) {
					deleteButton.focus();
				}

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

							const recipeId = data.recipe.id;
							img.dataset.recipe = recipeId;
							const button = recipeFilterControls.add(
								img,
								data.recipe.name,
								reverse => {
									if (reverse) {
										filters.toggleRecipeExclusion(recipeId);
									} else {
										filters.cycleRecipe(recipeId);
									}
									updateRecipeFilters();
									analysisStatus.textContent = `${button.getAttribute('aria-label')} ${resultCount.textContent}`;
								},
							);
							recipeControls.set(recipeId, button);
							recipeFilterControls.update(button, filters.recipeState(recipeId));
							img.title = data.recipe.name;

							if (i < makableRecipe.childNodes.length) {
								makableRecipe.insertBefore(button, makableRecipe.childNodes[i]);
							} else {
								makableRecipe.appendChild(button);
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
							healthpct: percentageGain(data.tags.health, data.recipe.health || 0),
							hungerpct: percentageGain(data.tags.hunger, data.recipe.hunger || 0),
							sanity: data.recipe.sanity,
							perish: data.recipe.perish,
						};
						made.push(row);
					},
					currentProgress => {
						// Chunk callback - show pause button if this is called (meaning async operation)
						progress = currentProgress;
						updateProgress();
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
						paused = false;
						snapshotNotice.hidden = true;

						// Remove pause button if it exists
						if (pauseButton.parentNode) {
							if (document.activeElement === pauseButton) {
								deleteButton.focus();
							}
							pauseButton.parentNode.removeChild(pauseButton);
						}

						window.analysis = {
							made,
						};

						makableTable.update();

						const summaryText = t('foundValidRecipes', { count: made.length });
						makableSummaryText.textContent = summaryText;
						analysisStatus.textContent = summaryText;

						isCalculating = false;
						updateMakableButtonLabel();
						makableButton.disabled = false;
					},
				);
				if (isCalculating) {
					makableTable.update();
				}
				document.addEventListener('foodguide:localechange', updateMakableControls);
				clearResults = () => {
					const restoreFocus = makableDiv.contains(document.activeElement);
					calculationControl.cancel();
					makableDiv.remove();
					makableTable.dispose();
					document.removeEventListener('foodguide:localechange', updateMakableTexts);
					document.removeEventListener('foodguide:localechange', updateMakableControls);
					if (window.analysis?.made === made) {
						window.analysis = { made: [] };
					}
					isCalculating = false;
					updateMakableButtonLabel();
					makableButton.disabled = false;
					if (restoreFocus) {
						makableButton.focus();
					}
					clearResults = () => {};
				};

				// Add pause/resume button functionality
				pauseButton.addEventListener('click', () => {
					if (calculationControl.isPaused()) {
						calculationControl.resume();
					} else {
						calculationControl.pause();
					}
					// Resuming may complete synchronously; completion owns its final UI state.
					if (!isCalculating) {
						return;
					}
					paused = calculationControl.isPaused();
					snapshotNotice.hidden = paused;
					pauseButton.textContent = t(calculationControl.isPaused() ? 'resume' : 'pause');
					makableTable.update();
					updateMakableTexts();
					analysisStatus.textContent = `${makableSummaryText.textContent} ${resultCount.textContent}`;
				});
			})();

		makableButton.addEventListener('click', initializeGrinder, false);

		return {
			button: makableButton,
			clearResults: () => clearResults(),
			dispose: () => {
				clearResults();
				document.removeEventListener('foodguide:localechange', updateMakableButtonLabel);
			},
		};
	};

	// Initialize statistics content after the grinder factory is available.
	const statisticsEl = document.getElementById('statistics');
	if (savedState.activeTab === 'statistics' && statisticsEl && !statisticsEl.hasChildNodes()) {
		statisticsGrinder = makeRecipeGrinder(null, true);
		statisticsEl.appendChild(statisticsGrinder.button);
	}

	const highestPriority = (array: CalculatorRow[]) => {
		return array.reduce(
			(highest, { priority }) =>
				typeof priority === 'number' ? Math.max(highest, priority) : highest,
			Number.NEGATIVE_INFINITY,
		);
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
			img.setAttribute('aria-hidden', 'true');
			const name = document.createElement('span');
			name.className = 'ingredient-name';
			name.textContent = item.name;
			name.setAttribute('aria-hidden', 'true');
			slotElement.replaceChildren(img, name);
		} else {
			slotElement.replaceChildren();
		}

		slotElement.title = item ? item.name : '';
		slotElement.setAttribute(
			'aria-label',
			item ? t('removeIngredient', { name: item.name }) : t('addIngredient'),
		);
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
				const title = document.createElement('h2');
				title.id = `selected-ingredients-${index}`;
				parent.setAttribute('role', 'group');
				parent.setAttribute('aria-labelledby', title.id);
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
			let pickerOptions: { element: HTMLSpanElement; key: string; name: string }[] = [];
			let groupLabels: { element: HTMLSpanElement; key: StringKey; count: number }[] = [];
			const updateGroupLabels = () => {
				for (const { element, key, count } of groupLabels) {
					element.textContent = `${t(key)} (${count})`;
				}
			};

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
			const pickerStatus = document.createElement('div');
			pickerStatus.className = 'sr-only';
			pickerStatus.setAttribute('role', 'status');
			pickerStatus.setAttribute('aria-atomic', 'true');
			pickerStatus.id = `ingredient-feedback-${index}`;
			const feedbackSpace = document.createElement('div');
			feedbackSpace.className = 'ingredient-feedback-space';
			const feedbackSizing = document.createElement('div');
			feedbackSizing.className = 'ingredient-feedback-sizing';
			feedbackSizing.setAttribute('aria-hidden', 'true');
			// Grid overlays measure every possible error so wrapping never moves the slots.
			const updateFeedbackSizing = () => {
				const samples = [t('ingredientSlotEmpty')];
				for (const item of Array.from(from).filter(testmode)) {
					if (fixedSlots.length) {
						samples.push(t('ingredientPotFull', { name: item.name }));
					}
					samples.push(t('ingredientNotSelected', { name: item.name }));
				}
				feedbackSizing.replaceChildren(
					...samples.map(message => {
						const sample = document.createElement('div');
						sample.className = 'ingredient-feedback';
						sample.textContent = message;
						return sample;
					}),
				);
			};
			const pickerSummary = document.createElement('div');
			pickerSummary.className = 'ingredient-search-summary';
			pickerSummary.id = `ingredient-summary-${index}`;
			const showAllIngredients = document.createElement('button');
			showAllIngredients.type = 'button';
			showAllIngredients.className = 'ingredient-show-all';
			showAllIngredients.setAttribute('data-i18n', 'ingredientShowAll');
			showAllIngredients.textContent = t('ingredientShowAll');
			showAllIngredients.setAttribute('aria-describedby', pickerSummary.id);
			const searchResultsSummary = document.createElement('div');
			searchResultsSummary.className = 'ingredient-search-results';
			searchResultsSummary.append(pickerSummary, showAllIngredients);
			const feedbackHeader = document.createElement('div');
			feedbackHeader.className = 'ingredient-feedback-header';
			const shortcutHint = document.createElement('span');
			shortcutHint.className = 'ingredient-shortcuts';
			const shortcutKey = fixedSlots.length
				? 'ingredientShortcuts'
				: 'ingredientDiscoveryShortcuts';
			shortcutHint.setAttribute('data-i18n', shortcutKey);
			shortcutHint.textContent = t(shortcutKey);
			picker.setAttribute('aria-keyshortcuts', 'Enter Shift+Enter Control+Enter Meta+Enter');
			feedbackHeader.append(searchResultsSummary, shortcutHint);
			const pickerHelp = document.createElement('div');
			pickerHelp.className = 'sr-only';
			pickerHelp.id = `ingredient-help-${index}`;
			const helpKey = fixedSlots.length
				? 'ingredientSearchHelp'
				: 'ingredientDiscoverySearchHelp';
			pickerHelp.setAttribute('data-i18n', helpKey);
			pickerHelp.textContent = t(helpKey);
			searchRow.appendChild(pickerHelp);
			picker.setAttribute('aria-describedby', `${pickerHelp.id} ${pickerSummary.id}`);
			let searchAnnouncement: number | undefined;
			let cookingHiddenCount = 0;
			let pickerError:
				| {
						key: 'ingredientPotFull' | 'ingredientNotSelected' | 'ingredientSlotEmpty';
						params: { name?: string };
				  }
				| undefined;
			const updateSummaryVisibility = () => {
				pickerSummary.hidden = dropdown.hidden && !pickerError;
				showAllIngredients.hidden =
					dropdown.hidden || cookingHiddenCount === 0 || !picker.value.trim();
			};
			const cancelSearchAnnouncement = () => {
				window.clearTimeout(searchAnnouncement);
				searchAnnouncement = undefined;
			};
			const announcePicker = (message: string, visible = false) => {
				cancelSearchAnnouncement();
				if (!visible) {
					pickerError = undefined;
				}
				pickerStatus.classList.toggle('sr-only', !visible);
				pickerStatus.classList.toggle('ingredient-feedback', visible);
				pickerStatus.replaceChildren(document.createTextNode(message));
				updateSummaryVisibility();
				picker.setAttribute(
					'aria-describedby',
					`${pickerHelp.id} ${pickerSummary.id}${visible ? ` ${pickerStatus.id}` : ''}`,
				);
			};
			const updateSearchFeedback = (announce = false) => {
				cancelSearchAnnouncement();
				if (pickerStatus.classList.contains('ingredient-feedback')) {
					announcePicker('');
				}
				const count = pickerOptions.length;
				let message = t(
					count === 0
						? cookingHiddenCount > 0
							? 'ingredientCookingEmpty'
							: 'ingredientSearchEmpty'
						: count === 1
							? 'ingredientSearchOne'
							: 'ingredientSearchCount',
					{ count, view: t('cookingAll') },
				);
				if (count > 0 && cookingHiddenCount > 0 && picker.value.trim()) {
					message += ` ${t('ingredientCookingHidden', { count: cookingHiddenCount })}`;
				}
				pickerSummary.textContent = message;
				updateSummaryVisibility();
				if (announce && searchRow.contains(document.activeElement)) {
					searchAnnouncement = window.setTimeout(() => {
						searchAnnouncement = undefined;
						if (!dropdown.hidden && searchRow.contains(document.activeElement)) {
							announcePicker(message);
						}
					}, 300);
				}
			};
			const announceIngredient = (
				key: 'ingredientAdded' | 'ingredientRemoved',
				id?: string,
			) => {
				const item = id ? getCollectionItem(from, id) : undefined;
				if (item) {
					announcePicker(t(key, { name: item.name }));
				}
			};

			const ingredientActionTimers = new WeakMap<
				HTMLElement,
				ReturnType<typeof setTimeout>
			>();
			const flashIngredientActionError = (
				target: HTMLElement | null,
				key: NonNullable<typeof pickerError>['key'],
				params: { name?: string } = {},
			) => {
				if (!target) {
					return;
				}
				pickerError = { key, params };
				announcePicker(t(key, params), true);

				window.clearTimeout(ingredientActionTimers.get(target));
				target.classList.remove('ingredient-action-error');
				void target.offsetWidth;
				target.classList.add('ingredient-action-error');
				ingredientActionTimers.set(
					target,
					window.setTimeout(() => {
						target.classList.remove('ingredient-action-error');
						ingredientActionTimers.delete(target);
					}, 400),
				);
			};

			const removeSlotById = (id?: string, all = false) => {
				if (!id) {
					return -1;
				}

				if (limited) {
					let removed = -1;
					// Work backwards: clearing a slot compacts the following ingredients.
					for (let i = fixedSlots.length - 1; i >= 0; i--) {
						if (getSlot(fixedSlots[i])?.key === id) {
							setSlot(fixedSlots[i], null);
							removed = i;
							if (!all) {
								break;
							}
						}
					}
					if (removed !== -1 && loaded) {
						updateRecipes();
						saveState();
					}
					return removed;
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
					saveState();
				}

				return i;
			};

			const pickItem = (id: string, target: HTMLElement, isRemoval = false) => {
				let result;
				const removing = isRemoval || (!limited && slots.includes(id));

				if (isRemoval) {
					result = removeSlotById(id);
				} else if (!limited && slots.indexOf(id) !== -1) {
					result = removeSlotById(id);
				} else {
					result = appendSlot(id);
				}

				if (result === -1) {
					flashIngredientActionError(
						target,
						limited && !removing ? 'ingredientPotFull' : 'ingredientNotSelected',
						{
							name: getCollectionItem(from, id)?.name || id,
						},
					);
				} else {
					announceIngredient(removing ? 'ingredientRemoved' : 'ingredientAdded', id);
				}
			};
			const removeAllCopies = (id: string, target: HTMLElement) => {
				const name = getCollectionItem(from, id)?.name || id;
				if (removeSlotById(id, true) === -1) {
					flashIngredientActionError(target, 'ingredientNotSelected', { name });
				} else {
					announcePicker(t('ingredientAllRemoved', { name }));
				}
			};

			const ensureEmptySlot = () => {
				// Only for unlimited mode (Discovery page)
				if (limited) {
					return;
				}

				// Preserve the add button so removing its neighbor does not lose focus.
				const existingEmptySlot = parent.querySelector<HTMLElement>(
					'.ingredient:not([data-id])',
				);
				if (existingEmptySlot) {
					if (existingEmptySlot !== parent.lastElementChild) {
						parent.appendChild(existingEmptySlot);
					}
					return;
				}

				// Add a single empty slot at the end
				const emptySlot = document.createElement('button');
				emptySlot.type = 'button';
				emptySlot.className = 'ingredient';
				setSlot(emptySlot, null);
				bindActivation(emptySlot, () => picker.focus(), removeSlot);
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
								saveState();
							}

							return i;
						}
					}

					return -1;
				} else {
					if (slots.indexOf(id) === -1) {
						slots.push(id);
						const i = document.createElement('button');
						i.type = 'button';
						i.className = 'ingredient';
						setSlot(i, item);
						bindActivation(i, removeSlot, removeSlot);
						parent.appendChild(i);

						// Ensure there's always an empty "+" slot at the end
						ensureEmptySlot();

						if (loaded) {
							updateRecipes();
							saveState();
						}

						return 1;
					}

					return -1;
				}
			};

			const liIntoPicker = function (this: HTMLElement, item: GuideItem) {
				const img = makeImage(item.img);
				img.setAttribute('aria-hidden', 'true');

				img.title = item.name;

				const li = document.createElement('span');
				li.classList.add('item');
				li.appendChild(img);

				const name = document.createElement('span');
				name.classList.add('text');
				name.appendChild(document.createTextNode(item.name));
				li.appendChild(name);
				li.appendChild(document.createTextNode(' '));
				// These are pointer shortcuts within one atomic listbox option. Keyboard
				// and assistive-technology users keep focus on the combobox and use Enter
				// modifiers; nesting buttons/checkboxes would break listbox semantics.
				const actions = document.createElement('span');
				actions.className = 'ingredient-option-actions';
				actions.setAttribute('aria-hidden', 'true');
				const toggle = document.createElement('span');
				toggle.className = 'ingredient-toggle';
				const checkbox = document.createElement('span');
				checkbox.className = 'ingredient-toggle-visual';
				const marker = document.createElement('span');
				marker.className = 'ingredient-picked-marker';
				checkbox.appendChild(marker);
				toggle.appendChild(checkbox);
				const subtract = document.createElement('span');
				subtract.className = 'ingredient-subtract';
				subtract.hidden = true;
				const minus = document.createElement('span');
				minus.className = 'ingredient-subtract-visual';
				subtract.appendChild(minus);
				// Draw the minus in CSS so it doesn't alter the ingredient's name.
				actions.append(toggle, subtract);
				li.appendChild(actions);

				li.dataset.id = item.key;
				li.id = `ingredient-result-${index}-${pickerOptions.length}`;
				li.setAttribute('role', 'option');
				li.setAttribute('aria-label', item.name);
				li.setAttribute('aria-selected', 'false');

				bindActivation(
					li,
					event => {
						const target = event.target instanceof Element ? event.target : null;
						if (target?.closest('.ingredient-subtract')) {
							if (li.classList.contains('faded')) {
								pickItem(item.key, li, true);
							}
						} else if (
							target?.closest('.ingredient-toggle') &&
							li.classList.contains('faded')
						) {
							removeAllCopies(item.key, li);
						} else {
							pickItem(item.key, li);
						}
					},
					() => pickItem(item.key, li, true),
				);
				this.appendChild(li);
				pickerOptions.push({ element: li, key: item.key, name: item.name });
			};

			const updateSelectionIndicators = () => {
				const counts = new Map<string, number>();
				const selected = limited ? fixedSlots.map(slot => slot.dataset.id) : slots;
				for (const id of selected) {
					if (id) {
						counts.set(id, (counts.get(id) || 0) + 1);
					}
				}
				for (const { element, key, name } of pickerOptions) {
					const count = counts.get(key) || 0;
					element.classList.toggle('faded', count > 0);
					element.querySelector('.ingredient-picked-marker')!.textContent =
						count > 1 ? String(count) : '';
					element.querySelector<HTMLElement>('.ingredient-toggle')!.title = t(
						count ? 'removeAllIngredient' : 'addNamedIngredient',
						{ name },
					);
					const subtract = element.querySelector<HTMLElement>('.ingredient-subtract')!;
					subtract.hidden = count <= 1;
					subtract.title = t('removeOneIngredient', { name });
					// The accessible name must include the quantity shown in the badge.
					element.setAttribute('aria-label', count > 1 ? `${name} ${count}` : name);
					if (count) {
						element.setAttribute(
							'aria-description',
							t(limited ? 'ingredientInPot' : 'ingredientInInventory', { count }),
						);
					} else {
						element.removeAttribute('aria-description');
					}
				}
			};

			const removeSlot = (e: Event) => {
				const target = eventControl(e);
				e.preventDefault();

				if (limited) {
					if (getSlot(target) !== null) {
						const removedId = target.dataset.id;
						setSlot(target, null);
						updateRecipes();
						saveState();
						announceIngredient('ingredientRemoved', removedId);

						return removedId;
					} else {
						// Empty slot clicked - focus the search bar
						if (e.type === 'contextmenu') {
							flashIngredientActionError(target, 'ingredientSlotEmpty');
						} else {
							picker.focus();
						}
						return null;
					}
				} else {
					const i = slots.indexOf(target.dataset.id || '');
					if (i === -1) {
						flashIngredientActionError(target, 'ingredientSlotEmpty');
						return null;
					}
					const removedId = target.dataset.id;

					slots.splice(i, 1);
					const focused = target.contains(document.activeElement);
					const nextSlot = target.nextElementSibling || target.previousElementSibling;
					parent.removeChild(target);

					// Ensure there's always an empty "+" slot at the end
					ensureEmptySlot();
					if (focused) {
						if (nextSlot instanceof HTMLElement && nextSlot.isConnected) {
							nextSlot.focus();
						} else {
							picker.focus();
						}
					}

					updateRecipes();
					saveState();
					announceIngredient('ingredientRemoved', removedId);

					return removedId;
				}
			};

			const refreshPicker = (announce = true) => {
				dropdown.hidden = false;
				picker.setAttribute('aria-expanded', 'true');
				selectedResult = -1;
				picker.removeAttribute('aria-activedescendant');
				searchSelectorControls.splitTag();
				let names = matchingNames(
					from,
					searchSelectorControls.getSearch(),
					allowUncookable,
				);
				const matchingCount = names.length;
				names = filterCookingIngredients(names, cookingControls.getValue(), {
					ingredients: food.filter(() => true),
					recipes: recipes.filter(() => true),
					modeMask,
					charMask,
				});
				cookingHiddenCount = matchingCount - names.length;

				const sortType = sortControls.getValue();
				names = sortIngredients(names, sortType, {
					statMultipliers,
					modifyItem: characterFoodModifiers.modifyItem,
					modeMask,
					search: searchSelectorControls.getSearch(),
				});

				dropdown.removeChild(ul);

				ul = document.createElement('div');
				ul.className = 'ingredient-result-groups';
				ul.classList.toggle('is-grouped', groupControls.getValue() !== 'none');
				pickerOptions = [];
				groupLabels = [];
				for (const group of groupIngredients(
					names,
					groupControls.getValue(),
					sortType === 'auto' && Boolean(picker.value.trim()),
				)) {
					const section = document.createElement('div');
					section.className = 'ingredient-result-group';
					if (group.label) {
						const heading = document.createElement('span');
						heading.className = 'ingredient-group-heading';
						heading.id = `ingredient-group-${index}-${group.key}`;
						heading.setAttribute('role', 'presentation');
						section.setAttribute('role', 'group');
						section.setAttribute('aria-labelledby', heading.id);
						section.appendChild(heading);
						groupLabels.push({
							element: heading,
							key: group.label,
							count: group.items.length,
						});
					}
					const options = document.createElement('div');
					options.className = 'ingredient-options';
					group.items.forEach(liIntoPicker, options);
					section.appendChild(options);
					ul.appendChild(section);
				}
				updateGroupLabels();
				pickerOptions.forEach(({ element }, optionIndex) => {
					element.setAttribute('aria-posinset', String(optionIndex + 1));
					element.setAttribute('aria-setsize', String(pickerOptions.length));
				});

				dropdown.appendChild(ul);
				updateSelectionIndicators();
				updateSearchFeedback(announce);
			};

			const pickerTables: SortableTable[] = [];
			const disposePickerTables = () => {
				for (const table of pickerTables) {
					table.dispose();
				}
				pickerTables.length = 0;
			};

			if (parent.id === 'ingredients') {
				//simulator
				loadSimulatorIngredients = items => {
					for (const [slotIndex, slot] of fixedSlots.entries()) {
						setSlot(slot, items[slotIndex] ?? null);
					}
					picker.value = '';
					refreshPicker(false);
					updateRecipes();
					setTab('simulator');
					fixedSlots[0].focus();
					announcePicker(t('analysisIngredientsLoaded', { count: items.length }));
					saveState();
				};

				const searchFor = (name: string, target: HTMLElement) => {
					const matches = matchingNames(from, name, allowUncookable);

					if (matches.length === 1) {
						const result = appendSlot(matches[0].key);
						if (result === -1) {
							flashIngredientActionError(target, 'ingredientPotFull', {
								name: matches[0].name,
							});
						} else {
							announceIngredient('ingredientAdded', matches[0].key);
						}
					} else {
						picker.value = name;
						refreshPicker();
					}
				};

				updateRecipes = () => {
					disposePickerTables();
					ingredients = fixedSlots.map(slot => {
						const item = getSlot(slot);
						return item && 'nameObject' in item ? item : null;
					});

					const cooking = getRecipes(ingredients);
					const health = cooking[0].health;
					const hunger = cooking[0].hunger;
					const sanity = cooking[0].sanity;

					let table = makeSortableTable({
						captionKey: 'tableCookingResults',
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
					pickerTables.push(table);
					simulatorLocaleRefresh = updateRecipes;

					results.appendChild(makeElement('p', t('discoveryHighlightsNote')));

					if (ingredients[0] !== null) {
						getSuggestions(suggestions, ingredients, cooking);

						if (suggestions.length > 0) {
							results.appendChild(makeElement('p', t('discoveryMoreSuggestions')));
							table = makeSortableTable({
								captionKey: 'tableRecipeSuggestions',
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
							pickerTables.push(table);
						}
					}

					updateSelectionIndicators();
				};
			} else if (parent.id === 'inventory') {
				//discovery
				let discoveryGrinder: ReturnType<typeof makeRecipeGrinder> | undefined;
				updateRecipes = () => {
					disposePickerTables();
					discoveryGrinder?.dispose();
					discoveryGrinder = undefined;
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
							captionKey: 'discoveryFoodStatsHeading',
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
							linkCallback: name => setHighlight(name),
							columnConfig: {
								toggleable: true,
								columns: ['Health', 'Hunger', 'Sanity', 'Perish', 'Info', 'Mode'],
								autoHide: getAutoHideColumns(['Sanity']),
							},
						});

						discoverfood.appendChild(foodTable);
						pickerTables.push(foodTable);
						getSuggestions(inventoryrecipes, ingredients, null, true);

						if (inventoryrecipes.length > 0) {
							const table = makeSortableTable({
								captionKey: 'discoveryRecipesHeading',
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
								linkCallback: name => setHighlight(name),
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
							pickerTables.push(table);

							discoveryGrinder = makeRecipeGrinder(
								ingredients.filter((item): item is Food => item !== null),
							);
							makable.appendChild(discoveryGrinder.button);
						}
					}

					updateSelectionIndicators();
				};
			}

			if (fixedSlots.length !== 0) {
				limited = true;

				fixedSlots.forEach(slot => {
					setSlot(slot, null);
					bindActivation(slot, removeSlot, removeSlot);
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
					{ value: 'auto', key: 'sortAuto' },
					{ value: 'name', key: 'sortName' },
					{ value: 'health', key: 'sortHealth' },
					{ value: 'hunger', key: 'sortHunger' },
					{ value: 'sanity', key: 'sortSanity' },
					{ value: 'perish', key: 'sortPerish' },
				],
				initialValue: 'auto',
				buttonClass: 'sortingredients',
				storageKey: 'foodGuideSortPreference',
				storageIndex: index,
				onSelect: () => {
					updateSortHelp();
					refreshPicker();
				},
			});
			const sortHelp = document.createElement('span');
			sortHelp.className = 'sr-only';
			sortHelp.id = `ingredient-sort-help-${index}`;
			sortHelp.setAttribute('data-i18n', 'sortAutoHelp');
			sortHelp.textContent = t('sortAutoHelp');
			const updateSortHelp = () => {
				if (sortControls.getValue() === 'auto') {
					sortControls.button.setAttribute('aria-describedby', sortHelp.id);
					sortControls.button.title = t('sortAutoHelp');
				} else {
					sortControls.button.removeAttribute('aria-describedby');
					sortControls.button.title = '';
				}
			};
			updateSortHelp();
			const groupControls = createDropdown({
				items: [
					{ value: 'none', key: 'groupNone' },
					{ value: 'type', key: 'groupType' },
					{ value: 'preparation', key: 'groupPreparation' },
				],
				initialValue: 'none',
				buttonClass: 'groupingredients',
				storageKey: 'foodGuideGroupPreference',
				storageIndex: index,
				onSelect: () => refreshPicker(),
			});
			const cookingControls = createDropdown({
				items: [
					{ value: 'all', key: 'cookingAll' },
					{ value: 'practical', key: 'cookingPractical' },
					{ value: 'everyday', key: 'cookingEveryday' },
				],
				initialValue: 'all',
				buttonClass: 'cookingingredients',
				storageKey: 'foodGuideCookingPreference',
				storageIndex: index,
				onSelect: () => {
					updateCookingHelp();
					refreshPicker();
				},
			});
			const cookingHelp = document.createElement('span');
			cookingHelp.className = 'sr-only';
			cookingHelp.id = `ingredient-cooking-help-${index}`;
			cookingControls.button.setAttribute('aria-describedby', cookingHelp.id);
			const updateCookingHelp = () => {
				const key =
					cookingControls.getValue() === 'practical'
						? 'cookingPracticalHelp'
						: cookingControls.getValue() === 'everyday'
							? 'cookingEverydayHelp'
							: 'cookingAllHelp';
				cookingHelp.textContent = t(key);
				cookingControls.button.title = t(key);
			};
			updateCookingHelp();
			showAllIngredients.addEventListener('click', () => {
				cookingControls.setValue('all', { persist: true });
				updateCookingHelp();
				picker.focus();
				refreshPicker();
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
				labelKey: 'pickerSearchType',
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
			showAllIngredients.setAttribute('aria-controls', dropdown.id);
			dropdown.setAttribute('role', 'listbox');
			picker.setAttribute('role', 'combobox');
			picker.setAttribute('data-i18n-attr-aria-label', 'searchPlaceholderName');
			picker.setAttribute('aria-label', t('searchPlaceholderName'));
			picker.setAttribute('aria-autocomplete', 'list');
			picker.setAttribute('aria-expanded', 'true');
			picker.setAttribute('aria-controls', dropdown.id);
			dropdown.appendChild(ul);
			// Keep mouse selections in the combobox without intercepting touch scrolling or focus.
			dropdown.addEventListener('pointerdown', event => {
				if (event.pointerType === 'mouse') {
					event.preventDefault();
				}
			});

			refreshPicker();

			clearSearchBtn.className = 'clearingredients clearsearchbtn';
			clearSearchBtn.type = 'button';
			clearSearchBtn.setAttribute('data-i18n-attr-aria-label', 'clearSearch');
			clearSearchBtn.setAttribute('aria-label', t('clearSearch'));
			clearSearchBtn.setAttribute('data-i18n-attr-title', 'clearSearch');
			clearSearchBtn.title = t('clearSearch');
			// Use an inline SVG for clear search or just an X
			clearSearchBtn.innerHTML = '<span>×</span>';

			clearSearchBtn.addEventListener('click', () => {
				picker.value = '';
				searchSelectorControls.setSearchType(0);
				refreshPicker();
				picker.focus();
			});

			clearIngredientsBtn.className = 'clearingredients clearingredientsbtn';
			clearIngredientsBtn.type = 'button';
			clearIngredientsBtn.setAttribute('data-i18n-attr-aria-label', 'clearIngredients');
			clearIngredientsBtn.setAttribute('aria-label', t('clearIngredients'));
			clearIngredientsBtn.setAttribute('data-i18n-attr-title', 'clearIngredients');
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
				saveState();
				announcePicker(t('ingredientsCleared'));
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
				labelKey: 'pickerDensity',
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
			controlsLeft.appendChild(groupControls.container);
			controlsLeft.appendChild(cookingControls.container);
			controlsLeft.appendChild(sortHelp);
			controlsLeft.appendChild(cookingHelp);

			controlsRight.appendChild(clearSearchBtn);
			controlsRight.appendChild(clearIngredientsBtn);

			controlsGroup.appendChild(controlsLeft);
			controlsGroup.appendChild(controlsRight);
			searchRow.appendChild(controlsGroup);

			searchRow.parentNode!.insertBefore(dropdown, parent.parentElement!);
			feedbackSpace.append(feedbackHeader, feedbackSizing, pickerStatus);
			searchRow.parentNode!.insertBefore(feedbackSpace, parent.parentElement!);

			picker.addEventListener('input', event => refreshPicker(!event.isComposing));
			picker.addEventListener('compositionstart', cancelSearchAnnouncement);
			picker.addEventListener('compositionend', () => updateSearchFeedback(true));
			picker.addEventListener('keydown', event => {
				if (event.isComposing || event.altKey) {
					return;
				}
				const options = pickerOptions;
				if (event.key === 'Enter' && options.length) {
					if (dropdown.hidden) {
						return;
					}
					event.preventDefault();
					const target = options[Math.max(0, selectedResult)];
					if (event.ctrlKey || event.metaKey) {
						removeAllCopies(target.key, target.element);
					} else {
						pickItem(target.key, target.element, event.shiftKey);
					}
					return;
				}
				if (event.ctrlKey || event.metaKey) {
					return;
				}
				if (event.key === 'Escape') {
					dropdown.hidden = true;
					updateSummaryVisibility();
					cancelSearchAnnouncement();
					picker.setAttribute('aria-expanded', 'false');
					selectedResult = -1;
				} else if (event.key === 'ArrowDown' && options.length) {
					dropdown.hidden = false;
					picker.setAttribute('aria-expanded', 'true');
					selectedResult = (selectedResult + 1) % options.length;
				} else if (event.key === 'ArrowUp' && options.length) {
					dropdown.hidden = false;
					picker.setAttribute('aria-expanded', 'true');
					selectedResult = selectedResult <= 0 ? options.length - 1 : selectedResult - 1;
				} else {
					return;
				}
				event.preventDefault();
				options.forEach(({ element: option }, optionIndex) => {
					const selected = optionIndex === selectedResult;
					option.classList.toggle('selected', selected);
					option.setAttribute('aria-selected', String(selected));
				});
				const activeOption = options[selectedResult];
				updateSummaryVisibility();
				if (activeOption) {
					picker.setAttribute('aria-activedescendant', activeOption.element.id);
					activeOption.element.scrollIntoView({ block: 'nearest' });
				} else {
					picker.removeAttribute('aria-activedescendant');
				}
			});

			picker.addEventListener(
				'focus',
				() => {
					dropdown.hidden = false;
					updateSummaryVisibility();
					picker.setAttribute('aria-expanded', 'true');
				},
				false,
			);

			picker.addEventListener(
				'blur',
				() => {
					cancelSearchAnnouncement();
					selectedResult = -1;
					picker.removeAttribute('aria-activedescendant');
					for (const { element } of pickerOptions) {
						element.classList.remove('selected');
						element.setAttribute('aria-selected', 'false');
					}
				},
				false,
			);

			updateRecipes();

			stateWriters.push(state => {
				state.pickers ??= [];
				state.pickers[index] = limited
					? fixedSlots.map(slot => getSlot(slot)?.key ?? null)
					: [...slots];
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
			modeRefreshers.push(
				refreshSelection,
				refreshPicker,
				updateRecipes,
				updateFeedbackSizing,
			);
			document.addEventListener('foodguide:localechange', () => {
				const error = pickerError;
				updateSortHelp();
				updateCookingHelp();
				updateGroupLabels();
				updateFeedbackSizing();
				updateSelectionIndicators();
				updateSearchFeedback();
				if (error) {
					pickerError = error;
					announcePicker(t(error.key, error.params), true);
				}
				for (const slot of parent.querySelectorAll<HTMLElement>('.ingredient')) {
					const item = getSlot(slot);
					slot.setAttribute(
						'aria-label',
						item ? t('removeIngredient', { name: item.name }) : t('addIngredient'),
					);
				}
			});
		}
	})();

	// --- Mode selector UI ---

	const selectVersion = (versionName: string) => {
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

	const toggleDlc = (dlcKey: string) => {
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

	const selectCharacter = (charName: string) => {
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
		btn.addEventListener('click', () => selectVersion(name), false);
		btn.title = gameVersions[name].name;

		const img = makeImage(`img/${gameVersions[name].img}`);
		img.setAttribute('aria-hidden', 'true');
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
		btn.addEventListener('click', () => toggleDlc(name), false);
		btn.title = `${dlcOptions[name].name}\n${t('dlcToggleHint')}`;

		const img = makeImage(`img/${dlcOptions[name].img}`);
		img.setAttribute('aria-hidden', 'true');
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
		btn.addEventListener('click', () => selectCharacter(name), false);
		const charAbilities = getCharacterAbilities(name, characters);
		const abilityText = charAbilities.length > 0 ? `\n${charAbilities.join('\n')}` : '';
		btn.title = `${characters[name].name}\n${t('characterToggleHint')}${abilityText}`;

		const img = makeImage(`img/${characters[name].img}`);
		img.setAttribute('aria-hidden', 'true');
		img.dataset.character = name;
		btn.appendChild(img);

		charSection.appendChild(btn);
	}

	headerTop.appendChild(charSection);

	setMode();
	initialized = true;
	saveState();
})();
