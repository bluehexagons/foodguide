// @ts-nocheck
'use strict';

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
	baseModes,
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
	const resolveIconTarget = el =>
		el.tagName === 'IMG' || el.classList.contains('icon') ? el.parentNode : el;

	const modeRefreshers = [];
	const localeTables = new Set();
	const responsiveTables = new Set();
	let tableResizeTimeout;

	window.addEventListener('resize', () => {
		clearTimeout(tableResizeTimeout);
		tableResizeTimeout = setTimeout(() => {
			for (const tableContainer of Array.from(responsiveTables)) {
				if (!tableContainer.isConnected) {
					responsiveTables.delete(tableContainer);
				} else {
					tableContainer.updateResponsive();
				}
			}
		}, 150);
	});
	let simulatorLocaleRefresh = null;
	let discoveryLocaleRefresh = null;

	let statMultipliers = defaultStatMultipliers;
	let characterFoodModifiers = { modifyItem: () => ({}) };

	// Mode state: game version + DLC toggles + optional character
	let currentVersion = 'together';
	let activeDlc = { giants: false, shipwrecked: false };
	let currentCharacter = null;
	let modeMask = gameVersions[currentVersion].baseMask;
	let charMask = 0;

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

	const langPicker = /** @type {HTMLSelectElement | null} */ (
		document.getElementById('language-picker')
	);
	if (langPicker) {
		const localeFlags = { en: '🇺🇸', es: '🇪🇸', zh: '🇨🇳' };
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
		if (langPicker) langPicker.value = getLocale();
		updateRecipeText();
		// Rebuild per-food info (tag chips, "dry in N days") so localized
		// labels appear without changing the active mode/character.
		updateFoodRecipes(
			recipes.filter(r => matchesMode(r.modeMask, modeMask, r.charMask, charMask)),
		);
		if (simulatorLocaleRefresh) simulatorLocaleRefresh();
		if (discoveryLocaleRefresh) discoveryLocaleRefresh();
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
	const getAutoHideColumns = baseColumns => {
		const columns = [...baseColumns];
		if (!shouldShowModeColumn() && !columns.includes('Mode')) {
			columns.push('Mode');
		}
		return columns;
	};

	const tableLabelKeys = {
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

	const tableHintKeys = {
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

	const summaryLabelKeys = {
		Total: 'simulatorSummaryTotal',
		Potential: 'simulatorSummaryPotential',
	};

	const translateTableLabel = label => {
		const key = tableLabelKeys[label];
		return key ? t(key) : label;
	};

	const translateSummaryLabel = label => {
		const key = summaryLabelKeys[label];
		return key ? t(key) : label;
	};

	const translateTableHint = hint => {
		const key = tableHintKeys[hint];
		return key ? t(key) : hint;
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
			document.getElementById('statistics').replaceChildren(makeRecipeGrinder(null, true));
		}

		// Update version button states
		const versionButtons = modePanel.querySelectorAll('.version-btn');
		for (const btn of versionButtons) {
			const ver = gameVersions[btn.dataset.version];
			if (!ver) {
				continue;
			}
			btn.classList.toggle('selected', btn.dataset.version === currentVersion);
		}

		// Show/hide DLC section (only visible for 'dontstarve')
		const dlcSection = modePanel.querySelector('.dlc-section');
		const dlcDivider = modePanel.querySelector('.dlc-divider');
		if (dlcSection) {
			dlcSection.classList.toggle('hidden', currentVersion !== 'dontstarve');
		}
		if (dlcDivider) {
			dlcDivider.style.display = currentVersion === 'dontstarve' ? '' : 'none';
		}

		// Update DLC toggle states
		const dlcButtons = modePanel.querySelectorAll('.dlc-btn');
		for (const btn of dlcButtons) {
			const dlcKey = btn.dataset.dlc;
			btn.classList.toggle('selected', !!activeDlc[dlcKey]);
		}

		// Update character button states and visibility
		const charSection = modePanel.querySelector('.char-section');
		const charDivider = modePanel.querySelector('.char-divider');
		const charButtons = modePanel.querySelectorAll('.char-btn');
		let anyCharApplicable = false;
		for (const btn of charButtons) {
			const charName = btn.dataset.character;
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
			btn.classList.toggle('selected', applicable && charName === currentCharacter);
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

	const mainElement = document.getElementById('main');
	const foodElement = document.getElementById('food');
	const recipesElement = document.getElementById('recipes');
	const navbar = document.getElementById('navbar');

	const populateGameInfoNumbers = () => {
		const set = (id, text) => {
			const el = document.getElementById(id);
			if (!el) return;
			el.textContent = '';
			el.appendChild(document.createTextNode(text));
		};
		const pct = v => `${Math.round(v * 1000) / 10}%`;
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
	const getRealRecipesFromCollection = (...args) => recipeAnalyzer.analyze(...args);

	let setTab;

	(() => {
		const navtabs = navbar.getElementsByTagName('li');
		const tabs = {};
		const elements = {};
		let activePage;
		let activeTab;

		const showTab = e => {
			setTab(e.target.dataset.tab);
		};

		setTab = tabID => {
			activeTab.className = '';
			activeTab = tabs[tabID];
			activePage.style.display = 'none';
			activePage = elements[tabID];
			activeTab.className = 'selected';
			activePage.style.display = 'block';

			// Initialize statistics tab content on first visit
			if (tabID === 'statistics' && !activePage.hasChildNodes()) {
				activePage.appendChild(makeRecipeGrinder(null, true));
			}
		};

		for (let i = 0; i < navtabs.length; i++) {
			const navtab = navtabs[i];

			if (navtab.dataset.tab) {
				tabs[navtab.dataset.tab] = navtab;
				elements[navtab.dataset.tab] = document.getElementById(navtab.dataset.tab);
				elements[navtab.dataset.tab].style.display = 'none';
				navtab.addEventListener(
					'selectstart',
					e => {
						e.preventDefault();
					},
					false,
				);
				navtab.addEventListener('click', showTab, false);
			}
		}

		activeTab = tabs['simulator'];
		activePage = elements['simulator'];

		try {
			if (window.localStorage.foodGuideState) {
				const storage = JSON.parse(window.localStorage.foodGuideState);

				if (storage.activeTab && tabs[storage.activeTab]) {
					activeTab = tabs[storage.activeTab];
					activePage = elements[storage.activeTab];
				} else if (storage.activeTab === 'help') {
					// Migrate: 'help' tab was split into 'about' and 'gameinfo'
					activeTab = tabs['about'];
					activePage = elements['about'];
				}

				// New format: version + dlc + character
				if (storage.version && gameVersions[storage.version]) {
					currentVersion = storage.version;
					if (storage.dlc && typeof storage.dlc === 'object') {
						activeDlc = {
							giants: !!storage.dlc.giants,
							shipwrecked: !!storage.dlc.shipwrecked,
						};
					}
					if (storage.character && characters[storage.character]) {
						currentCharacter = storage.character;
					}
				} else if (storage.baseMode && baseModes[storage.baseMode]) {
					// Migrate from previous format (baseMode + character)
					const bm = storage.baseMode;
					if (bm === 'together') {
						currentVersion = 'together';
					} else if (bm === 'hamlet') {
						currentVersion = 'hamlet';
					} else if (bm === 'shipwrecked') {
						currentVersion = 'dontstarve';
						activeDlc = { giants: true, shipwrecked: true };
					} else if (bm === 'giants') {
						currentVersion = 'dontstarve';
						activeDlc = { giants: true, shipwrecked: false };
					} else {
						currentVersion = 'dontstarve';
						activeDlc = { giants: false, shipwrecked: false };
					}
					if (storage.character && characters[storage.character]) {
						currentCharacter = storage.character;
					}
				} else if (storage.modeMask !== null) {
					// Migrate from oldest format: reverse-lookup modeMask.
					// Old bit values: VANILLA=1, GIANTS=2, SHIPWRECKED=4, TOGETHER=8,
					// WARLY=16, HAMLET=32, WARLYHAM=64, WARLYDST=128, WEBBER=256
					const oldMask = storage.modeMask;

					if (oldMask === 119) {
						// 1|2|4|32|16|64 = VANILLA|GIANTS|SHIPWRECKED|HAMLET|WARLY|WARLYHAM
						currentVersion = 'hamlet';
						currentCharacter = 'warly';
					} else if (oldMask === 23) {
						// 1|2|4|16 = VANILLA|GIANTS|SHIPWRECKED|WARLY
						currentVersion = 'dontstarve';
						activeDlc = { giants: true, shipwrecked: true };
						currentCharacter = 'warly';
					} else if (oldMask === 136) {
						// 8|128 = TOGETHER|WARLYDST
						currentVersion = 'together';
						currentCharacter = 'warly';
					} else if (oldMask === 39) {
						// 1|2|4|32 = VANILLA|GIANTS|SHIPWRECKED|HAMLET
						currentVersion = 'hamlet';
					} else if (oldMask === 7) {
						// 1|2|4 = VANILLA|GIANTS|SHIPWRECKED
						currentVersion = 'dontstarve';
						activeDlc = { giants: true, shipwrecked: true };
					} else if (oldMask === 3) {
						// 1|2 = VANILLA|GIANTS
						currentVersion = 'dontstarve';
						activeDlc = { giants: true, shipwrecked: false };
					} else if (oldMask === 1) {
						// VANILLA
						currentVersion = 'dontstarve';
						activeDlc = { giants: false, shipwrecked: false };
					} else if (oldMask === 8) {
						// TOGETHER
						currentVersion = 'together';
					}
				}
			}
		} catch (err) {
			console.warn('Unable to access localStorage', err);
			try {
				window.localStorage.removeItem('foodGuideState');
			} catch {}
		}

		activeTab.className = 'selected';
		activePage.style.display = 'block';

		window.addEventListener('beforeunload', () => {
			let obj;

			try {
				if (!window.localStorage.foodGuideState) {
					window.localStorage.foodGuideState = '{}';
				}

				obj = JSON.parse(window.localStorage.foodGuideState);
				obj.activeTab = activeTab.dataset.tab;
				obj.version = currentVersion;
				obj.dlc = { ...activeDlc };
				obj.character = currentCharacter;
				// Keep modeMask for backward compatibility during migration
				obj.modeMask = modeMask;
				window.localStorage.foodGuideState = JSON.stringify(obj);
			} catch (err) {
				console.warn('Unable to access localStorage', err);
			}
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

	const sign = n => {
		if (isNaN(n)) {
			return '';
		}

		const nEights = ((Math.abs(n) % 1) * 8) | 0;
		const fractStr = nEights < 1 || nEights > 7 ? '' : fractionChars[nEights - 1] || '';

		n = Math.floor(n);
		return (n > 0 ? `+${n}` : n) + fractStr;
	};

	const rawpct = (base, val) => {
		return base < val
			? (val - base) / Math.abs(base)
			: base > val
				? -(base - val) / Math.abs(base)
				: 0;
	};

	const pct = (base, val) => {
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

	const formatDays = value => formatDuration('day', value);

	const formatSeconds = value => formatDuration('sec', value);

	const formatPerish = value =>
		isNaN(value) ? t('durationNever') : formatDays(value / total_day_time);

	const formatToDays = value =>
		t('durationToDays', { count: value, unit: durationUnit('day', value) });

	const makeFoodRow = item => {
		const mult = statMultipliers[item.preparationType];
		const itemMods = characterFoodModifiers.modifyItem(item, modeMask);
		let health = sign((itemMods.health ?? item.health) * mult);
		let hunger = sign((itemMods.hunger ?? item.hunger) * mult);
		let sanity = isNaN(item.sanity) ? '' : (itemMods.sanity ?? item.sanity) * mult;
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
							: formatToDays(item.cook.perish / total_day_time)
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
			item.modeNode || '',
		);
	};

	const makeRecipeRow = (item, health, hunger, sanity) => {
		const mult = statMultipliers[item.preparationType] || 1;
		const itemMods = characterFoodModifiers.modifyItem(item, modeMask);
		const ihealth = (itemMods.health ?? item.health) * mult;
		const ihunger = (itemMods.hunger ?? item.hunger) * mult;
		const isanity = (itemMods.sanity ?? item.sanity) * mult;

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
			item.requires || '',
			item.note || '',
			item.modeNode || '',
		);
	};

	// food list, recipe list
	let foodHighlight;
	let foodHighlighted = [];
	let recipeHighlighted = [];

	const setHighlight = e => {
		let name = !e.target ? e : resolveIconTarget(e.target).dataset.link;

		if (name.substring(0, 7) === 'recipe:' || name.substring(0, 11) === 'ingredient:') {
			setTab('crockpot');

			if (name.substring(0, 7) === 'recipe:') {
				name = `*${name.substring(7)}`;
			}

			recipeHighlighted = matchingNames(recipes, name);
			recipeTable.update(true);
		} else {
			setTab('foodlist');

			if (foodHighlight !== name) {
				foodHighlight = name;
				foodHighlighted = matchingNames(food, name);
			} else {
				foodHighlight = '';
				foodHighlighted.length = 0;
			}

			foodTable.update(true);
		}
	};

	const setFoodHighlight = e => {
		let name = !e.target ? e : resolveIconTarget(e.target).dataset.link;

		if (name.substring(0, 7) === 'recipe:' || name.substring(0, 11) === 'ingredient:') {
			setTab('crockpot');

			if (name.substring(0, 7) === 'recipe:') {
				name = `*${name.substring(7)}`;
			}

			recipeHighlighted = matchingNames(recipes, name);
			recipeTable.update(true);
		} else {
			if (foodHighlight !== name) {
				foodHighlight = name;
				foodHighlighted = matchingNames(food, name);
			} else {
				foodHighlight = '';
				foodHighlighted.length = 0;
			}

			foodTable.update(true);
		}
	};

	const setRecipeHighlight = e => {
		const name = !e.target ? e : resolveIconTarget(e.target).dataset.link;
		const modename = name.substring(name.indexOf(':') + 1);

		if (!!modes[modename]) {
			recipeHighlighted = matchingNames(recipes, name);
			recipeTable.update(true);
		} else {
			setTab('foodlist');
			foodHighlight = name;
			foodHighlighted = matchingNames(food, name);
			foodTable.update(true);
		}
	};

	const testFoodHighlight = item => {
		return foodHighlighted.indexOf(item) !== -1;
	};

	const testRecipeHighlight = item => {
		return recipeHighlighted.indexOf(item) !== -1;
	};

	const testmode = item => {
		return matchesMode(item.modeMask, modeMask, item.charMask, charMask);
	};

	const foodTable = makeSortableTable(
		{
			'': '',
			Name: 'name',
			Health: 'health',
			Hunger: 'hunger',
			Sanity: 'sanity',
			Perish: 'perish',
			Info: '',
			Mode: 'modeMask',
		},
		Array.prototype.slice.call(food),
		makeFoodRow,
		'name',
		false,
		setFoodHighlight,
		testFoodHighlight,
		testmode,
		undefined,
		undefined,
		{
			toggleable: true,
			columns: ['Health', 'Hunger', 'Sanity', 'Perish', 'Info', 'Mode'],
			autoHide: getAutoHideColumns(['Sanity']),
		},
	);

	const recipeTable = makeSortableTable(
		{
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
		Array.prototype.slice.call(recipes),
		makeRecipeRow,
		'name',
		false,
		setRecipeHighlight,
		testRecipeHighlight,
		testmode,
		undefined,
		undefined,
		{
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
	);

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
	const ingredientToIcon = (a, b) => {
		return `${a}[ingredient:${food[b.id].name}|${food[b.id].img}]`;
	};

	const makeRecipeGrinder = (ingredients, excludeDefault) => {
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
				const idealIngredients = [];
				const makableRecipes = [];
				const usedIngredients = new Set();
				const excludedIngredients = new Set();
				const excludedRecipes = new Set();

				let i = ingredients ? ingredients.length : null;

				let selectedRecipe;
				let selectedRecipeElement;
				let made = [];

				const deleteButton = document.createElement('button');
				deleteButton.appendChild(document.createTextNode(t('clearResults')));
				deleteButton.className = 'deleteButton';
				deleteButton.addEventListener('click', () => {
					calculationControl?.cancel();
					makableButton.parentNode.removeChild(makableDiv);
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
					makableButton.parentNode.removeChild(makableButton.nextSibling);
				}
				hasTable = true;

				const checkExcludes = item => excludedIngredients.has(item.key);
				const checkIngredient = function (item) {
					return this.includes(food[item]);
				};

				// Cycle through filter states: normal -> required -> excluded -> normal
				const cycleFilterState = (target, reverse = false) => {
					const id = target.dataset.id;
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

				const toggleFilter = e => {
					cycleFilterState(e.target, false);
				};

				const toggleExclude = e => {
					cycleFilterState(e.target, true);
					e.preventDefault();
				};

				const setRecipe = e => {
					const target = e.target;
					const recipeId = target.dataset.recipe;

					// Clear all recipe selections first
					for (const el of makableRecipe.childNodes) {
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

				const excludeRecipe = e => {
					const target = e.target;
					const recipeId = target.dataset.recipe;

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
				if (i === null) {
					ingredients = food;
				}
				ingredients = ingredients.filter(f =>
					matchesMode(f.modeMask, modeMask, f.charMask, charMask),
				);
				i = ingredients.length;

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

				const tryPush = ingredient => {
					if (!ingredient.uncookable && !ingredient.skip) {
						idealIngredients.push(ingredient);
					}
				};

				while (i--) {
					if (!ingredients[i].skip) {
						if (
							!ingredients[i].uncookable &&
							(!ingredients[i].cooked || ingredients[i].ideal) &&
							idealIngredients.indexOf(ingredients[i]) === -1
						) {
							tryPush(ingredients[i]);
						}
					} else {
						if (
							ingredients[i].cook &&
							!ingredients[i].cook.uncookable &&
							!ingredients[i].cook.skip &&
							idealIngredients.indexOf(ingredients[i].cook) === -1
						) {
							tryPush(ingredients[i].cook);
						} else if (
							ingredients[i].dry &&
							!ingredients[i].dry.uncookable &&
							!ingredients[i].dry.skip &&
							idealIngredients.indexOf(ingredients[i].dry) === -1
						) {
							tryPush(ingredients[i].dry);
						}
					}

					if (
						ingredients[i].cooked &&
						!ingredients[i].raw.uncookable &&
						!ingredients[i].raw.skip &&
						idealIngredients.indexOf(ingredients[i].raw) === -1
					) {
						tryPush(ingredients[i].raw);
					}

					if (
						ingredients[i].rackdried &&
						!ingredients[i].wet.uncookable &&
						!ingredients[i].wet.skip &&
						idealIngredients.indexOf(ingredients[i].wet) === -1
					) {
						tryPush(ingredients[i].wet);
					}
				}

				made = [];

				const makableTable = makeSortableTable(
					{
						'': '',
						Name: 'name',
						[headings.health]: 'health',
						'Health+:Health gained compared to ingredients': 'healthpls',
						[headings.hunger]: 'hunger',
						'Hunger+:Hunger gained compared to ingredients': 'hungerpls',
						Ingredients: '',
					},
					made,
					data => {
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
					'hungerpls',
					false,
					null,
					null,
					data =>
						(!selectedRecipe || data.recipe.id === selectedRecipe) &&
						!excludedRecipes.has(data.recipe.id) &&
						(excludedIngredients.size === 0 || !data.ingredients.some(checkExcludes)) &&
						[...usedIngredients].every(checkIngredient, data.ingredients),
					0,
					25,
					{
						toggleable: true,
						columns: ['Health', 'Health+', 'Hunger', 'Hunger+', 'Ingredients'],
						autoHide: ['Health+', 'Hunger+'],
					},
				);
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
				makableSummary.appendChild(document.createTextNode(t('computingCombinations')));

				const makableFootnote = document.createElement('div');
				makableFootnote.className = 'makableFootnote';
				makableFootnote.appendChild(document.createTextNode(t('multipleResultsNote')));

				const filterHelp = document.createElement('div');
				filterHelp.className = 'makableFilterHelp';
				filterHelp.appendChild(document.createTextNode(t('filterCycleHelp')));
				const updateMakableTexts = () => {
					makableSummary.firstChild.textContent = t('computingCombinations');
					makableFootnote.firstChild.textContent = t('multipleResultsNote');
					filterHelp.firstChild.textContent = t('filterCycleHelp');
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

						if (!data.name) {
							data.name = data.recipe.name;
							data.health = data.recipe.health;
							data.ihealth = data.tags.health;
							data.healthpls = data.recipe.health - data.ihealth;
							data.hunger = data.recipe.hunger;
							data.ihunger = data.tags.hunger;
							data.hungerpls = data.recipe.hunger - data.ihunger;
							data.healthpct = rawpct(data.ihealth, data.recipe.health);
							data.hungerpct = rawpct(data.ihunger, data.recipe.hunger);
							data.sanity = data.recipe.sanity;
							data.perish = data.recipe.perish;
						}

						made.push(data);
					},
					() => {
						// Chunk callback - show pause button if this is called (meaning async operation)
						if (isCalculating && !pauseButton.parentNode) {
							makableSummary.appendChild(pauseButton);
						}
						makableSummary.firstChild.textContent = t('foundValidRecipesInProgress', {
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
						makableSummary.firstChild.textContent = summaryText;

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
						makableSummary.firstChild.textContent = t('foundValidRecipesInProgress', {
							count: made.length,
						});
					} else {
						calculationControl.pause();
						pauseButton.textContent = t('resume');
						makableSummary.firstChild.textContent = t('foundValidRecipesPaused', {
							count: made.length,
						});
					}
				});
			})();

		makableButton.addEventListener('click', initializeGrinder, false);

		return makableButton;
	};

	// Initialize statistics tab if it's the active tab on page load
	try {
		if (window.localStorage.foodGuideState) {
			const storage = JSON.parse(window.localStorage.foodGuideState);
			const statisticsEl = document.getElementById('statistics');
			if (
				storage.activeTab === 'statistics' &&
				statisticsEl &&
				!statisticsEl.hasChildNodes()
			) {
				statisticsEl.appendChild(makeRecipeGrinder(null, true));
			}
		}
	} catch {
		// Silently ignore localStorage errors
	}

	const highest = (array, property) => {
		return array.reduce((previous, current) => {
			return Math.max(previous, current[property] || 0);
		}, -100000);
	};

	window.food = food;
	window.recipes = recipes;
	window.matchingNames = matchingNames;

	const setSlot = (slotElement, item) => {
		if (item !== null) {
			slotElement.dataset.id = item.key;
		} else {
			if (
				slotElement.nextElementSibling &&
				getSlot(slotElement.nextElementSibling) !== null
			) {
				setSlot(slotElement, getSlot(slotElement.nextElementSibling));
				setSlot(slotElement.nextElementSibling, null);

				return;
			} else {
				slotElement.dataset.id = null;
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

	const getSlot = slotElement => {
		return (
			slotElement &&
			slotElement.dataset &&
			(food[slotElement.dataset.id] || recipes[slotElement.dataset.id] || null)
		);
	};

	(() => {
		const pickers = document.getElementsByClassName('ingredientpicker');
		let i = pickers.length;

		while (i--) {
			const dropdown = document.createElement('div');
			let ul = document.createElement('ul');
			const picker = pickers[i];
			const index = i;
			let state;
			const from = picker.dataset.type === 'recipes' ? recipes : food;
			const allowUncookable = !picker.dataset.cookable;
			let parent = picker.nextElementSibling;
			while (parent && !parent.classList.contains('ingredientlist')) {
				parent =
					parent.querySelector && parent.querySelector('.ingredientlist')
						? parent.querySelector('.ingredientlist')
						: parent.nextElementSibling;
			}
			if (!parent) {
				throw new Error('Ingredient list not found for picker');
			}
			if (!parent.parentNode.classList.contains('selectionpanel')) {
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
				parent.parentNode.insertBefore(panel, parent);
				panel.appendChild(title);
				panel.appendChild(parent);
			}
			let slots = parent.getElementsByClassName('ingredient');

			const searchRow = document.createElement('div');
			searchRow.className = 'ingredient-search-row';

			const searchInputGroup = document.createElement('div');
			searchInputGroup.className = 'ingredient-search-input-group';
			searchRow.appendChild(searchInputGroup);

			picker.parentNode.insertBefore(searchRow, picker);
			searchInputGroup.appendChild(picker);

			let limited;
			let ingredients = [];
			let updateRecipes;
			const suggestions = [];
			const inventoryrecipes = [];
			let loaded = false;
			const results = document.getElementById('results');
			const discoverfood = document.getElementById('discoverfood');
			const discover = document.getElementById('discover');
			const makable = document.getElementById('makable');
			const clearSearchBtn = document.createElement('button');
			const clearIngredientsBtn = document.createElement('button');

			const flashIngredientActionError = target => {
				if (!target) {
					return;
				}

				target.classList.remove('ingredient-action-error');
				void target.offsetWidth;
				target.classList.add('ingredient-action-error');
				const clearError = () => target.classList.remove('ingredient-action-error');
				target.addEventListener('animationend', clearError, { once: true });
				window.clearTimeout(target.ingredientActionErrorTimeout);
				target.ingredientActionErrorTimeout = window.setTimeout(clearError, 400);
			};

			const removeSlotById = id => {
				if (!id) {
					return -1;
				}

				if (limited) {
					for (let i = slots.length - 1; i >= 0; i--) {
						if (getSlot(slots[i])?.key === id) {
							setSlot(slots[i], null);
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
					child => child.dataset.id === id,
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

			const pickItem = e => {
				const target = !e.target.dataset.id ? e.target.parentNode : e.target;
				const id = target.dataset.id;
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

			const suppressIngredientContextMenu = e => {
				e.preventDefault();
			};

			let displaying = false;

			const ensureEmptySlot = () => {
				// Only for unlimited mode (Discovery page)
				if (limited) {
					return;
				}

				// Remove all existing empty slots first
				const existingEmptySlots = parent.querySelectorAll('.ingredient:empty');
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

			const appendSlot = id => {
				const item = food[id] || recipes[id] || null;

				if (!id) {
					console.warn('ID not set');
					return -1;
				}
				if (!item) {
					console.warn('Item not found', id);
					return -1;
				}

				if (limited) {
					for (let i = 0; i < slots.length; i++) {
						if (getSlot(slots[i]) === null) {
							setSlot(slots[i], item);
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

			const liIntoPicker = function (item) {
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

				li.addEventListener('mousedown', pickItem, false);
				li.addEventListener('contextmenu', suppressIngredientContextMenu, false);
				this.appendChild(li);

				this.dataset.length++;
			};

			const updateFaded = el => {
				if (ingredients.includes(food[el.dataset.id])) {
					if (!el.classList.contains('faded')) {
						el.classList.add('faded');
					}
				} else if (el.classList.contains('faded')) {
					el.classList.remove('faded');
				}
			};

			const removeSlot = e => {
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
					const i = slots.indexOf(target.dataset.id);
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
				ul.dataset.length = 0;
				names.forEach(liIntoPicker, ul);

				dropdown.appendChild(ul);
			};

			const searchFor = e => {
				const target = resolveIconTarget(e.target);
				const name = target.dataset.link;
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
					ingredients = Array.prototype.map.call(slots, slot => {
						return getSlot(slot);
					});

					const cooking = getRecipes(ingredients);
					const health = cooking[0].health;
					const hunger = cooking[0].hunger;
					const sanity = cooking[0].sanity;

					let table = makeSortableTable(
						{
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
						cooking,
						item => {
							return makeRecipeRow(item, health, hunger, sanity);
						},
						'priority',
						true,
						searchFor,
						(item, array) => {
							return array.length > 0 && item.priority === highest(array, 'priority');
						},
						undefined,
						undefined,
						undefined,
						{
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
					);

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
							table = makeSortableTable(
								{
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
								suggestions,
								item => {
									return makeRecipeRow(item, health, hunger, sanity);
								},
								'priority',
								false,
								searchFor,
								undefined,
								undefined,
								undefined,
								undefined,
								{
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
							);
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
					ingredients = Array.prototype.map
						.call(parent.getElementsByClassName('ingredient'), slot => {
							return getSlot(slot);
						})
						.filter(item => item !== null); // Filter out empty slots

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
						const foodTable = makeSortableTable(
							{
								'': '',
								Name: 'name',
								[headings.health]: 'health',
								[headings.hunger]: 'hunger',
								[headings.sanity]: 'sanity',
								[headings.perish]: 'perish',
								Info: '',
								'Mode:DLC or Game Mode required': 'modeMask',
							},
							ingredients,
							makeFoodRow,
							'name',
							false,
							setHighlight,
							undefined,
							undefined,
							undefined,
							undefined,
							{
								toggleable: true,
								columns: ['Health', 'Hunger', 'Sanity', 'Perish', 'Info', 'Mode'],
								autoHide: getAutoHideColumns(['Sanity']),
							},
						);

						discoverfood.appendChild(foodTable);
						getSuggestions(inventoryrecipes, ingredients, null, true);

						if (inventoryrecipes.length > 0) {
							const table = makeSortableTable(
								{
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
								inventoryrecipes,
								makeRecipeRow,
								'name',
								false,
								setHighlight,
								undefined,
								undefined,
								undefined,
								undefined,
								{
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
							);

							discover.appendChild(table);

							makable.appendChild(makeRecipeGrinder(ingredients));
						}
					}

					if (ul && ul.firstChild) {
						Array.prototype.forEach.call(ul.getElementsByTagName('span'), updateFaded);
					}
				};
				discoveryLocaleRefresh = updateRecipes;
			}

			if (slots.length !== 0) {
				limited = true;

				Array.prototype.forEach.call(slots, slot => {
					setSlot(slot, null);
					slot.addEventListener('click', removeSlot, false);
					slot.addEventListener('contextmenu', removeSlot, false);
				});
			} else {
				slots = [];
				limited = false;
			}

			try {
				if (window.localStorage.foodGuideState) {
					state = JSON.parse(window.localStorage.foodGuideState).pickers;

					if (state && state[index]) {
						state[index].forEach(id => {
							// Migrate old _dst IDs to unified format
							if (id && !food[id] && id.endsWith('_dst')) {
								const baseId = id.slice(0, -4);
								id = food[`${baseId}@together`] ? `${baseId}@together` : baseId;
							}
							if (food[id]) {
								appendSlot(id);
							}
						});
					}
				}
			} catch (err) {
				console.warn('Unable to access localStorage', err);
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
			const searchTypeKeys = [
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
			const searchSelectorControls = createDropdown({
				items: searchTypeKeys,
				initialValue: 'name',
				buttonClass: 'searchselector',
				onSelect: item => {
					picker.placeholder = t(item.placeholderKey);
					refreshPicker();
				},
			});
			picker.placeholder = t(
				searchTypeKeys.find(k => k.value === searchSelectorControls.getValue())
					.placeholderKey,
			);

			searchInputGroup.insertBefore(searchSelectorControls.container, picker);

			searchSelectorControls.getSearch = () =>
				searchSelectorControls.getItem().prefix + picker.value;
			searchSelectorControls.splitTag = () => {
				const parts = picker.value.split(/: */);
				if (parts.length === 2) {
					const tag = `${parts[0].toLowerCase()}:`;
					const name = parts[1];
					const found = searchTypeKeys.find(k => k.prefix === tag);
					if (found) {
						searchSelectorControls.setValue(found.value);
						picker.value = name;
					}
				}
			};
			searchSelectorControls.setSearchType = idx => {
				searchSelectorControls.setValue(searchTypeKeys[idx].value);
				picker.placeholder = t(searchTypeKeys[idx].placeholderKey);
			};

			dropdown.className = 'ingredientdropdown';
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
				ul.dataset.length = 0;
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

				if (!hasIngredients) return;

				// Warn user on Discovery tab (unlimited mode) before clearing
				if (!limited && !confirm(t('confirmClearInventory'))) {
					return;
				}

				// Clear all ingredients - handle limited vs unlimited mode differently
				if (limited) {
					// Limited mode: clear from last to first to avoid
					// setSlot's shift-left logic moving items around
					for (let i = slots.length - 1; i >= 0; i--) {
						if (getSlot(slots[i])) {
							setSlot(slots[i], null);
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
					if (mode === 'icons') dropdown.classList.add('hidetext');
					else if (mode === 'list') dropdown.classList.add('listmode');
				},
			});
			{
				const mode = displayModeControls.getValue();
				if (mode === 'icons') dropdown.classList.add('hidetext');
				else if (mode === 'list') dropdown.classList.add('listmode');
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

			searchRow.parentNode.insertBefore(dropdown, parent.parentNode);

			picker.addEventListener('input', refreshPicker);

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
				try {
					if (!window.localStorage.foodGuideState) {
						window.localStorage.foodGuideState = '{}';
					}
					const obj = JSON.parse(window.localStorage.foodGuideState);
					if (!obj.pickers) {
						obj.pickers = [];
					}
					if (limited) {
						const serialized = Array.prototype.map.call(slots, slot => {
							const item = getSlot(slot);
							return item ? item.key : null;
						});
						obj.pickers[index] = serialized;
					} else {
						obj.pickers[index] = slots;
					}
					window.localStorage.foodGuideState = JSON.stringify(obj);
				} catch (error) {
					console.warn('Unable to save picker state', error);
				}
			});

			modeRefreshers.push(refreshPicker);
			modeRefreshers.push(updateRecipes);
		}
	})();

	// --- Mode selector UI ---

	const selectVersion = e => {
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

	const toggleDlc = e => {
		const target = resolveIconTarget(e.target);
		const dlcKey = target.dataset.dlc;
		if (!dlcKey || !dlcOptions[dlcKey]) {
			return;
		}
		activeDlc[dlcKey] = !activeDlc[dlcKey];
		// Clear character if no longer applicable
		if (
			currentCharacter &&
			!isCharacterApplicable(currentCharacter, currentVersion, activeDlc, characters)
		) {
			currentCharacter = null;
		}
		setMode();
	};

	const selectCharacter = e => {
		const target = resolveIconTarget(e.target);
		const charName = target.dataset.character;
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
	const headerTop = document.querySelector('.header-top');
	const modePanel = headerTop; // mode buttons are injected directly into header-top

	const updateModeButtonTitles = () => {
		for (const btn of modePanel.querySelectorAll('.dlc-btn')) {
			const dlcKey = btn.dataset.dlc;
			if (!dlcKey || !dlcOptions[dlcKey]) continue;
			btn.title = `${dlcOptions[dlcKey].name}\n${t('dlcToggleHint')}`;
		}

		for (const btn of modePanel.querySelectorAll('.char-btn')) {
			const charName = btn.dataset.character;
			if (!charName || !characters[charName]) continue;
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
		const btn = document.createElement('div');
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
		const btn = document.createElement('div');
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
		const btn = document.createElement('div');
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
