# Development

Use Node.js 24 or newer (`nvm use` selects the CI version), install the lockfile
with `npm ci --ignore-scripts`, and install
the test browsers with `npx playwright install chromium firefox`. On Linux,
`npx playwright install --with-deps chromium firefox` also installs their system
dependencies; this may require administrator access. After upgrading Playwright,
[install its matching browser binaries again](https://playwright.dev/docs/browsers).

## Commands

| Command                                     | Purpose                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                               | Build modules, generate sprites, and serve `html/` at `127.0.0.1:8080`.    |
| `npm run build`                             | Compile browser modules to `html/` and build tools to `scripts/`.          |
| `npm run generate-sprites`                  | Compile modules and regenerate sprite sheets and their manifest.           |
| `npm run check`                             | Run fast checks and the full Chromium browser/accessibility suite.         |
| `npm run check:ci`                          | Run formatting, lint, types, and unit tests without a browser.             |
| `npm run test:browser:smoke`                | Build sprites and run four fast Chromium smoke scenarios.                  |
| `npm test`                                  | Run Node's tests, including deployment tests on Linux.                     |
| `npm run test:browser`                      | Generate sprites and run the full Chromium regression/accessibility suite. |
| `npm run test:browser -- --browser=firefox` | Run the shared browser suite in Firefox.                                   |
| `npm run typecheck`                         | Check strict sources and library consumers with both module resolvers.     |
| `npm run format:check` / `npm run lint`     | Check formatting or lint independently.                                    |
| `npm run fix`                               | Apply oxfmt formatting and oxlint's safe automatic fixes.                  |

All production modules, including the page controller and sprite generator, use
strict TypeScript. JavaScript tests exercise the compiled browser modules. oxlint
checks TypeScript sources and JavaScript tests with correctness rules and rejects
explicit `any`; warnings fail CI. oxfmt formats source, styles, HTML, documentation,
and configuration. Generated output and the npm-managed lockfile are excluded.
The compiler separately checks strict types and public library declarations.
Unit tests also pack the library and install it offline into a temporary consumer,
then check its runtime exports and strict NodeNext and bundler type resolution.
Browser tests default to Chromium. Select Firefox with `--browser=firefox`, or set
`PLAYWRIGHT_BROWSER=firefox` when running a focused Node test. `--headed` opens a
visible test browser in a graphical session; for example:

```bash
npm run test:browser -- --browser=firefox --headed
```

For a focused browser check, compile and generate the assets first, then use Node's
built-in name filter. Set `PLAYWRIGHT_BROWSER=firefox` to run the same selection
in Firefox:

```bash
npm run generate-sprites
node --test --test-name-pattern='entry points|section URLs' tests/browser-smoke.js
PLAYWRIGHT_BROWSER=firefox node --test --test-name-pattern='entry points|section URLs' tests/browser-smoke.js
```

CI runs `check:ci` plus `test:browser:smoke`. The smoke command selects the four
`CI smoke:` scenarios: startup/assets/calculation, root and subpath entry links,
section history and shared snapshots, and link-sharing choices. Each scenario has
a 60-second test timeout. It does not run accessibility audits or the full browser
regression suite. The workflow installs only Chromium's headless shell and has a
10-minute job limit.

Developers should run the full Chromium and Firefox suites for browser/UI changes:

```bash
npm run check
npm run test:browser -- --browser=firefox
```

The full suite includes an extensive accessibility audit and can take several
minutes. It reports progress after each panel, including theme, locale, viewport
mode, and completed scan count. Use focused checks while editing, then run the full
suites before submitting browser/UI changes. Keep CI smoke scenarios small; broad
coverage belongs in the developer-run suite.

`PLAYWRIGHT_EXECUTABLE_PATH` selects an existing Chromium executable and is ignored
for Firefox. Firefox automation uses Playwright's patched build, installed by the
command above, rather than a desktop Firefox installation. See the
[Playwright browser guide](https://playwright.dev/docs/browsers#firefox).
Use binaries matched to the locked Playwright version. Firefox's engine diagnostics
about pre-load layout in `chrome://juggler/content/content/main.js` and automatic
scroll anchoring are reported separately; application warnings and errors still
fail the developer-run browser checks.

On Linux, install Git, Bash, `flock` (usually supplied by `util-linux`), and `rsync`
for the deployment integration tests. Those tests use temporary repositories and
serving directories to verify asset generation and failure handling. They are
skipped on other operating systems.

When Go is installed, a separate test uses Go's template parser to verify the
webhook configuration and JSON escaping of its secret. That test is skipped when
Go is unavailable; the application itself does not require Go.

## Layout

| Path                                                                  | Responsibility                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `html/index.html`                                                     | Main application document, served at the site root.            |
| `src/foodguide.ts`                                                    | Page state, tabs, ingredient pickers, and UI wiring.           |
| `src/food.ts`, `src/recipes.ts`                                       | Food and recipe data and initialization.                       |
| `src/constants.ts`, `src/mode-utils.ts`, `src/functions.ts`           | Game constants, mode/character logic, and recipe predicates.   |
| `src/recipe-calculator.ts`, `src/recipe-analyzer.ts`                  | Search, recipe matching, and batched combination analysis.     |
| `src/dropdown.ts`, `src/sortable-table.ts`, `src/theme-controller.ts` | Shared UI controls.                                            |
| `src/table-sort.ts`                                                   | Shared name comparison and table sorting without DOM state.    |
| `src/ingredient-sort.ts`, `src/ingredient-groups.ts`                  | Picker relevance, explicit sorting, and disjoint groups.       |
| `src/ingredient-cooking.ts`                                           | Curated cooking views and recipe specialty preservation.       |
| `src/number-format.ts`                                                | Signed value formatting with fraction glyphs.                  |
| `src/preferences.ts`                                                  | Saved-state validation, legacy migration, and storage access.  |
| `src/navigation.ts`, `src/entry-redirect.ts`                          | Shareable fragment routes and legacy `.htm` link preservation. |
| `src/tab-storage.ts`                                                  | Tab-local working snapshots and last-used defaults.            |
| `src/food-selection.ts`                                               | Ingredient variants for saved selections and game changes.     |
| `src/analysis-filters.ts`                                             | Analyzer filter states and result matching without DOM state.  |
| `src/strings.ts`, `src/locales/`                                      | Translation helpers and locale dictionaries.                   |
| `html/style/`, `html/img/`                                            | Styles and original icon assets.                               |
| `tools/generate-sprites.ts`                                           | Sprite sheet generator using Sharp.                            |
| `tests/`                                                              | Unit, regression, deployment, and browser smoke tests.         |
| `.github/workflows/`                                                  | Shared checks, CI, and deployment.                             |

TypeScript sources live in `src/`; `npm run build` writes ignored JavaScript and
declarations to `html/`, retaining the existing module URLs. Edit the source files,
then rebuild before opening `html/index.html` or importing the library.
`npm run build:watch` recompiles browser sources while you edit. Node build tools
live in `tools/` and compile to `scripts/`. `npm ci --ignore-scripts` requires an
explicit build; normal installs and package creation run it automatically.

## State, storage, and navigation

`preferences.ts` validates JSON and migrates historical game settings.
`tab-storage.ts` stores the pot, game context, active section, and picker views in
`sessionStorage`, seeded from durable last-used defaults for a new tab. A memory
snapshot preserves the tab's choices when storage is unavailable. Theme and language
remain shared preferences.

### Personal data

`personal-data.ts` owns the versioned `localStorage.foodGuidePersonalData` document:
named inventories and cookbook dishes, each with a stable ID. Inventory ingredients
are a set; dishes contain exactly four ingredients, including repeated ones, and
capture their game/DLC/character context. `personal-data-ui.ts` owns their controls,
sharing and Options dialogs, synchronized language/theme controls, and backup
import/export. `cookbook-preview.ts` resolves each dish's
ingredients for its saved context and re-simulates all highest-priority outcomes.
Predictions are derived from current recipe data; they are not stored in backups
or calculated by changing the active Simulator. The active inventory ID is a tab preference,
not part of the shared document. First use migrates the previous inventory once into
“My inventory”; a fixed default ID and a Web Lock prevent duplicate first-run imports.

`header-actions.ts` places the same Share/Options controls beside the tablist on
wide screens and beside the title at widths up to 767 px. Reparenting preserves
keyboard focus and keeps the visual order aligned with the Tab order.

Writes use `navigator.locks` to serialize read/modify/write across tabs and Electron
windows. User edits apply ingredient additions/removals to the latest stored inventory,
not a stale full replacement. Other inventories, concurrent additions, and items hidden
by the current game remain intact. Pending deltas overlay incoming storage events;
storage and visibility events refresh the view without writing it back. Browsers without
Web Locks fall back to queued writes within a tab, with no cross-tab locking guarantee.
Storage failures retain edits in memory and show an export reminder. Invalid stored data
is not overwritten automatically. Imports validate the entire JSON file, including IDs,
names, ingredient availability for dishes, and game context, before adding copies with
new IDs. Limits are 2 MB, 200 inventories, 2,000 dishes, and 1,024 items per inventory.

### Dialogs and appearance

`ui-icons.ts` supplies decorative inline SVGs and the information-page links.
Dialogs support Close, Escape, and backdrop clicks; a drag beginning inside a
dialog does not dismiss it. Options shares the theme controller and locale state
with the header, including automatic device appearance and cross-tab updates.
The compact header uses a monochrome SVG book-and-pot mark at widths up to 480 px;
Share, Options, and language retain accessible names when their text is hidden.

### URLs and history

`share-link.ts` filters explicitly selected link contents and selects the current
site, GitHub Pages development site, or source repository. Sharing controls retain
their values only in the current document; they do not write shared preferences.
Ingredient snapshots and highlights require section and game settings so their
context is preserved. Deselecting all contents produces a plain site URL.

`navigation.ts` parses and formats fragment routes for static subpaths and the desktop's
`file:` entry point. Ordinary URLs contain the section, `game`, optional `dlc`/`character`,
and reference `highlight`. Only **Share** adds `ingredients` (Simulator) or `inventory`
(Discovery). Opening a snapshot restores the pot or creates a new shared-inventory copy,
then replaces the address with the short navigation route. Appearance and analyzer
results never enter the URL. Payload size and item counts are bounded.

Tabs are native anchors with tab semantics, including modified clicks and link menus.
Section changes push history; game edits replace the current route. Back/Forward and
manual routes restore section and context while retaining the tab's pot and selected
shared inventory. Returning to an unchanged selection preserves computed analyses,
expanded groups, and page positions. Together/Hamlet links retain inactive single-player
DLC preferences. Chromium and Firefox tests cover these routes, independent pot/views,
synchronized inventories, cookbook loading, backup validation, and dialog keyboard use.

Ingredient selections resolve to an available variant by base ID. Pot selections prune
items unavailable in the chosen game; inventories preserve them in storage and display
only those currently available. Discovery keeps one of each ingredient while the pot
preserves quantities in four slots.

## Tables and analyses

Sortable tables take a `TableOptions<T>` object with a required localized caption.
Overflowing wrappers become named, focusable regions so keyboard users can scroll
with Left/Right; wrappers that fit do not add a Tab stop. A `ResizeObserver` tracks
table and wrapper sizes, including changes to visible columns, and `dispose()`
disconnects it. Column sort keys and the default sort are checked against the row
type; summary rows have an explicit count.
The focused scroll region handles unmodified Left/Right keys directly so
horizontal scrolling works consistently across platforms. Keys on table buttons,
modified keys, and other scrolling commands retain their browser behavior.
Empty tables display localized feedback across their visible columns. Views can
provide an `emptyMessage` callback when that explanation depends on their state.
An optional `onRender` callback receives shown and matching row counts, excluding
the empty placeholder. Pagination uses these counts from the same filtering pass
as the rendered rows.
The shared sorter preserves the dataset's identity and leaves summary rows above
the sorted results. Search results use the same name comparator as tables.

Tables retain their header buttons and rebuild only the result rows. Sorting and
linked actions use native buttons; `aria-sort` describes the actual row order,
and column buttons expose their visibility with `aria-pressed`. Column controls
form a named group for their table. Auto uses the recommended columns for the
screen size; selecting a column switches to manual control without changing the
other visible columns. Turning Auto off restores the manual choices. If resizing
or zooming hides a focused cell, focus moves to its column button. When a linked
action rebuilds its own rows, focus returns to the same row and occurrence of its
link key, even when that action appears elsewhere in the table. Temporary
tables must call `dispose()` before their containers are removed or replaced;
this releases both lifecycle registrations and pending scroll restoration.
The picker owns its result tables, and analyzer controllers own their analysis
tables. The page's locale and resize listeners also dispose disconnected tables.

Bind control actions to their known keys or listener elements. The clicked child
(`event.target`) can be an icon or a nested label; use `event.currentTarget` when
the handler needs the element that owns the listener. Table link callbacks receive
the link key and its button element, and sortable headers capture a typed sort
key. Picker click and keyboard input call the same action directly. Primary
pointer actions run on release, so dragging away or scrolling cancels activation;
clicks supplied by assistive technology also work without a preceding press.

Analyzer filter state lives in `analysis-filters.ts`; its state queries drive both
icon classes and result matching. Preserve structural classes such as `icon` when
updating a filter's appearance. Analyzer controllers expose `dispose()` to cancel
work, remove translation listeners, and release their table registrations when
inputs or game settings change. An unfinished calculation displays a snapshot after
its first batch and refreshes it on pause/resume or filter changes. Group the entire sorted, filtered snapshot before
pagination, so one long recipe run cannot hide later recipes. The overview displays
25 consecutive recipe groups per page by default; expanding a group renders 25
combinations by default. Independent main-toolbar controls select 10, 25, 50, or
100 groups and combinations per page. Keep rendering bounded at both levels. Both
levels offer first/previous/next/last controls and a page-number jump. Pagination reuses the snapshot without sorting it again.
Avoid redrawing the growing table on every calculation batch. Resume can finish
synchronously; its completion callback owns the final controls and announcement.
Empty filtered results explain whether the search is still unfinished or which
filters to adjust. Locale changes update Discovery tables and analyzer controls
in place, preserving calculations, filters, and column choices. Browser
regressions cover nested labels, mouse and keyboard entry, filter cycles, and
calculation cleanup.

### Cooking views

Cooking views filter search results before sorting and grouping, independently
of selected slots and analyzer exclusions. `ingredient-cooking.ts` contains the
explicit substitute and uncommon-input lists; keep these choices auditable and
check their IDs when updating food data. Never infer rarity from `defaultExclude`
or `skip`: these are analysis hints and include everyday staples. A substitute
is hidden only when its cookable representative exists in the selected game.
Preparation links describe cooking and drying, rather than butchering. Fish Morsel
is a raw ingredient and represents interchangeable live fish in these views.
Practical retains uncommon ingredients with positive named requirements in
applicable recipes; Everyday omits those specialties. Negative requirements,
generic tags, trash, and roughage recipes do not qualify. Requirement `operator`
metadata lets alternatives share a role while AND retains separate roles; it
does not change predicate evaluation. Hide a duplicate prepared form only when
its preferred base satisfies the same named role. Preserve needed prepared
forms such as Roasted Birchnut and Roasted Coffee Beans. All preserves existing
search behavior, including non-cookable Discovery foods. Search summaries distinguish
hidden matches from no matches, including partially filtered searches. Show all
restores that picker's view and returns focus to the search, preserving the query
and selection. Each picker saves
its view under `foodGuideCookingPreference`.

## Input and accessibility

The tabs use one Tab stop with Left/Right, Home, and End navigation. Ingredient
slots are native buttons: Enter or Space removes a selected item or focuses the
search field from an empty slot. The picker keeps focus on its input while Up/Down
changes `aria-activedescendant`; Escape hides the results and arrow keys reopen
them. Enter adds (or toggles Discovery membership); Shift+Enter removes one copy,
and Ctrl/Command+Enter removes all copies of the highlighted ingredient. These
commands stay within the combobox, ignore IME composition and Alt-modified keys,
and do nothing while results are dismissed. Visible result counts and empty-search
messages are localized. Search
announcements wait for a short typing pause, skip IME composition, and are canceled
when focus leaves the search or an ingredient action takes priority. Action
feedback uses the same atomic status region between the picker and selection.
An invisible grid measures the available error messages in the current language
and game mode, reserving enough space for wrapping without moving the ingredients.
Result counts and localized keyboard hints occupy a separate row above the reserved
error area, so counts remain visible during errors. Error messages fade in without
movement, and reduced-motion settings disable that transition. Failed
actions display persistent explanations and recovery steps; changing language
translates the active error, while a new search or successful action clears it.
Their optional flash uses one bounded timer per target, so cleanup
does not depend on animation events that reduced-motion settings suppress.

`filter-controls.ts` owns analyzer keyboard navigation and accessible state
labels. Each ingredient/recipe toolbar has one Tab stop; arrows, Home, and End
move within it. Enter/Space cycles filters, while Shift+Enter/Space provides the
same alternative action as right-click. Keep filter state in `analysis-filters.ts`
and preserve focus when removing or hiding controls. Analyzer announcements occur
on pause/resume and completion, rather than on every computation chunk.

`activation.ts` shares click and secondary-action handling between picker options,
slots, and analyzer filters. Mouse right-click and keyboard context menus retain
their alternate actions; touch long presses and their trailing clicks leave the
selection unchanged. Every filter state is available by ordinary taps, without
requiring a long press. Do not move selection changes into press handlers or
cancel touch events needed for native scrolling and zooming.

### Touch layouts

`html/style/touch.css` uses `any-pointer: coarse` to provide at least 44-pixel
button and picker targets on touchscreens, including computers with a mouse.
The optional membership shortcuts appear only for picked ingredients. They overlay
the existing content with larger transparent hit areas, backed by option/slot
targets and keyboard commands. Compact anchors the checkbox at the trailing edge,
with the optional minus immediately before it, so hiding the minus leaves no gap
or movement of the checkbox. These inline badges overlay the text and use
20-pixel targets; list rows follow the content width. Normal uses corner
overlays and wider targets. Cozy names use cards with the name below the icon,
while cozy list mode retains larger rows. Icon-only options use square tiles with
centered artwork and controls aligned at the top corners, leaving the center free
for the ordinary ingredient action. Compact icons use fixed 36-pixel tiles and
tighter group spacing, so wider cards fit more icons rather than stretching the
tiles. Touchscreens keep 44-pixel tiles and larger shortcut targets.
Visibility and quantity changes add no padding, footer, or layout movement.
Quantity badges stay opaque; minus controls brighten on hover or keyboard
highlight, and touch/forced-color modes keep them fully visible.
Picker names wrap on touchscreens;
selected ingredients and analyzer filters also show names instead of depending
on hover titles. Text fields use 16-pixel type,
controls wrap on narrow screens, and wide tables scroll inside their own wrappers.
The viewport allows browser zoom. These choices follow the W3C guidance on
[pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation)
and [larger targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).

### Visual states

`html/style/accessibility.css` provides drawn checkmarks for selected game modes,
menu choices, picked ingredients, visible columns, and highlighted table rows.
Picked ingredients also have a distinct background and repeated pot ingredients
show a quantity badge. Clicking its checkbox-shaped target clears all copies;
the minus appears only with multiple copies and removes one. Its `hidden` state
removes both the visual and pointer target when there is a single copy.
These are pointer shortcuts inside an atomic
listbox option, rather than nested focusable controls; the combobox documents
and exposes equivalent keyboard commands with `aria-keyshortcuts`. Unpicked
ingredients have no visible or hit-testable removal controls. Clearing copies
walks fixed slots backwards to preserve the remaining order, then refreshes
recipes and persistence once. Rebuilds after search, sort, and game changes derive
this state from the slots; quantities also appear in accessible names, while
`aria-description` describes membership independently of the keyboard highlight's
`aria-selected`. Focus rings use the theme's focus color
and stay inside joined search inputs and scrolling menu items. These cues supplement
color. Targeted forced-color rules retain the
user's system palette through explicit system-color variables, remove the slot
texture, and preserve selection outlines
and filter badges. Keep this stylesheet last so it can adjust the shared styles.

### Picker sorting and grouping

Auto sorting gives exact names priority, then search relevance, while preserving
related preparation order when browsing. Stat-tag searches use character-adjusted
values. It never reorders in response to membership changes; explicit sorts stay
under the user's control. Old Default preferences restore as Auto. Group by
ingredient type or preparation creates named listbox groups with localized counts,
assigning mixed-tag foods once (monster before fish before meat for classification).
Browsing uses a consistent group order, while Auto searches start with the group
containing the strongest match. Sorting remains stable within each group. Arrow
navigation spans the flattened option order and skips headings; global
`aria-posinset`/`aria-setsize` describe that order. Grouping preferences persist
independently for Simulator and Discovery. Only `.ingredient-options` gets the
ingredient grid/list styling. Grouped wrappers get card columns when the
picker's container is at least 640 pixels wide; density and display mode determine
the minimum card width. Narrower pickers stack groups. Card order follows DOM and
keyboard order, with one outer scroll area rather than independently scrolling
cards. Each card stays in one column; groups fill columns top to bottom, then left
to right, avoiding gaps beneath shorter cards while preserving reading order.
A single matching group uses the full available width.
Resizing and zooming change layout without rebuilding options or focus.

## Analyzer results and scheduling

Statistics and Discovery efficiency tables collapse consecutive results for the
same recipe after sorting and filtering, before pagination. Each collapsed row
shows the first combination's exact stats and ingredients, not an aggregate; the
count
covers the full consecutive run in the filtered snapshot. Separate runs of the
same recipe remain separate, preserving numeric sort order. Expanding keeps the
control focused and renders a combination page with ordinary rows and their own
ingredient buttons. Tint and borders mark the entire expanded run; the last row
(or pager on a one-combination page) closes its boundary. These borders remain
visible with hidden columns and forced colors. The expanded header shows the first
combination on the current detail page; the range identifies its position within the group. Expansion survives language
changes and pagination when the first combination remains the same; changing the
sort collapses groups. Stable sorting
preserves tied combinations across rerenders, with missing numeric values last.
Clicking an ingredient cell or activating its button replaces the four Simulator
slots, preserves duplicates, updates recipes and membership badges, switches
tabs, focuses the first pot slot, announces the change, and saves immediately.
Discovery inventory and analysis results remain available when returning.

Running analyses keep a bounded table snapshot instead of sorting and rebuilding
it on every calculation batch. The snapshot notice explains this; pausing refreshes
the table. The overview count reports group range and all matching combinations,
while the calculation summary counts all valid combinations found so far.
Filter changes, resets, pausing, and pagination announce the matching count without
announcing every calculation batch.
Refresh results and completion refresh the snapshot without restarting calculation.
The refresh action stays available for unfinished and paused analyses, including
empty snapshots, and hides on completion. If focused, it hands focus to the groups
per page selector. An untouched overview stays on page one to show the start of
the final ranking. After paging ahead or expanding a run, refresh preserves the
browsed group and combination where possible by matching retained row identities
in the new snapshot. Keep a focused result at its previous viewport position when
new runs shift its row; scroll a fallback control into view if the result disappears.
Page-size changes keep the previous first row within the new page. Both toolbar
copies synchronize, and locale changes preserve page sizes. Filter changes and
reset return to the first overview page; reset restores initial exclusions and clears user requirements.
Locale changes preserve the snapshot, overview page, detail pages, expansion, and
focused controls. Sorting collapses groups and resets both levels. Pagination
announces the new range without announcing every calculation batch. Bottom overview
navigation returns the viewport and focus to the top paging bar of the next page.
The [browser console API](console.md) exposes captured analysis context, progress,
and bounded JSON-friendly result pages. `console-api.ts` references UI-owned arrays
and drops each registration when its panel clears. It does not duplicate full
results or scan them for summary counts. Legacy predicate text is generated lazily.

The analyzer drains delivered results from its batch buffer; the UI owns the
retained result collection. Gains from a zero ingredient baseline have no relative
percentage and show only the signed absolute change. Recipe values use the
character's consumption rules and recipe multiplier captured at calculation start. Both displayed
values and gain sorting use those adjusted outcomes, matching the Simulator;
the browser suite checks Warly in Shipwrecked and Together, Webber, Wigfrid, and
unmodified outcomes. Simulator totals and analyzer baselines apply character
rules to the ingredients and their best prepared form. Cooking tags and recipe
matching remain independent of dietary restrictions. Modifier results are cached
per ingredient during an analysis.

Food, recipe, Simulator, and Discovery tables resolve numeric sort values using
the same character rules and preparation multipliers as their displayed stats.
The shared renderer accepts a typed numeric-value callback without changing the
authored food or recipe data. Summary rows stay pinned and missing values stay
last in both directions. Browser checks cover Health, Hunger, and Sanity sorting
for Warly, Webber, and Wigfrid.

Monster Lasagna is marked as monster food in both game variants so Webber's
immunity applies in all result tables. Its health and sanity penalties remain
unchanged for other characters; see the
[game reference](https://dontstarve.wiki.gg/wiki/Monster_Lasagna/DST).

The analyzer checks a 16 ms work budget between combinations and bounds batch
growth, yielding through the scheduler so scrolling and pause actions stay
responsive. Sorted recipe priorities let matching stop after the winning priority
and its ties. Progress counts checked input combinations, including those with no
valid output, against C(n + 3, 4); it is distinct from valid result rows, which can
include multiple outcomes for one combination. The native progress bar and its
visible description update together and localize without restarting the run.
Progress updates do not enter the live announcement region. Configuration is
captured at the start, including a copy of mutable multipliers. Cancellation from
callbacks cannot enqueue another batch or invoke completion; a paused run leaves
no scheduled work behind.

## Browser coverage

The browser suite runs axe-core over all seven panels in both themes and all
three languages, including open picker menus, completed discovery results, and
paused statistics results, empty filtered tables, empty searches, and full-pot
feedback. English small-screen and forced-color scans repeat both themes. It also
exercises keyboard flows, horizontal table scrolling, search feedback,
and focus recovery,
touch taps and long-press event handling. Chromium also tests trusted canceled
gestures and picker/table scrolling through CDP; those three tests report explicit
skips in Firefox, where CDP is unavailable. Firefox still exercises emulated touch
taps and mobile viewport layouts. Touch layout
checks cover 320, 375, 768, and 1280-pixel
viewports in all three languages, plus every picker display/density combination.
Narrow-screen checks also apply the [increased text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
values and verify that selected ingredient names remain unclipped.
Automated scans do not replace testing with screen readers; review spoken names,
announcements, and focus visibility when changing interaction patterns. Emulated
touch does not replace checks on physical phones and tablets, particularly with
VoiceOver/TalkBack, browser zoom, and the software keyboard visible.

## Updating assets and data

Keep source icons in `html/img/`. The generator accepts PNG, WebP, JPEG, and `.jpg`
files, normalizes them to 64-pixel cells, and excludes the background texture.
`html/img/sprites/` is generated and ignored by Git. Every static deployment must
generate and copy these files together with the rest of `html/`.

Add recipe changes to `src/recipes.ts` and ingredient changes to `src/food.ts`.
Keep recipe `test` functions and displayed `requirements` consistent, and add a
regression for the ingredient combination or mode involved. Preserve mode-specific
keys and cross-references as described in the [data guide](data.md).

## Dependency maintenance

Use `npm outdated` and `npm audit` to review direct and transitive dependencies.
Update `package.json` and the lockfile together. Node declarations are a build-time
dependency and may track the current release; Node 24 remains the supported runtime
and CI baseline. Do not introduce newer runtime APIs without updating that baseline.
After a Playwright update, reinstall both matching
browser binaries and run `npm run check` plus the Firefox suite before committing. Review major
version changes against upstream release notes. GitHub Actions are pinned to
full commit SHAs; update the version comment with each pin.

Pull requests targeting `main` and manual CI runs use the shared checks. Pushes
to `main` run them once through the deployment workflow. Formatting, lint, types,
unit tests, dependency auditing, and four Chromium smoke scenarios gate publication.
Full browser and accessibility suites are developer-run. Superseded checks are
canceled; publication alone is serialized without canceling an active deployment.
