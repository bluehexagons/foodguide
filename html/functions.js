import {food} from './food.js';

//note: qty not used yet, this is for rapid summation

export const COMPARISONS = {
	'=': qty => { return qty === this.qty; },
	'>': qty => { return qty > this.qty; },
	'<': qty => { return qty < this.qty; },
	'>=': qty => { return qty >= this.qty; },
	'<=': qty => { return qty <= this.qty; }
};

export const NOQTY = {test: qty => { return !!qty; }, toString: () => { return ''; }};

export const COMPARE = (op, qty) => { return {op: op, qty: qty, test: COMPARISONS[op], toString: COMPAREString}; };

export const COMPAREString = () => { return this.op + this.qty; };

export const ANDTest = (cooker, names, tags) => { return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags); };

export const ANDString = () => { return this.item1 + ' and ' + this.item2; };

export const AND = (item1, item2) => { return {item1: item1, item2: item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel}; };

export const ORTest = (cooker, names, tags) => { return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags); };

export const ORString = () => { return this.item1 + ' or ' + this.item2; };

export const OR = (item1, item2) => { return {item1: item1, item2: item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel}; };

export const NOTTest = (cooker, names, tags) => { return !this.item.test(cooker, names, tags); };

export const NOTString = () => { return this.item.toString().substring(0, this.item.toString().length - 1) + '|strike]'; };

export const NOT = item => { return {item: item, test: NOTTest, toString: NOTString, cancel: true}; };

export const NAMETest = (_cooker, names, _tags) => { return (names[this.name] || 0) + (names[this.name + '_cooked'] || 0); };

export const NAMEString = () => { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (food[this.name].cook ? '[*' + food[this.name].cook.name + '|' + food[this.name].cook.img + ']' : '') + (food[this.name].raw ? '[*' + food[this.name].raw.name + '|' + food[this.name].raw.img + ']' : '') + (this.qty ? this.qty : ''); };

export const NAME = (name, qty) => { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }; //permits cooked variant

export const SPECIFICTest = (_cooker, names, _tags) => { return names[this.name]; };

export const SPECIFICString = () => { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (this.qty ? this.qty : ''); };

export const SPECIFIC = (name, qty) => { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }; //disallows cooked/uncooked variant

export const TAGTest = (_cooker, _names, tags) => { return tags[this.tag]; };

export const TAGString = () => { return '[tag:' + this.tag + '|' + this.tag + ']' + (this.qty ? this.qty : ''); };

export const TAG = (tag, qty) => { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; };
