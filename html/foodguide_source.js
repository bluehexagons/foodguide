/*
Makes use of no third-party code (for better or worse)

Copyright (c) 2014

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
		seg_time = 30,
		total_day_time = seg_time * 16,
		seg_time = total_day_time / 16,
		day_segs = 10,
		dusk_segs = 4,
		night_segs = 2,
		day_time = seg_time * day_segs,
		dusk_time = seg_time * dusk_segs,
		night_time = seg_time * night_segs,

		perish_warp = 1,

		stack_size_largeitem = 10,
		stack_size_meditem = 20,
		stack_size_smallitem = 40,

		healing_tiny = 1,
		healing_small = 3,
		healing_medsmall = 8,
		healing_med = 20,
		healing_medlarge = 30,
		healing_large = 40,
		healing_huge = 60,
		healing_superhuge = 100,

		sanity_supertiny = 1,
		sanity_tiny = 5,
		sanity_small = 10,
		sanity_med = 15,
		sanity_medlarge = 20,
		sanity_large = 33,
		sanity_huge = 50,

		perish_one_day = 1*total_day_time*perish_warp,
		perish_two_day = 2*total_day_time*perish_warp,
		perish_superfast = 3*total_day_time*perish_warp,
		perish_fast = 6*total_day_time*perish_warp,
		perish_med = 10*total_day_time*perish_warp,
		perish_slow = 15*total_day_time*perish_warp,
		perish_preserved = 20*total_day_time*perish_warp,
		perish_superslow = 40*total_day_time*perish_warp,

		dry_fast = total_day_time,
		dry_med = 2*total_day_time,

		calories_tiny = calories_per_day/8, // berries
		calories_small = calories_per_day/6, // veggies
		calories_medsmall = calories_per_day/4,
		calories_med = calories_per_day/3, // meat
		calories_large = calories_per_day/2, // cooked meat
		calories_huge = calories_per_day, // crockpot foods?
		calories_superhuge = calories_per_day*2, // crockpot foods?

		hot_food_bonus_temp = 40,
		cold_food_bonus_temp = -40,
		food_temp_brief = 5,
		food_temp_average = 10,
		food_temp_long = 15,

		spoiled_health = -1,
		spoiled_hunger = -10,
		perish_fridge_mult = .5,
		perish_ground_mult = 1.5,
		perish_global_mult = 1,
		perish_winter_mult = .75,
		perish_summer_mult = 1.25,

		stale_food_hunger = .667,
		spoiled_food_hunger = .5,

		stale_food_health = .333,
		spoiled_food_health = 0,

		base_cook_time = night_time*.3333,

		food = {
			acorn: {
				name: 'Birchnut',
				hunger: calories_tiny,
				health: healing_tiny,
				perish: perish_preserved,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			acorn_cooked: {
				name: 'Roasted Birchnut',
				seed: 1,
				hunger: calories_tiny,
				health: healing_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			butter: {
				name: 'Butter',
				fat: 1,
				dairy: 1,
				health: healing_large,
				hunger: calories_med,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			butterflywings: {
				name: 'Butterfly Wings',
				isveggie: true,
				decoration: 2,
				health: healing_medsmall,
				hunger: calories_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			cactusflower: {
				name: 'Cactus Flower',
				veggie: 0.5,
				hunger: calories_small,
				health: healing_medsmall,
				sanity: sanity_tiny,
				perish: perish_superfast,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			deerclopseyeball: {
				name: 'Deerclops Eyeball',
				uncookable: true,
				health: healing_huge,
				hunger: calories_huge,
				sanity: -sanity_med
			},
			bird_egg: {
				name: 'Egg',
				egg: 1,
				health: 0,
				hunger: calories_tiny,
				sanity: 0,
				perish: perish_med,
				stack: stack_size_smallitem,
				rot: 'rottenegg'
			},
			bird_egg_cooked: {
				name: 'Cooked Egg',
				egg: 1,
				precook: 1,
				health: 0,
				hunger: calories_small,
				sanity: 0,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			rottenegg: {
				name: 'Rotten Egg',
				uncookable: true,
				health: spoiled_health,
				hunger: spoiled_hunger,
				stack: stack_size_smallitem
			},
			cutlichen: {
				name: 'Lichen',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_small,
				sanity: -sanity_tiny,
				perish: perish_two_day
			},
			eel: {
				name: 'Eel',
				ismeat: true,
				meat: 0.5,
				fish: 1,
				health: healing_small,
				hunger: calories_tiny,
				perish: perish_superfast,
				stack: stack_size_smallitem,
				dry: 'smallmeat_dried',
				drytime: dry_fast
			},
			eel_cooked: {
				name: 'Cooked Eel',
				ismeat: true,
				health: healing_medsmall,
				hunger: calories_small,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			fish: {
				name: 'Fish',
				ismeat: true,
				meat: 0.5,
				fish: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_superfast,
				stack: stack_size_smallitem
			},
			fish_cooked: {
				name: 'Cooked Fish',
				ismeat: true,
				meat: 0.5,
				fish: 1,
				precook: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			froglegs: {
				name: 'Frog Legs',
				ismeat: true,
				meat: 0.5,
				health: 0,
				hunger: calories_small,
				perish: perish_fast,
				sanity: -sanity_small,
				stack: stack_size_smallitem
			},
			froglegs_cooked: {
				name: 'Cooked Frog Legs',
				ismeat: true,
				meat: 0.5,
				precook: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_med,
				sanity: 0,
				stack: stack_size_smallitem
			},
			foliage: {
				name: 'Foliage',
				uncookable: true,
				health: healing_tiny,
				hunger: 0,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			goatmilk: {
				name: 'Electric Milk',
				dairy: 1,
				health: healing_small,
				hunger: calories_small,
				sanity: sanity_small,
				perish: perish_fast,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			honey: {
				name: 'Honey',
				sweetener: true,
				health: healing_small,
				hunger: calories_tiny,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			honeycomb: {
				name: 'Honeycomb',
				sweetener: true
			},
			ice: {
				name: 'Ice',
				frozen: 1,
				perish: perish_superfast,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			lightbulb: {
				name: 'Light Bulb',
				health: healing_tiny,
				hunger: 0,
				perish: perish_fast,
				stack: stack_size_smallitem,
				uncookable: true
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
				precook: 1,
				health: healing_superhuge,
				hunger: calories_superhuge,
				stack: stack_size_smallitem
			},
			mole: {
				name: 'Moleworm',
				inedible: true,
				meat: 0.5,
				dlc: 'giants'
			},
			plantmeat: {
				name: 'Leafy Meat',
				uncookable: true,
				health: 0,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			plantmeat_cooked: {
				name: 'Cooked Leafy Meat',
				uncookable: true,
				health: healing_tiny,
				hunger: calories_medsmall,
				sanity: 0,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			monstermeat: {
				name: 'Monster Meat',
				ismeat: true,
				meat: 1,
				monster: true,
				health: -healing_med,
				hunger: calories_medsmall,
				sanity: -sanity_med,
				perish: perish_fast,
				stack: stack_size_meditem,
				dry: 'monstermeat_dried',
				drytime: dry_fast
			},
			monstermeat_cooked: {
				name: 'Cooked Monster Meat',
				ismeat: true,
				meat: 1,
				monster: true,
				precook: 1,
				health: -healing_small,
				hunger: calories_medsmall,
				sanity: -sanity_small,
				perish: perish_slow,
				stack: stack_size_meditem
			},
			monstermeat_dried: {
				name: 'Monster Jerky',
				ismeat: true,
				meat: 1,
				monster: true,
				dried: 1,
				health: -healing_small,
				hunger: calories_medsmall,
				sanity: -sanity_tiny,
				perish: perish_preserved,
				stack: stack_size_meditem
			},
			meat: {
				name: 'Meat',
				ismeat: true,
				meat: 1,
				health: healing_tiny,
				hunger: calories_med,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_meditem,
				dry: 'meat_dried',
				drytime: dry_med
			},
			meat_cooked: {
				name: 'Cooked Meat',
				ismeat: true,
				meat: 1,
				precook: 1,
				health: healing_small,
				hunger: calories_med,
				sanity: 0,
				perish: perish_med,
				stack: stack_size_meditem
			},
			meat_dried: {
				name: 'Jerky',
				ismeat: true,
				meat: 1,
				dried: 1,
				health: healing_med,
				hunger: calories_med,
				sanity: sanity_med,
				perish: perish_preserved,
				stack: stack_size_meditem
			},
			morsel: {
				name: 'Morsel',
				ismeat: true,
				meat: 0.5,
				health: 0,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_smallitem,
				drytime: dry_fast,
				dry: 'smallmeat_dried'
			},
			morsel_cooked: {
				name: 'Cooked Morsel',
				ismeat: true,
				meat: 0.5,
				precook: 1,
				health: healing_tiny,
				hunger: calories_small,
				sanity: 0,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			smallmeat_dried: {
				name: 'Small Jerky',
				ismeat: true,
				meat: 0.5,
				dried: 1,
				health: healing_medsmall,
				hunger: calories_small,
				sanity: sanity_small,
				perish: perish_preserved,
				stack: stack_size_smallitem
			},
			drumstick: {
				name: 'Drumstick',
				ismeat: true,
				ideal: true,
				meat: 0.5,
				health: 0,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_meditem,
				drytime: dry_fast,
				dry: 'smallmeat_dried'
			},
			drumstick_cooked: {
				name: 'Fried Drumstick',
				ismeat: true,
				meat: 0.5,
				precook: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_med,
				stack: stack_size_meditem
			},
			batwing: {
				name: 'Batilisk Wing',
				ismeat: true,
				health: healing_small,
				hunger: calories_small,
				sanity: -sanity_small,
				perish: perish_fast,
				stack: stack_size_smallitem,
				drytime: dry_med,
				dry: 'smallmeat_dried',
				uncookable: true
			},
			batwing_cooked: {
				name: 'Cooked Batilisk Wing',
				ismeat: true,
				health: healing_medsmall,
				hunger: calories_medsmall,
				sanity: 0,
				perish: perish_med,
				uncookable: true
			},
			minotaurhorn: {
				name: 'Guardian\'s Horn',
				uncookable: true,
				ismeat: true,
				health: healing_huge,
				hunger: calories_huge,
				sanity: -sanity_med
			},
			red_mushroom: {
				name: 'Red Cap',
				veggie: 0.5,
				ideal: true,
				health: -healing_med,
				hunger: calories_small,
				sanity: 0,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			red_mushroom_cooked: {
				name: 'Cooked Red Cap',
				veggie: 0.5,
				health: healing_tiny,
				hunger: 0,
				sanity: -sanity_small,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			green_mushroom: {
				name: 'Green Cap',
				veggie: 0.5,
				ideal: true,
				health: 0,
				hunger: calories_small,
				sanity: -sanity_huge,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			green_mushroom_cooked: {
				name: 'Cooked Green Cap',
				veggie: 0.5,
				health: -healing_tiny,
				hunger: 0,
				sanity: sanity_med,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			blue_mushroom: {
				name: 'Blue Cap',
				veggie: 0.5,
				ideal: true,
				health: healing_med,
				hunger: calories_small,
				sanity: -sanity_med,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			blue_mushroom_cooked: {
				name: 'Cooked Blue Cap',
				veggie: 0.5,
				health: -healing_small,
				hunger: 0,
				sanity: sanity_small,
				perish: perish_med,
				stack: stack_size_smallitem
			},
			petals: {
				name: 'Petals',
				uncookable: true,
				health: healing_tiny,
				hunger: 0,
				sanity: 0,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			petals_evil: {
				name: 'Dark Petals',
				uncookable: true,
				health: 0,
				hunger: 0,
				sanity: -sanity_tiny,
				perish: perish_fast,
				stack: stack_size_smallitem
			},
			seeds: {
				name: 'Seeds',
				uncookable: true,
				health: 0,
				//seed: 1,
				//  In Don't Starve's code, this is commented out.
				//  I'm guessing they considered making these usable
				//  in the crock pot again, but changed their minds.
				hunger: calories_tiny / 2,
				perish: perish_superslow,
				stack: stack_size_smallitem
			},
			seeds_cooked: {
				name: 'Toasted Seeds',
				uncookable: true,
				health: healing_tiny,
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
				precook: 1,
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
				sanity: 0,
				perish: perish_fast,
				stack: stack_size_meditem
			},
			trunk_summer_cooked: {
				name: 'Koalefant Trunk Steak',
				uncookable: true,
				ismeat: true,
				health: healing_large,
				hunger: calories_huge,
				sanity: 0,
				perish: perish_slow,
				stack: stack_size_meditem
			},
			twigs: {
				name: 'Twigs',
				inedible: 1
			},
			cavebanana: {
				name: 'Cave Banana',
				isfruit: true,
				fruit: 1,
				health: healing_tiny,
				hunger: calories_small,
				sanity: 0,
				perish: perish_med
			},
			cavebanana_cooked: {
				name: 'Cooked Banana',
				isfruit: true,
				fruit: 1,
				precook: 1,
				health: healing_small,
				hunger: calories_small,
				sanity: 0,
				perish: perish_fast
			},
			carrot: {
				name: 'Carrot',
				isveggie: true,
				veggie: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_med,
				sanity: 0,
				stack: stack_size_smallitem
			},
			carrot_cooked: {
				name: 'Roasted Carrot',
				isveggie: true,
				veggie: 1,
				precook: 1,
				health: healing_small,
				hunger: calories_small,
				perish: perish_fast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			corn: {
				name: 'Corn',
				ideal: true,
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_med,
				perish: perish_med,
				sanity: 0,
				stack: stack_size_smallitem
			},
			corn_cooked: {
				name: 'Popcorn',
				isveggie: true,
				veggie: 1,
				precook: 1,
				health: healing_small,
				hunger: calories_small,
				perish: perish_slow,
				sanity: 0,
				stack: stack_size_smallitem
			},
			pumpkin: {
				name: 'Pumpkin',
				isveggie: true,
				veggie: 1,
				health: healing_small,
				hunger: calories_large,
				perish: perish_med,
				sanity: 0,
				stack: stack_size_meditem
			},
			pumpkin_cooked: {
				name: 'Hot Pumpkin',
				isveggie: true,
				veggie: 1,
				precook: 1,
				health: healing_medsmall,
				hunger: calories_large,
				perish: perish_fast,
				sanity: 0,
				stack: stack_size_meditem
			},
			eggplant: {
				name: 'Eggplant',
				isveggie: true,
				veggie: 1,
				health: healing_medsmall,
				hunger: calories_med,
				perish: perish_med,
				sanity: 0,
				stack: stack_size_meditem
			},
			eggplant_cooked: {
				name: 'Braised Eggplant',
				isveggie: true,
				veggie: 1,
				precook: 1,
				health: healing_med,
				hunger: calories_med,
				perish: perish_fast,
				sanity: 0,
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
				sanity: -sanity_tiny,
				stack: stack_size_meditem
			},
			durian_cooked: {
				name: 'Extra Smelly Durian',
				isfruit: true,
				monster: 1,
				fruit: 1,
				precook: 1,
				health: 0,
				hunger: calories_med,
				perish: perish_fast,
				sanity: -sanity_tiny,
				stack: stack_size_meditem
			},
			pomegranate: {
				name: 'Pomegranate',
				isfruit: true,
				fruit: 1,
				health: healing_small,
				hunger: calories_tiny,
				perish: perish_fast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			pomegranate_cooked: {
				name: 'Sliced Pomegranate',
				isfruit: true,
				fruit: 1,
				precook: 1,
				health: healing_med,
				hunger: calories_small,
				perish: perish_superfast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			dragonfruit: {
				name: 'Dragon Fruit',
				isfruit: true,
				fruit: 1,
				health: healing_small,
				hunger: calories_tiny,
				perish: perish_fast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			dragonfruit_cooked: {
				name: 'Prepared Dragon Fruit',
				isfruit: true,
				fruit: 1,
				precook: 1,
				health: healing_med,
				hunger: calories_small,
				perish: perish_superfast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			berries: {
				name: 'Berries',
				isfruit: true,
				fruit: 0.5,
				health: 0,
				hunger: calories_tiny,
				perish: perish_fast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			berries_cooked: {
				name: 'Roasted Berries',
				isfruit: true,
				fruit: 0.5,
				precook: 1,
				health: healing_tiny,
				hunger: calories_small,
				perish: perish_superfast,
				sanity: 0,
				stack: stack_size_smallitem
			},
			cactusmeat: {
				name: 'Cactus Flesh',
				ideal: true,
				veggie: 1,
				hunger: calories_small,
				health: -healing_small,
				perish: perish_med,
				sanity: -sanity_tiny,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			cactusmeat_cooked: {
				name: 'Cooked Cactus Flesh',
				veggie: 1,
				hunger: calories_small,
				health: healing_tiny,
				perish: perish_med,
				sanity: sanity_med,
				precook: 1,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			watermelon: {
				name: 'Watermelon',
				fruit: 1,
				ideal: true,
				hunger: calories_small,
				health: healing_small,
				perish: perish_fast,
				sanity: sanity_tiny,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			watermelon_cooked: {
				name: 'Grilled Watermelon',
				fruit: 1,
				hunger: calories_small,
				health: healing_tiny,
				perish: perish_superfast,
				sanity: sanity_tiny * 1.5,
				precook: 1,
				stack: stack_size_smallitem,
				dlc: 'giants'
			},
			wormlight: {
				name: 'Glow Berry',
				uncookable: true,
				health: healing_medsmall + healing_small,
				hunger: calories_medsmall,
				sanity: -sanity_small,
				perish: perish_med
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
				sanity: sanity_tiny,
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
				sanity: sanity_tiny,
				cooktime: 2
			},
			taffy: {
				name: "Taffy",
				test: function(cooker, names, tags) {
					return tags.sweetener && tags.sweetener >= 3 && !tags.meat;
				},
				requirements: [TAG('sweetener', COMPARE('>=', 3)), NOT(TAG('meat'))],
				priority: 10,
				foodtype: "veggie",
				health: -healing_small,
				hunger: calories_small * 2,
				perish: perish_slow,
				sanity: sanity_med,
				cooktime: 2,
				tags: ['honeyed']
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
				perish: perish_med,
				sanity: sanity_med,
				cooktime: 2,
				tags: ['honeyed']
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
				sanity: sanity_tiny,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_brief,
				cooktime: 2
			},
			fishsticks: {
				name: 'Fishsticks',
				test: function(cooker, names, tags) {
					return tags.fish && names.twigs && (tags.inedible && tags.inedible <= 1);
				},
				requirements: [TAG('fish'), SPECIFIC('twigs'), TAG('inedible'), TAG('inedible', COMPARE('<=', 1))],
				priority: 10,
				foodtype: "meat",
				health: healing_large,
				hunger: calories_large,
				perish: perish_med,
				sanity: sanity_tiny,
				cooktime: 2
			},
			honeynuggets: {
				name: 'Honey Nuggets',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat <= 1.5 && !tags.inedible;
				},
				requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('<=', 1.5)), NOT(TAG('inedible'))],
				priority: 2,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_tiny,
				cooktime: 2,
				tags: ['honeyed']
			},
			honeyham: {
				name: 'Honey Ham',
				test: function(cooker, names, tags) {
					return names.honey && tags.meat && tags.meat > 1.5 && !tags.inedible;
				},
				requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('>', 1.5)), NOT(TAG('inedible'))],
				priority: 2,
				foodtype: "meat",
				health: healing_medlarge,
				hunger: calories_huge,
				perish: perish_slow,
				sanity: sanity_tiny,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_average,
				cooktime: 2,
				tags: ['honeyed']
			},
			dragonpie: {
				name: 'Dragonpie',
				test: function(cooker, names, tags) {
					return (names.dragonfruit || names.dragonfruit_cooked) && !tags.meat;
				},
				requirements: [NAME('dragonfruit'), NOT(TAG('meat'))],
				priority: 1,
				foodtype: "veggie",
				health: healing_large,
				hunger: calories_huge,
				perish: perish_slow,
				sanity: sanity_tiny,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_average,
				cooktime: 2
			},
			kabobs: {
				name: 'Kabobs',
				test: function(cooker, names, tags) {
					return tags.meat && names.twigs && (!tags.monster || tags.monster <= 1) && (tags.inedible && tags.inedible <= 1);
				},
				requirements: [TAG('meat'), SPECIFIC('twigs'), OR(NOT(TAG('monster')), TAG('monster', COMPARE('<=', 1))), TAG('inedible'), TAG('inedible', COMPARE('<=', 1))],
				priority: 5,
				foodtype: "meat",
				health: healing_small,
				hunger: calories_large,
				perish: perish_slow,
				sanity: sanity_tiny,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_long,
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
				sanity: sanity_tiny,
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
				health: healing_med,
				hunger: calories_huge,
				perish: perish_preserved,
				sanity: sanity_tiny,
				cooktime: 2
			},
			meatballs: {
				name: 'Meatballs',
				test: function(cooker, names, tags) {
					return tags.meat && !tags.inedible;
				},
				requirements: [TAG('meat'), NOT(TAG('inedible'))],
				priority: -1,
				foodtype: "meat",
				health: healing_small,
				hunger: calories_small * 5,
				perish: perish_med,
				sanity: sanity_tiny,
				cooktime: 0.75
			},
			bonestew: {
				name: 'Meaty Stew',
				test: function(cooker, names, tags) {
					return tags.meat && tags.meat >= 3 && !tags.inedible;
				},
				requirements: [TAG('meat', COMPARE('>=', 3)), NOT(TAG('inedible'))],
				priority: 0,
				foodtype: "meat",
				health: healing_small * 4,
				hunger: calories_large * 4,
				perish: perish_med,
				sanity: sanity_tiny,
				cooktime: 0.75
			},
			perogies: {
				name: 'Pierogi',
				test: function(cooker, names, tags) {
					return tags.egg && tags.meat && tags.veggie && !tags.inedible;
				},
				requirements: [TAG('egg'), TAG('meat'), TAG('veggie'), NOT(TAG('inedible'))],
				priority: 5,
				foodtype: "meat",
				health: healing_large,
				hunger: calories_large,
				perish: perish_preserved,
				sanity: sanity_tiny,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_average,
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
				sanity: sanity_tiny,
				cooktime: 3
			},
			ratatouille: {
				name: 'Ratatouille',
				test: function(cooker, names, tags) {
					return !tags.meat && tags.veggie && !tags.inedible;
				},
				requirements: [NOT(TAG('meat')), TAG('veggie'), NOT(TAG('inedible'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_small,
				hunger: calories_med,
				perish: perish_slow,
				sanity: sanity_tiny,
				temperature: cold_food_bonus_temp,
				temperatureduration: food_temp_brief,
				cooktime: 1
			},
			jammypreserves: {
				name: 'Fist Full of Jam',
				test: function(cooker, names, tags) {
					return tags.fruit && !tags.meat && !tags.veggie && !tags.inedible;
				},
				requirements: [TAG('fruit'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('inedible'))],
				priority: 0,
				foodtype: "veggie",
				health: healing_small,
				hunger: calories_small * 3,
				perish: perish_slow,
				sanity: sanity_tiny,
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
				health: healing_med,
				hunger: calories_med,
				perish: perish_fast,
				sanity: sanity_tiny,
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
				health: healing_med,
				hunger: calories_large,
				perish: perish_fast,
				sanity: sanity_tiny,
				cooktime: 0.5,
				tags: ['monstermeat']
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
				sanity: sanity_tiny,
				cooktime: 0.5
			},
			monsterlasagna: {
				name: 'Monster Lasagna',
				test: function(cooker, names, tags) {
					return tags.monster && tags.monster >= 2 && !tags.inedible;
				},
				requirements: [TAG('monster', COMPARE('>=', 2)), NOT(TAG('inedible'))],
				priority: 10,
				foodtype: "meat",
				health: -healing_med,
				hunger: calories_large,
				perish: perish_fast,
				sanity: -sanity_medlarge,
				cooktime: 0.5
			},
			powcake: {
				name: 'Powdercake',
				test: function(cooker, names, tags) {
					return names.twigs && names.honey && (names.corn || names.corn_cooked);
				},
				requirements: [SPECIFIC('twigs'), SPECIFIC('honey'), NAME('corn')],
				priority: 10,
				foodtype: "veggie",
				health: -healing_small,
				hunger: 0,
				perish: 9000000,
				sanity: 0,
				cooktime: 0.5,
				tags: ['honeyed']
			},
			unagi: {
				name: 'Unagi',
				test: function(cooker, names, tags) {
					return names.cutlichen && (names.eel || names.eel_cooked);
				},
				requirements: [SPECIFIC('cutlichen'), NAME('eel')],
				priority: 20,
				foodtype: "veggie",
				health: healing_med,
				hunger: calories_medsmall,
				perish: perish_med,
				sanity: sanity_tiny,
				cooktime: 0.5
			},
			wetgoop: {
				name: 'Wet Goop',
				test: function(cooker, names, tags) {
					return true;
				},
				requirements: [],
				trash: true,
				priority: -2,
				health: 0,
				hunger: 0,
				perish: perish_fast,
				sanity: 0,
				cooktime: 0.25
			},
			flowersalad: {
				name: 'Flower Salad',
				test: function(cooker, names, tags) {
					return names.cactusflower && tags.veggie && tags.veggie >= 2 && !tags.meat && !tags.inedible && !tags.egg && !tags.sweetener && !tags.fruit;
				},
				requirements: [SPECIFIC('cactusflower'), TAG('veggie', COMPARE('>=', 2)), NOT(TAG('meat')), NOT(TAG('inedible')), NOT(TAG('egg')), NOT(TAG('sweetener')), NOT(TAG('fruit'))],
				priority: 10,
				foodtype: "veggie",
				health: healing_large,
				hunger: calories_small,
				perish: perish_fast,
				sanity: sanity_tiny,
				cooktime: 0.5,
				dlc: 'giants'
			},
			icecream: {
				name: 'Ice Cream',
				test: function(cooker, names, tags) {
					return tags.frozen && tags.dairy && tags.sweetener && !tags.meat && !tags.veggie && !tags.inedible && !tags.egg;
				},
				requirements: [TAG('frozen'), TAG('dairy'), TAG('sweetener'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('inedible')), NOT(TAG('egg'))],
				priority: 10,
				foodtype: "veggie",
				health: 0,
				hunger: calories_med,
				perish: perish_superfast,
				sanity: sanity_huge,
				temperature: cold_food_bonus_temp,
				temperatureduration: food_temp_long,
				cooktime: 0.5,
				dlc: 'giants'
			},
			watermelonicle: {
				name: 'Melonsicle',
				test: function(cooker, names, tags) {
					return names.watermelon && tags.frozen && names.twigs && !tags.meat && !tags.veggie && !tags.egg;
				},
				requirements: [SPECIFIC('watermelon'), TAG('frozen'), SPECIFIC('twigs'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('egg'))],
				priority: 10,
				foodtype: "veggie",
				health: healing_small,
				hunger: calories_small,
				perish: perish_superfast,
				sanity: sanity_medlarge,
				temperature: cold_food_bonus_temp,
				temperatureduration: food_temp_average,
				cooktime: 0.5,
				dlc: 'giants'
			},
			trailmix: {
				name: 'Trail Mix',
				test: function(cooker, names, tags) {
					return names.acorn_cooked && tags.seed && tags.seed >= 1 && (names.berries || names.berries_cooked) && tags.fruit && tags.fruit >= 1 && !tags.meat && !tags.veggie && !tags.egg && !tags.dairy;
				},
				requirements: [SPECIFIC('acorn_cooked'), TAG('seed', COMPARE('>=', 1)), NAME('berries'), TAG('fruit', COMPARE('>=', 1)), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('egg')), NOT(TAG('dairy'))],
				priority: 10,
				foodtype: "veggie",
				health: healing_medlarge,
				hunger: calories_small,
				perish: perish_slow,
				sanity: sanity_tiny,
				cooktime: 0.5,
				dlc: 'giants'
			},
			hotchili: {
				name: 'Spicy Chili',
				test: function(cooker, names, tags) {
					return tags.meat && tags.veggie && tags.meat >= 1.5 && tags.veggie >= 1.5;
				},
				requirements: [TAG('meat', COMPARE('>=', 1.5)), TAG('veggie', COMPARE('>=', 1.5))],
				priority: 10,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_med,
				sanity: 0,
				temperature: hot_food_bonus_temp,
				temperatureduration: food_temp_long,
				cooktime: 0.5,
				dlc: 'giants'
			},
			guacamole: {
				name: 'Guacamole',
				test: function(cooker, names, tags) {
					return names.mole && names.cactusmeat && !tags.fruit;
				},
				requirements: [SPECIFIC('mole'), SPECIFIC('cactusmeat'), NOT(TAG('fruit'))],
				priority: 10,
				foodtype: "meat",
				health: healing_med,
				hunger: calories_large,
				perish: perish_med,
				sanity: 0,
				cooktime: 0.5,
				dlc: 'giants'
			}
		},
		recipeCrunchData,
		recipeCrunchString,
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
				allowUncookable = false,
				filter = function (element) {
					if (!allowUncookable && element.uncookable) {
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
			return function (arr, search, includeUncookable) {
				allowUncookable = !!includeUncookable;
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
		setIngredientValues = function (items, names, tags) {
			var i, k, item;
			for (i = 0; i < items.length; i++) {
				item = items[i];
				if (item !== null) {
					names[item.id] = 1 + (names[item.id] || 0);
					for (k in item) {
						if (item.hasOwnProperty(k) && k !== 'perish' && !isNaN(item[k])) {
							tags[k] = item[k] + (tags[k] || 0);
						} else if (k === 'perish') {
							tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
						}
					}
				}
			}
		},
		getSuggestions = (function () {
			var names,
				tags;
			return function (recipeList, items, exclude, itemComplete) {
				var i, ii, valid;
				recipeList.length = 0;
				names = {};
				tags = {};
				setIngredientValues(items, names, tags);
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
				tags;
			return function (items) {
				var i;
				recipeList.length = 0;
				names = {};
				tags = {};
				setIngredientValues(items, names, tags);
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
			var linkSearch = /\[([^\|]*)\|([^\|\]]*)\|?([^\|\]]*)\]/,
				leftSearch = /([^\|]\]\[[^\|]+\|[^\|\]]+)\|?([^\|\](?:left)]*)(?=\])/g,
				rightSearch = /(\[[^\|]+\|[^\|\]]+)\|?([^\|\]]*)(?=\]\[)(?!\]\[\|)/g,
				addLeftClass = function (a, b, c) { return b + '|' + (c.length === 0 ? 'left' : c + ' left'); },
				addRightClass = function (a, b, c) { return b + '|' + (c.length === 0 ? 'right' : c + ' right'); },
				titleCase = /_(\w)/g,
				toTitleCase = function (a, b) { return ' ' + b.toUpperCase(); };
			return function (str) {
				var processed = str && str.replace(leftSearch, addLeftClass).replace(leftSearch, addLeftClass).replace(rightSearch, addRightClass),
					results = processed && processed.split(linkSearch),
					fragment, i, span, url, image;
				if (!results || results.length === 1) {
					return processed;
				} else {
					fragment = document.createDocumentFragment();
					fragment.appendChild(document.createTextNode(results[0]));
					for (i = 1; i < results.length; i += 4) {
						if (results[i] === '' && results[i + 1] === '') {
							fragment.appendChild(document.createElement('br'));
						} else {
							span = document.createElement('span');
							span.className = results[i + 2] === '' ? 'link' : 'link ' + results[i + 2]; //IE doesn't support classList, too lazy to come up with a polyfill
							span.dataset.link = results[i];
							if (noDataset) {
								span.setAttribute('data-link', results[i]);
							}
							if (results[i + 1] && results[i + 1].indexOf('img/') === 0) {
								span.appendChild(document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')));
								url = results[i + 1].split(' ')[0];
								image = makeImage(url, 32);
								image.title = (url.substr(4, 1).toUpperCase() + url.substr(5).replace(titleCase, toTitleCase)).split('.')[0];
								span.appendChild(image);
							} else {
								span.appendChild(document.createTextNode(results[i + 1] ? results[i + 1] : results[i]));
							}
							fragment.appendChild(span);
						}
						fragment.appendChild(document.createTextNode(results[i + 3]));
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
		noDataset = false,
		dlc = {
			giants: {
				name: 'Reign of Giants',
				img: 'img/reign_of_giants_dlc.png'
			}
		};

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
	document.getElementById('stalehealth').appendChild(document.createTextNode(Math.round(stale_food_health * 1000) / 10 + '%'));
	document.getElementById('stalehunger').appendChild(document.createTextNode(Math.round(stale_food_hunger * 1000) / 10 + '%'));
	document.getElementById('spoiledhunger').appendChild(document.createTextNode(Math.round(spoiled_food_hunger * 1000) / 10 + '%'));
	document.getElementById('spoiledsanity').appendChild(document.createTextNode(sanity_small));
	document.getElementById('perishground').appendChild(document.createTextNode(Math.round(perish_ground_mult * 1000) / 10 + '%'));
	document.getElementById('perishwinter').appendChild(document.createTextNode(Math.round(perish_winter_mult * 1000) / 10 + '%'));
	document.getElementById('perishsummer').appendChild(document.createTextNode(Math.round(perish_summer_mult * 1000) / 10 + '%'));
	document.getElementById('perishfridge').appendChild(document.createTextNode(Math.round(perish_fridge_mult * 1000) / 10 + '%'));
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
			f.comment && info.push(f.comment);
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
				recipes[i].requires = makeLinkable(recipes[i].requirements.join('; ') + (recipes[i].dlc ? ('; [tag:dlc|' + dlc[recipes[i].dlc].img + '] DLC') : ''));
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
	var pl = function (str, n, plr) {
		return n === 1 ? str : str + (plr || 's');
	};

	for (i in food) {
		if (food.hasOwnProperty(i) && isNaN(i) && isNaN(food[i])) {
			var f = food[i];
			info = f.info;
			f.cooked && info.push('from [*' + f.raw.name + '|' + f.raw.img + ']');
			f.cook && info.push('cook: [*' + f.cook.name + '|' + f.cook.img + ']');
			if (f.dry) {
				if (!(f.dry instanceof Object)) {
					f.dry = food[f.dry];
				}
				info.push('dry in ' + (f.drytime / total_day_time) + ' ' + pl('day', (f.drytime / total_day_time)) + ': [*' + f.dry.name + '|' + f.dry.img + ']');
			}
			if (f.dlc) {
				info.push('requires [tag:dlc|' + dlc[f.dlc].img + '] DLC');
			}
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

	var usefulTags = ['id', 'health', 'hunger', 'fruit', 'veggie', 'meat', 'egg', 'fish', 'magic', 'decoration', 'inedible', 'monster', 'sweetener', 'fat', 'dairy'],
		combinationGenerator = function (length, callback, startPos) {
			var size = 4, index = 1, current = startPos || [0, 0, 0, 0], check, max = 0, iter = 0;
			return function (batch) {
				var overflow;
				while (batch-- && index < length) {
					callback(current);
					current[0]++;
					overflow = 0;
					while (current[overflow] >= length) {
						overflow++;
						current[overflow]++;
					}
					check = size;
					max = 0;
					while (check--) {
						if (current[check] >= length) {
							current[check] = max;
						} else if (current[check] > max) {
							max = current[check];
						}
					}
					if (overflow === size) {
						return false;
						break; //in case I copy and paste this for some reason and forget I need to get out of the loop
					}
					iter++;
				}
				return true;
			};
		};
	recipeCrunchData = {};
	recipeCrunchData.food = food.filter(function (item) {
			return !item.uncookable && !item.skip && (item.ideal || (!item.cook && (!item.raw || !item.raw.ideal)));
		}).map(function (item) {
			var f = {}, t = usefulTags.length;
			while (t--) {
				if (item.hasOwnProperty(usefulTags[t])) {
					f[usefulTags[t]] = item[usefulTags[t]];
				}
			}
			return f;
		});
	recipeCrunchData.recipes = recipes.filter(function (item) {
			return !item.trash;
		}).sort(function (a, b) {
			return b.priority - a.priority;
		});
	recipeCrunchData.test = recipeCrunchData.recipes.map(function (a) { return a.test; })
	recipeCrunchData.tests = recipeCrunchData.recipes.map(function (a) { return a.test.toString(); })
	recipeCrunchData.priority = recipeCrunchData.recipes.map(function (a) { return a.priority; });
	var getRealRecipesFromCollection = function (items, mainCallback, chunkCallback, endCallback) {
			var l = recipeCrunchData.test.length,
				built = [],
				renderedTo = 0,
				lastTime,
				block = 60,
				desiredTime = 38,
				foodFromIndex = function (index) {
					return items[index];
				},
				callback = function (combination) {
					var ingredients = combination.map(foodFromIndex), i, priority = null, names = {}, tags = {}, created = null, multiple = false, rcdTest = recipeCrunchData.test, rcdRecipes = recipeCrunchData.recipes;
					setIngredientValues(ingredients, names, tags);
					for (i = 0; i < l && (priority === null || rcdRecipes[i].priority >= priority); i++) {
						if (rcdTest[i](null, names, tags)) {
							if (created !== null) {
								multiple = true;
								created.multiple = true;
							}
							created = { recipe: rcdRecipes[i], ingredients: ingredients, tags: { health: tags.health, hunger: tags.hunger }, multiple: multiple };
							built.push(created);
							priority = rcdRecipes[i].priority;
						}
					}
				},
				getCombinations = combinationGenerator(items.length, callback),
				computeNextBlock = function () {
					var end = false,
						start = Date.now();
					if (getCombinations(block)) {
						setTimeout(computeNextBlock, 0);
					} else {
						end = true;
					}
					for (; renderedTo < built.length && built[renderedTo]; renderedTo++) {
						mainCallback(built[renderedTo]);
					}
					if (lastTime !== Date.now() - start) {
						lastTime = Date.now() - start + 1;
						block = desiredTime / lastTime * block + 1 | 0;
					}
					chunkCallback && chunkCallback();
					end && endCallback && endCallback();
				};
			computeNextBlock();
		};
	//console.log(recipeCrunchData);
	//delete recipeCrunchData.recipes;
	//recipeCrunchString = JSON.stringify(recipeCrunchData); //recipeCrunch might also be used for multithreading later

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
				navtab.addEventListener('selectstart', function (e) { e.preventDefault(); }, false);
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
	var makeSortableTable = function (headers, dataset, rowGenerator, defaultSort, hasSummary, linkCallback, highlightCallback, filterCallback, startRow, maxRows) {
		var table, header, sorting, invertSort = false, firstHighlight, lastHighlight, rows,
			generateAndHighlight = function (item, index, array) {
				var row;
				if ((!maxRows || rows < maxRows) && (!filterCallback || filterCallback(item))) {
					row = rowGenerator(item);
					if (highlightCallback && highlightCallback(item, array)) {
						row.className = 'highlighted';
						if (!firstHighlight) {
							firstHighlight = row;
						}
						lastHighlight = row;
					}
					table.appendChild(row);
					rows++;
				}
			},
			create = function (e, sort, scrollHighlight) {
				var tr, th, oldTable, sortBy, summary, links, i;
				if (sort || (e && e.target.dataset.sort !== '') || sorting) {
					sortBy = sort || (e && e.target.dataset.sort) || sorting;
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
					if (sort || e) {
						if (sorting === sortBy) {
							invertSort = !invertSort;
						} else {
							sorting = sortBy;
							invertSort = false;
						}
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
					if (header.indexOf(':') === -1) {
						th.appendChild(document.createTextNode(header));
					} else {
						th.appendChild(document.createTextNode(header.split(':')[0]));
						th.title = header.split(':')[1];
					}
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
				rows = 0;
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
		table.setMaxRows = function (max) {
			maxRows = max;
			this.update();
		};
		return table;
	};

	var sign = function (n) { return isNaN(n) ? '' : n > 0 ? '+' + n : n },
		rawpct = function (base, val) {
			return base < val ? (val - base) / Math.abs(base) : base > val ? -(base - val) / Math.abs(base) : 0;
		},
		pct = function (base, val) {
			return !isNaN(base) && base !== val ? ' (' + sign(((base < val ? (val - base) / Math.abs(base) : base > val ? -(base - val) / Math.abs(base) : 0)*100).toFixed(0)) + '%)' : '';
		};
	var makeFoodRow = function (item) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health), sign(item.hunger), isNaN(item.sanity) ? '' : sign(item.sanity), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' ' + pl('day', item.perish / total_day_time), item.info || '');
	};
	var makeRecipeRow = function (item, health, hunger) {
		return cells('td', item.img ? item.img : '', item.name, sign(item.health) + pct(health, item.health), sign(item.hunger) + pct(hunger, item.hunger), isNaN(item.sanity) ? '' : sign(item.sanity), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' ' + pl('day', item.perish / total_day_time), (item.cooktime * base_cook_time + 0.5 | 0) + ' secs', item.priority || '0', item.requires || '');
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
				{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Info': ''},
				Array.prototype.slice.call(food),
				makeFoodRow,
				'name',
				false,
				setFoodHighlight,
				testFoodHighlight
			),
			recipeTable = makeSortableTable(
				{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': ''},
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

	var ingredientToIcon = function (a, b) {
			return a + '[ingredient:' + food[b.id].name + '|' + food[b.id].img + ']';
		},
		makeRecipeGrinder = function (ingredients) {
			var makableButton = document.createElement('button');
			makableButton.appendChild(document.createTextNode('Calculate efficient recipes (may take some time)'));
			makableButton.className = 'makablebutton';
			makableButton.addEventListener('click', function () {
				var idealIngredients = [],
					i = ingredients ? ingredients.length : null,
					selectedRecipe,
					selectedRecipeElement,
					addedRecipes = 0,
					makableRecipes = [],
					makableRecipe,
					makableSummary,
					makableFootnote,
					splitCommaSpace = /, */,
					makableFilter,
					customFilter = null,
					customFilterHolder,
					customFilterInput,
					usesIngredients = [],
					excludesIngredients = [],
					makableApply,
					option,
					made,
					makableDiv,
					makableTable,
					checkExcludes = function (item) {
						return excludesIngredients.indexOf(item.id) !== -1;
					},
					checkIngredient = function (item) {
						return this.indexOf(food[item]) !== -1;
						//return usesIngredients.indexOf(item.id) !== -1;
					},
					toggleFilter = function (e) {
						if (excludesIngredients.indexOf(e.target.dataset.id) !== -1) {
							excludesIngredients.splice(excludesIngredients.indexOf(e.target.dataset.id), 1);
						}
						if (usesIngredients.indexOf(e.target.dataset.id) !== -1) {
							usesIngredients.splice(usesIngredients.indexOf(e.target.dataset.id), 1);
							e.target.className = '';
						} else {
							usesIngredients.push(e.target.dataset.id);
							e.target.className = 'selected';
						}
						makableTable.update();
					},
					toggleExclude = function (e) {
						if (usesIngredients.indexOf(e.target.dataset.id) !== -1) {
							usesIngredients.splice(usesIngredients.indexOf(e.target.dataset.id), 1);
						}
						if (excludesIngredients.indexOf(e.target.dataset.id) !== -1) {
							excludesIngredients.splice(excludesIngredients.indexOf(e.target.dataset.id), 1);
							e.target.className = '';
						} else {
							excludesIngredients.push(e.target.dataset.id);
							e.target.className = 'excluded';
						}
						makableTable.update();
						e.preventDefault();
					},
					setRecipe = function (e) {
						if (selectedRecipeElement) {
							selectedRecipeElement.className = '';
						}
						if (selectedRecipe === e.target.dataset.recipe) {
							selectedRecipeElement = null;
							selectedRecipe = null;
						} else {
							selectedRecipe = e.target.dataset.recipe;
							selectedRecipeElement = e.target;
							e.target.className = 'selected';
						}
						makableTable.update();
					};
				//TODO: optimize so much around this
				if (i === null) {
					i = food.length;
					ingredients = food;
				}
				while (i--) {
					if (ingredients[i].cook && idealIngredients.indexOf(ingredients[i].cook) === -1 && !ingredients[i].cook.uncookable) {
						idealIngredients.push(ingredients[i].cook);
					}
					if (!ingredients[i].uncookable && (ingredients[i].ideal || !ingredients[i].cook || ingredients[i].cook.uncookable) && idealIngredients.indexOf(ingredients[i]) === -1) {
						idealIngredients.push(ingredients[i]);
					}
				}
				made = [];
				makableTable = makeSortableTable(
					{'': '', 'Name': 'name', 'Health': 'health', 'Health+:Health gained compared to ingredients': 'healthpls', 'Hunger': 'hunger', 'Hunger+:Hunger gained compared to ingredients': 'hungerpls', 'Ingredients': ''},
					made,
					function (data) {
						var item = data.recipe,
							health = data.tags.health,
							hunger = data.tags.hunger;
						
						return cells('td', item.img ? item.img : '', item.name, sign(item.health), sign(data.healthpls) + ' (' + sign((data.healthpct * 100) | 0) + '%)', sign(item.hunger), sign(data.hungerpls) + ' (' + sign((data.hungerpct * 100) | 0) + '%)',
							makeLinkable(data.ingredients.reduce(ingredientToIcon, '') + (data.multiple ? '*' : '')));
					},
					'hungerpls',
					false,
					null,
					null,
					function (data) {
						return (!selectedRecipe || data.recipe.name === selectedRecipe) && (!excludesIngredients.length || !data.ingredients.some(checkExcludes)) && (!usesIngredients.length || usesIngredients.every(checkIngredient, data.ingredients));
					},
					0,
					15
				);
				makableDiv = document.createElement('div');
				makableSummary = document.createElement('div');
				makableSummary.appendChild(document.createTextNode('Computing combinations..'));
				makableFootnote = document.createElement('div');
				makableFootnote.appendChild(document.createTextNode('* combination has multiple possible results'));
				makableDiv.appendChild(makableSummary);
				makableRecipe = document.createElement('div');
				makableRecipe.className = 'recipeFilter';
				makableDiv.appendChild(makableRecipe);
				makableFilter = document.createElement('div');
				makableFilter.className = 'foodFilter';
				idealIngredients.forEach(function (item) {
					var img = makeImage(item.img, 32);
					img.dataset.id = item.id;
					img.addEventListener('click', toggleFilter, false);
					img.addEventListener('contextmenu', toggleExclude, false);
					img.title = item.name;
					makableFilter.appendChild(img);
				});
				makableDiv.appendChild(makableFilter);
				customFilterHolder = document.createElement('div');
				customFilterInput = document.createElement('input');
				customFilterInput.type = 'text';
				customFilterInput.placeholder = 'use custom filter';
				customFilterInput.className = 'customFilterInput';
				customFilterHolder.appendChild(customFilterInput);
				makableDiv.appendChild(makableTable);
				makableButton.parentNode.replaceChild(makableDiv, makableButton);
				makableDiv.appendChild(makableFootnote);
				getRealRecipesFromCollection(idealIngredients, function (data) { //row update
					var i, img;
					if (makableRecipes.indexOf(data.recipe.name) === -1) {
						for (i = 0; i < makableRecipes.length; i++) {
							if (data.recipe.name < makableRecipes[i]) {
								break;
							}
						}
						makableRecipes.splice(i, 0, data.recipe.name);
						img = makeImage(recipes.byName(makableRecipes[i].toLowerCase()).img);
						//TODO: optimize
						img.dataset.recipe = makableRecipes[i];
						img.addEventListener('click', setRecipe, false);
						img.title = data.recipe.name;
						if (i < makableRecipe.childNodes.length) {
							makableRecipe.insertBefore(img, makableRecipe.childNodes[i]);
						} else {
							makableRecipe.appendChild(img);
						}
					}
					if (!data.name) {
						data.name = data.recipe.name;
						data.health = data.recipe.health;
						data.ihealth = data.tags.health;
						data.healthpls = data.recipe.health - data.tags.health;
						data.hunger = data.recipe.hunger;
						data.ihunger = data.tags.hunger;
						data.hungerpls = data.recipe.hunger - data.tags.hunger;
						data.healthpct = rawpct(data.tags.health, data.recipe.health);
						data.hungerpct = rawpct(data.tags.hunger, data.recipe.hunger);
						data.sanity = data.recipe.sanity;
						data.perish = data.recipe.perish;
					}
					made.push(data);
				}, function () { //chunk update
					/*
					//this code provided updates to the table while the data was being crunched
					//there wasn't much point since it wasn't really usable until it was done calculating things anyway
					var l = makableRecipes.length, img;
					while (addedRecipes < l) {
						img = makeImage(recipes.byName(makableRecipes[addedRecipes].toLowerCase()).img);
						//TODO: optimize
						img.dataset.recipe = makableRecipes[addedRecipes];
						img.addEventListener('click', setRecipe, false);
						makableRecipe.appendChild(img);
						addedRecipes++;
						makableRecipes.sort();
						if (selectedRecipe !== makableRecipes[0]) {
							selectedRecipe = makableRecipes[0];
							selectedRecipeElement = makableRecipe.firstChild;
							makableRecipe.firstChild.className = 'selected';
						}
						makableSummary.firstChild.textContent = 'Found ' + made.length + ' valid recipes..';
						makableTable.update();
					}*/
					makableSummary.firstChild.textContent = 'Found ' + made.length + ' valid recipes..';
					//makableTable.update();
				}, function () { //computation finished
					makableTable.setMaxRows(30);
					makableSummary.firstChild.textContent = 'Found ' + made.length + ' valid recipes. Showing top 30 for selected recipe using all selected ingredients. Right-click to exclude ingredients.';
				});
			}, false);
			return makableButton;
		};
	document.getElementById('statistics').appendChild(makeRecipeGrinder());
	var highest = function (array, property) {
		return array.reduce(function (previous, current) {
			return Math.max(previous, current[property] || 0);
		}, -100000);
	};

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
				var searchSelector = document.createElement('span'),
					searchSelectorControls,
					dropdown = document.createElement('div'),
					ul = document.createElement('ul'),
					picker = pickers[i],
					index = i,
					state,
					from = picker.dataset.type === 'recipes' ? recipes : food,
					allowUncookable = !picker.dataset.cookable,
					parent = picker.nextSibling,
					slots = parent.getElementsByClassName('ingredient'),
					limited,
					ingredients = [],
					updateRecipes,
					suggestions = [],
					inventoryrecipes = [],
					selected = null,
					loaded = false,
					results = document.getElementById('results'),
					discoverfood = document.getElementById('discoverfood'),
					discover = document.getElementById('discover'),
					makable = document.getElementById('makable'),
					clear = document.createElement('span'),
					findPreviousMatching = function (el, test) {
						var previous = el;
						while (previous.previousSibling) {
							previous = previous.previousSibling;
							if (test(previous)) {
								return previous;
							}
						}
						return null;
					},
					findNextMatching = function (el, test) {
						var next = el;
						while (next.nextSibling) {
							next = next.nextSibling;
							if (test(next)) {
								return next;
							}
						}
						return null;
					},
					displaying = false,
					appendSlot = function (id) {
						var i, item = food[id] || recipes[id] || null;
						if (limited) {
							for (i = 0; i < slots.length; i++) {
								if (getSlot(slots[i]) === null) {
									setSlot(slots[i], item);
									loaded && updateRecipes();
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
								loaded && updateRecipes();
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
							/*dropdown.removeChild(ul);
							ul = document.createElement('div');
							names = matchingNames(from, '', allowUncookable);
							ul.dataset.length = 0;
							names.forEach(liIntoPicker, ul);
							dropdown.appendChild(ul);
							if (ul.firstChild) {
								ul.firstChild.className = 'selected';
							}
							picker.value = '';*/
							/*if (result < slots.length - 1 || !limited) {
								//picker.focus();
							} else {
								//picker.blur();
							}*/
							e && e.preventDefault && e.preventDefault();
							//refreshLocation();
						}
					},
					liIntoPicker = function (item) {
						var img = makeImage(item.img, 32),
							li = document.createElement('span');
						li.appendChild(img);
						li.appendChild(document.createTextNode(item.name));
						li.dataset.id = item.id;
						//li.dataset.tooltip = item.name;
						if (ingredients.indexOf(item) !== -1) {
							li.style.opacity = 0.5;
						}
						li.addEventListener('mousedown', pickItem, false);
						this.appendChild(li);
						this.dataset.length++;
						/*if (this.dataset.length % 10 === 0) {
							this.appendChild(document.createElement('br'));
						}*/
					},
					updateFaded = function (el) {
						if (ingredients.indexOf(food[el.dataset.id]) !== -1) {
							if (!el.style.opacity) {
								el.style.opacity = 0.5;
							}
						} else {
							if (el.style.opacity) {
								el.style.removeProperty('opacity');
							}
						}
					},
					removeSlot = function (e) {
						var i, target = e.target.tagName === 'IMG' ? e.target.parentNode : e.target;
						if (limited) {
							if (getSlot(target) !== null) {
								setSlot(target, null);
								updateRecipes();
								return target.dataset.id;
							} else {
								//picker.focus();
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
						/*if (mainElement.offsetLeft - dropdown.offsetWidth > 0) {
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
						}*/
					},
					refreshPicker = function () {
						var names;
						searchSelectorControls.splitTag();
						names = matchingNames(from, searchSelectorControls.getSearch(), allowUncookable);
						dropdown.removeChild(ul);
						ul = document.createElement('div');
						ul.dataset.length = 0;
						names.forEach(liIntoPicker, ul);
						dropdown.appendChild(ul);
						//refreshLocation();
						selected = null;
					},
					searchFor = function (e) {
						var name = e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link,
							matches = matchingNames(from, name, allowUncookable);
						if (matches.length === 1) {
							appendSlot(matches[0].id);
						} else {
							picker.value = name;
							refreshPicker();
							//picker.focus();
						}
					},
					coords;
				if (parent.id === 'ingredients') {
					//simulator
					updateRecipes = function () {
						var cooking,
							health, hunger,
							table;
						ingredients = Array.prototype.map.call(slots, function (slot) {
							return getSlot(slot);
						});
						cooking = getRecipes(ingredients);
						health = cooking[0].health;
						hunger = cooking[0].hunger;
						table = makeSortableTable(
							{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': ''},
							cooking,
							function (item) {
								return makeRecipeRow(item, health, hunger);
							},
							'priority',
							true,
							searchFor,
							function (item, array) {
								return array.length > 0 && item.priority === highest(array, 'priority');
							}
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
									{'': '', 'Name': 'name', 'Health:(% more than ingredients)': 'health', 'Hunger:(% more than ingredients)': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': ''},
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
						ul && ul.firstChild && Array.prototype.forEach.call(ul.getElementsByTagName('span'), updateFaded);
					};
				} else if (parent.id === 'inventory') {
					//discovery
					updateRecipes = function () {
						var foodTable,
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
						if (makable.firstChild) {
							makable.removeChild(makable.firstChild);
						}
						if (ingredients.length > 0) {
							foodTable = makeSortableTable(
								{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Info': ''},
								ingredients,
								makeFoodRow,
								'name'
							);
							discoverfood.appendChild(foodTable);
							getSuggestions(inventoryrecipes, ingredients, null, true);
							if (inventoryrecipes.length > 0) {
								table = makeSortableTable(
									{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': ''},
									inventoryrecipes,
									makeRecipeRow,
									'name'
								)
								discover.appendChild(table);

								makable.appendChild(makeRecipeGrinder(ingredients));
							}
						}
						ul && ul.firstChild && Array.prototype.forEach.call(ul.getElementsByTagName('span'), updateFaded);
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
				loaded = true;
				searchSelector.className = 'searchselector retracted';
				searchSelector.appendChild(document.createTextNode('name'));
				searchSelectorControls = (function () {
					var dropdown = document.createElement('div'),
						extended = false,
						extendedHeight = null,
						searchTypes = [{title: 'name', prefix: '', placeholder: 'Filter ingredients'}, {title: 'tag', prefix: 'tag:', placeholder: 'Meat, veggie, fruit, egg, monster...'}, {title: 'recipe', prefix: 'recipe:', placeholder: 'Find ingredients used in a recipe'}],
						selectedType = searchTypes[0],
						retractTimer = null,
						retract = function () {
							extended = false;
							dropdown.style.height = '0px';
							searchSelector.style.borderBottomLeftRadius = '3px';
							dropdown.style.borderTopLeftRadius = '3px';
							if (retractTimer !== null) {
								clearTimeout(retractTimer);
								retractTimer = null;
							}
							searchSelector.className = 'searchselector retracted';
						},
						extend = function () {
							if (extendedHeight === null) {
								dropdown.style.height = 'auto';
								dropdown.style.left = searchSelector.offsetLeft;
								dropdown.style.top = searchSelector.offsetTop + searchSelector.offsetHeight;
								extendedHeight = dropdown.offsetHeight + 'px';
								dropdown.style.height = '0px';
							}
							extended = true;
							dropdown.style.height = extendedHeight;
							searchSelector.style.borderBottomLeftRadius = '0px';
							dropdown.style.borderTopLeftRadius = '0px';
							dropdown.style.width = 'auto';
							dropdown.style.width = Math.max(dropdown.offsetWidth, searchSelector.offsetWidth + 1) + 'px';
							if (retractTimer !== null) {
								clearTimeout(retractTimer);
								retractTimer = null;
							}
							searchSelector.className = 'searchselector extended';
						},
						setSearchType = function (searchType) {
							selectedType = searchType;
							picker.placeholder = selectedType.placeholder;
							searchSelector.firstChild.textContent = selectedType.title;
						},
						setSearchTypeFromClick = function (e) {
							setSearchType(searchTypes[e.target.dataset.typeIndex]);
							refreshPicker();
							retract();
						},
						tagsplit = /: */,
						controls = {
							getTag: function () {
								return selectedType.title;
							},
							setSearchType: function (index) {
								setSearchType(searchTypes[index]);
							},
							getSearch: function () {
								return selectedType.prefix + picker.value;
							},
							splitTag: function () {
								var i,
									parts = picker.value.split(tagsplit),
									tag,
									name;
								if (parts.length === 2) {
									tag = parts[0].toLowerCase() + ':';
									name = parts[1];
									for (i = 0; i < searchTypes.length; i++) {
										if (tag === searchTypes[i].prefix) {
											setSearchType(searchTypes[i]);
											picker.value = name;
											break;
										}
									}
								}
							}
						};
					searchSelector.addEventListener('click', function () {
						if (extended) {
							retract();
						} else {
							extend();
						}
					}, false);
					searchSelector.addEventListener('selectstart', function (e) { e.preventDefault(); }, false);
					searchSelector.addEventListener('mouseout', function () {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
						}
						retractTimer = setTimeout(retract, 500);
					}, false);
					searchSelector.addEventListener('mouseover', function () {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
							retractTimer = null;
						}
					}, false);
					dropdown.addEventListener('mouseout', function () {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
						}
						retractTimer = setTimeout(retract, 500);
					}, false);
					dropdown.addEventListener('mouseover', function () {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
							retractTimer = null;
						}
					}, false);
					searchTypes.forEach(function (searchType, index) {
						var element = document.createElement('div');
						element.appendChild(document.createTextNode(searchType.title));
						element.dataset.typeIndex = index;
						element.addEventListener('click', setSearchTypeFromClick, false);
						searchType.element = element;
						dropdown.appendChild(element);
					});
					picker.parentNode.insertBefore(searchSelector, picker);
					dropdown.className = 'searchdropdown';
					picker.parentNode.insertBefore(dropdown, picker);
					return controls;
				}());
				dropdown.className = 'ingredientdropdown';
				dropdown.appendChild(ul);
				dropdown.addEventListener('mousedown', function (e) { e.preventDefault(); }, false);
				(function () {
					var names = matchingNames(from, searchSelectorControls.getSearch(), allowUncookable);
					dropdown.removeChild(ul);
					ul = document.createElement('div');
					ul.dataset.length = 0;
					names.forEach(liIntoPicker, ul);
					dropdown.appendChild(ul);
				}());
				clear.className = 'clearingredients';
				clear.appendChild(document.createTextNode('clear'));
				clear.addEventListener('click', function () {
					if (picker.value === '' && searchSelectorControls.getTag() === 'name') {
						while (getSlot(parent.firstChild)) {
							removeSlot({ target: parent.firstChild });
						}
					} else {
						picker.value = '';
						searchSelectorControls.setSearchType(0);
						refreshPicker();
					}
				}, false);
				clear.addEventListener('mouseover', function () {
					if (picker.value === '' && searchSelectorControls.getTag() === 'name') {
						clear.firstChild.textContent = 'clear chosen ingredients';
					}
				}, false);
				clear.addEventListener('mouseout', function () {
					if (clear.firstChild.textContent !== 'clear') {
						clear.firstChild.textContent = 'clear';
					}
				}, false);
				parent.parentNode.insertBefore(clear, parent);
				parent.parentNode.insertBefore(dropdown, parent);
				picker.addEventListener('keydown', function (e) {
					var movement = [16, 17, 37, 38, 39, 40, 13],
						up = 38, left = 37, down = 40, right = 39, enter = 13, current, items, i, find;
					if (movement.indexOf(e.keyCode) !== -1) {
						current = selected;
						if (e.keyCode === enter) {
							if (selected === null) {
								selected = ul.firstChild || null;
							}
							if (selected !== null) {
								pickItem({target: selected});
							}
						} else {
							if (selected === null) {
								if (e.keyCode === down) {
									selected = ul.childNodes[1] || ul.firstChild || null;
									if (selected !== null) {
										coords = (selected.offsetLeft + selected.offsetWidth / 2);
										e.preventDefault();
									}
								}
							} else {
								e.preventDefault();
								if (e.keyCode === left) {
									if (selected.previousSibling && selected.previousSibling.offsetTop === selected.offsetTop) {
										selected = selected.previousSibling;
									} else {
										find = findNextMatching(selected, function (el) {
											//separate this out
											return el.offsetTop !== selected.offsetTop;
										});
										if (find) {
											selected = find.previousSibling;
										} else {
											selected = ul.lastChild;
										}
									}
									if (selected !== null) {
										coords = (selected.offsetLeft + selected.offsetWidth / 2);
									}
								} else if (e.keyCode === right) {
									if (selected.nextSibling && selected.nextSibling.offsetTop === selected.offsetTop) {
										selected = selected.nextSibling;
									} else {
										find = findPreviousMatching(selected, function (el) {
											//separate this out
											return el.offsetTop !== selected.offsetTop;
										});
										if (find) {
											selected = find.nextSibling;
										} else {
											selected = ul.firstChild;
										}
									}
									if (selected !== null) {
										coords = (selected.offsetLeft + selected.offsetWidth / 2);
									}
								} else if (e.keyCode === up) {
									find = findPreviousMatching(selected, function (el) {
										return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
									});
									if (!find) {
										find = findPreviousMatching(ul.lastChild, function (el) {
											return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
										});
									}
									if (find) {
										selected = find;
									} else {
										selected = ul.firstChild;
									}
								} else if (e.keyCode === down) {
									find = findNextMatching(selected, function (el) {
										return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
									});
									if (!find) {
										find = findNextMatching(ul.firstChild, function (el) {
											return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
										});
									}
									if (find) {
										selected = find;
									} else {
										selected = ul.lastChild;
									}
								}
							}
						}
						if (selected !== current) {
							if (current !== null) {
								current.className = '';
							}
							if (selected !== null) {
								selected.className = 'selected';
							}
						}
					}
				}, false);
				picker.addEventListener('keyup', function (e) {
					var movement = [16, 17, 37, 38, 39, 40, 13],
						up = 38, left = 37, down = 40, right = 39, enter = 13, current, items, i;
					current = selected;
					if (movement.indexOf(e.keyCode) === -1) {
						refreshPicker();
					} else if (selected !== null) {
						e.preventDefault();
					}
					/*
					using comments as version control is bad
					else {
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
					}*/
				}, false);
				picker.addEventListener('focus', function () {
					if (!displaying) {
						displaying = true;
						//parent.appendChild(dropdown);
						//refreshLocation();
					}
				}, false);
				picker.addEventListener('blur', function () {
					if (displaying) {
						displaying = false;
						//parent.removeChild(dropdown);
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