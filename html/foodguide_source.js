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
		total_day_time = 480,
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
		perish_superfast = 3 * total_day_time * perish_warp,
		perish_fast = 6 * total_day_time * perish_warp,
		perish_med = 12 * total_day_time * perish_warp,
		perish_slow = 18 * total_day_time * perish_warp,
		perish_preserved = 24 * total_day_time * perish_warp,
		perish_superslow = 40 * total_day_time * perish_warp,
		calories_tiny = calories_per_day / 8,
		calories_small = calories_per_day / 6,
		calories_med = calories_per_day / 3,
		calories_large = calories_per_day / 2,
		calories_huge = calories_per_day,
		calories_superhuge = calories_per_day * 2,
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
				stack: stack_size_smallitem
			},
			froglegs_cooked: {
				name: 'Cooked Frog Legs',
				ismeat: true,
				meat: 0.5,
				health: healing_small,
				hunger: calories_small,
				perish: perish_med,
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
				perish: perish_slow,
				stack: stack_size_meditem
			},
			meat: {
				name: 'Meat',
				ismeat: true,
				meat: 1,
				health: healing_med,
				hunger: calories_med,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			meat_cooked: {
				name: 'Cooked Meat',
				ismeat: true,
				meat: 1,
				health: healing_medlarge,
				hunger: calories_large,
				perish: perish_med,
				stack: stack_size_meditem
			},
			morsel: {
				name: 'Morsel',
				ismeat: true,
				meat: 0.5,
				health: healing_small,
				hunger: calories_small,
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
				stack: stack_size_smallitem
			},
			drumstick: {
				name: 'Drumstick',
				ismeat: true,
				meat: 0.5,
				health: healing_tiny,
				hunger: calories_small,
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
			egg: {
				name: 'Tallbird Egg',
				egg: 4,
				health: healing_small,
				hunger: calories_med
			},
			egg_cooked: {
				name: 'Fried Tallbird Egg',
				egg: 4,
				health: 0,
				hunger: calories_large,
				perish: perish_fast
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
			},
			goop: {
				name: 'Rot',
				uncookable: true,
				health: spoiled_health,
				hunger: spoiled_hunger,
				stack: stack_size_smallitem
			},
			seeds: {
				name: 'Seeds',
				uncookable: true,
				health: healing_tiny,
				hunger: calories_tiny,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			seeds_cooked: {
				name: 'Toasted Seeds',
				uncookable: true,
				health: healing_small,
				hunger: calories_small,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			honeycomb: {
				name: 'Honeycomb',
				sweetener: true
			},
			twigs: {
				name: 'Twigs',
				inedible: 1
			},
			petals: {
				name: 'Petals',
				uncookable: true,
				health: healing_tiny,
				hunger: 0,
				perish: perish_fast,
				stack: stack_size_smallitem
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
		NAMEString = function () { return food[this.name].name + (this.qty ? this.qty : ''); },
		NAME = function (name, qty) { return {name: name, qty: qty || NOQTY, test: NAMETest, toString: NAMEString}; }, //permits cooked variant
		SPECIFICTest = function (cooker, names, tags) { return names[this.name]; },
		SPECIFICString = function () { return '*' + food[this.name].name + (this.qty ? this.qty : ''); },
		SPECIFIC = function (name, qty) { return {name: name, qty: qty || NOQTY, test: SPECIFICTest, toString: SPECIFICString}; }, //disallows cooked/uncooked variant
		TAGTest = function (cooker, names, tags) { return tags[this.tag]; },
		TAGString = function () { return this.tag + (this.qty ? this.qty : ''); },
		TAG = function (tag, qty) { return {tag: tag, qty: qty || NOQTY, test: TAGTest, toString: TAGString}; },
		recipes = {
			butterflymuffin: {
				name: 'Butter Muffin',
				test: function(cooker, names, tags) {
					return names.butterflywings && tags.veggie;
				},
				requires: 'Butterfly Wings, veggie',
				requirements: [NAME('butterflywings'), TAG('veggie')],
				priority: 1,
				weight: 1,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				cooktime: 2
			},
			frogglebunwich: {
				name: 'Froggle Bunwich',
				test: function(cooker, names, tags) {
					return names.froglegs && !names.froglegs_cooked && tags.veggie;
				},
				requirements: [SPECIFIC('froglegs'), TAG('veggie')],
				priority: 1,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				cooktime: 2
			},
			stuffedeggplant: {
				name: 'Stuffed Eggplant',
				test: function(cooker, names, tags) {
					return names.eggplant && tags.veggie && tags.veggie > 1;
				},
				requirements: [NAME('eggplant'), TAG('veggie', COMPARE('>', 1))],
				priority: 1,
				foodtype: "veggie",
				health: healing_small,
				hunger: calories_large,
				perish: perish_slow,
				cooktime: 2
			},
			fishsticks: {
				name: 'Fishsticks',
				test: function(cooker, names, tags) {
					return tags.fish && names.twigs;
				},
				requirements: [TAG('fish'), NAME('twigs')],
				priority: 10,
				foodtype: "meat",
				health: healing_large,
				hunger: calories_large,
				perish: perish_med,
				cooktime: 2
			},
			honeynuggets: {
				name: 'Honey Nuggets',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat <= 1.5;
				},
				requirements: [NAME('honey'), TAG('meat', COMPARE('<=', 1.5))],
				priority: 2,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_huge,
				perish: perish_slow,
				cooktime: 2
			},
			honeyham: {
				name: 'Honey Ham',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat > 1.5;
				},
				requirements: [NAME('honey'), TAG('meat', COMPARE('>', 1.5))],
				priority: 2,
				foodtype: "meat",
				health: healing_huge,
				hunger: calories_huge,
				perish: perish_slow,
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
				cooktime: 2
			},
			kabobs: {
				name: 'Kabobs',
				test: function(cooker, names, tags) {
					return tags.meat && names.twigs;
				},
				requirements: [TAG('meat'), NAME('twigs')],
				priority: 5,
				foodtype: "meat",
				health: healing_small,
				hunger: calories_large,
				perish: perish_slow,
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
				cooktime: 3
			},
			baconeggs: {
				name: 'Bacon and Eggs',
				test: function(cooker, names, tags) {
					return tags.egg && tags.egg > 1 && tags.meat && 1 < tags.meat && !tags.veggie;
				},
				requirements: [TAG('egg', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), NOT(TAG('veggie'))],
				priority: 10,
				foodtype: "meat",
				health: healing_huge,
				hunger: calories_huge,
				perish: perish_preserved,
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
				cooktime: 1
			},
			turkeydinner: {
				name: 'Turkey Dinner',
				test: function(cooker, names, tags) {
					return names.drumstick && names.drumstick > 1 && tags.meat && 1 < tags.meat && (tags.veggie || tags.fruit);
				},
				requirements: [SPECIFIC('drumstick', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), OR(TAG('veggie'), TAG('fruit'))],
				priority: 10,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_huge,
				perish: perish_fast,
				cooktime: 3
			},
			ratatouille: {
				name: 'Ratatouille',
				test: function(cooker, names, tags) {
					return tags.veggie;
				},
				requirements: [TAG('veggie')],
				priority: 0,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_med,
				perish: perish_slow,
				cooktime: 1
			},
			jammypreserves: {
				name: 'Fist Full of Jam',
				test: function(cooker, names, tags) {
					return tags.fruit && !tags.veggie;
				},
				requirements: [TAG('fruit'), NOT(TAG('veggie'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_small * 3,
				perish: perish_slow,
				cooktime: 0.5
			},
			fruitmedley: {
				name: 'Fruit Medley',
				test: function(cooker, names, tags) {
					return tags.fruit && !tags.veggie;
				},
				requirements: [TAG('fruit'), NOT(TAG('veggie'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_huge,
				hunger: calories_med,
				perish: perish_fast,
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
				cooktime: 0.5
			},
			waffles: {
				name: 'Waffles',
				test: function(cooker, names, tags) {
					return names.butter && (names.berries || names.berries_cooked) && tags.egg;
				},
				requirements: [NAME('butter'), NAME('berries'), TAG('egg')],
				priority: 10,
				foodtype: "veggie",
				health: healing_huge,
				hunger: calories_large,
				perish: perish_fast,
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
				cooktime: 0.25
			}
		},
		matchingNames = (function () {
			var name,
				anywhere,
				filter = function (element) {
					if (element.uncookable) {
						element.match = 0;
					} else if (element.lowerName.indexOf(name) === 0) {
						element.match = 1;
					} else if (anywhere.test(element.lowerName)) {
						element.match = 2;
					} else {
						element.match = 0;
					}
					return element.match;
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
					return a.match - b.match;
				};
			return function (arr, search) {
				name = search.toLowerCase();
				anywhere = new RegExp('\\b' + name.split('').join('.*') + '.*');
				return arr.filter(filter).sort(byMatch);
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
				images = {},
				canvasSupported = !!ctx,
				requests = [],
				cacheImage = function (url) {
					var renderToCache = function (url, imageElement) {
						canvas.width = imageElement.width;
						canvas.height = imageElement.height;
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						ctx.drawImage(imageElement, 0, 0);
						try {
							images[url] = canvas.toDataURL();
						} catch (ex) {
							canvasSupported = false;
						}
						requests.filter(function (request) { return request.url === url; }).forEach(function (request) {
							if (request.url === url) {
								request.img.src = images[url] || url;
							}
						});
					};
					return function (e) {
						renderToCache(url, e.target);
					}
				};
			return function (url) {
				var img = new Image();
				if (canvasSupported) {
					if (images[url]) {
						//image is cached
						img.src = images[url];
					} else if (images[url] === null) {
						//image is waiting to be loaded
						requests.push({url: url, img: img});
					} else {
						//image has not been cached
						images[url] = null;
						img.addEventListener('load', cacheImage(url), false);
						img.src = url;
					}
				} else {
					//if we can't cache the images with canvas, just do it normally
					img.src = url;
				}
				return img;
			};
		}()),
		i,
		index = 0,
		mainElement = document.getElementById('main'),
		foodElement = document.getElementById('food'),
		recipesElement = document.getElementById('recipes'),
		fragment, navbar = document.getElementById('navbar');

	if (!document.documentElement.dataset) {
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
	var info = [];
	for (i in food) {
		if (food.hasOwnProperty(i)) {
			food[i].match = 0;
			food[i].lowerName = food[i].name.toLowerCase();
			food[i].id = i;
			food[i].img = 'img/' + food[i].name.replace(/ /g, '_').toLowerCase() + '.png';
			info.length = 0;
			if (i.indexOf('_cooked') !== -1) {
				food[i].cooked = true;
			}
			if (food[i + '_cooked']) {
				food[i].cook = food[i + '_cooked'];
				food[i + '_cooked'].raw = food[i];
			}
			food[i].fruit && info.push('fruit' + (food[i].fruit === 1 ? '' : ' (' + food[i].fruit + ')'));
			food[i].veggie && info.push('vegetable' + (food[i].veggie === 1 ? '' : ' (' + food[i].veggie + ')'));
			food[i].meat && info.push('meat' + (food[i].meat === 1 ? '' : ' (' + food[i].meat + ')'));
			food[i].egg && info.push('egg' + (food[i].egg === 1 ? '' : ' (' + food[i].egg + ')'));
			food[i].fish && info.push('fish');
			food[i].magic && info.push('magic');
			food[i].decoration && info.push('decoration');
			food[i].inedible && info.push('inedible');
			food[i].monster && info.push('monster food');
			food[i].sweetener && info.push('sweetener');
			food[i].fat && info.push('fat');
			food[i].dairy && info.push('dairy');
			food[i].cooked && info.push('cooked ' + food[i].raw.name);
			food[i].cook && info.push('cook into ' + food[i].cook.name);
			food[i].uncookable && info.push('cannot be added to crock pot');
			food[i].info = info.join('; ');
			food[index++] = food[i];
		}
	}
	food.length = index;
	food.forEach = Array.prototype.forEach;
	food.filter = Array.prototype.filter;
	food.sort = Array.prototype.forEach;
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
				recipes[i].requires = recipes[i].requirements.join('; ');
			}
			recipes[index++] = recipes[i];
		}
	}
	recipes.length = index;
	recipes.forEach = Array.prototype.forEach;
	recipes.filter = Array.prototype.filter;
	recipes.sort = Array.prototype.sort;
	
	//output.push('{| class="wikitable sortable"\n! width=145px |Name\n! width=40px |Health\n! width=50px |Food\n! width=60px |Perish\n|');

	(function () {
		var navtabs = navbar.getElementsByTagName('li'),
			tabs = {},
			elements = {},
			storage,
			activeIndex = 0,
			activePage,
			activeTab,
			showTab = function (e) {
				activeTab.className = '';
				activeTab = tabs[e.target.dataset.tab];
				activePage.style.display = 'none';
				activePage = elements[e.target.dataset.tab];
				activeTab.className = 'selected';
				activePage.style.display = 'block';
			},
			navtab;
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

	var imgSize = '40px',
		cells = function (cellType) {
			var i, td, image, tr = document.createElement('tr'), cell;
			for (i = 1; i < arguments.length; i++) {
				td = document.createElement(cellType);
				cell = arguments[i] && arguments[i].indexOf ? arguments[i] : arguments[i].toString();
				if (cell.indexOf('img/') === 0) {
					image = makeImage(cell);
					//image.src = cell;
					image.style.width = imgSize;
					image.style.height = imgSize;
					td.appendChild(image);
				} else {
					td.appendChild(document.createTextNode(cell));
				}
				tr.appendChild(td);
			}
			return tr;
		};
	var makeSortableTable = function (headers, dataset, rowGenerator, defaultSort, hasSummary) {
		var table, header, sorting, invertSort = false,
			create = function (e, sort) {
				var tr, th, oldTable, sortBy, summary;
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
				dataset.forEach(rowGenerator, table);
				if (oldTable) {
					oldTable.parentNode.replaceChild(table, oldTable);
				}
			};
		if (defaultSort) {
			create(null, defaultSort);
		} else {
			create();
		}
		return table;
	};

	var sign = function (n) { return isNaN(n) ? '' : n > 0 ? '+' + n : n };
	var makeFoodRow = function (item) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health), sign(item.hunger), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', item.info || '');
	};
	foodElement.appendChild(makeSortableTable(
		{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Perish': 'perish', 'Info': ''},
		Array.prototype.slice.call(food),
		function (item) {
			this.appendChild(makeFoodRow(item));
		},
		'name'
	));
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
	var makeRecipeRow = function (item, health, hunger) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health) + (health && item.health !== health ? ' (' + ((item.health / health * 1000 | 0) / 10) + '%)' : ''), sign(item.hunger) + (hunger && item.hunger !== hunger ? ' (' + ((item.hunger / hunger * 1000 | 0) / 10) + '%)' : ''), (item.cooktime * base_cook_time + 0.5 | 0) + ' secs', isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' days', item.priority || '0', item.requires || '');
	};
	recipesElement.appendChild(makeSortableTable(
		{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Cook Time': 'cooktime', 'Perish': 'perish', 'Priority': 'priority', 'Requires': ''},
		Array.prototype.slice.call(recipes),
		function (item) {
			this.appendChild(makeRecipeRow(item));
		},
		'name'
	));
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
	var slotItemCSS = '\') center center, ',
		slotBackgroundCSS = 'url(\'img/background.png\') top left',
		setSlot = function (slotElement, item) {
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
					//slotElement.style.background = 'url(\'' + item.img + slotItemCSS + slotBackgroundCSS;
					if (slotElement.firstChild) {
						slotElement.replaceChild(makeImage(item.img), slotElement.firstChild);
					} else {
						slotElement.appendChild(makeImage(item.img));
					}
				} else {
					if (slotElement.firstChild) {
						slotElement.removeChild(slotElement.firstChild);
					}
					//slotElement.style.background = slotBackgroundCSS;
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
						var img = makeImage(item.img),
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
							{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Cook Time': 'cooktime', 'Perish': 'perish', 'Priority': 'priority', 'Requires': ''},
							cooking,
							function (item) {
								this.appendChild(makeRecipeRow(item, health, hunger));
							},
							'priority',
							true
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
									{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Cook Time': 'cooktime', 'Perish': 'perish', 'Priority': 'priority', 'Requires': ''},
									suggestions,
									function (item) {
										this.appendChild(makeRecipeRow(item, health, hunger));
									},
									'priority'
								);
								results.appendChild(table);
							}
						}
					};
				} else if (parent.id === 'inventory') {
					updateRecipes = function () {
						var ingredients,
							table;
						ingredients = Array.prototype.map.call(parent.getElementsByClassName('ingredient'), function (slot) {
							return getSlot(slot);
						});
						if (discover.firstChild) {
							discover.removeChild(discover.firstChild);
						}
						if (ingredients.length > 0) {
							getSuggestions(inventoryrecipes, ingredients, null, true);
							if (inventoryrecipes.length > 0) {
								table = makeSortableTable(
									{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Cook Time': 'cooktime', 'Perish': 'perish', 'Priority': 'priority', 'Requires': ''},
									inventoryrecipes,
									function (item) {
										this.appendChild(makeRecipeRow(item));
									},
									'priority'
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
							appendSlot(id);
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
				}());
				clear.className = 'clearingredients';
				clear.appendChild(document.createTextNode('clear'));
				clear.addEventListener('click', function () {
					while (getSlot(parent.firstChild)) {
						removeSlot({ target: parent.firstChild });
					}
				}, false);
				parent.parentNode.insertBefore(clear, parent);
				picker.addEventListener('keydown', function (e) {
					var up = 38, down = 40, enter = 13, current, items, i;
					items = ul.getElementsByTagName('li');
					for (i = 0; i < items.length; i++) {
						if (items[i].className === 'selected') {
							current = items[i];
							items[i].className = '';
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
				}, false);
				picker.addEventListener('keyup', function (e) {
					var movement = [16, 17, 37, 38, 39, 40, 13];
					if (movement.indexOf(e.keyCode) === -1) {
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