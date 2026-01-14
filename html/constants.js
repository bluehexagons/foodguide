/**
 * Game constants for Don't Starve food calculations
 * @type {number}
 */

export const seg_time = 30;
export const day_segs = 10;
export const dusk_segs = 4;
export const night_segs = 2;

export const day_time = seg_time * day_segs;
export const dusk_time = seg_time * dusk_segs;
export const night_time = seg_time * night_segs;
export const total_day_time = seg_time * 16;

export const base_cook_time = night_time * 0.3333;
export const buff_food_temp_duration = day_time;
export const cold_food_bonus_temp = -40;
export const hot_food_bonus_temp = 40;
export const food_temp_average = 10;
export const food_temp_brief = 5;
export const food_temp_long = 15;

export const defaultStatMultipliers = {
	raw: 1,
	dried: 1,
	cooked: 1,
	recipe: 1,
};

export const calories_per_day = 75;
export const calories_huge = calories_per_day; // crockpot foods
export const calories_large = calories_per_day / 2; // cooked meat
export const calories_med = calories_per_day / 3; // meat
export const calories_medsmall = calories_per_day / 4;
export const calories_small = calories_per_day / 6; // veggies
export const calories_tiny = calories_per_day / 8; // berries
export const calories_superhuge = calories_per_day * 2; // crockpot foods
export const calories_morehuge = 100; // todo: make this the same logic as game data

export const healing_tiny = 1;
export const healing_small = 3;
export const healing_medsmall = 8;
export const healing_med = 20;
export const healing_medlarge = 30;
export const healing_large = 40;
export const healing_huge = 60;
export const healing_morehuge = 75;
export const healing_superhuge = 100;

export const sanity_supertiny = 1;
export const sanity_tiny = 5;
export const sanity_small = 10;
export const sanity_med = 15;
export const sanity_medlarge = 20;
export const sanity_large = 33;
export const sanity_huge = 50;

export const spoiled_food_health = 0;
export const spoiled_food_hunger = 0.5;
export const spoiled_health = -1;
export const spoiled_hunger = -10;
export const stale_food_health = 0.333;
export const stale_food_hunger = 0.667;

export const perish_warp = 1;
export const perish_global_mult = 1;
export const perish_ground_mult = 1.5;
export const perish_fridge_mult = 0.5;
export const perish_summer_mult = 1.25;
export const perish_winter_mult = 0.75;

export const perish_one_day = 1 * total_day_time * perish_warp;
export const perish_two_day = 2 * total_day_time * perish_warp;
export const perish_superfast = 3 * total_day_time * perish_warp;
export const perish_fast = 6 * total_day_time * perish_warp;
export const perish_fastish = 8 * total_day_time * perish_warp;
export const perish_med = 10 * total_day_time * perish_warp;
export const perish_slow = 15 * total_day_time * perish_warp;
export const perish_preserved = 20 * total_day_time * perish_warp;
export const perish_superslow = 40 * total_day_time * perish_warp;

export const dry_superfast = 0.25 * total_day_time;
export const dry_veryfast = 0.5 * total_day_time;
export const dry_fast = total_day_time;
export const dry_med = 2 * total_day_time;

export const stack_size_largeitem = 10;
export const stack_size_meditem = 20;
export const stack_size_smallitem = 40;

export const VANILLA = 1;
export const GIANTS = 1 << 1;
export const SHIPWRECKED = 1 << 2;
export const TOGETHER = 1 << 3;
export const WARLY = 1 << 4;
export const HAMLET = 1 << 5;
export const WARLYHAM = 1 << 6;
export const WARLYDST = 1 << 7;

export const modes = {
	vanilla: {
		name: 'Vanilla',
		img: 'vanilla.png',
		bit: VANILLA,
		mask: VANILLA,
		color: '#ff592e',
	},

	giants: {
		name: 'Reign of Giants',
		img: 'reign_of_giants.png',
		bit: GIANTS,
		mask: VANILLA | GIANTS,
		color: '#b857c6',
	},

	shipwrecked: {
		name: 'Shipwrecked',
		img: 'shipwrecked.png',
		bit: SHIPWRECKED,
		mask: VANILLA | GIANTS | SHIPWRECKED,
		color: '#50c1cc',
	},

	warly: {
		name: 'Warly Shipwrecked',
		img: 'warly.png',
		bit: WARLY,
		mask: VANILLA | GIANTS | SHIPWRECKED | WARLY,
		multipliers: {
			raw: 0.7,
			dried: 0.8,
			cooked: 0.9,
			recipe: 1.2,
		},
		color: '#50c1cc',
	},

	hamlet: {
		name: 'Hamlet',
		img: 'hamlet.png',
		bit: HAMLET,
		mask: VANILLA | GIANTS | SHIPWRECKED | HAMLET,
		color: '#ffdf93',
	},

	warlyham: {
		name: 'Warly Hamlet',
		img: 'warlyHAM.png',
		bit: WARLYHAM,
		mask: VANILLA | GIANTS | SHIPWRECKED | HAMLET | WARLY | WARLYHAM,
		color: '#ffdf93',
	},

	together: {
		name: "Don't Starve Together",
		img: 'together.png',
		bit: TOGETHER,
		mask: TOGETHER,
		color: '#c0c0c0',
	},

	warlydst: {
		name: "Warly Don't Starve Together",
		img: 'warlyDST.png',
		bit: WARLYDST,
		mask: TOGETHER | WARLYDST,
		color: '#c0c0c0',
	},
};

export const headings = {
	health: 'Health:Health restored (change if cooked)',
	hunger: 'Hunger:Hunger restored (change if cooked)',
	sanity: 'Sanity:Sanity restored (change if cooked)',
	perish: 'Perish:Time to turn to rot (change if cooked)',
};
