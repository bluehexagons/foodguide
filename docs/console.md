# Browser console

Open the guide in a browser, then open its developer console. `foodGuide` provides
helpers for inspecting the current tab without changing its controls. Nothing is
logged automatically. These helpers operate on this tab's current game and
character settings unless a result explicitly records a captured configuration.

```js
foodGuide.getState(); // section, game/DLC/character, pot IDs, active inventory IDs
foodGuide.getRecipes([food.carrot, food.carrot, food.meat, food.meat]);
foodGuide.matchingNames(foodGuide.food, 'tag:meat');
```

`foodGuide.food` and `foodGuide.recipes` are the initialized collections already used
by the app. They include keyed and numeric lookups and their existing collection
helpers. `getRecipes(items)` returns the Simulator's summary and candidate recipes;
only the highest-priority matches can win. `getSuggestions(output, items, exclude?,
itemComplete?)` uses the calculator's existing interface, filling a caller-supplied
output array. Search helpers use the app's matching scores; treat shared collection
objects and legacy result arrays as read-only.

## Analyses

Run a calculation in Discovery or Statistics Analyzer first. Console access does
not start a search or calculate extra combinations.

```js
foodGuide.analyses();
// One summary per retained panel: source, status, checked, total, resultCount,
// selection, modeMask, charMask, multipliers, and analyzed ingredient IDs.

foodGuide.analysisRows('discovery'); // first 100 results, including filtered-out rows
foodGuide.analysisRows('statistics', { offset: 100, limit: 100 });
foodGuide.analysisRows('discovery', { filtered: true, limit: 500 });
```

Summaries distinguish `running`, `paused`, and `complete` searches. Settings and the
ingredient pool are captured when that search starts; they may differ from the
current view. `checked` counts input combinations, while `resultCount` counts winning
recipe outcomes, including ties. Clearing or replacing a panel's results removes
its old console entry too.

Rows are detached, JSON-friendly records with recipe and ingredient IDs, names,
character-adjusted stats, ingredient baselines, gains, percentages, and tie markers.
The `healthpct` and `hungerpct` fields are relative gains: `0.25` means 25%;
`null` means the ingredient baseline is zero. `perish` is in game seconds.
No DOM nodes, predicates, or linked food/recipe object graphs are copied. For example:

```js
JSON.stringify(foodGuide.analysisRows('discovery', { limit: 500 }));
```

Pages follow the retained result array’s order, including its most recent table
sort. New batches append until the next refresh or completion sorts the results;
the table’s visible page does not limit console access.
With `filtered: true`, offsets count only rows matching the panel's current filters.
The default limit is 100; a request accepts at most 10,000 rows. Fetch consecutive
pages for larger exports. Reading unfiltered pages jumps directly to their offset;
filtered pages scan only as far as needed to find the requested rows. Calls return
the currently available results, so pause or complete a run before exporting several
pages for a consistent snapshot, and leave table sorting and filters unchanged
while paging.

The inspector references the UI's existing result arrays. It does not retain a second
full result set, and it creates compact row records only when requested. Summary calls
never walk all results or apply their filters. The detached records returned by `getState()`, `analyses()`, and `analysisRows()`
can be edited without changing the app.

## Existing globals

`food`, `recipes`, and `matchingNames` remain aliases for their existing helpers.
`analysis.made` contains the last completed analysis's full shared rows, regardless
of table filters or pagination. Before a completed run it may be undefined; clearing
that run empties it. Both panels can retain results, so use `foodGuide.analyses()` to
identify their context rather than assuming the legacy global describes the visible
panel.

`recipeCrunchData` describes recipes considered by the most recently started run.
Its `test`, `tests`, and `priority` compatibility arrays are computed and cached only
when read; normal calculations do not allocate predicate text. Large raw graphs are
still available through the legacy globals for advanced use, but compact pages are
usually easier to inspect or export. Browser developer tools may retain objects you
explicitly inspect or log, even after the app clears them.
