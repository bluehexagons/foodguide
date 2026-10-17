# Localization

The guide bundles English, Spanish (`es`), Simplified Chinese (`zh`), Russian
(`ru`), and Brazilian Portuguese (`pt-BR`). UI copy lives in `src/strings.ts` and
`src/locales/{es,zh,ru,pt-BR}.ts`. Display names live in the sibling `*-names.ts`
dictionaries, keyed by the guide's canonical English name. Every food, recipe,
character in the favorite-food table, and game selector has a name entry. Proper
names can remain identical across languages.

Use `itemName(item)` or `localizedName(englishName)` for display. These helpers
leave `name`, `lowerName`, prefab IDs, collection keys, image paths, wiki URLs,
and saved data unchanged. Static HTML names use `data-i18n-name="Wilson"`;
`applyTranslations()` handles this attribute alongside the UI string attributes.
Custom locales can provide a partial `names` dictionary with English fallback.
User-authored inventory and dish names are shown as saved.

Search accepts the active language, canonical English, and prefab IDs. Accented
name searches, including Spanish and Portuguese, ignore accents; Chinese names
support substring searches. The
`recipe:` and `ingredient:` prefixes accept translated names, while `tag:` values
and link payloads retain their internal identifiers. Tag-search examples must use
accepted identifiers such as `meat` and `veggie`, even in translated placeholders.
Name sorts use the active language, keeping preparation families together in Auto
mode. Existing analysis snapshots retain their ordering and pages when the language
changes; choosing a name sort or refreshing the snapshot applies the current
language's ordering. Browser language detection checks the preferred languages
in order and matches regional codes without case sensitivity, including `pt-BR`.
It falls back from `ru-RU` to `ru` and from a generic Portuguese preference to the
available `pt-BR` locale. A saved choice takes precedence. Russian day labels use
the language's plural forms; Portuguese day labels distinguish `dia` and `dias`.
Numeric interpolation parameters use the active locale's decimal separator and
omit digit grouping to keep compact controls readable. String parameters,
canonical data values, identifiers, and search syntax are unchanged.

## Game name sources

Names were extracted on 2026-10-17 from `STRINGS.NAMES.*` entries in these
snapshots of the game-script translation catalogs:

