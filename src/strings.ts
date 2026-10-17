import type { TextParams } from './models.js';
/**
 * UI strings and translation helpers for the Don't Starve Food Guide.
 *
 * Goals:
 *   - All user-facing UI text emitted from the front-end goes through `t()`,
 *     so swapping locales requires no code changes.
 *   - Translations of static HTML are driven by `data-i18n` attributes; call
 *     `applyTranslations(root?: ParentNode)` to refresh a subtree after a locale change.
 *   - Game names use a separate display dictionary; canonical data names and
 *     identifiers stay unchanged for links, saved data, and library consumers.
 *
 * Element attribute conventions:
 *   - `data-i18n="key"`               → element.textContent = t(key)
 *   - `data-i18n-html="key"`          → element.innerHTML  = t(key)
 *     (preserves child markup such as <strong> or <span id="..."> tokens)
 *   - `data-i18n-attr-NAME="key"`     → element.setAttribute(NAME, t(key))
 *     where NAME may be e.g. `title`, `placeholder`, `aria-label`.
 *
 * Interpolation: `t('key', { name: 'Wilson' })` substitutes `{name}`
 * occurrences in the resolved string.
 */

const STORAGE_KEY = 'foodGuideLocale';

/**
 * Default English string table. Bundled locales cover every key; custom locales
 * may provide partial overrides. Missing custom translations fall back to English.
 */
