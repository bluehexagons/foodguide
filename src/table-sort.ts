import { localizedName, getLocale } from './strings.js';
export type SortRow = { name?: string; basename?: string; raw?: unknown };
/** A union row may have columns that occur on only one of its variants. */
export type TableSortKey<T> = Extract<T extends unknown ? keyof T : never, string>;

let collatorLocale: string;
let collator: Intl.Collator;

/** Custom locale tags may not be recognized by Intl; retain usable name sorting. */
export function compareLocalizedNames(left: string, right: string): number {
	const locale = getLocale();
	if (collatorLocale !== locale) {
		try {
			collator = new Intl.Collator(locale);
		} catch {
			collator = new Intl.Collator('en');
		}
		collatorLocale = locale;
	}
	return collator.compare(left, right);
}

const localizedSortName = (name: string) => {
	const suffix = name.match(/\.+$/)?.[0] || '';
	return localizedName(suffix ? name.slice(0, -suffix.length) : name) + suffix;
};

export function compareItemNames(a: SortRow, b: SortRow): number {
	const left = localizedSortName(a.basename || a.name || '');
	const right = localizedSortName(b.basename || b.name || '');
	if (left !== right) {
		return getLocale() === 'en' ? (left > right ? 1 : -1) : compareLocalizedNames(left, right);
	}
	// Raw forms precede cooked siblings; names consistently order other variants.
	const preparationOrder = Number(Boolean(a.raw)) - Number(Boolean(b.raw));
	if (preparationOrder !== 0) {
		return preparationOrder;
	}
	const leftName = localizedName(a.name || '');
	const rightName = localizedName(b.name || '');
	return leftName === rightName
		? 0
		: getLocale() === 'en'
			? leftName > rightName
				? 1
				: -1
			: compareLocalizedNames(leftName, rightName);
}

/** Sort the shared dataset in place, keeping summary rows above the results. */
export function sortTableRows<T extends SortRow>(
	dataset: T[],
	sortBy: TableSortKey<T>,
	{
		summaryRows = 0,
		invert = false,
		numericValue,
	}: {
		summaryRows?: number;
		invert?: boolean;
		numericValue?: (item: T, key: TableSortKey<T>) => number | undefined;
	} = {},
): void {
	const summary = dataset.splice(0, summaryRows);
	const direction = invert ? -1 : 1;
	if (sortBy === 'name') {
		dataset.sort((a, b) => direction * compareItemNames(a, b));
	} else {
		dataset.sort((a, b) => {
			// The column key is checked against T; absent union fields become NaN.
			const left = Number(numericValue ? numericValue(a, sortBy) : Reflect.get(a, sortBy));
			const right = Number(numericValue ? numericValue(b, sortBy) : Reflect.get(b, sortBy));
			if (Number.isNaN(left)) {
				return Number.isNaN(right) ? 0 : 1;
			}
			if (Number.isNaN(right)) {
				return -1;
			}
			return direction * (right - left);
		});
	}
	dataset.unshift(...summary);
}