- Don't Starve Together: [game scripts at
  `0dea2f76e0321ecc6c9faa8e1e5bdd80a5fc1b64`](https://github.com/taichunmin/dont-starve-together-game-scripts/tree/0dea2f76e0321ecc6c9faa8e1e5bdd80a5fc1b64/languages)
  (snapshot committed 2024-09-09), `spanish.po`, `chinese_s.po`, `russian.po`, and
  `portuguese_br.po`.
- Don't Starve, including Shipwrecked and Hamlet: [game scripts at
  `a4e5cb267f7ec0bb6c740d2b1bba391881eeb4d7`](https://github.com/taichunmin/dont-starve-game-scripts/tree/a4e5cb267f7ec0bb6c740d2b1bba391881eeb4d7/languages)
  (snapshot committed 2019-07-28), `spanish.po`, `chinese_s.po`, `russian.po`, and
  `portuguese_br.po`.

These are public third-party mirrors of game files, rather than Klei-hosted
downloads or a verification against a current local game installation. The
publisher's [Steam listing](https://store.steampowered.com/app/322330/Dont_Starve_Together/)
confirms Spanish, Chinese, and Russian language support. The Portuguese source
is specifically `portuguese_br.po`, rather than the Portugal locale listed on
Steam. Keep the snapshot distinction
when describing the names' provenance; the guide is unofficial and these older
catalogs can differ from current game builds.

The Spanish baseline is `spanish.po` (Spain), consistent with the guide's existing
Spanish locale. `spanish_mex.po` was also examined and had less name coverage in
these snapshots. Shared names prefer the Together catalog, falling back to the
single-player catalog for DLC content. Preserve the catalog's spelling, including
unusual names, rather than silently replacing it with a new translation. Document
any correction to a demonstrably incorrect catalog entry, as with Fish below.

Resolve names by prefab ID first, then by the catalog's English `msgid` where the
guide uses an alias. Strip the guide-only `_dst` suffix from recipe IDs, including
`pumpkincookie_dst`, `asparagussoup_dst`, `lobsterbisque_dst`, and
`lobsterdinner_dst`. Matching by ID also handles wording differences such as
Red Cap / Red Mushroom, Fish Meat / Raw Fish, and Wobster / Lobster. The static
favorite-food aliases Cave Banana, Cooked Cave Banana, and Pomegranates use the
Banana, Cooked Banana, and Pomegranate translations.

Character labels also use `STRINGS.CHARACTER_NAMES.*` where needed. The localized
Shipwrecked labels in Russian and Portuguese come from the single-player catalog's
game-selection UI. Warly's mode-specific labels retain their `(DST)` and
`(Shipwrecked)` suffixes for clarity.

Keep item references in guide prose and recipe notes consistent with those names.
The same Together snapshot supplies `DUSTMOTH` (Spanish Polvolilla) and `HEATROCK`
(Chinese 暖石) for terms used in the guide.

## Guide translations and remaining review

The final block in each names module separates guide translations from extracted
catalog names. Game/version labels use game UI translations where available,
guide translations, or unchanged product names. The following food and recipe
names had no populated entry in either
Spanish snapshot and use editorial Spanish translations:

`radish`, `radish_cooked`, `aloe`, `aloe_cooked`, `jellybug`, `jellybug_cooked`,
`cutnettle`, `snake_bone`, `piko_orange`, `slugbug`, `slugbug_cooked`,
`weevole_carapace`, `clippings`, `lotus_flower`, `lotus_flower_cooked`,
`venus_stalk`, `nectar_pod`, `teatree_nut`, `teatree_nut_cooked`, `tuber_crop`,
`tuber_crop_cooked`, `tuber_bloom_crop`, `tuber_bloom_crop_cooked`, `waterdrop`,
`bramble_bulb`, `froglegs_poison`, `froglegs_poison_cooked`, `meated_nettle`,
`nettlelosange`, `snakebonesoup`, `tea`, `icedtea`, `spicyvegstinger`, `feijoada`,
`steamedhamsandwich`, `hardshell_tacos`, and `gummy_cake`.

Russian and Brazilian Portuguese use guide translations for the same 37 Hamlet
food and recipe names listed above. The populated Bunnyman personal-name entry
for Radish is not treated as a verified food-name translation. Both languages
also override `STRINGS.NAMES.FISH`: these snapshots use the verb “to fish”
(`Рыбачить` / `Pescar`) as the food label. The guide uses the nouns `Рыба` and
`Peixe`, marked as guide translations. Other catalog spellings are retained.

Chinese uses an editorial translation for `meated_nettle` (Meated Nettles).
These exceptions are not claimed as official game translations. Replace them
when a verified game catalog becomes available. The original Spanish/Chinese UI
pass was generated by Anthropic Claude Opus; the additional guide translations
were generated and reviewed with OpenAI Codex and Luna assistance. Native-speaking
players' review remains welcome, particularly for the editorial Hamlet names.

## Updating translations

Prefer catalogs from an installed game or a pinned, inspectable game-script
snapshot. Read each PO record's `msgctxt`, `msgid`, and nonempty `msgstr`, including
continued quoted lines. Match `STRINGS.NAMES.<PREFAB>` against food/recipe IDs and
check mismatched English names before accepting a mapping. Only copy the names
used by this guide; do not bundle entire game catalogs or download them at runtime.
Update the source revision and exception list along with the dictionaries.

Run `npm run check:ci` and the Chromium/Firefox browser suites described in
[development.md](development.md). The localized-name tests require every current
entry to be covered and verify English data stability, translated searches,
requirement link identities, and sorting. Browser coverage includes live locale
changes, the cookbook, reference links, and favorite foods.

Register every one-off food or recipe note in `strings.notes` and every recipe
requirement tag in `strings.tags`, then translate it in each bundled locale.
Coverage tests check the data entries as well as the dictionaries, so adding a
raw note or tag cannot silently bypass translation. Prefer existing parameterized
notes for shared effects. The Warly heating and cooling foods use the signed
temperature bonuses and five-minute duration from the same Together snapshot's
[`preparedfoods_warly.lua`](https://github.com/taichunmin/dont-starve-together-game-scripts/blob/0dea2f76e0321ecc6c9faa8e1e5bdd80a5fc1b64/preparedfoods_warly.lua)
and
[`tuning.lua`](https://github.com/taichunmin/dont-starve-together-game-scripts/blob/0dea2f76e0321ecc6c9faa8e1e5bdd80a5fc1b64/tuning.lua).
