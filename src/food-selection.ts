import type { Food, FoodCollection } from './models.js';
import { getCollectionItem } from './collection.js';
import { matchesMode } from './mode-utils.js';

/** Normalize historical IDs without filtering out ingredients from other games. */
export function getSavedFood(foods: FoodCollection, key: string): Food | undefined {
	const item = getCollectionItem<Food>(foods, key);
	if (item || !key.endsWith('_dst')) {
		return item;
	}
	const baseId = key.slice(0, -4);
	return (
		getCollectionItem<Food>(foods, `${baseId}@together`) ||
		getCollectionItem<Food>(foods, baseId)
	);
}

/** Resolve saved and selected ingredients to a variant available in the active game. */
export function createFoodSelectionResolver(foods: FoodCollection) {
	const variants = new Map<string, Food[]>();
	for (const item of Array.from(foods)) {
		const group = variants.get(item.id) ?? [];
		group.push(item);
		variants.set(item.id, group);
	}
	return (key: string, modeMask: number, charMask: number): Food | undefined => {
		const item = getSavedFood(foods, key);
		if (!item) {
			return;
		}
		const available = (variant: Food) =>
			matchesMode(variant.modeMask, modeMask, variant.charMask, charMask);
		return available(item) ? item : variants.get(item.id)?.find(available);
	};
}
