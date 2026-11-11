# Using the guide

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
combinations for the same recipe across the full filtered dataset, preserving
sort order. The overview shows 25 groups per page with each group's full count.
Expand a group to browse its combinations, 25 at a time. Both levels support
first/previous/next/last navigation and direct page-number jumps. The main paging
bars let you choose groups per page and, separately, combinations per expanded group page (10, 25, 50, or 100). Expanded runs
have a tinted background and borders marking where their paged results start and end.
Sort by **Name** to browse each recipe's combinations together, or by a stat to compare outcomes.
Each row shows the exact combination's values; click its ingredients to fill the
crock pot and open the Simulator.
**Refresh results** updates a running analysis without pausing or restarting it.
Completion automatically refreshes the table, preserving your browsing position
where possible. You can also pause to inspect a stable snapshot. Its progress bar
reports combinations checked out of the full search, including combinations that produce
no valid recipe. The table reports the group range and total matching combinations.
**Reset filters** restores the analysis's original filters, including the Statistics
Analyzer's default exclusions, and returns to the first overview page.
Stat gains show absolute changes; percentages appear when the ingredient baseline
is nonzero.

Ingredient searches accept display names and game identifiers, with spaces or
underscores between words. For example, `mushroom` finds Red, Green, and Blue Caps
and their cooked forms. Use `tag:meat` to filter by a food tag or
`recipe:butter muffin` to find ingredients for an exact recipe name.

The # links beside food and recipe names highlight an entry and can be copied or
opened in another tab. The browser address links to the current section and game;
use **Share** to include a snapshot of your pot or inventory. A shared inventory
opens as a new named copy. Share lets you choose the current section, game settings,
and ingredients or a highlighted entry, or omit all of them for a plain site link.
You can also link to the development version on GitHub Pages or the GitHub source
repository. These choices stay in the current tab between openings of the dialog.
Ordinary addresses do not include ingredient selections.
Back and Forward navigate between sections.

**Share** and **Options** sit beside the section tabs on wider screens and beside
the title on smaller screens. On compact portrait layouts, a Food Guide mark
and icon buttons keep the header short; the language menu still shows full
language names when opened.

Discovery supports multiple named inventories: create, rename, duplicate, or delete
an inventory using its controls. Inventories persist between sessions and synchronize
across tabs on the same browser profile and site. Each tab independently chooses
which inventory to view. Changing the game hides unavailable items without deleting
them. Pot choices and picker preferences remain local to each tab; new tabs start
with the last saved defaults. Theme and language synchronize across tabs.

Choose four pot ingredients and select **Save dish** to keep the combination in
**My cookbook**, with its game and character settings. Loading a dish restores those
settings and its ingredients. Cookbook cards show ingredient icons and recalculate
the possible recipes using the saved settings, even when a dish has a custom name.
**Options** includes language and Light/Dark/Device theme settings as well as
backup controls. The header language picker and quick theme toggle remain available.
Export all inventories and dishes as a
JSON backup, or import additional copies without replacing existing entries.
Backups support transferring data to another browser or the desktop app. Personal
data stays on your device and is not sent to a server.

## Offline use and installation

Visit the website online, open **About → Offline & installation**, and wait for
**Ready to use offline** before disconnecting. This downloads the complete guide,
including every language and image. Recipes, search, shared fragment links,
inventories, cookbook entries and preferences then work without a connection.
External wiki and game links still need internet.

On Android Chrome, use the browser menu's **Add to Home screen / Install app**;
on Android Firefox use **Install**. In Safari on iPhone or iPad, choose
**Share → Add to Home Screen**. Installation options vary by browser. Installing
an icon alone does not guarantee that the offline download has finished.

A complete new build downloads in the background. **Update guide and reload**
appears in the header when it is ready. Finish editing before choosing it. Close
other guide tabs or installed-app windows first; they are never forcibly reloaded.
Closing all guide windows also lets a waiting update take over on the next visit.
An interrupted download leaves the previous offline guide available.

**Request persistent storage** asks the browser to protect saved data and offline
files from automatic eviction. It may decline. You can still clear site data, so
keep JSON backups from **Options**. Different origins, including the main site
and GitHub Pages, have separate saved data and offline copies. The desktop app
already includes the guide and does not show browser installation controls.
