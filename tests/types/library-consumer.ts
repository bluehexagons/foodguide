import { food, recipes, NAME, COMPARE, matchesMode, TOGETHER, t } from 'foodguide';
import type { Food, Recipe, Requirement, LocaleDict } from 'foodguide';
import { food as standaloneFood } from 'foodguide/food';
import { updateFoodRecipes } from 'foodguide/recipes';
import { accumulateIngredients } from 'foodguide/utils';
import { defaultStatMultipliers } from 'foodguide/constants';
import { registerLocale } from 'foodguide/strings';
import 'foodguide/locales/es';

const foods: Food[] = food.filter(item => matchesMode(item.modeMask, TOGETHER, item.charMask));
const dishes: Recipe[] = recipes.filter(recipe => recipe.priority > 0);
const cooked: Food | undefined = standaloneFood.carrot.cook;
const lookup: Recipe | undefined = recipes.byName('meatballs');
const requirement: Requirement = NAME('carrot', COMPARE('>=', 1));
const dict: LocaleDict = { themeToggleTitle: 'Theme', tags: { meat: 'meat' } };
registerLocale('test', 'Test', dict);
updateFoodRecipes(dishes);
accumulateIngredients([food.carrot, null], {}, {}, defaultStatMultipliers);
food.forEach((item, index, collection) => {
	const sibling: Food = collection[index];
	void sibling;
	void item;
});
recipes.sort((a, b) => b.priority - a.priority);
t('foundValidRecipes', { count: foods.length });
void cooked;
void lookup;
void requirement;

// The public declarations must reject invalid recipes, links, and translations.
// @ts-expect-error Comparison operators are a closed set.
COMPARE('approximately', 1);
// @ts-expect-error Preparation links are Food objects, not authored string IDs.
food.carrot.cook = 'carrot_cooked';
// @ts-expect-error Recipe priority is numeric.
recipes.meatballs.priority = 'high';
// @ts-expect-error Translation keys are checked against the English dictionary.
t('missingTranslationKey');
// @ts-expect-error Lookup results can be missing.
const missing: Recipe = recipes.byName('missing');
void missing;