const defaultStrings = {
	siteTitle: "Don't Starve Food Guide",
	// Dialogs, options, and information pages
	shareDestination: 'Link to',
	shareCurrentSite: 'This website',
	shareDevelopmentSite: 'Development version · GitHub Pages',
	shareRepository: 'Source code · GitHub',
	shareCurrentHelp: 'Share a link to the website you are using.',
	shareDevelopmentHelp:
		'The latest development version, published from the main branch after checks pass.',
	shareRepositoryHelp: 'Share the project’s source code, issue tracker and development history.',
	shareIncludes: 'Include in the link',
	shareSection: 'Current section',
	shareSectionHelp: 'Leave unchecked for a general link to the guide.',
	shareGame: 'Game, DLC and character',
	sharePot: 'Pot ingredients',
	shareInventory: 'Inventory ingredients',
	shareHighlight: 'Highlighted food or recipe',
	shareDetailsHelp:
		'Include both the section and game settings to share ingredients or a highlighted item.',
	shareRemember: 'These choices are remembered only in this tab.',
	linkDevelopmentSite: 'Development version on GitHub Pages',
	aboutDevelopment:
		'GitHub Pages hosts the current development version of this guide. It updates from the main development branch (called “main”) after automated checks pass. You can use it to check recent changes.',
	personalShareTitle: 'Share a link',
	personalSnapshotHelp:
		'The recipient gets a copy. Their changes won’t affect your pot or inventory.',
	optionsAppearance: 'Language & appearance',
	optionsLanguageHelp:
		'Applies to all your tabs, including food and recipe names. You can also search in English.',
	optionsTheme: 'Color theme',
	themeAuto: 'Device',
	themeLight: 'Light',
	themeDark: 'Dark',
	optionsThemeHelp: 'Device follows your system theme. Use the header button for a quick switch.',
	optionsDataHeading: 'Inventories & cookbook',
	optionsExportHeading: 'Save a backup',
	optionsExportHelp: 'Download your saved inventories and dishes as a JSON file.',
	optionsImportHeading: 'Bring in a backup',
	optionsImportHelp:
		'Add copies from a Food Guide JSON file (up to 2 MB). Existing data is kept.',
	optionsPrivacy: 'Saved on this device. Your data is never uploaded.',
	personalDone: 'Done',
	personalExported: 'Your backup is ready to save.',
	personalImporting: 'Importing {name}…',
	gameInfoHeading: 'Food & cooking basics',
	gameInfoIntro: 'A quick reference for freshness, Crock Pot rules and character food mechanics.',
	gameInfoContents: 'Jump to a topic',
	gameInfoFreshHeading: 'Fresh',
	gameInfoFreshBody:
		'Eat food before the halfway point of its perish time for its listed benefits.',
	gameInfoStaleHeading: 'Stale · 50%',
	gameInfoStaleBody:
		'Gives <strong><span id="stalehealth"></span> health</strong> and <strong><span id="stalehunger"></span> hunger</strong>, with <strong>no sanity</strong>.',
	gameInfoSpoiledHeading: 'Spoiled · 75%',
	gameInfoSpoiledBody:
		'Gives <strong><span id="spoiledhunger"></span> hunger</strong> and no health. Eating it costs <strong><span id="spoiledsanity"></span> sanity</strong>.',
	gameInfoStorageHeading: 'Storage & seasons',
	gameInfoStorageBody:
		'On the ground, food perishes at <strong><span id="perishground"></span></strong> of its normal rate: <strong><span id="perishwinter"></span></strong> in Winter and <strong><span id="perishsummer"></span></strong> in Summer. An Ice Box reduces the rate to <strong><span id="perishfridge"></span></strong>.',
	gameInfoCookingHeading: 'Crock Pot rules',
	gameInfoPriorityHeading: 'Highest priority wins',
	gameInfoWarmthHeading: 'Warming & cooling',
	gameInfoCookedHeading: 'Raw or cooked?',
	favoritesNone: 'No favorite food',
	requirementAnd: 'and',
	requirementOr: 'or',

	// Personal inventories, cookbook, sharing, and backups
	inventoryLabel: 'Inventory',
	inventoryDefault: 'My inventory',
	inventoryName: 'Inventory name',
	inventoryRename: 'Rename',
	inventoryNew: 'New inventory',
	inventoryNewName: 'Inventory',
	inventoryDuplicate: 'Duplicate',
	inventoryShared: 'Shared inventory',
	inventorySyncHelp:
		'Inventories are saved and synchronized across tabs. Each tab can view a different inventory. Items unavailable in this game stay saved.',
	cookbookHelp:
		'Recipes are recalculated using each dish’s saved settings. Select a dish to load its ingredients into the crock pot.',
	cookbookMakes: 'Makes',
	cookbookPossibleResults: 'Possible results',
	cookbookUnavailable: 'No recipe available with these settings',
	cookbookDishDescription: 'Results: {recipes}. Ingredients: {ingredients}.',
	cookbookTitle: 'My cookbook',
	cookbookDishName: 'Dish name (optional)',
	cookbookSave: 'Save dish',
	cookbookSaveHelp:
		'Choose four ingredients to save a dish, including its game and character settings.',
	cookbookDishDefault: 'Crock pot dish',
	cookbookEmpty: 'No saved dishes yet.',
	cookbookSaved: 'Dish saved to your cookbook.',
	cookbookLoaded: 'Saved dish loaded into the crock pot.',
	cookbookLoad: 'Load dish',
	personalCopy: 'copy',
	personalClose: 'Close',
	personalDelete: 'Delete',
	personalDeleteNamed: 'Delete {name}',
	personalDeleteTitle: 'Delete saved item',
	personalDeletePrompt: 'Delete “{name}”? This also removes it from other open tabs.',
	personalCancel: 'Cancel',
	personalShare: 'Share',
	personalShareHelp:
		'Choose where the link goes and what to include. Theme and language are not included.',
	personalShareLink: 'Shareable link',
	personalCopyLink: 'Copy link',
	personalLinkCopied: 'Link copied.',
	personalCopyManually: 'The link is selected. Copy it using your browser or keyboard.',
	personalData: 'Options',
	personalDataHelp: 'Save your inventories and dishes or move them to another browser.',
	personalExport: 'Export backup',
	personalImport: 'Import backup',
	personalImported: 'Imported {inventories} inventories and {dishes} dishes.',
	personalImportError:
		'Could not import this file. Use a Food Guide JSON backup with valid ingredients, names, and game settings (up to 2 MB). Existing data has not been replaced.',
	personalStorageError:
		'Changes are available in this tab, but could not be saved. Export a backup before closing it.',
	personalLimitError:
		'The saved-data limit has been reached. Export a backup and remove unused entries first.',

	// Theme toggle
	themeSwitchToLight: 'Switch to light theme',
	themeSwitchToDark: 'Switch to dark theme',
	themeToggleTitle: 'Toggle dark/light theme',

	// Language picker
	languagePickerLabel: 'Language',
	languagePickerTitle: 'Change language',
	languageNote:
		'Food names use game translations where available. Guide translations may need community review.',

	// Mode selector labels in the header
	modeLabelGame: 'Game',
	modeLabelDlc: 'DLC',
	modeLabelCharacter: 'Char',
	dlcToggleHint: 'click to toggle',
	characterToggleHint: 'click to toggle',

	// Character ability descriptions (used by mode-utils.getCharacterAbilities)
	abilityNoMonsterPenalty: 'Can safely eat Monster Foods',
	abilityRawMeatIsCooked: 'Can safely eat Raw Meat',
	abilityMeatOnly: 'Only eats meat',
	abilityMeatAndGoodies: 'Only eats meat and goodies',

	// Navbar tabs
	tabSimulator: 'Simulator',
	tabSimulatorTitle: 'Crock Pot recipe simulation',
	tabDiscovery: 'Discovery',
	tabDiscoveryTitle: 'Add inventory items to find recipes',
	tabFoodList: 'Food List',
	tabFoodListTitle: 'View all food in the selected DLC',
	tabRecipeList: 'Recipe List',
	tabRecipeListTitle: 'View all recipes for the selected DLC',
	tabStatistics: 'Statistics Analyzer',
	tabStatisticsTitle: 'Explore ingredient combinations and compare recipe efficiency',
	tabAbout: 'About',
	tabAboutTitle: 'About this tool and how to use it',
	tabGameInfo: 'Game Info',
	tabGameInfoTitle: "Don't Starve game mechanics reference",

	// Top-level instructions
	noscriptMessage: 'Sorry, this Food Guide requires JavaScript and a modern web browser.',
	simulatorHeading: 'Crock Pot Simulator',
	simulatorBody:
		'Click ingredients to add. Uncheck to remove all copies; use − or a pot slot to remove one.',
	discoveryHeading: 'Inventory Discovery',
	discoveryBody:
		'Add all items in your inventory below to see what recipes you can make. Click the + to add more items.',
	discoveryFoodStatsHeading: 'Ingredient stats',
	discoveryRecipesHeading: 'Available recipes',
	discoveryEfficientHeading: 'Recipe efficiency',
	discoveryHighlightsNote:
		'When all four slots are filled, cooking chooses one of the highlighted recipes with the highest priority.',
	discoveryMoreSuggestions:
		'Explore recipes that use your selected ingredients. Select a requirement to find ingredients for it.',
	discoveryEmpty: 'Add ingredients to your inventory to compare their stats and find recipes.',
	discoveryNoRecipes: 'No recipes match this inventory yet. Try adding other ingredient types.',
	discoveryRecipesHelp:
		'Recipes you can make from these ingredient types, assuming you have enough of each.',
	discoveryEfficiencyHelp:
		'Compare the gains from cooking with the stats of the ingredients used.',
	statisticsHeading: 'Statistics Analyzer',
	statisticsIntro:
		'Explore four-ingredient combinations and compare the health and hunger gained from cooking. Filter by recipe or ingredient, then select a combination to try it in the Simulator.',
	statisticsCostHelp:
		'Large ingredient sets can take time. You can pause the calculation or refresh the results while it runs.',
	simulatorSelectedIngredients: 'Selected crock pot ingredients',
	discoverySelectedIngredients: 'Food on hand',
	searchIngredientsPlaceholder: 'Search ingredients...',

	// Ingredient picker controls
	clearSearchOrIngredients: 'Clear search or remove all ingredients',
	clearSearch: 'Clear search',
	clearIngredients: 'Clear all ingredients',
	skipToContent: 'Skip to content',
	addIngredient: 'Add an ingredient',
	removeIngredient: 'Remove {name}',
	ingredientAdded: 'Added {name}.',
	ingredientRemoved: 'Removed {name}.',
	ingredientAllRemoved: 'All copies of {name} removed.',
	addNamedIngredient: 'Add {name}',
	removeAllIngredient: 'Remove all copies of {name}',
	removeOneIngredient: 'Remove one {name}',
	ingredientShortcuts: 'Enter: add · Shift+Enter: −1 · Ctrl/⌘+Enter: remove all',
	ingredientDiscoveryShortcuts: 'Enter: toggle · Shift+Enter: remove · Ctrl/⌘+Enter: remove all',
	ingredientActionFailed:
		'Unable to change {name}. The pot may be full or the ingredient is not selected.',
	ingredientInPot: 'In the pot: {count}.',
	ingredientInInventory: 'In your inventory.',
	ingredientDiscoverySearchHelp:
		'Use Up and Down to browse results, Enter to add or remove, Shift+Enter to remove one, Ctrl or Command+Enter to remove all copies, and Escape to hide results. Tab to the selected ingredients to remove them.',
	ingredientPotFull: 'The pot is full. Remove an ingredient before adding {name}.',
	ingredientNotSelected: '{name} is not selected. Add it before trying to remove it.',
	ingredientSlotEmpty: 'This slot is empty. Select an ingredient from the search results.',
	ingredientsCleared: 'All ingredients cleared.',
	ingredientSearchEmpty: 'No matching ingredients. Try another search or game selection.',
	ingredientCookingEmpty:
		'No matching ingredients in this view. Choose “{view}” to show hidden matches.',
	ingredientCookingHidden: '{count} hidden by cooking view.',
	ingredientShowAll: 'Show all',
	ingredientSearchOne: '1 matching ingredient.',
	ingredientSearchCount: '{count} matching ingredients.',
	tableCookingResults: 'Crock pot results',
	tableRecipeSuggestions: 'Recipe suggestions',
	tableEfficientRecipes: 'Efficient recipes',
	tableScrollHelp: 'Scrollable table. Use Left and Right to scroll.',
	tableEmpty: 'No matching results.',
	analysisNoResultsYet: 'No matching combinations found so far.',
	analysisNoMatchingResults:
		'No combinations match these filters. Try adjusting the ingredient or recipe filters.',
	ingredientSearchHelp:
		'Use Up and Down to browse results, Enter to add, Shift+Enter to remove one, Ctrl or Command+Enter to remove all copies, and Escape to hide results. Tab to the selected ingredients to remove them.',
	confirmClearInventory: 'Are you sure you want to clear all ingredients from your inventory?',
	displayModeNames: 'Display: Names',
	displayModeIcons: 'Display: Icons',
	displayModeList: 'Display: List',
	densityCozy: 'Cozy',
	pickerDensity: 'Picker density',
	pickerSearchType: 'Search by',
	densityNormal: 'Normal',
	densityCompact: 'Compact',
	sortAuto: 'Sort: Auto',
	groupNone: 'Group by: None',
	groupType: 'Group by: Ingredient type',
	groupPreparation: 'Group by: Preparation',
	cookingAll: 'Cooking: All',
	cookingPractical: 'Cooking: Practical',
	cookingEveryday: 'Cooking: Everyday',
	cookingAllHelp: 'Show all ingredients allowed by the current game and search.',
	cookingPracticalHelp:
		'Focus on crock pot cooking. Hide redundant forms and uncommon ingredients, keeping specialties for recipes in the current game and character selection. Choose All to find hidden ingredients.',
	cookingEverydayHelp:
		'A smaller list for routine crock pot cooking. Hide uncommon specialties and redundant forms, keeping prepared ingredients needed by recipes. Choose All to find hidden ingredients.',
	ingredientGroupMonster: 'Monster foods',
	ingredientGroupFish: 'Fish & seafood',
	ingredientGroupMeat: 'Meat',
	ingredientGroupEgg: 'Eggs',
	ingredientGroupVegetables: 'Vegetables',
	ingredientGroupFruit: 'Fruit',
	ingredientGroupSweeteners: 'Sweeteners',
	ingredientGroupDairy: 'Dairy',
	ingredientGroupFrozen: 'Frozen',
	ingredientGroupInedible: 'Inedible',
	ingredientGroupOther: 'Other',
	ingredientGroupRaw: 'Raw',
	ingredientGroupCooked: 'Cooked',
	ingredientGroupDried: 'Dried',
	ingredientGroupRecipes: 'Recipes',
	sortAutoHelp:
		'Auto: closest search matches first, related preparations together; stat searches use your character’s values.',
	sortName: 'Sort: Name',
	sortHealth: 'Sort: Health',
	sortHunger: 'Sort: Hunger',
	sortSanity: 'Sort: Sanity',
	sortPerish: 'Sort: Perish',
	searchTypeName: 'name',
	searchTypeTag: 'tag',
	searchTypeRecipe: 'recipe',
	searchPlaceholderName: 'Filter ingredients',
	searchPlaceholderTag: 'Meat, veggie, fruit, egg, monster...',
	searchPlaceholderRecipe: 'Find ingredients used in a recipe',

	// Statistics analyzer ("recipe grinder")
	calculateRecipes: 'Calculate efficient recipes (may take some time)',
	clearResults: 'Clear results',
	calculating: 'Calculating...',
	pause: 'Pause',
	resume: 'Resume',
	computingCombinations: 'Computing combinations…',
	multipleResultsNote: '* combination has multiple possible results',
	analysisGroupingHelp:
		'Consecutive combinations for the same recipe are grouped across the full filtered results. Browse recipe group pages, then expand a group to page through its combinations. Sorting is preserved; each row shows the exact combination’s values. Click the ingredients to try that combination in the Simulator.',
	analysisShowCombinations: 'Show {count} consecutive combinations for {name}',
	analysisHideCombinations: 'Hide {count} consecutive combinations for {name}',
	analysisTryCombination: 'Try {name} in the Simulator with {ingredients}',
	analysisIngredientsLoaded: 'Loaded {count} ingredients into the crock pot.',
	analysisResetFilters: 'Reset filters',
	analysisResetFiltersHelp:
		'Restore the original ingredient and recipe filters for this analysis.',
	analysisFiltersReset: 'Analysis filters reset.',
	analysisResultCount: 'Recipe groups {first}–{last} of {groups}; {total} matching combinations.',
	analysisRefresh: 'Refresh results',
	analysisRefreshHelp:
		'Update the table with the combinations found so far without interrupting calculation.',
	analysisRefreshed: 'Results refreshed.',
	paginationGroupsPerPage: 'Groups per page',
	paginationCombinationsPerPage: 'Combinations per group page',
	paginationCombinationSizeChanged:
		'Expanded groups now show up to {size} combinations per page.',
	paginationGroups: 'Recipe group pages',
	paginationCombinations: 'Combination pages for {name}',
	paginationGroupRange: 'Recipe groups {first}–{last} of {total}',
	paginationCombinationRange: 'Combinations {first}–{last} of {total}',
	paginationPageNumber: 'Page number',
	paginationPageCount: 'Page {page} of {pages}',
	paginationFirst: 'First',
	paginationPrevious: 'Previous',
	paginationNext: 'Next',
	paginationLast: 'Last',
	paginationGo: 'Go',
	analysisProgressLabel: 'Combination checking progress',
	analysisProgressCount: 'Checked {checked} of {total} combinations ({percent}%).',
	analysisSnapshotNotice:
		'Refresh to inspect the latest results without pausing. The table refreshes automatically when calculation finishes.',
	filterCycleHelp:
		'Use arrow keys to browse each filter group. Click, tap, Enter, or Space cycles normal → required (✓) → excluded (✕). Shift+Enter, Shift+Space, or right-click reverses ingredient filters or toggles recipe exclusions.',
	filterIngredients: 'Ingredient filters',
	filterRecipes: 'Recipe filters',
	filterNormal: 'Normal',
	filterRequired: 'Required',
	filterExcluded: 'Excluded',
	filterLabel: '{name}: {state}',
	customFilterPlaceholder: 'use custom filter',
	foundValidRecipes: 'Found {count} valid combinations.',
	foundValidRecipesInProgress:
		'Found {count} valid combinations… (you can change Food Guide tabs during this process)',
	foundValidRecipesPaused: 'Found {count} valid combinations (paused)',
	durationNever: 'Never',
	durationDays: '{count} {unit}',
	durationSeconds: '{count} {unit}',
	durationToNever: 'to Never',
	durationToDays: 'to {count} {unit}',
	foodInfoRecipes: 'Recipes',
	foodInfoFrom: 'from',
	foodInfoCook: 'cook',
	foodInfoDryIn: 'dry in {duration}',
	foodInfoCannotAdd: 'cannot be added to crock pot',
	noteProvidesHeatFor: 'Provides {heat} heat for {duration}',
	noteHeatWhenConsumed: '{heat} heat when consumed',
	noteLightSeconds: 'Gives {seconds} seconds of light',
	noteSpeedBonusForSeconds: 'Gives {speed} bonus speed ({percent}) for {seconds} seconds',
	noteDriesRateForSeconds: 'Dries {rate} for {seconds} seconds',
	noteHeatDelta: '{heat} heat',
	noteGlowDarkMinutes: 'Makes the player glow in the dark for {minutes} minutes',
	notePreventsHayfeverSeconds: 'Prevents hayfever for {seconds} seconds',
	notePoisonous: 'Poisonous',
	noteCuresPoison: 'Cures poison',
	notePutsPlayerToSleep: 'Puts the player to sleep',
	noteRemovesGrogginessEffect: 'Removes grogginess effect',
	noteGivesNaughtiness: 'Gives {amount} naughtiness',
	noteSpeedBonusForSecondsDays:
		'Gives {speed} bonus speed ({percent}) for {seconds} seconds ({days} days)',
	noteHayfeverSecondsDays: 'Prevents hayfever for {seconds} seconds ({days} days)',
	noteProducesAndHealsOverMinutes:
		'Recipe produces {count}; heals {health} health over {minutes} minutes',
	noteIncreasesTemperatureByDegreesInSeconds:
		'Increases temperature by {degrees} degrees in {seconds} seconds.',
	noteRestoresSanityOverMinutes: 'Restores {sanity} sanity over {minutes} minutes',
	noteLowersTemperatureByDegreesOverSeconds:
		'Lowers temperature by {degrees} degrees over {seconds} seconds',
	noteRaisesTemperatureByDegreesOverSeconds:
		'Raises temperature by {degrees} degrees over {seconds} seconds',
	noteRequiresUncookedTallbirdEgg: 'Requires uncooked Tallbird Egg',
	notePlayerCannotEatBeefaloOnly: 'Cannot be eaten by the player, only given to Beefalo',
	noteDustMothsOnly: 'Used to feed Dust Moths, cannot be eaten by the player',

	/*
	 * One-off note text still attached directly to food/recipe entries.
	 * Keys are the canonical English note strings from food.js / recipes.js.
	 * Locale files may override any subset under `notes: { ... }`.
	 * Repeated note patterns should prefer stable `noteKey` templates above.
	 */
	notes: {
		'Removes 3 heat, and for 30 seconds, dries 1/s and adds 2 bonus speed (+33%)':
			'Removes 3 heat, and for 30 seconds, dries 1/s and adds 2 bonus speed (+33%)',
		'While worn, restores 3.9 Hunger every 5 seconds (187.5 in total, over 4 minutes), while reducing Sanity by 1.33 per minute (Wurt gains +1.33 sanity/min, Wigfrid refuses to wear this)':
			'While worn, restores 3.9 Hunger every 5 seconds (187.5 in total, over 4 minutes), while reducing Sanity by 1.33 per minute (Wurt gains +1.33 sanity/min, Wigfrid refuses to wear this)',
		'Gives those that eat this 16 minutes of light that fades in a similar fashion after eating a glowberry':
			'Gives those that eat this 16 minutes of light that fades in a similar fashion after eating a glowberry',
	},

	// Table column-toggle controls
	columns: 'Columns',
	autoColumns: 'Auto',
	autoColumnsTitle:
		'Use recommended columns for this screen size. Selecting a column turns Auto off.',
	tableName: 'Name',
	tableImage: 'Image',
	tableInfo: 'Info',
	tableMode: 'Mode',
	tableHealth: 'Health',
	tableHealthGain: 'Health+',
	tableHunger: 'Hunger',
	tableHungerGain: 'Hunger+',
	tableSanity: 'Sanity',
	tablePerish: 'Perish',
	tableCookTime: 'Cook Time',
	tablePriority: 'Priority',
	tableNotes: 'Notes',
	tableRequires: 'Requires',
	tableIngredients: 'Ingredients',
	simulatorSummaryTotal: 'Total',
	simulatorSummaryPotential: 'Potential',
	tableHealthHint: 'Health restored (change if cooked)',
	tableHungerHint: 'Hunger restored (change if cooked)',
	tableSanityHint: 'Sanity restored (change if cooked)',
	tablePerishHint: 'Time to turn to rot (change if cooked)',
	tablePriorityHint: 'One of the highest priority recipes for a combination will be made',
	tableRequiresHint: 'Dim, struck items cannot be used',
	tableModeHint: 'DLC or Game Mode required',
	tableHealthGainHint: 'Health gained compared to ingredients',
	tableHungerGainHint: 'Hunger gained compared to ingredients',

	// About page
	aboutHeading: 'About this guide',
	aboutIntro:
		'This is an unofficial tool to help avoid starvation in <a href="https://www.klei.com/games/dont-starve" target="_blank" rel="noopener">Don\'t Starve</a>, an uncompromising wilderness survival game full of science and magic by <a href="https://klei.com/" target="_blank" rel="noopener">Klei Entertainment</a>.',
	aboutBrowser:
		'This page requires a modern web browser, such as a recent version of Firefox, Chrome, Edge, or Safari, and runs locally using JavaScript.',
	aboutSource:
		'Open-source and maintained as a community effort on GitHub: <a href="https://github.com/bluehexagons/foodguide" target="_blank" rel="noopener">github.com/bluehexagons/foodguide</a>.',
	aboutChangelog:
		'For the latest changes, see the <a href="https://github.com/bluehexagons/foodguide/commits/main" target="_blank" rel="noopener">commit history</a>.',
	aboutSectionsHeading: 'Sections',
	aboutSimulatorHeading: 'Simulator',
	aboutSimulatorBody:
		'Fill the pot with up to four ingredients to see the highest-priority dishes. Suggestions show what you could cook by completing a partial pot.',
	aboutDiscoveryHeading: 'Discovery',
	aboutDiscoveryBody:
		'Build a named inventory and find recipes from the ingredients you have. Quantities are ignored: the guide assumes four of each ingredient.',
	aboutFoodRecipeListsHeading: 'Food List & Recipe List',
	aboutFoodRecipeListsBody:
		'Compare foods and Crock Pot recipes for your selected game and character. Sort by stats, or use the # links to share a highlighted entry.',
	aboutStatisticsHeading: 'Statistics Analyzer',
	aboutStatisticsBody:
		'Compare four-ingredient combinations and filter by recipe or ingredient. Expand a recipe group to browse its combinations; pause or refresh while the search runs.',
	linkToItem: 'Link to {name}',
	aboutNavigationHeading: 'Saved data and sharing',
	aboutNavigationBody:
		'Share links to this section and game, with an optional pot or inventory snapshot. Inventories and cookbook dishes stay saved in this browser and sync across its tabs. Each tab keeps its own pot and working view. Open Options for language, theme and backup controls.',
	aboutAdvancedHeading: 'Advanced: JavaScript console',
	aboutAdvancedBody1:
		'The JavaScript console exposes <code>foodGuide</code> with food and recipe data, search and calculation helpers. <code>foodGuide.getState()</code> returns the current section, game settings, pot and inventory.',
	aboutAdvancedBody2:
		'Use <code>foodGuide.analyses()</code> for analysis progress and captured settings. <code>foodGuide.analysisRows("discovery", {limit: 100, filtered: true})</code> returns a page of results matching the current filters; use <code>"statistics"</code> for the Statistics Analyzer. Existing globals such as <code>food</code>, <code>recipes</code>, <code>matchingNames</code>, <code>analysis.made</code> and <code>recipeCrunchData</code> remain available.',
	aboutLinksHeading: 'Links',
	linkChangelog: 'Food Guide Changelog',
	linkBugReports: 'Report Food Guide Bugs / Issues',
	linkOfficialSite: "Don't Starve Official Website",
	linkWiki: "Don't Starve Wiki",

	// Game Info page
	gameInfoFoodMechHeading: 'Freshness & spoilage',
	gameInfoFoodMechBody:
		'Perish time is the time before food turns to Rot. Freshness changes what you get from eating it.',
	gameInfoWarmth:
		'Foods that provide <strong>warmth</strong> or <strong>cooling</strong> work like a thermal stone; when eaten, they provide a heat source at a particular temperature for a period of time. Eating another heating/cooling food within this period will replace the earlier effect.',
	gameInfoPriority:
		'<strong>Recipe priority</strong> determines which recipe a food combination will make; only the highest-priority possible recipes can be produced by a batch of ingredients.',
	gameInfoCooked:
		"In recipe requirements, cooked/uncooked usually doesn't make a difference. If it does, then only the valid form will be listed.",
	gameInfoVersionsHeading: 'Game Versions and DLC',
	gameInfoVersionsBody:
		"The game version selector at the top lets you switch between Don't Starve Together (DST), Don't Starve (DS), and Hamlet. When Don't Starve is selected, you can toggle the Reign of Giants and Shipwrecked DLC on or off to control which foods and recipes are shown. You can also select a character like Warly or Webber to see their special recipes and food mechanics.",
	gameInfoCharactersHeading: 'Character Food Mechanics',
	gameInfoWarly:
		'<strong>Warly</strong> is a chef character who can only be played in Shipwrecked, Hamlet, and DST. In Shipwrecked, his meals are more filling when prepared as recipes but less effective when eaten raw, dried, or cooked. He also has access to unique recipes not available to other characters.',
	gameInfoWebber:
		'<strong>Webber</strong> is a spider-human hybrid who can be played in all game versions. He can safely eat Monster Foods without any adverse health effects, and can eat Raw Meat as if it were cooked (with full health and no sanity penalty). He is also the only character who can naturally befriend Spiders.',
	gameInfoWigfrid:
		'<strong>Wigfrid</strong> is a character from Reign of Giants available in Don\'t Starve Together. She is a stage performer who only eats meat. In Don\'t Starve Together, she can also eat "goodies" such as Taffy, Jellybeans, and Volt Goat Chaud-Froid.',
	gameInfoFavoritesHeading: 'Favorite Foods (DST)',
	gameInfoFavoritesBody:
		"In Don't Starve Together, each character gains an extra 15 Hunger when eating their favorite food. This bonus is affected by freshness.",
	favoritesHeaderCharacter: 'Character',
	favoritesHeaderFavorite: 'Favorite Food',
	gameInfoWikiHeading: 'Useful Wiki Pages',
	wikiFood: 'Food',
	wikiCooking: 'Cooking',
	wikiCrockPot: 'Crock Pot',
	wikiFarming: 'Farming',

	// Footer
	footerCopyrightLicense:
		'<a href="https://www.klei.com/games/dont-starve" target="_blank" rel="noopener">Don\'t Starve</a> &copy; <a href="https://klei.com/" target="_blank" rel="noopener">Klei Entertainment</a>. Unofficial food guide <a href="https://github.com/bluehexagons/foodguide" target="_blank" rel="noopener">source code</a> made available under the <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">Apache License 2.0</a>.',
	footerLinks:
		'<a href="https://github.com/bluehexagons/foodguide" target="_blank" rel="noopener">Source Code on GitHub</a> | <a href="https://github.com/bluehexagons/foodguide/issues" target="_blank" rel="noopener">Bugs and Feature Reports</a>',

	/*
	 * Ingredient/recipe tag labels.
	 *
	 * Keys here are the *internal* tag identifiers used throughout the
	 * data files (e.g. food.js properties, recipe `tags: [...]` entries,
	 * `foodtype` strings). They are **input syntax** for the tag-search
	 * (e.g. `tag:meat`) and must stay in English in URLs / dataset.link
	 * payloads. Only the *visible* label is translated.
	 *
	 * Locale files may override any subset under `tags: { ... }`; missing
	 * keys fall back to the English label here, then to the raw key. To
	 * add a new tag, register it here first so contributors can mirror
	 * the entry in each `src/locales/*.ts`.
	 *
	 * Includes:
	 *   - ingredient tags shown as chips on each food (fruit, meat, ...)
	 *   - foodtype categories (meat, veggie, goodies)
	 *   - recipe metadata tags (honeyed, monstermeat)
	 */
	tags: {
		// Ingredient tags (shown on each food row as clickable chips)
		fruit: 'fruit',
		veggie: 'vegetable',
		meat: 'meat',
		egg: 'egg',
		fish: 'fish',
		magic: 'magic',
		decoration: 'decoration',
		inedible: 'inedible',
		monster: 'monster food',
		sweetener: 'sweetener',
		fat: 'fat',
		dairy: 'dairy',
		jellyfish: 'jellyfish',
		antihistamine: 'antihistamine',
		filter: 'filter',
		bug: 'bug',
		bone: 'bone',
		roughage: 'roughage',

		// Foodtype categories (recipe.foodtype)
		goodies: 'goodies',

		// Recipe metadata tags (recipe.tags entries)
		honeyed: 'honeyed',
		monstermeat: 'monster meat',
	},
};

