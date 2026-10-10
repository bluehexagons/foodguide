# Don't Starve Food Guide

An unofficial food reference, Crock Pot simulator, and recipe discovery tool for
Don't Starve, Don't Starve Together, and their supported DLCs and characters.
The guide is a static TypeScript/HTML/CSS application with reusable food and recipe
data and no runtime package dependencies.

Use the [live guide](https://foodguide.bluehexagons.com) or the
[GitHub Pages version](https://bluehexagons.github.io/foodguide/).
The separate [foodguide-app](https://github.com/bluehexagons/foodguide-app) repository
provides an Electron desktop wrapper and release builds.

## Run locally

Use Node.js 24 or newer and npm. CI uses Node.js 24; `nvm use` selects that
major version from `.nvmrc`. Dependency installation rejects older Node versions.

```bash
npm ci --ignore-scripts
npm run dev
```

Open [127.0.0.1:8080/index.htm](http://127.0.0.1:8080/index.htm). The development
command generates the icon sprites, serves `html/` on loopback, and opens a browser.
Serve the guide over HTTP; opening the HTML directly with `file://` prevents module
loading in most browsers. Local use needs no internet connection after dependencies
are installed, apart from external links to the game and wiki.

In the Simulator, choose a game version and character, filter ingredients, and add
up to four items to the pot. Discovery accepts an inventory of ingredients and shows
possible recipes. Food List and Recipe List provide sortable reference tables.
The Statistics Analyzer evaluates ingredient combinations in batches and can be paused.

Use Tab to reach controls and page tabs. In an ingredient search, use Up/Down to
highlight results and Enter to select. Shift+Enter removes one copy; Ctrl+Enter
(Command+Enter on macOS) removes all copies. Escape dismisses the results;
Up/Down or refocusing the search reopens them. Dropdown menus support Up/Down,
Home/End, Enter/Space, and Escape.

Picked ingredients show a checkbox to remove all copies. When there is more than
one copy, a minus also appears to remove one.
The ingredient itself adds another copy in the Simulator and toggles membership
in Discovery. Choose Compact for dense rows, Normal for larger rows, or Cozy for
cards; list and icon-only views are also available. Compact icons pack into smaller
tiles, with larger targets retained on touchscreens.

Group results by ingredient type or preparation, or leave them ungrouped. Groups
appear as cards across wider pickers and stack on narrow screens. Auto
sort prioritizes exact names and search relevance, keeps related preparations
together while browsing, and uses character-adjusted values for stat searches.
Explicit name and stat sorts remain available. Display, density, sort, grouping, and cooking
preferences are saved separately for the Simulator and Discovery.

Use **Cooking: Practical** to focus on crock pot inputs: it hides duplicate cooked
and dried foods, redundant substitutes, and uncommon ingredients without a named
recipe role. Specialties such as Butter and Royal Jelly remain, and Warly-only
inputs appear when Warly is selected. **Cooking: Everyday** also hides those
uncommon specialties. Both retain needed prepared ingredients, such as Roasted
Birchnut, and use fish meat in place of most interchangeable live fish.
These are curated browsing suggestions; availability depends on your world and
play style. **Cooking: All**, the default, restores the full list. Cooking views
apply to searches too, leave selected food in place, and do not change recipe
calculations, the Food List, or analyzer filters.
When a search has hidden matches, its summary offers **Show all** to restore them
without clearing the search or changing the other picker's view.

The Statistics Analyzer and Discovery's efficiency results group consecutive
combinations for the same recipe without changing the sort order. Expand a recipe
to see its combinations; a collapsed row shows the first combination's values.
Click its ingredients to fill the crock pot and open the Simulator.
Pause a running analysis to inspect its latest results and load more combinations.
Its progress bar reports combinations checked out of the full search, including
combinations that produce no valid recipe.
The table reports how many matching combinations are loaded; recipe groups can
contain several of those combinations. **Reset filters** restores the analysis's
original filters, including the Statistics Analyzer's default exclusions.
Stat gains show absolute changes; percentages appear when the ingredient baseline
is nonzero.

Ingredient searches accept display names and game identifiers, with spaces or
underscores between words. For example, `mushroom` finds Red, Green, and Blue Caps
and their cooked forms. Use `tag:meat` to filter by a food tag or
`recipe:butter muffin` to find ingredients for an exact recipe name.

## Development and deployment

```bash
npx playwright install chromium
npm run check
```

`check` runs formatting, linting, source type checking, unit tests, and a Chromium
browser smoke test. On Linux, deployment tests also require Git, Bash, `flock`, and
`rsync`.

- [Development guide](docs/development.md): commands, module layout, tests, and assets.
- [Deployment guide](docs/deployment.md): GitHub Pages and the optional server webhook.
- [Data and library guide](docs/data.md): package exports, data shape, and mode filtering.

Bug reports and pull requests are welcome, especially when the food data differs
from the game. Include the game version, DLCs, character, ingredients, and a source
for proposed recipe changes.

## Reuse the data

Install this repository as a Git dependency:

```bash
npm install git+https://github.com/bluehexagons/foodguide.git
```

```js
import { food, recipes, TOGETHER, matchesMode } from 'foodguide';

const togetherRecipes = recipes.filter(recipe =>
	matchesMode(recipe.modeMask, TOGETHER, recipe.charMask, 0),
);
const carrot = food.carrot;
```

The entry point works in Node and browser module environments. Collections are
shared mutable objects with keyed lookups and array-like helpers; see the
[data guide](docs/data.md) before iterating or changing them.

## Translations

UI strings live in `src/strings.ts`. Static HTML uses `data-i18n="key"`,
`data-i18n-html="key"`, and `data-i18n-attr-NAME="key"` attributes. English is the
fallback; bundled Spanish and Chinese dictionaries live in `src/locales/` and are
registered by the package entry point.

The Spanish and Chinese translations were generated by Anthropic Claude Opus and
have not yet been reviewed by native-speaking Don't Starve players. Corrections
are welcome. Food, recipe, character, and DLC names remain in English.

```js
import { registerLocale, setLocale } from 'foodguide';

registerLocale('fr', 'Français', {
	pause: 'Pause',
	resume: 'Reprendre',
	// Missing keys fall back to English.
});
setLocale('fr');
```

For a bundled locale, add its module to `src/locales/index.ts`; the language picker
uses the registered locale list automatically.

## Contributors

[bluehexagons](https://github.com/bluehexagons),
[rezecib](https://github.com/rezecib),
[levy9527](https://github.com/levy9527),
[brewingcode](https://github.com/brewingcode),
[agathasilva28](https://github.com/agathasilva28),
[6lancmange](https://github.com/6lancmange),
[lakhnishMonster](https://github.com/lakhnishMonster),
[lormico](https://github.com/lormico), and
[VaingloriousReptile](https://github.com/VaingloriousReptile).

Code is licensed under [Apache 2.0](LICENSE). Don't Starve and its game artwork
belong to Klei Entertainment.
