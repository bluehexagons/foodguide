import {food} from './food.js';

//note: qty not used yet, this is for rapid summation
export var COMPAREString = function () { return this.op + this.qty; },
	COMPARISONS = {
		'=': function (qty) { return qty === this.qty; },
		'>': function (qty) { return qty > this.qty; },
		'<': function (qty) { return qty < this.qty; },
		'>=': function (qty) { return qty >= this.qty; },
		'<=': function (qty) { return qty <= this.qty; }
	},
	NOQTY = {test: function (qty) { return !!qty; }, toString: function () { return ''; }},
	COMPARE = function (op, qty) { return {op: op, qty: qty, test: COMPARISONS[op], toString: COMPAREString}; },
	ANDTest = function (cooker, names, tags) { return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags); },
	ANDString = function () { return this.item1 + ' and ' + this.item2; },
	AND = function (item1, item2) { return {item1: item1, item2: item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel}; },
	ORTest = function (cooker, names, tags) { return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags); },
	ORString = function () { return this.item1 + ' or ' + this.item2; },
	OR = function (item1, item2) { return {item1: item1, item2: item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel}; },
	NOTTest = function (cooker, names, tags) { return !this.item.test(cooker, names, tags); },
	NOTString = function () { return this.item.toString().substring(0, this.item.toString().length - 1) + '|strike]'; },
	NOT = function (item) { return {item: item, test: NOTTest, toString: NOTString, cancel: true}; },
	NAMETest = function (cooker, names, tags) { return (names[this.name] || 0) + (names[this.name + '_cooked'] || 0); },
	NAMEString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (food[this.name].cook ? '[*' + food[this.name].cook.name + '|' + food[this.name].cook.img + ']' : '') + (food[this.name].raw ? '[*' + food[this.name].raw.name + '|' + food[this.name].raw.img + ']' : '') + (this.qty ? this.qty : ''); },
	NAME = function (name, qty) { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }, //permits cooked variant
	SPECIFICTest = function (cooker, names, tags) { return names[this.name]; },
	SPECIFICString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (this.qty ? this.qty : ''); },
	SPECIFIC = function (name, qty) { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }, //disallows cooked/uncooked variant
	TAGTest = function (cooker, names, tags) { return tags[this.tag]; },
	TAGString = function () { return '[tag:' + this.tag + '|' + this.tag + ']' + (this.qty ? this.qty : ''); },
	TAG = function (tag, qty) { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; }