export type StringKey = {
	[K in keyof typeof defaultStrings]: (typeof defaultStrings)[K] extends string ? K : never;
}[keyof typeof defaultStrings];
export type LocaleDict = Partial<Omit<typeof defaultStrings, 'tags' | 'notes'>> & {
	tags?: Record<string, string>;
	notes?: Record<string, string>;
	/** Display translations keyed by the canonical English game name. */
	names?: Record<string, string>;
};
/** Bundled locales translate every UI label and note. */
export type BundledLocaleDict = Record<StringKey, string> & {
	tags: Record<keyof typeof defaultStrings.tags, string>;
	notes: Record<keyof typeof defaultStrings.notes, string>;
	names: Record<string, string>;
};
interface LocaleEntry {
	name: string;
	dict: LocaleDict;
	dir?: 'ltr' | 'rtl';
}
const locales: Record<string, LocaleEntry> = {
	en: { name: 'English', dict: defaultStrings },
};

let activeLocale = 'en';

/**
 * Register a translation dictionary. Missing keys fall back to English.
 * @param {string} code - BCP-47-style language tag (e.g. "es", "zh", "pt-BR").
 * @param {string} name - Display name in the locale's own language.
 * @param {LocaleDict} dict - Partial overrides keyed by string id.
 * @param {{ dir?: 'ltr' | 'rtl' }} [opts]
 */
