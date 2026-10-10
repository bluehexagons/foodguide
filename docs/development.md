# Development

Use Node.js 24 or newer (`nvm use` selects the CI version), install the lockfile
with `npm ci --ignore-scripts`, and install
the test browser with `npx playwright install chromium`. On Linux,
`npx playwright install --with-deps chromium` also installs the browser's system
dependencies; this may require administrator access. After upgrading Playwright,
[install its matching browser binaries again](https://playwright.dev/docs/browsers).

## Commands

| Command                                 | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                           | Build modules, generate sprites, and serve `html/` at `127.0.0.1:8080`. |
| `npm run build`                         | Compile browser modules to `html/` and build tools to `scripts/`.       |
| `npm run generate-sprites`              | Rebuild ignored sprite sheets and their manifest.                       |
| `npm run check`                         | Run all formatting, lint, type, unit, and browser checks.               |
| `npm test`                              | Run Node's tests, including deployment tests on Linux.                  |
| `npm run test:browser`                  | Generate sprites and run the Chromium smoke test.                       |
| `npm run typecheck`                     | Check strict sources and library consumers with both module resolvers.  |
| `npm run format:check` / `npm run lint` | Check formatting or lint independently.                                 |
| `npm run fix`                           | Apply oxfmt formatting and oxlint's safe automatic fixes.               |

All production modules, including the page controller and sprite generator, use
strict TypeScript. JavaScript tests exercise the compiled browser modules. oxlint
checks TypeScript sources and JavaScript tests with correctness rules and rejects
explicit `any`; warnings fail CI. oxfmt formats source, styles, HTML, documentation,
and configuration. Generated output and the npm-managed lockfile are excluded.
The compiler separately checks strict types and public library declarations.
Unit tests also pack the library and install it offline into a temporary consumer,
then check its runtime exports and strict NodeNext and bundler type resolution.
`PLAYWRIGHT_EXECUTABLE_PATH` can select an existing Chromium executable for the
smoke test; CI uses the browser downloaded for the locked Playwright version.

On Linux, install Git, Bash, `flock` (usually supplied by `util-linux`), and `rsync`
for the deployment integration tests. Those tests use temporary repositories and
serving directories to verify asset generation and failure handling. They are
skipped on other operating systems.

When Go is installed, a separate test uses Go's template parser to verify the
webhook configuration and JSON escaping of its secret. That test is skipped when
Go is unavailable; the application itself does not require Go.

## Layout

| Path                                                                  | Responsibility                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `html/index.htm`                                                      | Main application document; `index.html` redirects here.       |
| `src/foodguide.ts`                                                    | Page state, tabs, ingredient pickers, and UI wiring.          |
| `src/food.ts`, `src/recipes.ts`                                       | Food and recipe data and initialization.                      |
| `src/constants.ts`, `src/mode-utils.ts`, `src/functions.ts`           | Game constants, mode/character logic, and recipe predicates.  |
| `src/recipe-calculator.ts`, `src/recipe-analyzer.ts`                  | Search, recipe matching, and batched combination analysis.    |
| `src/dropdown.ts`, `src/sortable-table.ts`, `src/theme-controller.ts` | Shared UI controls.                                           |
| `src/table-sort.ts`                                                   | Shared name comparison and table sorting without DOM state.   |
| `src/number-format.ts`                                                | Signed value formatting with fraction glyphs.                 |
| `src/preferences.ts`                                                  | Saved-state validation, legacy migration, and storage access. |
| `src/food-selection.ts`                                               | Ingredient variants for saved selections and game changes.    |
| `src/analysis-filters.ts`                                             | Analyzer filter states and result matching without DOM state. |
| `src/strings.ts`, `src/locales/`                                      | Translation helpers and locale dictionaries.                  |
| `html/style/`, `html/img/`                                            | Styles and original icon assets.                              |
| `tools/generate-sprites.ts`                                           | Sprite sheet generator using Sharp.                           |
| `tests/`                                                              | Unit, regression, deployment, and browser smoke tests.        |
| `.github/workflows/`                                                  | Shared checks, CI, and deployment.                            |

TypeScript sources live in `src/`; `npm run build` writes ignored JavaScript and
declarations to `html/`, retaining the existing module URLs. Edit the source files,
then rebuild before opening `html/index.htm` or importing the library.
`npm run build:watch` recompiles browser sources while you edit. Node build tools
live in `tools/` and compile to `scripts/`. `npm ci --ignore-scripts` requires an
explicit build; normal installs and package creation run it automatically.

The page controller reads saved preferences once at startup. `preferences.ts`
validates that JSON, translates historical game settings, and handles unavailable
or corrupt storage. Controllers register state writers with the page's shared
save function. After initialization, each successful ingredient edit, tab change,
and game/character/DLC change saves a complete snapshot immediately, including
ingredients removed by a game change. Recovery does not depend on an unload event;
the browser regression opens the saved snapshot while the original page remains
open. Writes still merge into the latest stored state.

Ingredient selections follow the active game on restoration and mode changes.
Shared ingredients resolve to an available variant by their base ID; ingredients
absent from the selected game are removed. Discovery keeps one of each ingredient,
while the simulator preserves quantities in its four slots.

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
inputs or game settings change. An unfinished calculation displays up to 25
results after its first batch and refreshes them on pause/resume. Completion
raises the initial limit to 500, with further results available through Show more.
That control reports matching rows, hides when all matches are visible, and updates
with the language. Filtering preserves the expanded limit so restoring filters
does not collapse the table.
Avoid redrawing the growing table on every calculation batch. Resume can finish
synchronously; its completion callback owns the final controls and announcement.
Empty filtered results explain whether the search is still unfinished or which
filters to adjust. Locale changes update Discovery tables and analyzer controls
in place, preserving calculations, filters, and column choices. Browser
regressions cover nested labels, mouse and keyboard entry, filter cycles, and
calculation cleanup.

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

`html/style/touch.css` uses `any-pointer: coarse` to provide at least 44-pixel
button and picker targets on touchscreens, including computers with a mouse.
The optional in-option membership shortcuts use separate 32-pixel targets (24 on
mouse-only devices), backed by the larger option/slot targets and keyboard commands.
Compact/icon-only modes retain that minimum. Picker names wrap on touchscreens;
selected ingredients and analyzer filters also show names instead of depending
on hover titles. Text fields use 16-pixel type,
controls wrap on narrow screens, and wide tables scroll inside their own wrappers.
The viewport allows browser zoom. These choices follow the W3C guidance on
[pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation)
and [larger targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).

`html/style/accessibility.css` provides drawn checkmarks for selected game modes,
menu choices, picked ingredients, visible columns, and highlighted table rows.
Picked ingredients also have a distinct background and repeated pot ingredients
show a quantity badge. Clicking its checkbox-shaped target clears all copies;
the adjacent minus removes one. These are pointer shortcuts inside an atomic
listbox option, rather than nested focusable controls; the combobox documents
and exposes equivalent keyboard commands with `aria-keyshortcuts`. Unpicked
checkboxes add once, and unavailable minus targets do nothing. Clearing copies
walks fixed slots backwards to preserve the remaining order, then refreshes
recipes and persistence once. Rebuilds after search, sort, and game changes derive
this
state from the slots; quantities also appear in accessible names, while
`aria-description` describes membership independently of the keyboard highlight's
`aria-selected`. Focus rings use the theme's focus color
and stay inside joined search inputs and scrolling menu items. These cues supplement
color. Targeted forced-color rules retain the
user's system palette, remove the slot texture, and preserve selection outlines
and filter badges. Keep this stylesheet last so it can adjust the shared styles.

The browser suite runs axe-core over all seven panels in both themes and all
three languages, including open picker menus, completed discovery results, and
paused statistics results, empty filtered tables, empty searches, and full-pot
feedback. English small-screen and forced-color scans repeat both themes. It also
exercises keyboard flows, horizontal table scrolling, search feedback,
and focus recovery,
trusted Chromium touch taps/canceled gestures, picker/table scrolling, and
long-press event handling. Touch layout checks cover 320, 375, 768, and 1280-pixel
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
Update `package.json` and the lockfile together, reinstall Playwright's browser
after a version change, and run `npm run check` before committing. Review major
version changes against upstream release notes. GitHub Actions are pinned to
full commit SHAs; update the version comment with each pin.

CI runs dependency audits and checks on pushes and pull requests targeting `main`, and on the migration feature branch.
The deployment workflow also runs the shared checks before publishing.
