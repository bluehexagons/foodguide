import {
	healing_tiny,
	healing_small,
	healing_medsmall,
	healing_med,
	healing_medlarge,
	healing_large,
	healing_huge,
	healing_superhuge,
	sanity_tiny,
	sanity_small,
	sanity_med,
	sanity_medlarge,
	sanity_large,
	sanity_huge,
	perish_one_day,
	perish_superfast,
	perish_fast,
	perish_fastish,
	perish_med,
	perish_slow,
	perish_preserved,
	calories_tiny,
	calories_small,
	calories_medsmall,
	calories_med,
	calories_large,
	calories_huge,
	calories_superhuge,
	hot_food_bonus_temp,
	cold_food_bonus_temp,
	food_temp_brief,
	food_temp_average,
	food_temp_long,
	buff_food_temp_duration
} from './constants.js';
import {
	COMPARE,
	AND,
	OR,
	NOT,
	NAME,
	SPECIFIC,
	TAG
} from './functions.js';

export const recipes = {
	butterflymuffin: {
		name: 'Butter Muffin',
		test: (cooker, names, tags) => {
			//return (names.butterflywings || names.moonbutterflywings) && !tags.meat && tags.veggie; <- For when issue #32 is sorted out
			return names.butterflywings && !tags.meat && tags.veggie;
		},
		requires: 'Butterfly Wings, veggie',
		requirements: [NAME('butterflywings'), NOT(TAG('meat')), TAG('veggie')],
		priority: 1,
		weight: 1,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 2
	},
	frogglebunwich: {
		name: 'Froggle Bunwich',
		test: (cooker, names, tags) => {
			return (names.froglegs || names.froglegs_cooked) && tags.veggie;
		},
		requirements: [NAME('froglegs'), TAG('veggie')],
		priority: 1,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 2
	},
	taffy: {
		name: 'Taffy',
		test: (cooker, names, tags) => {
			return tags.sweetener && tags.sweetener >= 3 && !tags.meat;
		},
		requirements: [TAG('sweetener', COMPARE('>=', 3)), NOT(TAG('meat'))],
		priority: 10,
		foodtype: 'veggie',
		health: -healing_small,
		hunger: calories_small * 2,
		perish: perish_slow,
		sanity: sanity_med,
		cooktime: 2,
		tags: ['honeyed']
	},
	pumpkincookie: {
		name: 'Pumpkin Cookie',
		test: (cooker, names, tags) => {
			return (names.pumpkin || names.pumpkin_cooked) && tags.sweetener && tags.sweetener >= 2;
		},
		requirements: [NAME('pumpkin'), TAG('sweetener', COMPARE('>=', 2))],
		priority: 10,
		foodtype: 'veggie',
		health: 0,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		tags: ['honeyed']
	},
	stuffedeggplant: {
		name: 'Stuffed Eggplant',
		test: (cooker, names, tags) => {
			return (names.eggplant || names.eggplant_cooked) && tags.veggie && tags.veggie > 1;
		},
		requirements: [NAME('eggplant'), TAG('veggie', COMPARE('>', 1))],
		priority: 1,
		foodtype: 'veggie',
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
		test: (cooker, names, tags) => {
			return tags.fish && names.twigs && (tags.inedible && tags.inedible <= 1);
		},
		requirements: [TAG('fish'), SPECIFIC('twigs'), TAG('inedible'), TAG('inedible', COMPARE('<=', 1))],
		priority: 10,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 2
	},
	honeynuggets: {
		name: 'Honey Nuggets',
		test: (cooker, names, tags) => {
			return names.honey && tags.meat && tags.meat <= 1.5 && !tags.inedible;
		},
		requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('<=', 1.5)), NOT(TAG('inedible'))],
		priority: 2,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 2,
		tags: ['honeyed']
	},
	honeyham: {
		name: 'Honey Ham',
		test: (cooker, names, tags) => {
			return names.honey && tags.meat && tags.meat > 1.5 && !tags.inedible;
		},
		requirements: [SPECIFIC('honey'), TAG('meat', COMPARE('>', 1.5)), NOT(TAG('inedible'))],
		priority: 2,
		foodtype: 'meat',
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
		test: (cooker, names, tags) => {
			return (names.dragonfruit || names.dragonfruit_cooked) && !tags.meat;
		},
		requirements: [NAME('dragonfruit'), NOT(TAG('meat'))],
		priority: 1,
		foodtype: 'veggie',
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
		test: (cooker, names, tags) => {
			return tags.meat && names.twigs && (!tags.monster || tags.monster <= 1) && (tags.inedible && tags.inedible <= 1);
		},
		requirements: [TAG('meat'), SPECIFIC('twigs'), OR(NOT(TAG('monster')), TAG('monster', COMPARE('<=', 1))), TAG('inedible'), TAG('inedible', COMPARE('<=', 1))],
		priority: 5,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 2
	},
	mandrakesoup: {
		name: 'Mandrake Soup',
		test: (cooker, names, tags) => {
			return names.mandrake;
		},
		requirements: [SPECIFIC('mandrake')],
		priority: 10,
		foodtype: 'veggie',
		health: healing_superhuge,
		hunger: calories_superhuge,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 3
	},
	baconeggs: {
		name: 'Bacon and Eggs',
		test: (cooker, names, tags) => {
			return tags.egg && tags.egg > 1 && tags.meat && tags.meat > 1 && !tags.veggie;
		},
		requirements: [TAG('egg', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), NOT(TAG('veggie'))],
		priority: 10,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_huge,
		perish: perish_preserved,
		sanity: sanity_tiny,
		cooktime: 2
	},
	meatballs: {
		name: 'Meatballs',
		test: (cooker, names, tags) => {
			return tags.meat && !tags.inedible;
		},
		requirements: [TAG('meat'), NOT(TAG('inedible'))],
		priority: -1,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_small * 5,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 0.75
	},
	bonestew: {
		name: 'Meaty Stew',
		test: (cooker, names, tags) => {
			return tags.meat && tags.meat >= 3 && !tags.inedible;
		},
		requirements: [TAG('meat', COMPARE('>=', 3)), NOT(TAG('inedible'))],
		priority: 0,
		foodtype: 'meat',
		health: healing_small * 4,
		hunger: calories_large * 4,
		perish: perish_med,
		sanity: sanity_tiny,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_long,
		cooktime: 0.75
	},
	perogies: {
		name: 'Pierogi',
		test: (cooker, names, tags) => {
			return tags.egg && tags.meat && tags.veggie && !tags.inedible;
		},
		requirements: [TAG('egg'), TAG('meat'), TAG('veggie'), NOT(TAG('inedible'))],
		priority: 5,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large,
		perish: perish_preserved,
		sanity: sanity_tiny,
		cooktime: 1
	},
	turkeydinner: {
		name: 'Turkey Dinner',
		test: (cooker, names, tags) => {
			return names.drumstick && names.drumstick > 1 && tags.meat && tags.meat > 1 && (tags.veggie || tags.fruit);
		},
		requirements: [SPECIFIC('drumstick', COMPARE('>', 1)), TAG('meat', COMPARE('>', 1)), OR(TAG('veggie'), TAG('fruit'))],
		priority: 10,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_huge,
		perish: perish_fast,
		sanity: sanity_tiny,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_average,
		cooktime: 3
	},
	ratatouille: {
		name: 'Ratatouille',
		test: (cooker, names, tags) => {
			return !tags.meat && tags.veggie && !tags.inedible;
		},
		requirements: [NOT(TAG('meat')), TAG('veggie'), NOT(TAG('inedible'))],
		priority: 0,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_med,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 1
	},
	jammypreserves: {
		name: 'Fist Full of Jam',
		test: (cooker, names, tags) => {
			return tags.fruit && !tags.meat && !tags.veggie && !tags.inedible;
		},
		requirements: [TAG('fruit'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('inedible'))],
		priority: 0,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_small * 3,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 0.5
	},
	fruitmedley: {
		name: 'Fruit Medley',
		test: (cooker, names, tags) => {
			return tags.fruit && tags.fruit >= 3 && !tags.meat && !tags.veggie;
		},
		requirements: [TAG('fruit', COMPARE('>=', 3)), NOT(TAG('meat')), NOT(TAG('veggie'))],
		priority: 0,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_med,
		perish: perish_fast,
		sanity: sanity_tiny,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_brief,
		cooktime: 0.5
	},
	fishtacos: {
		name: 'Fish Tacos',
		test: (cooker, names, tags) => {
			return tags.fish && (names.corn || names.corn_cooked);
		},
		requirements: [TAG('fish'), NAME('corn')],
		priority: 10,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 0.5,
		tags: ['monstermeat']
	},
	waffles: {
		name: 'Waffles',
		test: (cooker, names, tags) => {
			//return names.butter && (names.berries || names.berries_cooked || names.berries_juicy || names.berries_juicy_cooked) && tags.egg; <- For when issue #32 is sorted out
			return names.butter && (names.berries || names.berries_cooked) && tags.egg;
		},
		requirements: [SPECIFIC('butter'), NAME('berries'), TAG('egg')],
		priority: 10,
		foodtype: 'veggie',
		health: healing_huge,
		hunger: calories_large,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 0.5
	},
	monsterlasagna: {
		name: 'Monster Lasagna',
		test: (cooker, names, tags) => {
			return tags.monster && tags.monster >= 2 && !tags.inedible;
		},
		requirements: [TAG('monster', COMPARE('>=', 2)), NOT(TAG('inedible'))],
		priority: 10,
		foodtype: 'meat',
		health: -healing_med,
		hunger: calories_large,
		perish: perish_fast,
		sanity: -sanity_medlarge,
		cooktime: 0.5
	},
	powcake: {
		name: 'Powdercake',
		test: (cooker, names, tags) => {
			return names.twigs && names.honey && (names.corn || names.corn_cooked);
		},
		requirements: [SPECIFIC('twigs'), SPECIFIC('honey'), NAME('corn')],
		priority: 10,
		foodtype: 'veggie',
		health: -healing_small,
		hunger: 0,
		perish: 9000000,
		sanity: 0,
		cooktime: 0.5,
		tags: ['honeyed']
	},
	unagi: {
		name: 'Unagi',
		test: (cooker, names, tags) => {
			return names.cutlichen && (names.eel || names.eel_cooked);
		},
		requirements: [SPECIFIC('cutlichen'), NAME('eel')],
		priority: 20,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_medsmall,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 0.5
	},
	wetgoop: {
		name: 'Wet Goop',
		test: (cooker, names, tags) => {
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

	// Giants recipes
	flowersalad: {
		name: 'Flower Salad',
		test: (cooker, names, tags) => {
			return names.cactusflower && tags.veggie && tags.veggie >= 2 && !tags.meat && !tags.inedible && !tags.egg && !tags.sweetener && !tags.fruit;
		},
		requirements: [SPECIFIC('cactusflower'), TAG('veggie', COMPARE('>=', 2)), NOT(TAG('meat')), NOT(TAG('inedible')), NOT(TAG('egg')), NOT(TAG('sweetener')), NOT(TAG('fruit'))],
		priority: 10,
		foodtype: 'veggie',
		health: healing_large,
		hunger: calories_small,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 0.5,
		mode: 'giants'
	},
	icecream: {
		name: 'Ice Cream',
		test: (cooker, names, tags) => {
			return tags.frozen && tags.dairy && tags.sweetener && !tags.meat && !tags.veggie && !tags.inedible && !tags.egg;
		},
		requirements: [TAG('frozen'), TAG('dairy'), TAG('sweetener'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('inedible')), NOT(TAG('egg'))],
		priority: 10,
		foodtype: 'veggie',
		health: 0,
		hunger: calories_med,
		perish: perish_superfast,
		sanity: sanity_huge,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_long,
		cooktime: 0.5,
		mode: 'giants'
	},
	watermelonicle: {
		name: 'Melonsicle',
		test: (cooker, names, tags) => {
			return names.watermelon && tags.frozen && names.twigs && !tags.meat && !tags.veggie && !tags.egg;
		},
		requirements: [SPECIFIC('watermelon'), TAG('frozen'), SPECIFIC('twigs'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('egg'))],
		priority: 10,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_small,
		perish: perish_superfast,
		sanity: sanity_medlarge,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_average,
		cooktime: 0.5,
		mode: 'giants'
	},
	trailmix: {
		name: 'Trail Mix',
		test: (cooker, names, tags) => {
			//return names.acorn_cooked && tags.seed && tags.seed >= 1 && (names.berries || names.berries_cooked || names.berries_juicy || names.berries_juicy_cooked) && tags.fruit && tags.fruit >= 1 && !tags.meat && !tags.veggie && !tags.egg && !tags.dairy; <- For when issue #32 is sorted out
			return names.acorn_cooked && tags.seed && tags.seed >= 1 && (names.berries || names.berries_cooked) && tags.fruit && tags.fruit >= 1 && !tags.meat && !tags.veggie && !tags.egg && !tags.dairy;
		},
		requirements: [SPECIFIC('acorn_cooked'), TAG('seed', COMPARE('>=', 1)), NAME('berries'), TAG('fruit', COMPARE('>=', 1)), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('egg')), NOT(TAG('dairy'))],
		priority: 10,
		foodtype: 'veggie',
		health: healing_medlarge,
		hunger: calories_small,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 0.5,
		mode: 'giants'
	},
	hotchili: {
		name: 'Spicy Chili',
		test: (cooker, names, tags) => {
			return tags.meat && tags.veggie && tags.meat >= 1.5 && tags.veggie >= 1.5;
		},
		requirements: [TAG('meat', COMPARE('>=', 1.5)), TAG('veggie', COMPARE('>=', 1.5))],
		priority: 10,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: 0,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_long,
		cooktime: 0.5,
		mode: 'giants'
	},
	guacamole: {
		name: 'Guacamole',
		test: (cooker, names, tags) => {
			//return names.mole && (names.rock_avocado_fruit_ripe || names.cactusmeat) && !tags.fruit; <- For when issue #32 is sorted out
			return names.mole && names.cactusmeat && !tags.fruit;
		},
		requirements: [SPECIFIC('mole'), SPECIFIC('cactusmeat'), NOT(TAG('fruit'))],
		priority: 10,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: 0,
		cooktime: 0.5,
		mode: 'giants'
	},

	//Shipwrecked recipes
	californiaroll: {
		name: 'California Roll',
		test: (cooker, names, tags) => {
			return names.seaweed && names.seaweed === 2 && tags.fish && tags.fish >= 1;
		},
		requirements: [SPECIFIC('seaweed', COMPARE('=', 2)), TAG('fish', COMPARE('>=', 1))],
		priority: 20,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_small,
		cooktime: 0.5,
		mode: 'shipwrecked'
	},
	seafoodgumbo: {
		name: 'Seafood Gumbo',
		test: (cooker, names, tags) => {
			return tags.fish && tags.fish > 2;
		},
		requirements: [TAG('fish', COMPARE('>', 2))],
		priority: 10,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_medlarge,
		cooktime: 1,
		mode: 'shipwrecked'
	},
	bisque: {
		name: 'Bisque',
		test: (cooker, names, tags) => {
			return names.limpets && names.limpets === 3 && tags.frozen;
		},
		requirements: [SPECIFIC('limpets', COMPARE('=', 3)), TAG('frozen')],
		priority: 30,
		foodtype: 'meat',
		health: healing_huge,
		hunger: calories_medsmall,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 1,
		mode: 'shipwrecked'
	},
	ceviche: {
		name: 'Ceviche',
		test: (cooker, names, tags) => {
			return tags.fish && tags.fish >= 2 && tags.frozen;
		},
		requirements: [TAG('fish', COMPARE('>=', 2)), TAG('frozen')],
		priority: 20,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_med,
		perish: perish_med,
		sanity: sanity_tiny,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_average,
		cooktime: 0.5,
		mode: 'shipwrecked'
	},
	jellyopop: {
		name: 'Jelly-O Pop',
		test: (cooker, names, tags) => {
			return tags.jellyfish && tags.frozen && tags.inedible;
		},
		requirements: [TAG('jellyfish'), TAG('frozen'), TAG('inedible')],
		priority: 20,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_small,
		perish: perish_superfast,
		sanity: 0,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_average,
		cooktime: 0.5,
		mode: 'shipwrecked'
	},
	bananapop: {
		name: 'Banana Pop',
		test: (cooker, names, tags) => {
			return names.cave_banana && tags.frozen && tags.inedible && !tags.meat && !tags.fish;
			//DST recipe, idk if the inedible part is necessary, but this is how it's presented in preparedfoods.lua, commented out due to issue #32
			//return (names.cave_banana || names.cave_banana_cooked) && tags.frozen && names.twigs && !tags.meat && !tags.fish && (tags.inedible && tags.inedible <= 2);
		},
		requirements: [SPECIFIC('cave_banana'), TAG('frozen'), TAG('inedible'), NOT(TAG('meat')), NOT(TAG('fish'))],
		//DST:
		//requirements: [NAME('cave_banana'), TAG('frozen'), SPECIFIC('twigs'), NOT(TAG('meat')), NOT(TAG('fish')), TAG('inedible', COMPARE('<=', 2))],
		priority: 20,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_small,
		perish: perish_superfast,
		sanity: sanity_large,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_average,
		cooktime: 0.5,
		mode: 'shipwrecked'
	},
	lobsterbisque: {
		name: 'Wobster Bisque',
		test: (cooker, names, tags) => {
			return names.lobster && tags.frozen;
		},
		requirements: [SPECIFIC('lobster'), TAG('frozen')],
		priority: 30,
		foodtype: 'meat',
		health: healing_huge,
		hunger: calories_med,
		perish: perish_med,
		sanity: sanity_small,
		cooktime: 0.5,
		mode: 'shipwrecked'
	},
	lobsterdinner: {
		name: 'Wobster Dinner',
		test: (cooker, names, tags) => {
			return names.lobster && names.butter && !tags.meat && !tags.frozen;
		},
		requirements: [SPECIFIC('lobster'), SPECIFIC('butter'), NOT(TAG('meat')), NOT(TAG('frozen'))],
		priority: 25,
		foodtype: 'meat',
		health: healing_huge,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_huge,
		cooktime: 1,
		mode: 'shipwrecked'
	},
	sharkfinsoup: {
		name: 'Shark Fin Soup',
		test: (cooker, names, tags) => {
			return names.shark_fin;
		},
		requirements: [SPECIFIC('shark_fin')],
		priority: 20,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_small,
		perish: perish_med,
		sanity: -sanity_small,
		cooktime: 1,
		note: 'Gives 10 naughtiness',
		mode: 'shipwrecked'
	},
	surfnturf: {
		name: 'Surf \'n\' Turf',
		test: (cooker, names, tags) => {
			return tags.meat && tags.meat >= 2.5 && tags.fish && tags.fish >= 1.5 && !tags.frozen;
		},
		requirements: [TAG('meat', COMPARE('>=', 2.5)), TAG('fish', COMPARE('>=', 1.5)), NOT(TAG('frozen'))],
		priority: 30,
		foodtype: 'meat',
		health: healing_huge,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_large,
		cooktime: 1,
		mode: 'shipwrecked'
	},
	coffee: {
		name: 'Coffee',
		test: (cooker, names, tags) => {
			return names.coffeebeans_cooked && (names.coffeebeans_cooked === 4 || (names.coffeebeans_cooked === 3 && (tags.dairy || tags.sweetener)));
		},
		requirements: [OR(SPECIFIC('coffeebeans_cooked', COMPARE('=', 4)), (AND(SPECIFIC('coffeebeans_cooked', COMPARE('=', 3)), OR(TAG('dairy'), TAG('sweetener')))))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_tiny,
		perish: perish_med,
		sanity: -sanity_tiny,
		cooktime: 0.5,
		note: 'Gives 5 bonus speed (+83%) for 240 seconds (0.5 days)',
		mode: 'shipwrecked'
	},
	tropicalbouillabaisse: {
		name: 'Tropical Bouillabaisse',
		test: (cooker, names, tags) => {
			return (names.fish3 || names.fish3_cooked) && (names.fish4 || names.fish4_cooked) && (names.fish5 || names.fish5_cooked) && tags.veggie;
		},
		requirements: [NAME('fish3'), NAME('fish4'), NAME('fish5'), TAG('veggie')],
		priority: 35,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		note: 'Removes 3 heat, and for 30 seconds, dries 1/s and adds 2 bonus speed (+33%)',
		mode: 'shipwrecked'
	},
	caviar: {
		name: 'Caviar',
		test: (cooker, names, tags) => {
			return (names.roe || names.roe_cooked === 3) && tags.veggie;
		},
		requirements: [OR(SPECIFIC('roe'), SPECIFIC('roe_cooked', COMPARE('=', 3))), TAG('veggie')],
		priority: 20,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_small,
		perish: perish_med,
		sanity: sanity_large,
		cooktime: 2,
		mode: 'shipwrecked'
	},

	//Warly recipes
	sweetpotatosouffle: {
		name: 'Sweet Potato Souffle',
		test: (cooker, names, tags) => {
			return names.sweet_potato && names.sweet_potato === 2 && tags.egg && tags.egg >= 2;
		},
		requirements: [SPECIFIC('sweet_potato', COMPARE('=', 2)), TAG('egg', COMPARE('>=', 2))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		mode: 'warly'
	},
	monstertartare: {
		name: 'Monster Tartare',
		test: (cooker, names, tags) => {
			return tags.monster && tags.monster >= 2 && tags.egg && tags.veggie;
		},
		requirements: [TAG('monster', COMPARE('>=', 2)), TAG('egg'), TAG('veggie')],
		priority: 30,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_small,
		cooktime: 2,
		mode: 'warly'
	},
	freshfruitcrepes: {
		name: 'Fresh Fruit Crepes',
		test: (cooker, names, tags) => {
			return tags.fruit && tags.fruit >= 1.5 && names.butter && names.honey;
		},
		requirements: [TAG('fruit', COMPARE('>=', 1.5)), SPECIFIC('butter'), SPECIFIC('honey')],
		priority: 30,
		foodtype: 'veggie',
		health: healing_huge,
		hunger: calories_superhuge,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		mode: 'warly'
	},
	musselbouillabaise: {
		name: 'Mussel Bouillabaise',
		test: (cooker, names, tags) => {
			return names.mussel && names.mussel === 2 && tags.veggie && tags.veggie >= 2;
		},
		requirements: [SPECIFIC('mussel', COMPARE('=', 2)), TAG('veggie', COMPARE('>=', 2))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		mode: 'warly'
	},

	//Hamlet recipes
	nettlelosange: {
		name: 'Nettle Rolls',
		test: (cooker, names, tags) => {
			return tags.antihistamine && tags.antihistamine >= 3;
		},
		requirements: [TAG('antihistamine', COMPARE('>=', 3))],
		priority: 0,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_med,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 0.5,
		note: 'Prevents hayfever for 720 seconds (1.5 days)',
		mode: 'hamlet'
	},
	snakebonesoup: {
		name: 'Snake Bone Soup',
		test: (cooker, names, tags) => {
			return tags.bone && tags.bone >= 2 && tags.meat && tags.meat >= 2;
		},
		requirements: [TAG('bone', COMPARE('>=', 2)), TAG('meat', COMPARE('>=', 2))],
		priority: 20,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_med,
		perish: perish_med,
		sanity: sanity_small,
		cooktime: 1,
		mode: 'hamlet'
	},
	tea: {
		name: 'Tea',
		test: (cooker, names, tags) => {
			return tags.filter && tags.filter >= 2 && tags.sweetener && !tags.meat && !tags.veggie && !tags.inedible;
		},
		requirements: [TAG('filter', COMPARE('>=', 2)), TAG('sweetener'), NOT(TAG('meat')), NOT(TAG('veggie')), NOT(TAG('inedible'))],
		priority: 25,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_small,
		perish: perish_one_day,
		sanity: sanity_large,
		temperaturebump: 15,
		cooktime: 0.5,
		rot: 'icedtea',
		note: 'Gives 2.5 bonus speed (+42%) for 120 seconds',
		mode: 'hamlet'
	},
	icedtea: {
		name: 'Iced Tea',
		test: (cooker, names, tags) => {
			return tags.filter && tags.filter >= 2 && tags.sweetener && tags.frozen;
		},
		requirements: [TAG('filter', COMPARE('>=', 2)), TAG('sweetener'), TAG('frozen')],
		priority: 30,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_small,
		perish: perish_fast,
		sanity: sanity_large,
		temperaturebump: -10,
		cooktime: 0.5,
		note: 'Gives 1.7 bonus speed (+28%) for 80 seconds',
		mode: 'hamlet'
	},
	asparagussoup: {
		name: 'Asparagus Soup',
		test: (cooker, names, tags) => {
			return (names.asparagus || names.asparagus_cooked) && tags.veggie && tags.veggie > 1;
		},
		requirements: [NAME('asparagus'), TAG('veggie', COMPARE('>', 1))],
		priority: 10,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_medsmall,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 0.5,
		mode: 'hamlet'
	},
	spicyvegstinger: {
		name: 'Spicy Vegetable Stinger',
		test: (cooker, names, tags) => {
			return (names.asparagus || names.asparagus_cooked || names.radish || names.radish_cooked)
				&& tags.veggie && tags.veggie > 2 && tags.frozen && !tags.meat;
		},
		requirements: [OR(NAME('asparagus'), NAME('radish')), TAG('veggie', COMPARE('>', 2)), TAG('frozen'), NOT(TAG('meat'))],
		priority: 15,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_med,
		perish: perish_slow,
		sanity: sanity_large,
		cooktime: 0.5,
		mode: 'hamlet'
	},
	feijoada: {
		name: 'Feijoada',
		test: (cooker, names, tags) => {
			return tags.meat && names.jellybug === 3 || names.jellybug_cooked === 3 || (names.jellybug && names.jellybug_cooked && names.jellybug + names.jellybug_cooked === 3);
		},
		requirements: [TAG('meat'), NAME('jellybug', COMPARE('=', 3))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_huge,
		perish: perish_fastish,
		sanity: sanity_med,
		cooktime: 3.5,
		note: 'Using 3 Cooked Bean Bugs, or a combination of Raw and Cooked Bean Bugs, makes it so that meat is not needed, intentional or not by Klei.',
		mode: 'hamlet'
	},
	steamedhamsandwich: {
		name: 'Steamed Ham Sandwich',
		test: (cooker, names, tags) => {
			return (names.meat || names.meat_cooked) && (tags.veggie && tags.veggie >= 2) && names.foliage;
		},
		requirements: [NAME('meat'), TAG('veggie', COMPARE('>=', 2)), SPECIFIC('foliage')],
		priority: 5,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large,
		perish: perish_fast,
		sanity: sanity_med,
		cooktime: 2,
		mode: 'hamlet'
	},
	hardshell_tacos: {
		name: 'Hard Shell Tacos',
		test: (cooker, names, tags) => {
			return names.weevole_carapace == 2 && tags.veggie;
		},
		requirements: [SPECIFIC('weevole_carapace', COMPARE('=', 2)), TAG('veggie')],
		priority: 1,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 1,
		mode: 'hamlet'
	},
	gummy_cake: {
		name: 'Gummy Cake',
		test: (cooker, names, tags) => {
			return (names.slugbug || names.slugbug_cooked) && tags.sweetener;
		},
		requirements: [NAME('slugbug'), TAG('sweetener')],
		priority: 1,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_superhuge,
		perish: perish_preserved,
		sanity: -sanity_tiny,
		cooktime: 2,
		mode: 'hamlet'
	},

	//Together recipes
	jellybean: {
		name: 'Jellybeans',
		test: (cooker, names, tags) => {
			return names.royal_jelly && !tags.inedible && !tags.monster;
		},
		requirements: [SPECIFIC('royal_jelly'), NOT(TAG('inedible')), NOT(TAG('monster'))],
		priority: 12,
		foodtype: 'goodies',
		health: 2,
		hunger: 0,
		sanity: sanity_tiny,
		cooktime: 2.5,
		note: 'Recipe produces 3; heals 120 health over 2 minutes',
		mode: 'together'
	},
	pepperpopper: {
		name: 'Stuffed Pepper Poppers',
		test: (cooker, names, tags) => {
			return (names.pepper || names.pepper_cooked) && tags.meat && tags.meat <= 1.5 && !tags.inedible;
		},
		requirements: [NAME('pepper'), TAG('meat', COMPARE('<=', 1.5)), NOT(TAG('inedible'))],
		priority: 20,
		foodtype: 'meat',
		health: healing_medlarge,
		hunger: calories_med,
		perish: perish_slow,
		sanity: -sanity_tiny,
		cooktime: 2,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_long,
		note: 'Increases temperature by 40 degrees in 15 seconds.',
		mode: 'together'
	},
	mashedpotatoes: {
		name: 'Creamy Potato Purée',
		test: (cooker, names, tags) => {
			return ((names.potato && names.potato > 1) || (names.potato_cooked && names.potato_cooked > 1) || (names.potato && names.potato_cooked)) && (names.garlic || names.garlic_cooked) && !tags.meat && !tags.inedible;
		},
		requirements: [NAME('potato', COMPARE('>', 1)), NAME('garlic'), NOT(TAG('meat')), NOT(TAG('inedible'))],
		priority: 20,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_large,
		cooktime: 1,
		mode: 'together'
	},
	salsa: {
		name: 'Salsa Fresca',
		test: (cooker, names, tags) => {
			return (names.tomato || names.tomato_cooked) && (names.onion || names.onion_cooked) && !tags.meat && !tags.egg && !tags.inedible;
		},
		requirements: [NAME('tomato'), NAME('onion'), NOT(TAG('meat')), NOT(TAG('egg')), NOT(TAG('inedible'))],
		priority: 20,
		foodtype: 'veggie',
		health: healing_medlarge,
		hunger: calories_med,
		perish: perish_slow,
		sanity: sanity_large,
		cooktime: 0.5,
		mode: 'together'
	},
	potatotornado: {
		name: 'Fancy Spiralled Tubers',
		test: (cooker, names, tags) => {
			return (names.potato || names.potato_cooked) && names.twigs && (!tags.monster || tags.monster <= 1) && !tags.meat && (tags.inedible && tags.inedible <= 2);
		},
		requirements: [NAME('potato'), NAME('twigs'), OR(NOT(TAG('monster')), TAG('monster', COMPARE('<=', 1))), NOT(TAG('meat')), TAG('inedible', COMPARE('<=', 2))],
		priority: 10,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 0.75,
		mode: 'together'
	},
	barnaclepita: {
		name: 'Barnacle Pita',
		test: (cooker, names, tags) => {
			return (names.barnacle || names.barnacle_cooked) && tags.veggie && tags.veggie >= 0.5;
		},
		requirements: [NAME('barnacle'), TAG('veggie', COMPARE('>=', 0.5))],
		priority: 25,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		perish: perish_slow,
		sanity: sanity_tiny,
		cooktime: 2,
		mode: 'together'
	},
	barnaclesushi: {
		name: 'Barnacle Nigiri',
		test: (cooker, names, tags) => {
			return (names.barnacle || names.barnacle_cooked) && (names.kelp || names.kelp_cooked) && tags.egg && tags.egg >= 1;
		},
		requirements: [NAME('barnacle'), NAME('kelp'), TAG('egg', COMPARE('>=', 1))],
		priority: 30,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 0.5,
		mode: 'together'
	},
	barnaclinguine: {
		name: 'Barnacle Linguine',
		test: (cooker, names, tags) => {
			return ((names.barnacle || 0) + (names.barnacle_cooked || 0) >= 2 ) && tags.veggie && tags.veggie >= 2;
		},
		requirements: [NAME('barnacle', COMPARE('>=', 2)), TAG('veggie', COMPARE('>=', 2))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med / 2,
		hunger: calories_large * 2,
		perish: perish_fast,
		sanity: healing_med,
		cooktime: 2,
		mode: 'together'
	},
	barnaclestuffedfishhead: {
		name: 'Stuffed Fish Heads',
		test: (cooker, names, tags) => {
			return (names.barnacle || names.barnacle_cooked) && tags.fish && tags.fish >= 1.25;
		},
		requirements: [NAME('barnacle'), TAG('fish', COMPARE('>=', 1.25))],
		priority: 25,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large * 2,
		perish: perish_superfast,
		sanity: 0,
		cooktime: 2,
		mode: 'together'
	},
	shroomcake: {
		name: 'Mushy Cake',
		test: (cooker, names, tags) => {
			return names.moon_mushroom && names.red_mushroom && names.blue_mushroom && names.green_mushroom;
		},
		requirements: [SPECIFIC('moon_mushroom'), SPECIFIC('red_mushroom'), SPECIFIC('blue_mushroom'), SPECIFIC('green_mushroom')],
		priority: 30,
		foodtype: 'goodies',
		health: 0,
		hunger: calories_med,
		sanity: sanity_small,
		perish: perish_slow,
		cooktime: 1,
		mode: 'together'
	},
	sweettea: {
		name: 'Soothing Tea',
		test: (cooker, names, tags) => {
			return names.forgetmelots && tags.sweetener && tags.frozen && !tags.monster && !tags.veggie && !tags.meat && !tags.fish && !tags.egg && !tags.fat && !tags.dairy && !tags.inedible;
		},
		requirements: [NAME('forgetmelots'), TAG('sweetener'), TAG('frozen'), NOT(TAG('monster')), NOT(TAG('veggie')), NOT(TAG('meat')), NOT(TAG('fish')), NOT(TAG('egg')), NOT(TAG('fat')), NOT(TAG('dairy')), NOT(TAG('inedible'))],
		priority: 1,
		foodtype: 'goodies',
		health: healing_small,
		hunger: 0,
		sanity: sanity_med,
		perish: perish_superfast,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_brief,
		cooktime: 1,
		note: 'Restores 30 sanity over 1 minute',
		mode: 'together'
	},
	koalefig_trunk: {
		name: 'Fig-Stuffed Trunk',
		test: (cooker, names, tags) => {
			return (names.trunk_summer || names.trunk_cooked || names.trunk_winter) && (names.fig || names.fig_cooked);
		},
		requirements: [NAME('trunk_summer'), NAME('fig')],
		priority: 40,
		foodtype: 'meat',
		health: healing_huge,
		hunger: calories_large + calories_medsmall,
		sanity: 0,
		perish: perish_med,
		cooktime: 2,
		mode: 'together'
	},
	figatoni: {
		name: 'Figatoni',
		test: (cooker, names, tags) => {
			return (names.fig || names.fig_cooked) && tags.veggie && tags.veggie >= 2 && !tags.meat;
		},
		requirements: [NAME('fig'), TAG('veggie', COMPARE('>=', 2)), NOT(TAG('meat'))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_medlarge,
		hunger: calories_large + calories_medsmall,
		sanity: sanity_med,
		perish: perish_fast,
		cooktime: 2,
		mode: 'together'
	},
	figkabab: {
		name: 'Figkabab',
		test: (cooker, names, tags) => {
			return (names.fig || names.fig_cooked) && names.twigs && tags.meat && tags.meat >= 1 && (!tags.monster || tags.monster <= 1);
		},
		requirements: [NAME('fig'), SPECIFIC('twigs'), TAG('meat', COMPARE('>=', 1)), OR(NOT(TAG('monster')), TAG('monster', COMPARE('<=', 1)))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_med,
		sanity: sanity_med,
		perish: perish_slow,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_long,
		cooktime: 1,
		mode: 'together'
	},
	frognewton: {
		name: 'Figgy Frogwich',
		test: (cooker, names, tags) => {
			return (names.fig || names.fig_cooked) && (names.froglegs || names.froglegs_cooked);
		},
		requirements: [NAME('fig'), NAME('froglegs')],
		priority: 1,
		foodtype: 'meat',
		health: healing_medsmall,
		hunger: calories_medsmall,
		sanity: sanity_small,
		perish: perish_slow,
		cooktime: 1,
		mode: 'together'
	},
	frozenbananadaiquiri: {
		name: 'Frozen Banana Daiquiri',
		test: (cooker, names, tags) => {
			return (names.cave_banana || names.cave_banana_cooked) && (tags.frozen && tags.frozen >=1);
		},
		requirements: [NAME('cave_banana'), TAG('frozen', COMPARE('>=', 1))],
		priority: 1,
		foodtype: 'goodies',
		health: healing_medlarge,
		hunger: calories_medsmall,
		sanity: sanity_med,
		perish: perish_slow,
		temperature: cold_food_bonus_temp,
		temperatureduration: food_temp_long,
		note: 'Lowers temperature by 15 degrees over 15 seconds',
		cooktime: 1,
		mode: 'together'
	},
	bunnystew: {
		name: 'Bunny Stew',
		test: (cooker, names, tags) => {
			return (tags.meat && tags.meat < 1) && (tags.frozen && tags.frozen >= 2) && !tags.inedible;
		},
		requirements: [TAG('meat', COMPARE('<', 1)), TAG('frozen', COMPARE('>=', 2)), NOT(TAG('inedible'))],
		priority: 1,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		sanity: sanity_tiny,
		perish: perish_med,
		temperature: hot_food_bonus_temp,
		temperatureduration: food_temp_brief,
		note: 'Raises temperature by 5 degrees over 5 seconds',
		cooktime: 0.5,
		mode: 'together'
	},
	bananajuice: {
		name: 'Banana Shake',
		test: (cooker, names, tags) => {
	//I'm not sure how to write this recipe, but I noticed leafymeatsouffle has the same pattern, so I'm copying it. as I understand, this is to ensure that you have to use two of the ingredient, but one can be raw and one cooked
	//this is the preparedfoods.lua version: return ((names.cave_banana or 0) + (names.cave_banana_cooked or 0) >= 2)
			return ((names.cave_banana || 0) + (names.cave_banana_cooked || 0) >= 2);
		},
		requirements: [NAME('cave_banana', COMPARE('>=', 2))],
		priority: 1,
		foodtype: 'veggie',
		health: healing_medsmall,
		hunger: calories_med,
		sanity: sanity_large,
		perish: perish_slow,
		cooktime: 0.5,
		mode: 'together'
	},
	//A Little Drama update
	justeggs: {
		name: 
		test: (cooker, names, tags) => {
			return 
		},
      		requirements:
		priority: 0,
		foodtype: 'meat',
		health: healing_small,
		hunger: calories_small * 4,
		perishtime: perish_med,
		sanity = TUNING.SANITY_TINY,
		cooktime: 0.5,
		mode: 'together'
	},
		
	// Leafy Meat recipes, won't work properly in simulator until issue #32 is solved
	leafloaf: {
		name: 'Leafy Meatloaf',
		test: (cooker, names, tags) => {
			return ((names.plantmeat || 0) + (names.plantmeat_cooked || 0) >= 2 );
		},
		requirements: [NAME('plantmeat', COMPARE('>=',2))],
		priority: 25,
		foodtype: 'meat',
		health: healing_medsmall,
		hunger: calories_large,
		perish: perish_preserved,
		sanity: sanity_tiny,
		cooktime: 2,
		mode: 'together'
	},
	leafymeatburger: {
		name: 'Veggie Burger',
		test: (cooker, names, tags) => {
			return (names.plantmeat || names.plantmeat_cooked) && (names.onion || names.onion_cooked) && tags.veggie && tags.veggie >= 2;
		},
		requirements: [NAME('plantmeat'), NAME('onion'), TAG('veggie', COMPARE('>=', 2))],
		priority: 25,
		foodtype: 'meat',
		health: healing_medlarge,
		hunger: calories_large,
		perish: perish_fast,
		sanity: sanity_large,
		cooktime: 2,
		mode: 'together'
	},
	leafymeatsouffle: {
		name: 'Jelly Salad',
		test: (cooker, names, tags) => {
			return ((names.plantmeat || 0) + (names.plantmeat_cooked || 0) >= 2 ) && tags.sweetener && tags.sweetener >= 2;
		},
		requirements: [NAME('plantmeat', COMPARE('>=', 2)), TAG('sweetener', COMPARE('>=',2))],
		priority: 50,
		foodtype: 'meat',
		health: 0,
		hunger: calories_large,
		perish: perish_fast,
		sanity: sanity_huge,
		cooktime: 2,
		mode: 'together'
	},
	meatysalad: {
		name: 'Beefy Greens',
		test: (cooker, names, tags) => {
			return (names.plantmeat || names.plantmeat_cooked) && tags.veggie && tags.veggie >= 3;
		},
		requirements: [NAME('plantmeat'), TAG('veggie', COMPARE('>=', 3))],
		priority: 25,
		foodtype: 'meat',
		health: healing_large,
		hunger: calories_large * 2,
		perish: perish_fast,
		sanity: sanity_tiny,
		cooktime: 2,
		mode: 'together'
	},

	// Warly DST recipes, waiting for issue #32 to be solved
	/*
	gazpacho: {
		name: 'Asparagazpacho',
		test: (cooker, names, tags) => {
			return names.asparagus && names.asparagus === 2 && names.ice && names.ice === 2;
		},
		requirements: [SPECIFIC('asparagus', COMPARE('=', 2)), SPECIFIC('ice', COMPARE('=', 2))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_med,
		sanity: sanity_small,
		temperature: cold_food_bonus_temp,
		temperatureduration: buff_food_temp_duration,  // Varies from season to season
		perish: perish_slow,
		cooktime: 0.5,
		mode: 'warly' //+ 'together'
	},
	bonesoup: {
		name: 'Bone Bouillon',
		test: (cooker, names, tags) => {
			return names.boneshard && names.boneshard === 2 && (names.onion || names.onion_cooked) && (tags.inedible && tags.inedible < 3);
		},
		requirements: [NAME('boneshard', COMPARE('=', 2)), NAME('onion'), TAG('inedible'), TAG('inedible', COMPARE('<', 3))],
		priority: 30,
		foodtype: 'meat',
		health: healing_medsmall * 4,
		hunger: calories_large * 4,
		sanity: sanity_tiny,
		perish: perish_med,
		cooktime: 2,
		mode: 'warly' //+ 'together'
	},
	frogfishbowl: {
		name: 'Fish Cordon Bleu',
		test: (cooker, names, tags) => {
			return ((names.froglegs && names.froglegs >= 2) || (names.froglegs_cooked && names.froglegs_cooked >= 2 ) || (names.froglegs && names.froglegs_cooked)) && (tags.fish && tags.fish >= 1) && !tags.inedible;
		},
		requirements: [NAME('froglegs', COMPARE('=',2)), TAG('fish', COMPARE('>=', 1)), NOT(TAG('inedible'))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med,
		hunger: calories_large,
		sanity: -sanity_small,
		perish: perish_fastish,
		cooktime: 2,
		note: 'Sets wetness to 0 and grants wetness immunity for 300 seconds',
		mode: 'warly' //+ 'together'
	},
	glowberrymousse: {
		name: 'Glow Berry Mousse',
		test: (cooker, names, tags) => {
			return (names.wormlight || (names.wormlight_lesser && names.wormlight_lesser >= 2)) && (tags.fruit && tags.fruit >= 2) && !tags.meat && !tags.inedible;
		},
		requirements: [OR(SPECIFIC('wormlight'),SPECIFIC('wormlight_lesser', COMPARE('>=', 2))), TAG('fruit', COMPARE('>=', 2)), NOT(TAG('meat')), NOT(TAG('inedible'))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_small,
		hunger: calories_large,
		perish: perish_fastish,
		sanity: sanity_small,
		cooktime: 1,
		note: 'Gives 600 seconds of light',
		mode: 'warly' //+ 'together'
	},
	nightmarepie: {
		name: 'Grim Galette',
		test: (cooker, names, tags) => {
			return names.nightmarefuel && names.nightmarefuel === 2 && (names.potato || names.potato_cooked) && (names.onion || names.onion_cooked);
		},
		requirements: [NAME('nightmarefuel', COMPARE('=', 2)), NAME('potato'), NAME('onion')],
		priority: 30,
		foodtype: 'veggie',
		health: healing_tiny,
		hunger: calories_med,
		perish: perish_med,
		sanity: sanity_tiny,
		cooktime: 2,
		note: 'Swaps health and sanity values',
		mode: 'warly' //+ 'together'
	},
	dragonchilisalad: {
		name: 'Hot Dragon Chili Salad',
		test: (cooker, names, tags) => {
			return (names.dragonfruit || names.dragonfruit_cooked) && (names.pepper || names.pepper_cooked) && !tags.meat && !tags.inedible && !tags.egg;
		},
		requirements: [NAME('dragonfruit'), NAME('pepper'), NOT(TAG('meat')), NOT(TAG('inedible')), NOT(TAG('egg'))],
		priority: 30,
		foodtype: 'veggie',
		health: -healing_small,
		hunger: calories_med,
		sanity: sanity_small,
		temperature: hot_food_bonus_temp,
		temperatureduration: buff_food_temp_duration,  // Varies from season to season
		// nochill: true, ?
		perish: perish_slow,
		cooktime: 0.75,
		mode: 'warly' //+ 'together'
	},
	moqueca: {
		name: 'Moqueca',
		test: (cooker, names, tags) => {
			return tags.fish && (names.onion || names.onion_cooked) && (names.tomato || names.tomato_cooked) && !tags.inedible;
		},
		requirements: [TAG('fish'), NAME('onion'), NAME('tomato'), NOT(TAG('inedible'))],
		priority: 30,
		foodtype: 'meat',
		health: healing_med * 3,
		hunger: calories_large * 3,
		perish: perish_fastish,
		sanity: sanity_large,
		cooktime: 2,
		mode: 'warly' //+ 'together'
	},
	potatosouffle: {
		name: 'Puffed Potato Soufflé',
		test: (cooker, names, tags) => {
			return ((names.potato && names.potato >= 2) || (names.potato_cooked && names.potato_cooked >= 2) || (names.potato && names.potato_cooked)) && tags.egg && !tags.meat && !tags.inedible;
		},
		requirements: [NAME('potato', COMPARE('>=', 2)), TAG('egg'), NOT(TAG('meat')), NOT(TAG('inedible'))],
		priority: 30,
		foodtype: 'veggie',
		health: healing_med,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_med,
		cooktime: 2,
		mode: 'warly' //+ 'together'
	},
	voltgoatjelly: {
		name: 'Volt Goat Chaud-Froid',
		test: (cooker, names, tags) => {
			return (names.lightninggoathorn) && (tags.sweetener && tags.sweetener >= 2) && !tags.meat;
		},
		requirements: [NAME('lightninggoathorn'), TAG('sweetener', COMPARE('>=', 2)), NOT(TAG('meat'))],
		priority: 30,
		foodtype: 'goodies',
		health: healing_small,
		hunger: calories_large,
		perish: perish_med,
		sanity: sanity_small,
		cooktime: 2,
		note: 'All damage caused becomes electrical damage',
		mode: 'warly' //+ 'together'
	}
	*/
	
	//preparednonfoods – not dishes, but made in crock pot
	batnosehat: {
		name: 'Milkmade Hat',
		test: (cooker, names, tags) => {
			return names.batnose && names.kelp && (tags.dairy && tags.dairy >= 1);
		},
		requirements: [NAME('batnose'), NAME('kelp'), TAG('dairy', COMPARE ('>=', 1))],
		priority: 55,
		perish: perish_slow,
		cooktime: 2,
		note: 'While worn, restores 3.9 Hunger every 5 seconds (187.5 in total, over 4 minutes), while reducing Sanity by 1.33 per minute',
		mode: 'together'
	},
	dustmeringue: {
		name: 'Amberosia',
		test: (cooker, names, tags) => {
			return names.refined_dust;
		},
		requirements: [NAME('refined_dust')],
		priority: 100,
		cooktime: 2,
		note: 'Used to feed Dust Moths, cannot be eaten by the player',
		mode: 'together'
	}
};