export function registerLocale(
	code: string,
	name: string,
	dict: LocaleDict,
	opts?: { dir?: 'ltr' | 'rtl' },
) {
	const dir = opts && opts.dir === 'rtl' ? 'rtl' : 'ltr';
	locales[code] = { name, dict, dir };
}

/**
 * Returns the BCP-47-style codes of all registered locales (always
 * includes 'en').
 * @returns {string[]}
 */
export function listLocales() {
	return Object.keys(locales);
}

/**
 * Display name of the registered locale (in that locale's own language),
 * or the code itself if unknown.
 * @param {string} code
 */
export function localeName(code: string) {
	return Object.hasOwn(locales, code) ? locales[code].name : code;
}

/**
 * Currently active locale code.
 */
export function getLocale() {
	return activeLocale;
}

/** Translate a display name without changing canonical names used in URLs or data. */
export function localizedName(name: string): string {
	const names = locales[activeLocale]?.dict.names;
	return names && Object.hasOwn(names, name) ? names[name] : name;
}

export function itemName(item: { name?: string }): string {
	return localizedName(item.name || '');
}

/**
 * Switch the active locale. Unknown codes silently fall back to English.
 * Persists the choice to localStorage and dispatches a `foodguide:localechange`
 * event on `document` so listeners can refresh.
 * @param {string} code
 */
