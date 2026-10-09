import type { Collection } from './models.js';

/** Attach array operations without changing keyed lookups or object identity. */
export function initializeCollection<T extends { lowerName: string }>(
	items: Record<string, T>,
): Collection<T> {
	const values = Object.values(items);
	// The only assertion is at the boundary where helper properties are attached.
	const collection = items as Collection<T>;
	values.forEach((item, index) => {
		collection[index] = item;
	});
	collection.length = values.length;
	collection.forEach = function (callback, thisArg) {
		Array.prototype.forEach.call(this, (item: T, index: number) =>
			callback.call(thisArg, item, index, this),
		);
	};
	collection.filter = function (predicate, thisArg) {
		return Array.prototype.filter.call(this, (item: T, index: number) =>
			predicate.call(thisArg, item, index, this),
		);
	};
	collection.sort = function (compare) {
		Array.prototype.sort.call(this, compare);
		return this;
	};
	collection.byName = function (name: string) {
		let i = this.length;
		while (i--) {
			if (this[i].lowerName === name) {
				return this[i];
			}
		}
	};
	return collection;
}
