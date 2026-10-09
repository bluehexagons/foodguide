import type { Food, FoodCollection } from './models.js';
import { getCollectionItem } from './collection.js';
import { matchesMode } from './mode-utils.js';

/** Resolve saved and selected ingredients to a variant available in the active game. */
export function createFoodSelectionResolver(foods: FoodCollection) {
	const variants = new Map<string, Food[]>();
	for (const item of Array.from(foods)) {
		const group = variants.get(item.id) ?? [];
		group.push(item);
		variants.set(item.id, group);
	}
	return (key: string, modeMask: number, charMask: number): Food | undefined => {
		let item = getCollectionItem<Food>(foods, key);
		if (!item && key.endsWith('_dst')) {
			const baseId = key.slice(0, -4);
			item =
				getCollectionItem<Food>(foods, `${baseId}@together`) ||
				getCollectionItem<Food>(foods, baseId);
		}
		if (!item) {
			return;
		}
		const available = (variant: Food) =>
			matchesMode(variant.modeMask, modeMask, variant.charMask, charMask);
		return available(item) ? item : variants.get(item.id)?.find(available);
	};
}