export function setLocale(code: string, persist = true) {
	if (!Object.hasOwn(locales, code)) {
		code = 'en';
	}
	activeLocale = code;
	if (typeof document !== 'undefined') {
		const html = document.documentElement;
		html.setAttribute('lang', code);
		html.setAttribute('dir', locales[code].dir === 'rtl' ? 'rtl' : 'ltr');
		if (persist) {
			try {
				localStorage.setItem(STORAGE_KEY, code);
			} catch {
				/* ignore quota / unavailable storage */
			}
		}
		document.dispatchEvent(new CustomEvent('foodguide:localechange', { detail: { code } }));
	}
}

/**
 * Initialise the locale: read from localStorage if set, otherwise
 * pick the first registered locale that matches `navigator.language`,
 * otherwise English. Safe to call before `applyTranslations`.
 */
export function initLocale() {
	if (typeof document === 'undefined') {
		return;
	}
	let code;
	try {
		code = localStorage.getItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
	if (!code && typeof navigator !== 'undefined' && navigator.language) {
		const nav = navigator.language.toLowerCase();
		const candidates = [nav, nav.split('-')[0]];
		for (const c of candidates) {
			const match = listLocales().find(locale => locale.toLowerCase() === c);
			if (match) {
				code = match;
				break;
			}
		}
	}
	if (code && Object.hasOwn(locales, code)) {
		setLocale(code);
	} else {
		setLocale('en');
	}
}

/**
 * Read a translated string by key, with optional `{name}` interpolation.
 * @param {keyof typeof defaultStrings} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key: StringKey, params?: TextParams) {
	const entry = locales[activeLocale];
	let value;
	if (entry && entry.dict && entry.dict[key] !== undefined) {
		value = entry.dict[key];
	} else {
		value = defaultStrings[key];
	}
	if (value === undefined) {
		return String(key);
	}
	if (params) {
		return String(value).replace(/\{(\w+)\}/g, (_, name) =>
			Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
		);
	}
	return value;
}

export function durationUnit(kind: string, count: number) {
	if (kind === 'day') {
		if (activeLocale === 'zh') {
			return '天';
		}
		if (activeLocale === 'es') {
			return count === 1 ? 'día' : 'días';
		}
		if (activeLocale === 'pt-BR') {
			return count === 1 ? 'dia' : 'dias';
		}
		if (activeLocale === 'ru') {
			const form = new Intl.PluralRules('ru').select(count);
			return form === 'one' ? 'день' : form === 'many' ? 'дней' : 'дня';
		}
		return count === 1 ? 'day' : 'days';
	}
	if (kind === 'sec') {
		if (activeLocale === 'zh') {
			return '秒';
		}
		if (activeLocale === 'es') {
			return count === 1 ? 'seg' : 'segs';
		}
		if (activeLocale === 'pt-BR') {
			return 's';
		}
		if (activeLocale === 'ru') {
			return 'сек.';
		}
		return count === 1 ? 'sec' : 'secs';
	}
	return kind;
}

export function formatDuration(kind: string, count: number) {
	if (kind === 'day') {
		return t('durationDays', { count, unit: durationUnit('day', count) });
	}
	if (kind === 'sec') {
		return t('durationSeconds', { count, unit: durationUnit('sec', count) });
	}
	return String(count);
}

/**
 * Resolve a localized label for an internal tag identifier.
 *
 * Lookup order:
 *   1. `tags[key]` in the active locale's dictionary
 *   2. `tags[key]` in the default (English) dictionary
 *   3. the supplied `fallback`
 *   4. the raw `key` itself
 *
 * The returned string is intended for display only; the original `key`
 * should still be used wherever the tag identifier is part of input
 * syntax (e.g. `tag:KEY` search queries or `dataset.link` payloads).
 *
 * @param {string} key - Internal tag identifier (e.g. 'meat', 'honeyed').
 * @param {string} [fallback] - Optional fallback label if no entry exists.
 * @returns {string}
 */
export function tagLabel(key: string, fallback?: string) {
	const entry = locales[activeLocale];
	const localeTags = entry && entry.dict && entry.dict.tags;
	if (localeTags && Object.prototype.hasOwnProperty.call(localeTags, key)) {
		return localeTags[key];
	}
	const defaultTags = defaultStrings.tags as Record<string, string>;
	if (defaultTags && Object.prototype.hasOwnProperty.call(defaultTags, key)) {
		return defaultTags[key];
	}
	return fallback !== undefined ? fallback : key;
}

/**
 * Resolve a localized one-off note string from its canonical English source text.
 *
 * Lookup order:
 *   1. `notes[note]` in the active locale dictionary
 *   2. `notes[note]` in the default English dictionary
 *   3. the original `note`
 *
 * @param {string} note
 * @returns {string}
 */
export function noteText(note: string) {
	const entry = locales[activeLocale];
	const localeNotes = entry && entry.dict && entry.dict.notes;
	if (localeNotes && Object.prototype.hasOwnProperty.call(localeNotes, note)) {
		return localeNotes[note];
	}
	const defaultNotes = defaultStrings.notes as Record<string, string>;
	if (defaultNotes && Object.prototype.hasOwnProperty.call(defaultNotes, note)) {
		return defaultNotes[note];
	}
	return note;
}

/**
 * Resolve a note from a stable translation key, falling back to noteText for
 * one-off exact-string notes when no key is provided.
 *
 * @param {(keyof typeof defaultStrings) | undefined} noteKey
 * @param {Record<string, string | number>} [params]
 * @param {string} [fallbackNote]
 * @returns {string}
 */
export function resolveNote(noteKey?: StringKey, params?: TextParams, fallbackNote?: string) {
	if (noteKey) {
		return t(noteKey, params);
	}
	return fallbackNote ? noteText(fallbackNote) : '';
}

/**
 * Walk a DOM subtree and apply translations to elements carrying
 * `data-i18n*` attributes. Safe to call repeatedly.
 * @param {ParentNode} [root=document]
 */
export function applyTranslations(root?: ParentNode) {
	if (typeof document === 'undefined') {
		return;
	}
	const scope = root || document;
	const nodes = [];
	if (scope instanceof Element) {
		nodes.push(scope);
	}
	nodes.push(...Array.from(scope.querySelectorAll('*')));

	for (const el of nodes) {
		if (el.hasAttribute('data-i18n')) {
			el.textContent = translateAttribute(el.getAttribute('data-i18n') || '');
		}
		if (el.hasAttribute('data-i18n-name')) {
			el.textContent = localizedName(el.getAttribute('data-i18n-name') || '');
		}
	}
	for (const el of nodes) {
		if (el.hasAttribute('data-i18n-html')) {
			el.innerHTML = translateAttribute(el.getAttribute('data-i18n-html') || '');
		}
	}
	for (const el of nodes) {
		for (const attr of Array.from(el.attributes)) {
			if (attr.name.startsWith('data-i18n-attr-')) {
				const target = attr.name.slice('data-i18n-attr-'.length);
				el.setAttribute(target, translateAttribute(attr.value));
			}
		}
	}
}

/**
 * The full English string table; useful as a base for new locale dicts.
 */
export const strings = defaultStrings;

function translateAttribute(key: string): string {
	return Object.prototype.hasOwnProperty.call(defaultStrings, key) &&
		typeof defaultStrings[key as StringKey] === 'string'
		? t(key as StringKey)
		: key;
}
