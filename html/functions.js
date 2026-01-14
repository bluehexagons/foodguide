import { food } from './food.js';

const ANDTest = function (cooker, names, tags) {
	return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags);
};
const ORTest = function (cooker, names, tags) {
	return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags);
};
const NAMETest = function (_cooker, names, _tags) {
	return (names[this.name] || 0) + (names[`${this.name}_cooked`] || 0);
};
const NOTTest = function (cooker, names, tags) {
	return !this.item.test(cooker, names, tags);
};
const SPECIFICTest = function (_cooker, names, _tags) {
	return names[this.name];
};
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
 * @type {Object.<string, function(number): boolean>}
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
 * @type {Object}
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
 * Creates comparison requirement
 * @param {string} op - Comparison operator (=, >, <, >=, <=)
 * @param {number} qty - Quantity to compare against
 * @returns {Object} Comparison requirement object
 */
export const COMPARE = (op, qty) => {
	return { op, qty, test: COMPARISONS[op], toString: COMPAREString };
};

/**
 * Creates AND requirement between two items
 * @param {Object} item1 - First requirement
 * @param {Object} item2 - Second requirement
 * @returns {Object} AND requirement object
 */
export const AND = (item1, item2) => {
	return { item1, item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel };
};
export const OR = (item1, item2) => {
	return { item1, item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel };
};
export const NOT = item => {
	return { item, test: NOTTest, toString: NOTString, cancel: true };
};
export const NAME = (name, qty) => {
	return { name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString };
}; //permits cooked variant
export const SPECIFIC = (name, qty) => {
	return { name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString };
}; //disallows cooked/uncooked variant
export const TAG = (tag, qty) => {
	return { tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString };
};
