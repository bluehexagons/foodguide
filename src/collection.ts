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

/** Resolve saved or DOM-provided keys without exposing indexes or helper properties. */
export function getCollectionItem<T extends { lowerName: string; key: string }>(
	collection: Collection<T>,
	key: string,
): T | undefined {
	const item = collection[key];
	return Object.hasOwn(collection, key) &&
		typeof item === 'object' &&
		item !== null &&
		item.key === key
		? item
		: undefined;
}
