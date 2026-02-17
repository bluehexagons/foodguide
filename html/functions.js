import { food } from './food.js';

/**
 * @typedef {Object} IngredientNames
 * @property {number} [key] - Count of each ingredient by id
 */

/**
 * @typedef {Record<string, number>} IngredientTags
 */

/**
 * @typedef {(cooker: any, names: IngredientNames, tags: IngredientTags) => any} RequirementTestFn
 */

/**
 * @typedef {Object} Requirement
 * @property {RequirementTestFn} test
 * @property {() => string} toString
 * @property {boolean} [cancel]
 * @property {string} [name]
 * @property {string} [tag]
 * @property {CompareQty | NoQty} [qty]
 * @property {Requirement} [item]
 * @property {Requirement} [item1]
 * @property {Requirement} [item2]
 */

/**
 * @typedef {Object} CompareQty
 * @property {string} op
 * @property {number} qty
 * @property {(qty: number) => boolean} test
 * @property {() => string} toString
 */

/**
 * @typedef {Object} NoQty
 * @property {(qty: number) => boolean} test
 * @property {() => string} toString
 */

/** @this {{ item1: Requirement, item2: Requirement }} */
const ANDTest = function (cooker, names, tags) {
	return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags);
};
/** @this {{ item1: Requirement, item2: Requirement }} */
const ORTest = function (cooker, names, tags) {
	return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags);
};
/** @this {{ name: string }} */
const NAMETest = function (_cooker, names, _tags) {
	return (names[this.name] || 0) + (names[`${this.name}_cooked`] || 0);
};
/** @this {{ item: Requirement }} */
const NOTTest = function (cooker, names, tags) {
	return !this.item.test(cooker, names, tags);
};
/** @this {{ name: string }} */
const SPECIFICTest = function (_cooker, names, _tags) {
	return names[this.name];
};
/** @this {{ tag: string }} */
const TAGTest = function (_cooker, _names, tags) {
	return tags[this.tag];
};

const ANDString = function () {
	return `${this.item1} and ${this.item2}`;
};
const COMPAREString = function () {
	return this.op + this.qty;
};
const ORString = function () {
	return `${this.item1} or ${this.item2}`;
};
const NAMEString = function () {
	return `[*${food[this.name].name}|${food[this.name].img} ${food[this.name].name}]${food[this.name].cook ? `[*${food[this.name].cook.name}|${food[this.name].cook.img}]` : ''}${food[this.name].raw ? `[*${food[this.name].raw.name}|${food[this.name].raw.img}]` : ''}${this.qty ? this.qty : ''}`;
};
const NOTString = function () {
	return `${this.item.toString().substring(0, this.item.toString().length - 1)}|strike]`;
};
const SPECIFICString = function () {
	return `[*${food[this.name].name}|${food[this.name].img} ${food[this.name].name}]${this.qty ? this.qty : ''}`;
};
const TAGString = function () {
	return `[tag:${this.tag}|${this.tag}]${this.qty ? this.qty : ''}`;
};

/**
 * Comparison operators for recipe requirements
 * @type {Record<string, (this: CompareQty, qty: number) => boolean>}
 */
export const COMPARISONS = {
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

/**
 * Default quantity checker - returns true if quantity exists
 * @type {NoQty}
 */
export const NOQTY = {
	test: qty => {
		return !!qty;
	},
	toString: () => {
		return '';
	},
};

/**
 * Creates comparison quantity object
 * @param {string} op - Comparison operator (=, >, <, >=, <=)
 * @param {number} qty - Quantity to compare against
 * @returns {CompareQty}
 */
export const COMPARE = (op, qty) => {
	return { op, qty, test: COMPARISONS[op], toString: COMPAREString };
};

/**
 * Creates AND requirement between two items
 * @param {Requirement} item1
 * @param {Requirement} item2
 * @returns {Requirement}
 */
export const AND = (item1, item2) => {
	return { item1, item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel };
};

/**
 * Creates OR requirement between two items
 * @param {Requirement} item1
 * @param {Requirement} item2
 * @returns {Requirement}
 */
export const OR = (item1, item2) => {
	return { item1, item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel };
};

/**
 * Creates NOT requirement (cancels matching)
 * @param {Requirement} item
 * @returns {Requirement}
 */
export const NOT = item => {
	return { item, test: NOTTest, toString: NOTString, cancel: true };
};

/**
 * Creates NAME requirement (permits cooked variant)
 * @param {string} name - Ingredient id
 * @param {CompareQty | NoQty} [qty]
 * @returns {Requirement}
 */
export const NAME = (name, qty) => {
	return { name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString };
};

/**
 * Creates SPECIFIC requirement (disallows cooked/uncooked variant)
 * @param {string} name - Ingredient id
 * @param {CompareQty | NoQty} [qty]
 * @returns {Requirement}
 */
export const SPECIFIC = (name, qty) => {
	return { name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString };
};

/**
 * Creates TAG requirement
 * @param {string} tag - Tag name
 * @param {CompareQty | NoQty} [qty]
 * @returns {Requirement}
 */
export const TAG = (tag, qty) => {
	return { tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString };
};
