import type { GuideItem } from './models.js';
import type { StringKey } from './strings.js';

const typeGroups = [
	['monster', 'ingredientGroupMonster'],
	['fish', 'ingredientGroupFish'],
	['meat', 'ingredientGroupMeat'],
	['egg', 'ingredientGroupEgg'],
	['veggie', 'ingredientGroupVegetables'],
	['fruit', 'ingredientGroupFruit'],
	['sweetener', 'ingredientGroupSweeteners'],
	['dairy', 'ingredientGroupDairy'],
	['frozen', 'ingredientGroupFrozen'],
	['inedible', 'ingredientGroupInedible'],
] as const satisfies readonly (readonly [string, StringKey])[];
const preparationLabels = {
	raw: 'ingredientGroupRaw',
	cooked: 'ingredientGroupCooked',
	dried: 'ingredientGroupDried',
	recipe: 'ingredientGroupRecipes',
} as const satisfies Record<string, StringKey>;
const typeOrder = [
	'meat',
	'fish',
	'veggie',
	'fruit',
	'egg',
	'sweetener',
	'dairy',
	'frozen',
	'monster',
	'inedible',
	'other',
];

export interface IngredientGroup<T> {
	key: string;
	label?: StringKey;
	items: T[];
}

/** Each ingredient belongs to one group; preserve the chosen sort within it. */
export function groupIngredients<T extends GuideItem>(
	items: T[],
	groupBy: string,
	relevanceOrder = false,
): IngredientGroup<T>[] {
	if (groupBy !== 'type' && groupBy !== 'preparation') {
		return [{ key: 'all', items }];
	}
	const groups = new Map<string, IngredientGroup<T>>();
	for (const item of items) {
		const [key, label] =
			groupBy === 'preparation'
				? [item.preparationType, preparationLabels[item.preparationType]]
				: (typeGroups.find(([tag]) => Number(Reflect.get(item, tag)) > 0) ?? [
						'other',
						'ingredientGroupOther',
					]);
		let group = groups.get(key);
		if (!group) {
			group = { key, label, items: [] };
			groups.set(key, group);
		}
		group.items.push(item);
	}
	const result = [...groups.values()];
	if (!relevanceOrder) {
		const order = groupBy === 'type' ? typeOrder : Object.keys(preparationLabels);
		result.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
	}
	return result;
}
