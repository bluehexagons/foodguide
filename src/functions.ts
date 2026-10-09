import { food } from './food.js';
import { tagLabel } from './strings.js';
import type { IngredientNames, IngredientTags, Requirement, Quantity } from './models.js';
export type { IngredientNames, IngredientTags, Requirement } from './models.js';

export interface CompareQty extends Quantity {
	op: ComparisonOperator;
	qty: number;
}
export type NoQty = Quantity;
export type ComparisonOperator = '=' | '>' | '<' | '>=' | '<=';

const ANDTest = function (
	this: { item1: Requirement; item2: Requirement },
	cooker: unknown,
	names: IngredientNames,
	tags: IngredientTags,
) {
	return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags);
};
const ORTest = function (
	this: { item1: Requirement; item2: Requirement },
	cooker: unknown,
	names: IngredientNames,
	tags: IngredientTags,
) {
	return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags);
};
const NAMETest = function (
	this: { name: string },
	_cooker: unknown,
	names: IngredientNames,
	_tags: IngredientTags,
) {
	return (names[this.name] || 0) + (names[`${this.name}_cooked`] || 0);
};
const NOTTest = function (
	this: { item: Requirement },
	cooker: unknown,
	names: IngredientNames,
	tags: IngredientTags,
) {
	return !this.item.test(cooker, names, tags);
};
const SPECIFICTest = function (
	this: { name: string },
	_cooker: unknown,
	names: IngredientNames,
	_tags: IngredientTags,
) {
	return names[this.name];
};
const TAGTest = function (
	this: { tag: string },
	_cooker: unknown,
	_names: IngredientNames,
	tags: IngredientTags,
) {
	return tags[this.tag];
};
const ANDString = function (this: { item1: Requirement; item2: Requirement }) {
	return `${this.item1} and ${this.item2}`;
};
const ORString = function (this: { item1: Requirement; item2: Requirement }) {
	return `${this.item1} or ${this.item2}`;
};
const COMPAREString = function (this: CompareQty) {
	return this.op + this.qty;
};
const NAMEString = function (this: { name: string; qty?: Quantity }) {
	const item = food[this.name];
	return `[*${item.name}|${item.img} ${item.name}]${item.cook ? `[*${item.cook.name}|${item.cook.img}]` : ''}${item.raw ? `[*${item.raw.name}|${item.raw.img}]` : ''}${this.qty ? this.qty : ''}`;
};
const NOTString = function (this: { item: Requirement }) {
	return `${this.item.toString().substring(0, this.item.toString().length - 1)}|strike]`;
};
const SPECIFICString = function (this: { name: string; qty?: Quantity }) {
	const item = food[this.name];
	return `[*${item.name}|${item.img} ${item.name}]${this.qty ? this.qty : ''}`;
};
const TAGString = function (this: { tag: string; qty?: Quantity }) {
	return `[tag:${this.tag}|${tagLabel(this.tag)}]${this.qty ? this.qty : ''}`;
};

export const COMPARISONS: Record<ComparisonOperator, (this: CompareQty, qty: number) => boolean> = {
	'='(qty) {
		return qty === this.qty;
	},
	'>'(qty) {
		return qty > this.qty;
	},
	'<'(qty) {
		return qty < this.qty;
	},
	'>='(qty) {
		return qty >= this.qty;
	},
	'<='(qty) {
		return qty <= this.qty;
	},
};
export const NOQTY: NoQty = { test: qty => !!qty, toString: () => '' };
export const COMPARE = (op: ComparisonOperator, qty: number): CompareQty => ({
	op,
	qty,
	test: COMPARISONS[op],
	toString: COMPAREString,
});
export const AND = (item1: Requirement, item2: Requirement): Requirement => ({
	item1,
	item2,
	test: ANDTest,
	toString: ANDString,
	cancel: item1.cancel && item2.cancel,
});
export const OR = (item1: Requirement, item2: Requirement): Requirement => ({
	item1,
	item2,
	test: ORTest,
	toString: ORString,
	cancel: item1.cancel || item2.cancel,
});
export const NOT = (item: Requirement): Requirement => ({
	item,
	test: NOTTest,
	toString: NOTString,
	cancel: true,
});
/** NAME includes the cooked variant; quantity objects describe UI requirements. */
export const NAME = (name: string, qty?: Quantity): Requirement => ({
	name,
	qty: qty || NOQTY,
	test: NAMETest,
	toString: NAMEString,
});
export const SPECIFIC = (name: string, qty?: Quantity): Requirement => ({
	name,
	qty: qty || NOQTY,
	test: SPECIFICTest,
	toString: SPECIFICString,
});
export const TAG = (tag: string, qty?: Quantity): Requirement => ({
	tag,
	qty: qty || NOQTY,
	test: TAGTest,
	toString: TAGString,
});
