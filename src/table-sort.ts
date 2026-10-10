export type SortRow = { name?: string; basename?: string; raw?: unknown };
/** A union row may have columns that occur on only one of its variants. */
export type TableSortKey<T> = Extract<T extends unknown ? keyof T : never, string>;

export function compareItemNames(a: SortRow, b: SortRow): number {
	const left = a.basename || a.name || '';
	const right = b.basename || b.name || '';
	if (left !== right) {
		return left > right ? 1 : -1;
	}
	// Raw forms precede cooked siblings; names consistently order other variants.
	const preparationOrder = Number(Boolean(a.raw)) - Number(Boolean(b.raw));
	if (preparationOrder !== 0) {
		return preparationOrder;
	}
	const leftName = a.name || '';
	const rightName = b.name || '';
	return leftName === rightName ? 0 : leftName > rightName ? 1 : -1;
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
