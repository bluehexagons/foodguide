/*
Makes use of no third-party code (for better or worse)

Copyright (c) 2013

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function () {
	'use strict';
	var calories_per_day = 75,
		total_day_time = 60 * 8,
		seg_time = total_day_time / 16,
		day_time = 10 * total_day_time / 16,
		dusk_time = 2 * total_day_time / 16,
		night_time = total_day_time - day_time - dusk_time,
		base_cook_time = night_time * 0.3333,
		perish_warp = 1,
		stack_size_largeitem = 10,
		stack_size_meditem = 20,
		stack_size_smallitem = 40,

		healing_tiny = 1,
		healing_small = 5,
		healing_medsmall = 10,
		healing_med = 25,
		healing_medlarge = 35,
		healing_large = 50,
		healing_huge = 75,
		healing_superhuge = 100,
		
		sanity_tiny = 5,
		sanity_small = 10,
		sanity_med = 15,
		sanity_medlarge = 20,
		sanity_large = 33,
		sanity_huge = 50,
		
		perish_superfast = 3*total_day_time*perish_warp,
		perish_fast = 6*total_day_time*perish_warp,
		perish_med = 12*total_day_time*perish_warp,
		perish_slow = 18*total_day_time*perish_warp,
		perish_preserved = 24*total_day_time*perish_warp,
		perish_superslow = 40*total_day_time*perish_warp,

		calories_tiny = calories_per_day/8, //berries
		calories_small = calories_per_day/6, //veggies
		calories_med = calories_per_day/3, //meat
		calories_large = calories_per_day/2, //cooked meat
		calories_huge = calories_per_day, //crockpot foods?
		calories_superhuge = calories_per_day*2, //crockpot foods?

		spoiled_health = -1,
		spoiled_hunger = -10,
		Strings = {
			'butter': 'Butter',
			'butterflywings': 'Butterfly Wings',
			'fish': 'Fish'
		},
		food = {
			butter: {
				name: Strings.butter,
				fat: 1,
				dairy: 1,
				health: healing_large,
				hunger: calories_med,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			butterflywings: {
				name: Strings.butterflywings,
				isveggie: true,
				decoration: 2,
				health: healing_med,
				hunger: calories_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			fish: {
				name: Strings.fish,
				ismeat: true,
				meat: 0.5,
				fish: 1,
				health: healing_med,
				hunger: calories_small,
				perish: perish_superfast,
				stack: stack_size_smallitem
			},
			fish_cooked: {
				name: 'Cooked Fish',
				ismeat: true,
				meat: 0.5,
				fish: 1,
				health: healing_large,
				hunger: calories_small,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			froglegs: {
				name: 'Frog Legs',
				ismeat: true,
				meat: 0.5,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_fast,
				sanity: -sanity_small,
				stack: stack_size_smallitem
			},
			froglegs_cooked: {
				name: 'Cooked Frog Legs',
				ismeat: true,
				meat: 0.5,
				health: healing_small,
				hunger: calories_small,
				perish: perish_med,
				sanity: -sanity_small,
				stack: stack_size_smallitem
			},
			honey: {
				name: 'Honey',
				sweetener: true,
				health: healing_medsmall,
				hunger: calories_small,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			honeycomb: {
				name: 'Honeycomb',
				inedible: true,
				sweetener: true
			},
			mandrake: {
				name: 'Mandrake',
				veggie: 1,
				magic: 1,
				health: healing_huge,
				hunger: calories_huge,
				stack: stack_size_smallitem
			},
			mandrake_cooked: {
				name: 'Cooked Mandrake',
				uncookable: true,
				veggie: 1,
				magic: 1,
				health: healing_superhuge,
				hunger: calories_superhuge,
				stack: stack_size_smallitem
			},
			monstermeat: {
				name: 'Monster Meat',
				ismeat: true,
				meat: 1,
				monster: true,
				health: -healing_med,
				hunger: calories_med,
				sanity: -sanity_med,
				perish: perish_med,
				stack: stack_size_meditem
			},
			monstermeat_cooked: {
				name: 'Cooked Monster Meat',
				ismeat: true,
				meat: 1,
				monster: true,
				health: -healing_small,
				hunger: calories_med,
				sanity: -sanity_med,
				perish: perish_slow,
				stack: stack_size_meditem
			},
			meat: {
				name: 'Meat',
				ismeat: true,
				meat: 1,
				health: healing_med,
				hunger: calories_med,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			meat_cooked: {
				name: 'Cooked Meat',
				ismeat: true,
				meat: 1,
				health: healing_medlarge,
				hunger: calories_large,
				sanity: sanity_tiny,
				perish: perish_med,
				stack: stack_size_meditem
			},
			morsel: {
				name: 'Morsel',
				ismeat: true,
				meat: 0.5,
				health: healing_small,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			morsel_cooked: {
				name: 'Cooked Morsel',
				ismeat: true,
				meat: 0.5,
				health: healing_med,
				hunger: calories_small,
				perish: perish_med,
				sanity: sanity_tiny,
				stack: stack_size_smallitem
			},
			drumstick: {
				name: 'Drumstick',
				ismeat: true,
				meat: 0.5,
				health: healing_tiny,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			drumstick_cooked: {
				name: 'Fried Drumstick',
				ismeat: true,
				meat: 0.5,
				health: healing_small,
				hunger: calories_small,
				perish: perish_med,
				stack: stack_size_meditem
			},
			petals: {
				name: 'Petals',
				uncookable: true,
				health: healing_tiny,
				hunger: 0,
				sanity: -sanity_tiny / 2,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			seeds: {
				name: 'Seeds',
				uncookable: true,
				health: healing_tiny,
				hunger: calories_tiny / 2,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			seeds_cooked: {
				name: 'Toasted Seeds',
				uncookable: true,
				health: healing_small,
				hunger: calories_tiny / 2,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			spoiled_food: {
				name: 'Rot',
				uncookable: true,
				health: spoiled_health,
				hunger: spoiled_hunger,
				stack: stack_size_smallitem
			},
			tallbirdegg: {
				name: 'Tallbird Egg',
				egg: 4,
				health: healing_small,
				hunger: calories_med
			},
			tallbirdegg_cooked: {
				name: 'Fried Tallbird Egg',
				egg: 4,
				health: 0,
				hunger: calories_large,
				perish: perish_fast
			},
			trunk_summer: {
				name: 'Koalefant Trunk',
				uncookable: true,
				ismeat: true,
				health: healing_medlarge,
				hunger: calories_large,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			trunk_summer_cooked: {
				name: 'Koalefant Trunk Steak',
				uncookable: true,
				ismeat: true,
				health: healing_large,
				hunger: calories_huge,
				perish: perish_slow,
				stack: stack_size_meditem
			},
			twigs: {
				name: 'Twigs',
				inedible: 1
			},
			carrot: {
				name: 'Carrot',
				isveggie: true,
				veggie: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			carrot_cooked: {
				name: 'Roasted Carrot',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_med,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			corn: {
				name: 'Corn',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_med,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			corn_cooked: {
				name: 'Popcorn',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_small,
				perish: perish_slow,
				stack: stack_size_smallitem
			},
			pumpkin: {
				name: 'Pumpkin',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_large,
				perish: perish_med,
				stack: stack_size_meditem
			},
			pumpkin_cooked: {
				name: 'Hot Pumpkin',
				isveggie: true,
				veggie: 1,
				health: healing_med,
				hunger: calories_large,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			eggplant: {
				name: 'Eggplant',
				isveggie: true,
				veggie: 1,
				health: healing_med,
				hunger: calories_med,
				perish: perish_med,
				stack: stack_size_meditem
			},
			eggplant_cooked: {
				name: 'Braised Eggplant',
				isveggie: true,
				veggie: 1,
				health: healing_large,
				hunger: calories_med,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			durian: {
				name: 'Durian',
				isfruit: true,
				monster: 1,
				fruit: 1,
				health: -healing_small,
				hunger: calories_med,
				perish: perish_med,
				stack: stack_size_meditem
			},
			durian_cooked: {
				name: 'Extra Smelly Durian',
				isfruit: true,
				monster: 1,
				fruit: 1,
				health: 0,
				hunger: calories_med,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			pomegranate: {
				name: 'Pomegranate',
				isfruit: true,
				fruit: 1,
				health: healing_med,
				hunger: calories_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			pomegranate_cooked: {
				name: 'Sliced Pomegranate',
				isfruit: true,
				fruit: 1,
				health: healing_huge,
				hunger: calories_small,
				perish: perish_superfast,
				stack: stack_size_smallitem
			},
			dragonfruit: {
				name: 'Dragon Fruit',
				isfruit: true,
				fruit: 1,
				health: healing_med,
				hunger: calories_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			dragonfruit_cooked: {
				name: 'Prepared Dragon Fruit',
				isfruit: true,
				fruit: 1,
				health: healing_huge,
				hunger: calories_small,
				perish: perish_superfast,
				stack: stack_size_smallitem
			},
			berries: {
				name: 'Berries',
				isfruit: true,
				fruit: 0.5,
				health: healing_tiny,
				hunger: calories_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			berries_cooked: {
				name: 'Roasted Berries',
				isfruit: true,
				fruit: 0.5,
				health: healing_small,
				hunger: calories_small,
				perish: perish_superfast,
				stack: stack_size_smallitem
			}
		},
		//note: qty not used yet, this is for rapid summation
		COMPAREString = function () { return this.op + this.qty; },
		COMPARISONS = {
			'=': function (qty) { return qty === this.qty; },
			'>': function (qty) { return qty > this.qty; },
			'<': function (qty) { return qty < this.qty; },
			'>=': function (qty) { return qty >= this.qty; },
			'<=': function (qty) { return qty <= this.qty; }
		},
		NOQTY = {test: function (qty) { return !!qty; }, toString: function () { return ''; }},
		COMPARE = function (op, qty) { return {op: op, qty: qty, test: COMPARISONS[op], toString: COMPAREString}; },
		ORTest = function (cooker, names, tags) { return this.item1.test(cooker, names, tags) || this.item2.test(cooker, names, tags); },
		ORString = function () { return this.item1 + ' or ' + this.item2; },
		OR = function (item1, item2) { return {item1: item1, item2: item2, test: ORTest, toString: ORString, cancel: item1.cancel || item2.cancel}; },
		NOTTest = function (cooker, names, tags) { return !this.item.test(cooker, names, tags); },
		NOTString = function () { return 'not ' + this.item; },
		NOT = function (item) { return {item: item, test: NOTTest, toString: NOTString, cancel: true}; },
		NAMETest = function (cooker, names, tags) { return (names[this.name] || 0) + (names[this.name + '_cooked'] || 0); },
		NAMEString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (food[this.name].cook ? '[*' + food[this.name].cook.name + '|' + food[this.name].cook.img + ']' : '') + (food[this.name].raw ? '[*' + food[this.name].raw.name + '|' + food[this.name].raw.img + ']' : '') + (this.qty ? this.qty : ''); },
		NAME = function (name, qty) { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }, //permits cooked variant
		SPECIFICTest = function (cooker, names, tags) { return names[this.name]; },
		SPECIFICString = function () { return '[*' + food[this.name].name + '|' + food[this.name].img + ' ' + food[this.name].name + ']' + (this.qty ? this.qty : ''); },
		SPECIFIC = function (name, qty) { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }, //disallows cooked/uncooked variant
		TAGTest = function (cooker, names, tags) { return tags[this.tag]; },
		TAGString = function () { return '[tag:' + this.tag + '|' + this.tag + ']' + (this.qty ? this.qty : ''); },
		TAG = function (tag, qty) { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; },
		recipes = {
			butterflymuffin: {
				name: 'Butter Muffin',
				test: function(cooker, names, tags) {
					return names.butterflywings && !tags.meat && tags.veggie;
				},
				requires: 'Butterfly Wings, veggie',
				requirements: [NAME('butterflywings'), NOT(TAG('meat')), TAG('veggie')],
				priority: 1,
				weight: 1,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			frogglebunwich: {
				name: 'Froggle Bunwich',
				test: function(cooker, names, tags) {
					return (names.froglegs || names.froglegs_cooked) && tags.veggie;
				},
				requirements: [NAME('froglegs'), TAG('veggie')],
				priority: 1,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			taffy: {
				name: "Taffy",
				test: function(cooker, names, tags) {
					return tags.sweetener && tags.sweetener >= 3 && !tags.meat;
				},
				requirements: [TAG('sweetener', COMPARE('>=', 3), NOT(TAG('meat')))],
				priority: 10,
				foodtype: "veggie",
				health: -healing_small,
				hunger: calories_small * 2,
				perishtime: perish_slow,
				sanity: sanity_large,
				cooktime: 2
			},
			pumpkincookie: {
				name: "Pumpkin Cookie",
				test: function(cooker, names, tags) {
					return (names.pumpkin || names.pumpkin_cooked) && tags.sweetener && tags.sweetener >= 2;
				},
				requirements: [NAME('pumpkin'), TAG('sweetener', COMPARE('>=', 2))],
				priority: 10,
				foodtype: "veggie",
				health: 0,
				hunger: calories_large,
				perishtime: perish_med,
				sanity: sanity_large,
				cooktime: 2
			},
			stuffedeggplant: {
				name: 'Stuffed Eggplant',
				test: function(cooker, names, tags) {
					return (names.eggplant || names.eggplant_cooked) && tags.veggie && tags.veggie > 1;
				},
				requirements: [NAME('eggplant'), TAG('veggie', COMPARE('>', 1))],
				priority: 1,
				foodtype: "veggie",
				health: healing_small,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			fishsticks: {
				name: 'Fishsticks',
				test: function(cooker, names, tags) {
					return tags.fish && names.twigs;
				},
				requirements: [TAG('fish'), SPECIFIC('twigs')],
				priority: 10,
				foodtype: "meat",
				health: healing_large,
				hunger: calories_large,
				perish: perish_med,
				sanity: sanity_med,
				cooktime: 2
			},
			honeynuggets: {
				name: 'Honey Nuggets',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat <= 1.5;
				},
				requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('<=', 1.5))],
				priority: 2,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			honeyham: {
				name: 'Honey Ham',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat > 1.5;
				},
				requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('>', 1.5))],
				priority: 2,
				foodtype: "meat",
				health: healing_huge,
				hunger: calories_huge,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			dragonpie: {
				name: 'Dragonpie',
				test: function(cooker, names, tags) {
					return (names.dragonfruit || names.dragonfruit_cooked) && !tags.meat;
				},
				requirements: [NAME('dragonfruit'), NOT(TAG('meat'))],
				priority: 1,
				foodtype: "veggie",
				health: healing_huge,
				hunger: calories_huge,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			kabobs: {
				name: 'Kabobs',
				test: function(cooker, names, tags) {
					return tags.meat && names.twigs;
				},
				requirements: [TAG('meat'), SPECIFIC('twigs')],
				priority: 5,
				foodtype: "meat",
				health: healing_small,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2
			},
			mandrakesoup: {
				name: 'Mandrake Soup',
				test: function(cooker, names, tags) {
					return names.mandrake;
				},
				requirements: [SPECIFIC('mandrake')],
				priority: 10,
				foodtype: "veggie",
				health: healing_superhuge,
				hunger: calories_superhuge,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 3
			},
			baconeggs: {
				name: 'Bacon and Eggs',
				test: function(cooker, names, tags) {
					return tags.egg && tags.egg > 1 && tags.meat && tags.meat > 1 && !tags.veggie;
				},
				requirements: [TAG('egg', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), NOT(TAG('veggie'))],
				priority: 10,
				foodtype: "meat",
				health: healing_huge,
				hunger: calories_huge,
				perish: perish_preserved,
				sanity: sanity_med,
				cooktime: 2
			},
			meatballs: {
				name: 'Meatballs',
				test: function(cooker, names, tags) {
					return tags.meat;
				},
				requirements: [TAG('meat')],
				priority: -1,
				foodtype: "meat",
				health: healing_small * 5,
				hunger: calories_small * 5,
				perish: perish_med,
				sanity: sanity_med,
				cooktime: 0.75
			},
			bonestew: {
				name: 'Meaty Stew',
				test: function(cooker, names, tags) {
					return tags.meat && tags.meat >= 3;
				},
				requirements: [TAG('meat', COMPARE('>=', 3))],
				priority: 0,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large * 4,
				perish: perish_med,
				sanity: sanity_med,
				cooktime: 0.75
			},
			perogies: {
				name: 'Pierogi',
				test: function(cooker, names, tags) {
					return tags.egg && tags.meat && tags.veggie;
				},
				requirements: [TAG('egg'), TAG('meat'), TAG('veggie')],
				priority: 5,
				foodtype: "meat",
				health: healing_large,
				hunger: calories_large,
				perish: perish_preserved,
				sanity: sanity_med,
				cooktime: 1
			},
			turkeydinner: {
				name: 'Turkey Dinner',
				test: function(cooker, names, tags) {
					return names.drumstick && names.drumstick > 1 && tags.meat && tags.meat > 1 && (tags.veggie || tags.fruit);
				},
				requirements: [SPECIFIC('drumstick', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), OR(TAG('veggie'), TAG('fruit'))],
				priority: 10,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_huge,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 3
			},
			ratatouille: {
				name: 'Ratatouille',
				test: function(cooker, names, tags) {
					return !tags.meat && tags.veggie;
				},
				requirements: [NOT(TAG('meat')), TAG('veggie')],
				priority: 0,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_med,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 1
			},
			jammypreserves: {
				name: 'Fist Full of Jam',
				test: function(cooker, names, tags) {
					return tags.fruit && !tags.meat && !tags.veggie;
				},
				requirements: [TAG('fruit'), NOT(TAG('meat')), NOT(TAG('veggie'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_small * 3,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 0.5
			},
			fruitmedley: {
				name: 'Fruit Medley',
				test: function(cooker, names, tags) {
					return tags.fruit && tags.fruit >= 3 && !tags.meat && !tags.veggie;
				},
				requirements: [TAG('fruit', COMPARE('>=', 3)), NOT(TAG('meat')), NOT(TAG('veggie'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_huge,
				hunger: calories_med,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 0.5
			},
			fishtacos: {
				name: 'Fish Tacos',
				test: function(cooker, names, tags) {
					return tags.fish && (names.corn || names.corn_cooked);
				},
				requirements: [TAG('fish'), NAME('corn')],
				priority: 10,
				foodtype: "meat",
				health: healing_huge,
				hunger: calories_large,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 0.5
			},
			waffles: {
				name: 'Waffles',
				test: function(cooker, names, tags) {
					return names.butter && (names.berries || names.berries_cooked) && tags.egg;
				},
				requirements: [SPECIFIC('butter'), NAME('berries'), TAG('egg')],
				priority: 10,
				foodtype: "veggie",
				health: healing_huge,
				hunger: calories_large,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 0.5
			},
			monsterlasagna: {
				name: 'Monster Lasagna',
				test: function(cooker, names, tags) {
					return tags.monster && tags.monster >= 2;
				},
				requirements: [TAG('monster', COMPARE('>=', 2))],
				priority: 10,
				foodtype: "meat",
				health: -healing_tiny,
				hunger: calories_large,
				perish: perish_med,
				sanity: -sanity_medlarge,
				cooktime: 0.5
			},
			wetgoop: {
				name: 'Wet Goop',
				test: function(cooker, names, tags) {
					return true;
				},
				requirements: [],
				priority: -2,
				health: 0,
				hunger: 0,
				perish: perish_fast,
				sanity: sanity_med,
				cooktime: 0.25
			}
		},
		matchingNames = (function () {
			var name,
				tag,
				tagsearch = /^tag[: ]/,
				tagsplit = /^tag:? */,
				recipe,
				recipesearch = /^recipe[: ]/,
				recipesplit = /^recipe:? */,
				ingredient,
				ingredientsearch = /^ingredient[: ]/,
				ingredientsplit = /^ingredient:? */,
				anywhere,
				wordstarts,
				filter = function (element) {
					if (element.uncookable) {
						element.match = 0;
					} else if (element.lowerName.indexOf(name) === 0 || (element.raw && element.raw.lowerName.indexOf(name) === 0)) {
						element.match = 3;
					} else if (wordstarts.test(element.lowerName) === 0) {
						element.match = 2;
					} else if (anywhere.test(element.lowerName)) {
						element.match = 1;
					} else {
						element.match = 0;
					}
					return element.match;
				},
				tagFilter = function (element) {
					return element.match = element[tag] + 0 || 0;
				},
				recipeFilter = function (element) {
					var i = 0, result, failed = true;
					while (i < recipe.length) {
						result = recipe[i].test(null, element.nameObject, element);
						if (recipe[i].cancel) {
							if (!result) {
								failed = true;
								break;
							}
						} else {
							if (result) {
								failed = false;
							}
						}
						i++;
					}
					return element.match = failed ? 0 : 1;
				},
				ingredientFilter = function (recipe) {
					var i = 0, result, failed = true;
					while (i < recipe.requirements.length) {
						result = recipe.requirements[i].test(null, ingredient.nameObject, ingredient);
						if (recipe.requirements[i].cancel) {
							if (!result) {
								failed = true;
								break;
							}
						} else {
							if (result) {
								failed = false;
							}
						}
						i++;
					}
					return recipe.match = failed ? 0 : 1;
				},
				exact = function (element) {
					return element.match = (element.lowerName === name) ? 1 : 0;
				},
				like = function (element) {
					return element.match = (element.lowerName === name || (element.raw && element.raw.lowerName === name) || (element.cook && element.cook.lowerName === name)) ? 1 : 0;
				},
				byMatch = function (a, b) {
					var aname, bname;
					if (a.match === b.match) {
						aname = a.raw ? a.raw.name : a.name;
						bname = b.raw ? b.raw.name : b.name;
						if (aname !== bname) {
							return aname > bname ? 1 : aname < bname ? -1 : 0;
						}
						return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
					}
					return b.match - a.match;
				};
			return function (arr, search) {
				name = search.toLowerCase();
				if (tagsearch.test(name)) {
					tag = name.split(tagsplit)[1];
					return arr.filter(tagFilter).sort(byMatch);
				} else if (recipesearch.test(name)) {
					recipe = recipes.byName(name.split(recipesplit)[1].toLowerCase());
					if (recipe) {
						recipe = recipe.requirements;
						return arr.filter(recipeFilter).sort(byMatch);
					} else {
						return [];
					}
				} else if (ingredientsearch.test(name)) {
					ingredient = food.byName(name.split(ingredientsplit)[1].toLowerCase());
					if (ingredient) {
						return arr.filter(ingredientFilter).sort(byMatch);
					} else {
						return [];
					}
				} else if (name.indexOf('*') === 0) {
					name = name.substring(1);
					return arr.filter(exact).sort(byMatch);
				} else if (name.indexOf('~') === 0) {
					name = name.substring(1);
					return arr.filter(like).sort(byMatch);
				} else {
					wordstarts = new RegExp('\\b' + name + '.*');
					anywhere = new RegExp('\\b' + name.split('').join('.*') + '.*');
					return arr.filter(filter).sort(byMatch);
				}
			};
		}()),
		getSuggestions = (function () {
			var names,
				tags,
				setIngredientValues = function (items) {
					var i, k, item;
					names = {};
					tags = {};
					for (i = 0; i < items.length; i++) {
						item = items[i];
						if (item !== null) {
							names[item.id] = 1 + (names[item.id] || 0);
							for (k in item) {
								if (item.hasOwnProperty(k) && k !== 'perish') {
									tags[k] = item[k] + (tags[k] || 0);
								} else if (k === 'perish') {
									tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
								}
							}
						}
					}
				};
			return function (recipeList, items, exclude, itemComplete) {
				var i, ii, valid;
				recipeList.length = 0;
				setIngredientValues(items);
				for (i = 0; i < recipes.length; i++) {
					valid = false;
					for (ii = 0; ii < recipes[i].requirements.length; ii++) {
						if (recipes[i].requirements[ii].test(null, names, tags)) {
							if (!recipes[i].requirements[ii].cancel) {
								valid = true;
							}
						} else if (!itemComplete && recipes[i].requirements[ii].cancel) {
							valid = false;
							break;
						} else if (itemComplete && !recipes[i].requirements[ii].cancel) {
							valid = false;
							break;
						}
					}
					valid && (!exclude || exclude.indexOf(recipes[i]) === -1) && recipeList.push(recipes[i]);
				}
				tags.img = '';
				tags.name = 'Combined';
				return recipeList;
			};
		}()),
		getRecipes = (function () {
			var recipeList = [],
				names,
				tags,
				setIngredientValues = function (items) {
					var i, k, item;
					names = {};
					tags = {};
					for (i = 0; i < items.length; i++) {
						item = items[i];
						if (item !== null) {
							names[item.id] = 1 + (names[item.id] || 0);
							for (k in item) {
								if (item.hasOwnProperty(k) && k !== 'perish') {
									tags[k] = item[k] + (tags[k] || 0);
								} else if (k === 'perish') {
									tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
								}
							}
						}
					}
				};
			return function (items) {
				var i;
				recipeList.length = 0;
				setIngredientValues(items);
				for (i = 0; i < recipes.length; i++) {
					recipes[i].test(null, names, tags) && recipeList.push(recipes[i]);
				}
				recipeList.sort(function (a, b) {
					return b.priority - a.priority;
				});
				tags.img = '';
				tags.name = 'Combined';
				recipeList.unshift(tags);
				return recipeList;
			};
		}()),
		makeImage = (function () {
			var canvas = document.createElement('canvas'),
				ctx = canvas.getContext && canvas.toDataURL && canvas.getContext('2d'),
				canvas32 = document.createElement('canvas'),
				ctx32 = canvas32.getContext && canvas32.getContext('2d'),
				images = {},
				images32 = {},
				canvasSupported = !!ctx,
				requests = [],
				cacheImage = function (url) {
					var renderToCache = function (url, imageElement) {
						ctx.clearRect(0, 0, 64, 64);
						ctx.drawImage(imageElement, 0, 0, 64, 64);
						ctx32.clearRect(0, 0, 32, 32);
						ctx32.drawImage(imageElement, 0, 0, 32, 32);
						try {
							images[url] = canvas.toDataURL();
							images32[url] = canvas32.toDataURL();
						} catch (ex) {
							canvasSupported = false;
						}
						requests.filter(function (request) { return request.url === url; }).forEach(function (request) {
							if (request.url === url) {
								delete request.img.dataset.pending;
								if (noDataset) {
									request.img.removeAttribute('data-pending');
								}
								if (request.d === 32) {
									request.img.src = images32[url] || url;
								} else {
									request.img.src = images[url] || url;
								}
							}
						});
						requests = requests.filter(function (request) { return request.url !== url; });
					};
					return function (e) {
						renderToCache(url, e.target);
					}
				},
				queue = function (img, url, d) {
					img.dataset.pending = url;
					if (noDataset) {
						img.setAttribute('data-pending', url);
					}
					requests.push({url: url, img: img, d: d});
				},
				makeImage = function (url, d) {
					var img = new Image(), dummy, listener;
					if (canvasSupported) {
						if (images[url]) {
							//image is cached
							if (d === 32) {
								img.src = images32[url];
							} else {
								img.src = images[url];
							}
						} else if (images[url] === null) {
							//image is waiting to be loaded
							queue(img, url, d);
						} else {
							//image has not been cached
							images[url] = null;
							dummy = new Image();
							dummy.addEventListener('load', cacheImage(url), false);
							dummy.src = url;
							queue(img, url, d);
						}
					} else {
						//if we can't cache the images with canvas, just do it normally
						img.src = url;
					}
					return img;
				};
			canvas.width = 64;
			canvas.height = 64;
			canvas32.width = 32;
			canvas32.height = 32;
			makeImage.queue = queue;
			return makeImage;
		}()),
		makeLinkable = (function () {
			var linkSearch = /\[([^\|]*)\|([^\|]*)\]/;
			return function (str) {
				var results = str && str.split(linkSearch),
					fragment, i, span, image;
				if (!results || results.length === 1) {
					return str;
				} else {
					fragment = document.createDocumentFragment();
					fragment.appendChild(document.createTextNode(results[0]));
					for (i = 1; i < results.length; i += 3) {
						if (results[i] === '' && results[i + 1] === '') {
							fragment.appendChild(document.createElement('br'));
						} else {
							span = document.createElement('span');
							span.className = 'link';
							span.dataset.link = results[i];
							if (noDataset) {
								span.setAttribute('data-link', results[i]);
							}
							if (results[i + 1] && results[i + 1].indexOf('img/') === 0) {
								span.appendChild(document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')));
								span.appendChild(makeImage(results[i + 1].split(' ')[0], 32));
							} else {
								span.appendChild(document.createTextNode(results[i + 1] ? results[i + 1] : results[i]));
							}
							fragment.appendChild(span);
						}
						fragment.appendChild(document.createTextNode(results[i + 2]));
					}
					return fragment;
				}
			};
		}()),
		i,
		index = 0,
		mainElement = document.getElementById('main'),
		foodElement = document.getElementById('food'),
		recipesElement = document.getElementById('recipes'),
		fragment, navbar = document.getElementById('navbar'),
		noDataset = false;

	if (!document.documentElement.dataset) {
		noDataset = true;
		Object.defineProperty(Element.prototype, 'dataset', {
			get: function () {
				if (!this.ds) {
					this.ds = {};
					Array.prototype.forEach.call(this.attributes, function (item) {
						if (item.name.indexOf('data-') === 0) {
							this.ds[item.name.substring(5)] = item.value;
						}
					}, this);
				}
				return this.ds;
			}
		});
	}
	//var info = [];
	var info,
		taggify = function (tag, name) { return '[tag:' + tag + '|' + (name || tag) + ']'; };
	for (i in food) {
		if (food.hasOwnProperty(i)) {
			var f = food[i];
			f.match = 0;
			f.lowerName = f.name.toLowerCase();
			f.id = i;
			f.nameObject = {};
			f.nameObject[i] = 1;
			f.img = 'img/' + f.name.replace(/ /g, '_').toLowerCase() + '.png';
			if (i.indexOf('_cooked') !== -1) {
				f.cooked = true;
			}
			if (food[i + '_cooked']) {
				f.cook = food[i + '_cooked'];
				food[i + '_cooked'].raw = f;
			}
			f.info = [];
			info = f.info;
			f.fruit && info.push(taggify('fruit') + (f.fruit === 1 ? '' : '\xd7' + f.fruit));
			f.veggie && info.push(taggify('veggie', 'vegetable') + (f.veggie === 1 ? '' : '\xd7' + f.veggie));
			f.meat && info.push(taggify('meat') + (f.meat === 1 ? '' : '\xd7' + f.meat));
			f.egg && info.push(taggify('egg') + (f.egg === 1 ? '' : '\xd7' + f.egg));
			f.fish && info.push(taggify('fish'));
			f.magic && info.push(taggify('magic'));
			f.decoration && info.push(taggify('decoration'));
			f.inedible && info.push(taggify('inedible'));
			f.monster && info.push(taggify('monster', 'monster food'));
			f.sweetener && info.push(taggify('sweetener'));
			f.fat && info.push(taggify('fat'));
			f.dairy && info.push(taggify('dairy'));
			food[index++] = f;
		}
	}
	food.length = index;
	index = 0;
	for (i in recipes) {
		if (recipes.hasOwnProperty(i)) {
			recipes[i].match = 0;
			recipes[i].name = recipes[i].name || i;
			recipes[i].id = i;
			recipes[i].lowerName = recipes[i].name.toLowerCase();
			recipes[i].weight = recipes[i].weight || 1;
			recipes[i].priority = recipes[i].priority || 0;
			recipes[i].img = 'img/' + recipes[i].name.replace(/ /g, '_').toLowerCase() + '.png';
			if (recipes[i].requirements) {
				recipes[i].requires = makeLinkable(recipes[i].requirements.join('; '));
			}
			recipes[index++] = recipes[i];
		}
	}
	recipes.length = index;
	recipes.forEach = Array.prototype.forEach;
	recipes.filter = Array.prototype.filter;
	recipes.sort = Array.prototype.sort;
	recipes.byName = function (name) {
		var i = this.length;
		while (i--) {
			if (this[i].lowerName === name) {
				return this[i];
			}
		}
	};
	var reduceRecipeButton = function (a, b) {
		return a + '[recipe:' + b.name + '|' + b.img + ']';
	};

	for (i in food) {
		if (food.hasOwnProperty(i) && isNaN(i) && isNaN(food[i])) {
			var f = food[i];
			info = f.info;
			f.cooked && info.push('cooked [*' + f.raw.name + '|' + f.raw.img + ']');
			f.cook && info.push('cook into [*' + f.cook.name + '|' + f.cook.img + ']');
			f.info = info.join('; ');
			if (!f.uncookable) {
				f.recipes = [];
				recipes.forEach(function (recipe) {
					var qualifies = false, r = recipe.requirements, i = r.length;
					while (i--) {
						if (r[i].test(null, f.nameObject, f)) {
							if (!r[i].cancel && !qualifies) {
								qualifies = true;
							}
						} else {
							if (r[i].cancel) {
								qualifies = false;
								break;
							}
						}
					}
					if (qualifies) {
						f.recipes.push(recipe);
					}
				});
				if (f.recipes.length > 0) {
					f.ingredient = true;
					f.info += (f.recipes.reduce(reduceRecipeButton, '[|][ingredient:' + f.name + '|Recipes] '));
				}
			} else {
				f.info += ('[|]cannot be added to crock pot');
			}
			f.info = makeLinkable(f.info);
		}
	}
	food.forEach = Array.prototype.forEach;
	food.filter = Array.prototype.filter;
	food.sort = Array.prototype.forEach;
	food.byName = function (name) {
		var i = this.length;
		while (i--) {
			if (this[i].lowerName === name) {
				return this[i];
			}
		}
	};
	//output.push('{| class="wikitable sortable"\n! width=145px |Name\n! width=40px |Health\n! width=50px |Food\n! width=60px |Perish\n|');
	var setTab;
	(function () {
		var navtabs = navbar.getElementsByTagName('li'),
			tabs = {},
			elements = {},
			storage,
			activeIndex = 0,
			activePage,
			activeTab,
			showTab = function (e) {
				setTab(e.target.dataset.tab);
			},
			navtab;
		setTab = function (tabID) {
			activeTab.className = '';
			activeTab = tabs[tabID];
			activePage.style.display = 'none';
			activePage = elements[tabID];
			activeTab.className = 'selected';
			activePage.style.display = 'block';
		};
		for (i = 0; i < navtabs.length; i++) {
			navtab = navtabs[i];
			if (navtab.dataset.tab) {
				tabs[navtab.dataset.tab] = navtab;
				elements[navtab.dataset.tab] = document.getElementById(navtab.dataset.tab);
				elements[navtab.dataset.tab].style.display = 'none';
				navtab.addEventListener('click', showTab, false);
			}
		}
		activeTab = tabs['simulator'];
		activePage = elements['simulator'];
		if (window.localStorage && localStorage.foodGuideState) {
			if (localStorage.foodGuideState[0] === '[') {
				//converts from old format which causes errors
				storage = {};
				storage.pickers = JSON.parse(localStorage.foodGuideState);
				localStorage.foodGuideState = JSON.stringify(storage);
			} else {
				storage = JSON.parse(localStorage.foodGuideState);
			}
			if (storage.activeTab && tabs[storage.activeTab]) {
				activeTab = tabs[storage.activeTab];
				activePage = elements[storage.activeTab];
			}
		}
		activeTab.className = 'selected';
		activePage.style.display = 'block';
		window.addEventListener('beforeunload', function () {
			var obj, serialized;
			if (window.localStorage) {
				if (!localStorage.foodGuideState) {
					localStorage.foodGuideState = '{}';
				}
				obj = JSON.parse(localStorage.foodGuideState);
				obj.activeTab = activeTab.dataset.tab;
				localStorage.foodGuideState = JSON.stringify(obj);
			}
		});
	}());

	var queue = function (img) {
			if (img.dataset.pending) {
				makeImage.queue(img, img.dataset.pending, 32);
			}
		},
		cells = function (cellType) {
			var i, td, image, tr = document.createElement('tr'), cell, celltext;
			for (i = 1; i < arguments.length; i++) {
				td = document.createElement(cellType);
				cell = arguments[i],
				celltext = cell && cell.indexOf ? cell : cell.toString();
				if (cell instanceof DocumentFragment) {
					td.appendChild(cell.cloneNode(true));
					Array.prototype.forEach.call(td.getElementsByTagName('img'), queue);
				} else if (celltext.indexOf('img/') === 0) {
					image = makeImage(celltext);
					td.appendChild(image);
				} else {
					td.appendChild(document.createTextNode(celltext));
				}
				tr.appendChild(td);
			}
			return tr;
		};
	var makeSortableTable = function (headers, dataset, rowGenerator, defaultSort, hasSummary, linkCallback, highlightCallback) {
		var table, header, sorting, invertSort = false, firstHighlight, lastHighlight,
			generateAndHighlight = function (item) {
				var row = rowGenerator(item);
				if (highlightCallback && highlightCallback(item)) {
					row.className = 'highlighted';
					if (!firstHighlight) {
						firstHighlight = row;
					}
					lastHighlight = row;
				}
				table.appendChild(row);
			},
			create = function (e, sort, scrollHighlight) {
				var tr, th, oldTable, sortBy, summary, links, i;
				if (sort || (e && e.target.dataset.sort !== '')) {
					sortBy = sort || e.target.dataset.sort;
					if (hasSummary) {
						summary = dataset.shift();
					}
					if (sortBy === 'name') {
						dataset.sort(function (a, b) {
							var aname = a.raw ? a.raw.name : a.name,
								bname = b.raw ? b.raw.name : b.name;
							if (aname !== bname) {
								return aname > bname ? 1 : aname < bname ? -1 : 0;
							}
							return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
						});
					} else {
						dataset.sort(function (a, b) {
							var sa = a[sortBy], sb = b[sortBy];
							return !isNaN(sa) && !isNaN(sb) ? sb - sa : isNaN(sa) && isNaN(sb) ? 0 : isNaN(sa) ? 1 : -1;
						});
					}
					if (sorting === sortBy) {
						invertSort = !invertSort;
					} else {
						sorting = sortBy;
						invertSort = false;
					}
					if (invertSort) {
						dataset.reverse();
					}
					if (hasSummary) {
						dataset.unshift(summary);
					}
				}
				tr = document.createElement('tr');
				for (header in headers) {
					th = document.createElement('th');
					th.appendChild(document.createTextNode(header));
					if (headers[header]) {
						if (headers[header] === sorting) {
							th.style.background = invertSort ? '#555' : '#ccc';
							th.style.color = invertSort ? '#ccc' : '#555';
							th.style.borderRadius = '4px';
						}
						th.style.cursor = 'pointer';
						th.dataset.sort = headers[header];
						th.addEventListener('click', create, false);
					}
					tr.appendChild(th);
				}
				oldTable = table;
				table = document.createElement('table');
				table.appendChild(tr);
				firstHighlight = null;
				lastHighlight = null;
				dataset.forEach(generateAndHighlight);
				if (linkCallback) {
					table.className = 'links';
					Array.prototype.forEach.call(table.getElementsByClassName('link'), function (element) {
						element.addEventListener('click', linkCallback, false);
					});
				}
				if (oldTable) {
					oldTable.parentNode.replaceChild(table, oldTable);
				}
				if (scrollHighlight) {
					if (firstHighlight && firstHighlight.offsetTop + table.offsetTop + mainElement.offsetTop + firstHighlight.offsetHeight > window.scrollY + window.innerHeight) {
						firstHighlight.scrollIntoView(true);
					} else if (lastHighlight && lastHighlight.offsetTop + table.offsetTop + mainElement.offsetTop < window.scrollY) {
						lastHighlight.scrollIntoView(false);
					}
				}
			};
		if (defaultSort) {
			create(null, defaultSort);
		} else {
			create();
		}
		table.update = function (scrollHighlight) {
			create(null, null, scrollHighlight);
		};
		return table;
	};

	var sign = function (n) { return isNaN(n) ? '' : n > 0 ? '+' + n : n };
	var makeFoodRow = function (item) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health), sign(item.hunger), isNaN(item.sanity) ? '' : sign(item.sanity), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', item.info || '');
	};
	var makeRecipeRow = function (item, health, hunger) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health) + (health && item.health !== health ? ' (' + ((item.health / health * 1000 | 0) / 10) + '%)' : ''), sign(item.hunger) + (hunger && item.hunger !== hunger ? ' (' + ((item.hunger / hunger * 1000 | 0) / 10) + '%)' : ''), isNaN(item.sanity) ? '' : sign(item.sanity), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', (item.cooktime * base_cook_time + 0.5 | 0) + ' secs', item.priority || '0', item.requires || '');
	};
	(function () {
		var foodHighlight,
			foodHighlighted = [],
			recipeHighlighted = [],
			setFoodHighlight = function (e) {
				var name = !e.target ? e : e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link;
				if (name.substring(0, 7) === 'recipe:' || name.substring(0, 11) === 'ingredient:') {
					setTab('crockpot');
					if (name.substring(0, 7) === 'recipe:') {
						name = '*' + name.substring(7);
					}
					recipeHighlighted = matchingNames(recipes, name);
					recipeTable.update(true);
				} else {
					if (foodHighlight !== name) {
						foodHighlight = name;
						foodHighlighted = matchingNames(food, name);
					} else {
						foodHighlight = '';
						foodHighlighted.length = 0;
					}
					foodTable.update(true);
				}
			},
			setRecipeHighlight = function (e) {
				var name = !e.target ? e : e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link;
				setTab('foodlist');
				foodHighlight = name;
				foodHighlighted = matchingNames(food, name);
				foodTable.update(true);
			},
			testFoodHighlight = function (item) {
				return foodHighlighted.indexOf(item) !== -1;
			},
			testRecipeHighlight = function (item) {
				return recipeHighlighted.indexOf(item) !== -1;
			},
			foodTable = makeSortableTable(
				{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Info': ''},
				Array.prototype.slice.call(food),
				makeFoodRow,
				'name',
				false,
				setFoodHighlight,
				testFoodHighlight
			),
			recipeTable = makeSortableTable(
				{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Cook Time': 'cooktime', 'Priority': 'priority', 'Requires': ''},
				Array.prototype.slice.call(recipes),
				makeRecipeRow,
				'name',
				false,
				setRecipeHighlight,
				testRecipeHighlight
			);
		foodElement.appendChild(foodTable);
		recipesElement.appendChild(recipeTable);
	}());
	//this was used to generate a Wiki table, might be re-purposed later
	/*fragment = document.createDocumentFragment();
	fragment.appendChild(cells('th', '', 'Name', 'Health', 'Hunger', 'Perish', 'Info'));
	food.forEach(function (item) {
		fragment.appendChild(makeFoodRow(item));
		//output.push('-\n', '| ', item.name, '\n| ', isNaN(item.health) ? '' : item.health < 0 ? "'''" + item.health + "'''" : '+' + item.health, '\n| ', isNaN(item.hunger) ? '' : '+' + item.hunger, '\n| ', isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', '\n|');
	});
	foodElement.appendChild(fragment);*/
	//output.push('}');
	//var a = document.createElement('textarea');
	//a.value = output.join('');
	//document.body.appendChild(a);

	//output = [];
	//output.push('{| class="wikitable sortable"\n! width=145px |Name\n! width=40px |Health\n! width=50px |Food\n! width=60px |Cook time\n! width=60px |Perish\n|');
	
	/*fragment = document.createDocumentFragment();
	fragment.appendChild(cells('th', '', 'Name', 'Health', 'Hunger', 'Cook Time', 'Perish', 'Priority', 'Requires'));
	recipes.forEach(function (item) {
		fragment.appendChild(makeRecipeRow(item));
		//output.push('-\n', '| ', item.name, '\n| ', isNaN(item.health) ? '' : item.health < 0 ? "'''" + item.health + "'''" : '+' + item.health, '\n| ', isNaN(item.hunger) ? '' : '+' + item.hunger, '\n| ', (item.cooktime * base_cook_time + 0.5 | 0) + ' secs', '\n| ', isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', '\n|');
	});
	recipesElement.appendChild(fragment);*/
	//output.push('}');
	//a = document.createElement('textarea');
	//a.value = output.join('');
	//document.body.appendChild(a);
	window.food = food;
	window.recipes = recipes;
	window.matchingNames = matchingNames;
	var setSlot = function (slotElement, item) {
			var end = false;
			if (item !== null) {
				slotElement.dataset.id = item.id;
			} else {
				if (slotElement.nextSibling && getSlot(slotElement.nextSibling) !== null) {
					setSlot(slotElement, getSlot(slotElement.nextSibling));
					setSlot(slotElement.nextSibling, null);
					end = true;
				} else {
					slotElement.dataset.id = null;
				}
			}
			if (!end) {
				if (item !== null) {
					if (slotElement.firstChild) {
						slotElement.replaceChild(makeImage(item.img), slotElement.firstChild);
					} else {
						slotElement.appendChild(makeImage(item.img));
					}
				} else {
					if (slotElement.firstChild) {
						slotElement.removeChild(slotElement.firstChild);
					}
				}
				slotElement.title = item ? item.name : '';
			}
		},
		getSlot = function (slotElement) {
			return food[slotElement.dataset.id] || recipes[slotElement.dataset.id] || null;
		};
	(function () {
		var pickers = document.getElementsByClassName('ingredientpicker'),
			i = pickers.length;
		while (i--) {
			(function () {
				var dropdown = document.createElement('div'),
					ul = document.createElement('ul'),
					picker = pickers[i],
					index = i,
					state,
					from = picker.dataset.type === 'recipes' ? recipes : food,
					parent = picker.nextSibling,
					slots = parent.getElementsByClassName('ingredient'),
					limited,
					updateRecipes,
					suggestions = [],
					inventoryrecipes = [],
					results = document.getElementById('results'),
					discoverfood = document.getElementById('discoverfood'),
					discover = document.getElementById('discover'),
					clear = document.createElement('span'),
					displaying = false,
					appendSlot = function (id) {
						var i, item = food[id] || recipes[id] || null;
						if (limited) {
							for (i = 0; i < slots.length; i++) {
								if (getSlot(slots[i]) === null) {
									setSlot(slots[i], item);
									updateRecipes();
									return i;
								}
							}
							return -1;
						} else {
							if (slots.indexOf(id) === -1) {
								slots.push(id);
								i = document.createElement('span');
								i.className = 'ingredient';
								setSlot(i, item);
								i.addEventListener('click', removeSlot, false);
								parent.appendChild(i);
								updateRecipes();
								return 1;
							}
							return 1;
						}
					},
					pickItem = function (e) {
						var names,
							target = e.target.tagName === 'IMG' ? e.target.parentNode : e.target,
							result = appendSlot(target.dataset.id);
						if (result !== -1) {
							dropdown.removeChild(ul);
							ul = document.createElement('ul');
							names = matchingNames(from, '');
							names.forEach(liIntoPicker, ul);
							dropdown.appendChild(ul);
							if (ul.firstChild) {
								ul.firstChild.className = 'selected';
							}
							picker.value = '';
							if (result < slots.length - 1 || !limited) {
								picker.focus();
							} else {
								picker.blur();
							}
							e && e.preventDefault && e.preventDefault();
							refreshLocation();
						}
					},
					liIntoPicker = function (item) {
						var img = makeImage(item.img, 32),
							li = document.createElement('li');
						li.appendChild(img);
						li.appendChild(document.createTextNode(item.name));
						li.dataset.id = item.id;
						li.addEventListener('mousedown', pickItem, false);
						this.appendChild(li);
					},
					removeSlot = function (e) {
						var i, target = e.target.tagName === 'IMG' ? e.target.parentNode : e.target;
						if (limited) {
							if (getSlot(target) !== null) {
								setSlot(target, null);
								updateRecipes();
								return target.dataset.id;
							} else {
								picker.focus();
							}
						} else {
							i = slots.indexOf(target.dataset.id);
							slots.splice(i, 1);
							parent.removeChild(target);
							updateRecipes();
							return slots[i] || null;
						}
					},
					refreshLocation = function () {
						if (mainElement.offsetLeft - dropdown.offsetWidth > 0) {
							//to the left
							dropdown.style.left = -dropdown.offsetWidth + 'px';
							dropdown.style.top = picker.offsetTop + 'px';
						} else if (mainElement.offsetLeft + picker.offsetLeft + picker.offsetWidth + dropdown.offsetWidth > window.innerWidth) {
							//below
							dropdown.style.left = picker.offsetLeft + 'px';
							dropdown.style.top = picker.offsetTop + picker.offsetHeight + 'px';
						} else {
							//to the right
							dropdown.style.left = picker.offsetLeft + picker.offsetWidth + 'px';
							dropdown.style.top = picker.offsetTop + 'px';
						}
					},
					refreshPicker = function () {
						var li = document.createElement('li'),
							names = matchingNames(from, picker.value);
						dropdown.removeChild(ul);
						ul = document.createElement('ul');
						names.forEach(liIntoPicker, ul);
						if (ul.firstChild) {
							ul.firstChild.className = 'selected';
						}
						dropdown.appendChild(ul);
						refreshLocation();
					},
					searchFor = function (e) {
						var name = e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link,
							matches = matchingNames(from, name);
						if (matches.length === 1) {
							appendSlot(matches[0].id);
						} else {
							picker.value = name;
							refreshPicker();
							picker.focus();
						}
					};
				if (parent.id === 'ingredients') {
					updateRecipes = function () {
						var ingredients,
							cooking,
							health, hunger,
							table;
						ingredients = Array.prototype.map.call(slots, function (slot) {
							return getSlot(slot);
						});
						cooking = getRecipes(ingredients);
						health = cooking[0].health;
						hunger = cooking[0].hunger;
						table = makeSortableTable(
							{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Cook Time': 'cooktime', 'Priority': 'priority', 'Requires': ''},
							cooking,
							function (item) {
								return makeRecipeRow(item, health, hunger);
							},
							'priority',
							true,
							searchFor
						);
						if (results.firstChild) {
							results.removeChild(results.firstChild);
						}
						if (results.firstChild) {
							results.removeChild(results.firstChild);
							results.removeChild(results.firstChild);
						}
						results.appendChild(table);
						if (ingredients[0] !== null) {
							getSuggestions(suggestions, ingredients, cooking);
							if (suggestions.length > 0) {
								results.appendChild(document.createTextNode('Add more ingredients to make:'));
								table = makeSortableTable(
									{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Cook Time': 'cooktime', 'Priority': 'priority', 'Requires': ''},
									suggestions,
									function (item) {
										return makeRecipeRow(item, health, hunger);
									},
									'priority',
									false,
									searchFor
								);
								results.appendChild(table);
							}
						}
					};
				} else if (parent.id === 'inventory') {
					updateRecipes = function () {
						var ingredients,
							foodTable,
							table;
						ingredients = Array.prototype.map.call(parent.getElementsByClassName('ingredient'), function (slot) {
							return getSlot(slot);
						});
						if (discoverfood.firstChild) {
							discoverfood.removeChild(discoverfood.firstChild);
						}
						if (discover.firstChild) {
							discover.removeChild(discover.firstChild);
						}
						if (ingredients.length > 0) {
							foodTable = makeSortableTable(
								{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Info': ''},
								ingredients,
								makeFoodRow,
								'name'
							);
							discoverfood.appendChild(foodTable);
							getSuggestions(inventoryrecipes, ingredients, null, true);
							if (inventoryrecipes.length > 0) {
								table = makeSortableTable(
									{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish': 'perish', 'Cook Time': 'cooktime', 'Priority': 'priority', 'Requires': ''},
									inventoryrecipes,
									makeRecipeRow,
									'name'
								)
								discover.appendChild(table);
							}
						}
					};
				}
				if (slots.length !== 0) {
					limited = true;
					Array.prototype.forEach.call(slots, function (slot) {
						setSlot(slot, null);
						slot.addEventListener('click', removeSlot, false);
					});
				} else {
					slots = [];
					limited = false;
				}
				if (window.localStorage && localStorage.foodGuideState) {
					state = JSON.parse(localStorage.foodGuideState).pickers;
					if (state && state[index]) {
						state[index].forEach(function (id) {
							if (food[id]) {
								appendSlot(id);
							}
						});
					}
				}
				dropdown.className = 'ingredientdropdown';
				dropdown.appendChild(ul);
				dropdown.addEventListener('mousedown', function (e) { e.preventDefault(); }, false);
				(function () {
					var li = document.createElement('li'),
						names = matchingNames(from, picker.value);
					dropdown.removeChild(ul);
					ul = document.createElement('ul');
					names.forEach(liIntoPicker, ul);
					dropdown.appendChild(ul);
					if (ul.firstChild) {
						ul.firstChild.className = 'selected';
					}
				}());
				clear.className = 'clearingredients';
				clear.appendChild(document.createTextNode('clear'));
				clear.addEventListener('click', function () {
					if (picker.value === '') {
						while (getSlot(parent.firstChild)) {
							removeSlot({ target: parent.firstChild });
						}
					} else {
						picker.value = '';
						refreshPicker();
					}
				}, false);
				parent.parentNode.insertBefore(clear, parent);
				picker.addEventListener('keydown', function (e) {
					
				}, false);
				picker.addEventListener('keyup', function (e) {
					var movement = [16, 17, 37, 38, 39, 40, 13],
						up = 38, down = 40, enter = 13, current, items, i;

					if (movement.indexOf(e.keyCode) === -1) {
						refreshPicker();
					} else {
						items = ul.getElementsByTagName('li');
						for (i = 0; i < items.length; i++) {
							if (items[i].className === 'selected') {
								current = items[i];
								if (e.keyCode === up || e.keyCode === down) {
									items[i].className = '';
								}
								if (e.keyCode === up) {
									items[i - 1 < 0 ? items.length - 1 : i - 1].className = 'selected';
								} else if (e.keyCode === down) {
									items[(i + 1) % items.length].className = 'selected';
								} else if (e.keyCode === enter && current) {
									pickItem({target: current});
									refreshLocation();
								}
								break;
							}
						}
						if (!current && items.length > 0) {
							if (e.keyCode === up) {
								items[items.length - 1].className = 'selected';
							} else if (e.keyCode === down) {
								items[0].className = 'selected';
							} else if (e.keyCode === enter) {
								pickItem({target: items[0]});
							}
						}
					}
				}, false);
				picker.addEventListener('focus', function () {
					if (!displaying) {
						displaying = true;
						parent.appendChild(dropdown);
						refreshLocation();
					}
				}, false);
				picker.addEventListener('blur', function () {
					if (displaying) {
						displaying = false;
						parent.removeChild(dropdown);
					}
				}, false);
				updateRecipes();
				window.addEventListener('beforeunload', function () {
					var obj, serialized;
					if (window.localStorage) {
						if (!localStorage.foodGuideState) {
							localStorage.foodGuideState = '{}';
						}
						obj = JSON.parse(localStorage.foodGuideState);
						if (!obj.pickers) {
							obj.pickers = [];
						}
						if (limited) {
							serialized = [];
							serialized = Array.prototype.map.call(slots, function (slot) {
								var item = getSlot(slot);
								return item ? item.id : null;
							});
							obj.pickers[index] = serialized;
						} else {
							obj.pickers[index] = slots;
						}
						localStorage.foodGuideState = JSON.stringify(obj);
					}
				});
			}());
		}
	}())
}());