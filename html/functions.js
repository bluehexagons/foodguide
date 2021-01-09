import {food} from './food.js';

const ANDTest = function (cooker, names, tags) { return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags); };
const ORTest = function (cooker, names, tags) { return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags); };
const NAMETest = function (_cooker, names, _tags) { return (names[this.name] || 0) + (names[this.name + '_cooked'] || 0); };
const NOTTest = function (cooker, names, tags) { return !this.item.test(cooker, names, tags); };
const SPECIFICTest = function (_cooker, names, _tags) { return names[this.name]; };
const TAGTest = function (_cooker, _names, tags) { return tags[this.tag]; };

const ANDString = function () { return this.item1 + ' and ' + this.item2; };
const COMPAREString = function () { return this.op + this.qty; };
const ORString = function () { return this.item1 + ' or ' + this.item2; };
const NAMEString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (food[this.name].cook ? '[*' + food[this.name].cook.name + '|' + food[this.name].cook.img + ']' : '') + (food[this.name].raw ? '[*' + food[this.name].raw.name + '|' + food[this.name].raw.img + ']' : '') + (this.qty ? this.qty : ''); };
const NOTString = function () { return this.item.toString().substring(0, this.item.toString().length - 1) + '|strike]'; };
const SPECIFICString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (this.qty ? this.qty : ''); };
const TAGString = function () { return '[tag:' + this.tag + '|' + this.tag + ']' + (this.qty ? this.qty : ''); };

//note: qty not used yet, this is for rapid summation
export const COMPARISONS = {
	'=':  function (qty) { return qty === this.qty; },
	'>':  function (qty) { return qty > this.qty; },
	'<':  function (qty) { return qty < this.qty; },
	'>=': function (qty) { return qty >= this.qty; },
	'<=': function (qty) { return qty <= this.qty; }
};

export const NOQTY = {test: qty => { return !!qty; }, toString: () => { return ''; }};

export const COMPARE = (op, qty) => { return {op: op, qty: qty, test: COMPARISONS[op], toString: COMPAREString}; };
export const AND = (item1, item2) => { return {item1: item1, item2: item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel}; };
export const OR = (item1, item2) => { return {item1: item1, item2: item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel}; };
export const NOT = item => { return {item: item, test: NOTTest, toString: NOTString, cancel: true}; };
export const NAME = (name, qty) => { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }; //permits cooked variant
export const SPECIFIC = (name, qty) => { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }; //disallows cooked/uncooked variant
export const TAG = (tag, qty) => { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; };

