import {food} from './food.js';

//note: qty not used yet, this is for rapid summation
export var COMPAREString = () => { return this.op + this.qty; },
	COMPARISONS = {
		'=': qty => { return qty === this.qty; },
		'>': qty => { return qty > this.qty; },
		'<': qty => { return qty < this.qty; },
		'>=': qty => { return qty >= this.qty; },
		'<=': qty => { return qty <= this.qty; }
	},
	NOQTY = {test: qty => { return !!qty; }, toString: () => { return ''; }},
	COMPARE = (op, qty) => { return {op: op, qty: qty, test: COMPARISONS[op], toString: COMPAREString}; },
	ANDTest = (cooker, names, tags) => { return this.item1.test(cooker, names, tags) && this.item2.test(cooker, names, tags); },
	ANDString = () => { return this.item1 + ' and ' + this.item2; },
	AND = (item1, item2) => { return {item1: item1, item2: item2, test: ANDTest, toString: ANDString, cancel: item1.cancel && item2.cancel}; },
	ORTest = (cooker, names, tags) => { return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags); },
	ORString = () => { return this.item1 + ' or ' + this.item2; },
	OR = (item1, item2) => { return {item1: item1, item2: item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel}; },
	NOTTest = (cooker, names, tags) => { return !this.item.test(cooker, names, tags); },
	NOTString = () => { return this.item.toString().substring(0, this.item.toString().length - 1) + '|strike]'; },
	NOT = item => { return {item: item, test: NOTTest, toString: NOTString, cancel: true}; },
	NAMETest = (cooker, names, tags) => { return (names[this.name] || 0) + (names[this.name + '_cooked'] || 0); },
	NAMEString = () => { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (food[this.name].cook ? '[*' + food[this.name].cook.name + '|' + food[this.name].cook.img + ']' : '') + (food[this.name].raw ? '[*' + food[this.name].raw.name + '|' + food[this.name].raw.img + ']' : '') + (this.qty ? this.qty : ''); },
	NAME = (name, qty) => { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }, //permits cooked variant
	SPECIFICTest = (cooker, names, tags) => { return names[this.name]; },
	SPECIFICString = () => { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (this.qty ? this.qty : ''); },
	SPECIFIC = (name, qty) => { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }, //disallows cooked/uncooked variant
	TAGTest = (cooker, names, tags) => { return tags[this.tag]; },
	TAGString = () => { return '[tag:' + this.tag + '|' + this.tag + ']' + (this.qty ? this.qty : ''); },
	TAG = (tag, qty) => { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; }
