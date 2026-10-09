import type { GuideItem, Stat, StatMultipliers, ModifyItem } from './models.js';
const statValue = (
	item: GuideItem,
	stat: Stat,
	statMultipliers: StatMultipliers,
	modifyItem: ModifyItem,
	modeMask: number,
) => {
	const modifiers = modifyItem(item, modeMask);
	const value = modifiers[stat] ?? item[stat] ?? 0;
	return value * (statMultipliers[item.preparationType] ?? 1);
};

/**
 * Returns a separately sorted ingredient list for the picker controls.
 *
 * Character-specific stat modifiers are applied so the picker order matches
 * the values shown in food tables.
 */
export const sortIngredients = <T extends GuideItem>(
	items: T[],
	sortType: string,
	{
		statMultipliers,
		modifyItem,
		modeMask,
	}: { statMultipliers: StatMultipliers; modifyItem: ModifyItem; modeMask: number },
) => {
	const sorted = [...items];
	const byName = (a: T, b: T) => a.name.localeCompare(b.name);

	switch (sortType) {
		case 'health':
		case 'hunger':
		case 'sanity':
			return sorted.sort(
				(a, b) =>
					statValue(b, sortType, statMultipliers, modifyItem, modeMask) -
						statValue(a, sortType, statMultipliers, modifyItem, modeMask) ||
					byName(a, b),
			);
		case 'perish':
			return sorted.sort(
				(a, b) => (a.perish || 999999) - (b.perish || 999999) || byName(a, b),
			);
		case 'name':
			return sorted.sort(byName);
		default:
			return sorted;
	}
};
