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
	{ summaryRows = 0, invert = false }: { summaryRows?: number; invert?: boolean } = {},
): void {
	const summary = dataset.splice(0, summaryRows);
	if (sortBy === 'name') {
		dataset.sort(compareItemNames);
	} else {
		dataset.sort((a, b) => {
			// The column key is checked against T; absent union fields become NaN.
			const left = Number(Reflect.get(a, sortBy));
			const right = Number(Reflect.get(b, sortBy));
			if (Number.isNaN(left)) {
				return Number.isNaN(right) ? 0 : 1;
			}
			if (Number.isNaN(right)) {
				return -1;
			}
			return right - left;
		});
	}
	if (invert) {
		dataset.reverse();
	}
	dataset.unshift(...summary);
}
