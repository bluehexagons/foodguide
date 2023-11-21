export const calories_per_day = 75,
	seg_time = 30,
	total_day_time = seg_time * 16,
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
	healing_morehuge = 75,
	healing_superhuge = 100,

	sanity_supertiny = 1,
	sanity_tiny = 5,
	sanity_small = 10,
	sanity_med = 15,
	sanity_medlarge = 20,
	sanity_large = 33,
	sanity_huge = 50,

	perish_one_day = 1 * total_day_time * perish_warp,
	perish_two_day = 2 * total_day_time * perish_warp,
	perish_superfast = 3 * total_day_time * perish_warp,
	perish_fast = 6 * total_day_time * perish_warp,
	perish_fastish = 8 * total_day_time * perish_warp,
	perish_med = 10 * total_day_time * perish_warp,
	perish_slow = 15 * total_day_time * perish_warp,
	perish_preserved = 20 * total_day_time * perish_warp,
	perish_superslow = 40 * total_day_time * perish_warp,

	dry_superfast = 0.25 * total_day_time,
	dry_veryfast = 0.5 * total_day_time,
	dry_fast = total_day_time,
	dry_med = 2 * total_day_time,

	calories_tiny = calories_per_day / 8, // berries
	calories_small = calories_per_day / 6, // veggies
	calories_medsmall = calories_per_day / 4,
	calories_med = calories_per_day / 3, // meat
	calories_large = calories_per_day / 2, // cooked meat
	calories_huge = calories_per_day, // crockpot foods?
	calories_morehuge = 100, // todo: make this the same logic as game data
	calories_superhuge = calories_per_day * 2, // crockpot foods?

	hot_food_bonus_temp = 40,
	cold_food_bonus_temp = -40,
	food_temp_brief = 5,
	food_temp_average = 10,
	food_temp_long = 15,
	buff_food_temp_duration = day_time,

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

	base_cook_time = night_time * .3333,

	defaultStatMultipliers = {
		raw: 1,
		dried: 1,
		cooked: 1,
		recipe: 1
	},

	VANILLA = 1,
	GIANTS = 1 << 1,
	SHIPWRECKED = 1 << 2,
	TOGETHER = 1 << 3,
	WARLY = 1 << 4,
	HAMLET = 1 << 5,
	WARLYHAM = 1 << 6,
	WARLYDST = 1 << 7,


	modes = {
		vanilla: {
			name: 'Vanilla',
			img: 'vanilla.png',
			bit: VANILLA,
			mask: VANILLA,
			color: '#ff592e'
		},

		giants: {
			name: 'Reign of Giants',
			img: 'reign_of_giants.png',
			bit: GIANTS,
			mask: VANILLA | GIANTS,
			color: '#b857c6'
		},

		shipwrecked: {
			name: 'Shipwrecked',
			img: 'shipwrecked.png',
			bit: SHIPWRECKED,
			mask: VANILLA | GIANTS | SHIPWRECKED,
			color: '#50c1cc'
		},

		hamlet: {
			name: 'Hamlet',
			img: 'hamlet.png',
			bit: HAMLET,
			mask: VANILLA | GIANTS | SHIPWRECKED | HAMLET,
			color: '#ffdf93'
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
				recipe: 1.2
			},
		},

		warlyham: {
			name: 'Warly Hamlet',
			img: 'warlyHAM.png',
			bit: WARLYHAM,
			mask: VANILLA | GIANTS | SHIPWRECKED | HAMLET | WARLY | WARLYHAM,
		},

		together: {
			name: 'Don\'t Starve Together',
			img: 'together.png',
			bit: TOGETHER,
			mask: TOGETHER,
			color: '#c0c0c0'
		},

		warlydst: {
			name: 'Warly Don\'t Starve Together',
			img: 'warlyDST.png',
			bit: WARLYDST,
			mask: TOGETHER | WARLYDST,
		},
	};
