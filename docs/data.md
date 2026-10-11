# Data and library usage

The package entry point (`foodguide`) exports the initialized food and recipe
collections, constants, recipe predicates, mode helpers, and translation helpers.
These modules have no runtime npm dependencies. The npm package contains the
library modules; the full website and artwork are available from the repository.

## Entry points

| Import                 | Contents                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `foodguide`            | Initialized collections, constants, predicates, mode helpers, and bundled locales. |
| `foodguide/food`       | Keyed food records and preparation cross-references.                               |
| `foodguide/recipes`    | Recipe records, collection initialization, and `updateFoodRecipes`.                |
| `foodguide/constants`  | Game units, mode flags, character definitions, and multipliers.                    |
| `foodguide/functions`  | Recipe requirement builders such as `AND`, `OR`, `NAME`, and `TAG`.                |
| `foodguide/mode-utils` | Mode masks, character applicability, and stat modifier helpers.                    |
| `foodguide/strings`    | Translation registration, selection, and formatting.                               |
| `foodguide/locales`    | Registration of bundled Spanish and Chinese dictionaries.                          |
| `foodguide/utils`      | Ingredient accumulation and DOM helpers such as `makeImage`.                       |

DOM helpers need a browser document when called. `foodguide/strings` alone does
not register bundled locales; import `foodguide/locales` or the main entry point
to register them.

## Collections and records

Use `food.carrot` or `recipes.meatballs` for keyed lookups. Both collections have numeric indexes, `length`,
`forEach`, `filter`, `sort`, and `byName`. They are array-like objects rather than
iterable arrays: use `Array.from(food)` when an ordinary array is needed.
`Object.values(food)` also includes indexes and helper properties after
initialization, so it is unsuitable for enumerating foods without duplicates.

The package includes generated declarations and `types` export conditions.
TypeScript consumers can import `Food`, `Recipe`, `Requirement`, and collection
types from the main entry point. Authored definitions keep preparation IDs, while
initialized records expose references to other `Food` objects.

The package marks recipe initialization and locale registration as side effects.
Preserve that metadata when bundling the library.

`byName` expects an exact lowercase display name. A food's `key` identifies its
record, while `id` identifies the ingredient counted by recipe predicates.
Mode variants such as `butterflywings@together` share their base ingredient `id`.

| Fields                                    | Meaning                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `name`, `key`, `id`, `img`                | Display name, record lookup key, ingredient/recipe identifier, and relative icon path. |
| `health`, `hunger`, `sanity`              | Base stat changes; apply mode and character modifiers separately.                      |
| `perish`                                  | Spoilage time in game seconds; divide by `total_day_time` for days.                    |
| `meat`, `veggie`, `fruit`, `egg`, etc.    | Numeric ingredient tag contributions, including fractional values.                     |
| `modeMask`, `charMask`                    | Initialized game/DLC and character availability flags.                                 |
| `preparationType`                         | Preparation category used to select stat multipliers.                                  |
| `cook`, `raw`, `dry`, `wet`               | References to related food records when available.                                     |
| Recipe `test`, `requirements`, `priority` | Matching predicate, displayed requirement builders, and priority.                      |
| Recipe `cooktime`                         | Multiplier of `base_cook_time`, rather than a time in seconds.                         |

Records and cross-references are shared mutable objects, and preparation links may
form cycles. Avoid serializing the collections directly as JSON or changing them
globally when you only need a filtered view. In browsers, some presentation fields
contain DOM fragments; in Node, link markup remains text.

When several foods share a cooked output, author its canonical `raw` ID explicitly.
For example, Freshwater Fish and Fish Morsel both cook into Cooked Fish Morsel,
whose reverse link points to Fish Morsel. This keeps raw inputs in the correct
preparation category. The [Fish Morsel data](https://dontstarve.wiki.gg/wiki/Fish_Morsel/DST)
also lists the cooked form's six-day spoilage time.

## Filter by game and character

```js
import { food, recipes, TOGETHER, matchesMode } from 'foodguide';

const availableFood = food.filter(item => matchesMode(item.modeMask, TOGETHER, item.charMask, 0));
const availableRecipes = recipes.filter(recipe =>
	matchesMode(recipe.modeMask, TOGETHER, recipe.charMask, 0),
);
```

A character mask of `0` includes ordinary recipes and excludes character-only
recipes. Use `calculateModeMask` and `calculateCharMask` for combinations of game
version, DLCs, and character; `getActiveMultipliers` and
`getCharacterFoodModifiers` supply the corresponding stat changes.

Recipe `test(cooker, names, tags)` evaluates accumulated ingredient identities and
tag totals. The UI passes `null` as the cooker. When several recipes match, the
highest priority wins; equal-priority recipes may produce multiple outcomes.
`updateFoodRecipes(availableRecipes)` rebuilds localized presentation links and
per-food recipe suggestions; it mutates the shared food records.
