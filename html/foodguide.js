'use strict';

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

import {
	total_day_time,
	sanity_small,
	perish_preserved,
	perish_fridge_mult,
	perish_ground_mult,
	perish_winter_mult,
	perish_summer_mult,
	stale_food_hunger,
	spoiled_food_hunger,
	stale_food_health,
	base_cook_time,
	defaultStatMultipliers,
	VANILLA,
	GIANTS,
	SHIPWRECKED,
	HAMLET,
	modes
} from './constants.js';
import {food} from './food.js';
import {recipes} from './recipes.js';

(() => {
	const stats = ['hunger', 'health', 'sanity'];
	const isStat = {
		hunger: true,
		health: true,
		sanity: true
	};
	const isBestStat = {
		bestHunger: true,
		bestHealth: true,
		bestSanity: true
	};
	const modeRefreshers = [];

	let statMultipliers = defaultStatMultipliers;

	let modeMask = VANILLA | GIANTS | SHIPWRECKED | HAMLET;

	const setMode = mask => {
		statMultipliers = {};
		for (const i in defaultStatMultipliers) {
			if (defaultStatMultipliers.hasOwnProperty(i)) {
				statMultipliers[i] = defaultStatMultipliers[i];
			}
		}
		modeMask = mask;
		for (let i = 0; i < modeTab.childNodes.length; i++) {
			const img = modeTab.childNodes[i];
			const mode = modes[img.dataset.mode]
			img.className = (modeMask & mode.bit) !== 0 ? 'mode-button enabled' : 'mode-button';

			if (mode.multipliers && ((modeMask & mode.bit) !== 0)) {
				for (const foodtype in mode.multipliers) {
					if (mode.multipliers.hasOwnProperty(foodtype)) {
						statMultipliers[foodtype] *= mode.multipliers[foodtype];
					}
				}
			}
		}
		for (let i = 0; i < modeRefreshers.length; i++) {
			modeRefreshers[i]();
		}
		const modeOrder = ['together', 'hamlet', 'shipwrecked', 'giants', 'vanilla']
		for (let i = 0; i < modeOrder.length; i++) {
			if ((modeMask & modes[modeOrder[i]].bit) !== 0) {
				document.getElementById('background').style['background-color'] = modes[modeOrder[i]].color;
				return;
			}
		}
	};

	let recipeCrunchData;

	let matchingNames = (() => {
		const tagsearch = /^tag[: ]/;
		const tagsplit = /^tag:? */;
		const tagnotsearch = /^tagnot[: ]/;
		const tagnotsplit = /^tagnot:? */;
		const recipesearch = /^recipe[: ]/;
		const recipesplit = /^recipe:? */;
		const ingredientsearch = /^ingredient[: ]/;
		const ingredientsplit = /^ingredient:? */;

		let name;
		let tag;
		let recipe;
		let ingredient;
		let allowUncookable = false;
		let anywhere;
		let wordstarts;

		const filter = element => {
			if ((!allowUncookable && element.uncookable) || (element.modeMask & modeMask) === 0) {
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
		};
		const tagFilter = element => {
			return element.match = element[tag] + 0 || 0;
		};
		const recipeFilter = element => {
			let i = 0;
			let failed = true;
			while (i < recipe.length) {
				const result = recipe[i].test(null, element.nameObject, element);
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
		};
		const ingredientFilter = recipe => {
			let i = 0;
			let failed = true;

			while (i < recipe.requirements.length) {
				const result = recipe.requirements[i].test(null, ingredient.nameObject, ingredient);
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
		};
		const exact = element => {
			return element.match = (element.lowerName === name) ? 1 : 0;
		};
		const like = element => {
			return element.match = (element.lowerName === name || (element.raw && element.raw.lowerName === name) || (element.cook && element.cook.lowerName === name)) ? 1 : 0;
		};
		const byMatch = (a, b) => {
			if (a.match === b.match) {
				const aname = a.basename ? a.basename : a.name;
				const bname = b.basename ? b.basename : b.name;
				if (aname !== bname) {
					return aname > bname ? 1 : aname < bname ? -1 : 0;
				}
				return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
			}
			return b.match - a.match;
		};
		return (arr, search, includeUncookable) => {
			allowUncookable = !!includeUncookable;
			name = search.toLowerCase();
			if (tagsearch.test(name)) {
				tag = name.split(tagsplit)[1];
				return arr.filter(tagFilter).sort(byMatch);
			} else if (tagnotsearch.test(name)) {
				tag = name.split(tagnotsplit)[1];
				return arr.filter(element => { return !tagFilter(element); }).sort(byMatch);
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
	})();

	const setIngredientValues = (items, names, tags) => {
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item !== null) {
				names[item.id] = 1 + (names[item.id] || 0);
				for (const k in item) {
					if (item.hasOwnProperty(k) && k !== 'perish' && !isNaN(item[k])) {
						let val = item[k]
						if (isStat[k]) {
							val *= statMultipliers[item.preparationType];
						}
						else if (isBestStat[k]) {
							val *= statMultipliers[item[k+'Type']];
						}
						tags[k] = val + (tags[k] || 0);
					} else if (k === 'perish') {
						tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
					}
				}
			}
		}
	};

	const getSuggestions = (() => {
		return (recipeList, items, exclude, itemComplete) => {
			recipeList.length = 0;
			const names = {};
			const tags = {};
			setIngredientValues(items, names, tags);
			tags.hunger = tags.bestHunger;
			tags.health = tags.bestHealth;
			tags.sanity = tags.bestSanity;
			outer: for (let i = 0; i < recipes.length; i++) {
				let valid = false;
				if ((recipes[i].modeMask & modeMask) === 0) {
					continue;
				}
				for (let ii = 0; ii < recipes[i].requirements.length; ii++) {
					const requirement = recipes[i].requirements[ii]
					if (requirement.test(null, names, tags)) {
						if (!recipes[i].requirements[ii].cancel) {
							valid = true;
						}
					} else if (!itemComplete && recipes[i].requirements[ii].cancel) {
						continue outer;
					} else if (itemComplete && !recipes[i].requirements[ii].cancel) {
						continue outer;
					}
				}
				valid && (!exclude || exclude.indexOf(recipes[i]) === -1) && recipeList.push(recipes[i]);
			}
			tags.img = '';
			tags.name = 'Combined';
			return recipeList;
		};
	})();

	const getRecipes = (() => {
		const recipeList = [];
		return items => {
			const names = {};
			const tags = {};
			recipeList.length = 0;
			setIngredientValues(items, names, tags);
			tags.hunger = tags.bestHunger;
			tags.health = tags.bestHealth;
			tags.sanity = tags.bestSanity;
			for (let i = 0; i < recipes.length; i++) {
				recipes[i].test(null, names, tags)
					&& (recipes[i].modeMask & modeMask) !== 0
					&& recipeList.push(recipes[i]);
			}
			recipeList.sort((a, b) => {
				return b.priority - a.priority;
			});
			tags.img = '';
			tags.name = 'Combined';
			tags.priority = ' ';
			tags.perish = 0;
			tags.cooktime = 0;
			recipeList.unshift(tags);
			return recipeList;
		};
	})();

	const makeImage = (() => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext && canvas.toDataURL && canvas.getContext('2d');
		const canvas32 = document.createElement('canvas');
		const ctx32 = canvas32.getContext && canvas32.getContext('2d');
		const images = {};
		const images32 = {};
		const canvasSupported = !!ctx;
		let requests = [];
		const cacheImage = url => {
			const renderToCache = (url, imageElement) => {
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
				requests.filter(request => { return request.url === url; }).forEach(request => {
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
				requests = requests.filter(request => { return request.url !== url; });
			};
			return e => {
				renderToCache(url, e.target);
			}
		};
		const queue = (img, url, d) => {
			img.dataset.pending = url;
			if (noDataset) {
				img.setAttribute('data-pending', url);
			}
			requests.push({url: url, img: img, d: d});
		};
		const makeImage = (url, d) => {
			const img = new Image(d)
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
					const dummy = new Image();
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
	})();
	const makeLinkable = (() => {
		const linkSearch = /\[([^\|]*)\|([^\|\]]*)\|?([^\|\]]*)\]/;
		const leftSearch = /([^\|]\]\[[^\|]+\|[^\|\]]+)\|?([^\|\](?:left)]*)(?=\])/g;
		const rightSearch = /(\[[^\|]+\|[^\|\]]+)\|?([^\|\]]*)(?=\]\[)(?!\]\[\|)/g;
		const addLeftClass = (_a, b, c) => { return b + '|' + (c.length === 0 ? 'left' : c + ' left'); };
		const addRightClass = (_a, b, c) => { return b + '|' + (c.length === 0 ? 'right' : c + ' right'); };
		const titleCase = /_(\w)/g;
		const toTitleCase = (_a, b) => { return ' ' + b.toUpperCase(); };

		return str => {
			const processed = str && str.replace(leftSearch, addLeftClass).replace(leftSearch, addLeftClass).replace(rightSearch, addRightClass);
			const results = processed && processed.split(linkSearch);

			if (!results || results.length === 1) {
				return processed;
			} else {
				const fragment = document.createDocumentFragment();
				fragment.appendChild(document.createTextNode(results[0]));
				for (let i = 1; i < results.length; i += 4) {
					if (results[i] === '' && results[i + 1] === '') {
						fragment.appendChild(document.createElement('br'));
					} else {
						const span = document.createElement('span');
						span.className = results[i + 2] === '' ? 'link' : 'link ' + results[i + 2]; //IE doesn't support classList, too lazy to come up with a polyfill
						span.dataset.link = results[i];
						if (noDataset) {
							span.setAttribute('data-link', results[i]);
						}
						if (results[i + 1] && results[i + 1].indexOf('img/') === 0) {
							span.appendChild(document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')));
							const url = results[i + 1].split(' ')[0];
							const image = makeImage(url, 32);
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
	})();

	const mainElement = document.getElementById('main');
	const foodElement = document.getElementById('food');
	const recipesElement = document.getElementById('recipes');
	const navbar = document.getElementById('navbar');
	let noDataset = false;
	let info;
	const taggify = (tag, name) => { return '[tag:' + tag + '|' + (name || tag) + ']'; };

	// TODO: process the rot: entries, and add the spoiled fish

	document.getElementById('stalehealth').appendChild(document.createTextNode(Math.round(stale_food_health * 1000) / 10 + '%'));
	document.getElementById('stalehunger').appendChild(document.createTextNode(Math.round(stale_food_hunger * 1000) / 10 + '%'));
	document.getElementById('spoiledhunger').appendChild(document.createTextNode(Math.round(spoiled_food_hunger * 1000) / 10 + '%'));
	document.getElementById('spoiledsanity').appendChild(document.createTextNode(sanity_small));
	document.getElementById('perishground').appendChild(document.createTextNode(Math.round(perish_ground_mult * 1000) / 10 + '%'));
	document.getElementById('perishwinter').appendChild(document.createTextNode(Math.round(perish_winter_mult * 1000) / 10 + '%'));
	document.getElementById('perishsummer').appendChild(document.createTextNode(Math.round(perish_summer_mult * 1000) / 10 + '%'));
	document.getElementById('perishfridge').appendChild(document.createTextNode(Math.round(perish_fridge_mult * 1000) / 10 + '%'));

	let foodCount = 0
	for (const i in food) {
		if (!food.hasOwnProperty(i)) {
			continue;
		}

		const f = food[i];
		f.match = 0;
		f.lowerName = f.name.toLowerCase();
		f.id = i;
		f.nameObject = {};
		f.nameObject[i] = 1;
		f.img = 'img/' + f.name.replace(/ /g, '_').replace(/'/g, '').toLowerCase() + '.png';
		f.preparationType = f.preparationType || 'raw';
		if (food[i + '_cooked']) {
			f.cook = food[i + '_cooked'];
		}
		if (typeof f.cook === 'string') {
			f.cook = food[f.cook];
		}
		if (f.cook && !f.cook.raw) {
			f.cook.raw = f;
			f.cook.cooked = true;
			if (!f.cook.basename) {
				f.cook.basename = (f.basename || f.name) + '.';
			}
		}
		if (typeof f.raw === 'string') {
			f.raw = food[f.raw];
			f.cooked = true;
			if (!f.basename) {
				f.basename = (f.raw.basename || f.raw.name) + '.';
			}
		}
		if (typeof f.dry === 'string') {
			f.dry = food[f.dry];
		}
		if (f.dry && !f.dry.wet) {
			f.dry.wet = f;
			f.dry.rackdried = true;
			if (!f.dry.basename) {
				f.dry.basename = (f.basename || f.name) + '..';
			}
		}
		if (typeof f.wet === 'string') {
			f.rackdried = true;
			f.wet = food[f.wet];
			if (!f.basename) {
				f.basename = (f.wet.basename || f.wet.name) + '..';
			}
		}
		if (f.cook) {
			f.cook.preparationType = 'cooked';
		}
		if (f.dry) {
			f.dry.preparationType = 'dried';
		}

		for (let i = 0; i < stats.length; i++) {
			let stat = stats[i];
			let bestStat = f[stat] || 0;
			let bestStatType = f.preparationType;

			if (f.raw) {
				bestStat = Math.max(f.raw[stat] || 0, bestStat)
				if (bestStat === f.raw[stat]) {
					bestStatType = 'raw';
				}
			}
			if (f.cook) {
				bestStat = Math.max(f.cook[stat] || 0, bestStat)
				if (bestStat === f.cook[stat]) {
					bestStatType = 'cooked';
				}
			}
			stat = stat.charAt(0).toUpperCase() + stat.slice(1);
			f['best' + stat] = bestStat;
			f['best' + stat + 'Type'] = bestStatType;
			// console.log('best' + stat + 'Type');
		}

		// const bestHealth = f.health || 0;
		// const bestHunger = f.hunger || 0;
		// const bestSanity = f.sanity || 0;
		// if (f.cook) {
		// 	bestHealth = Math.max(f.cook.health || 0, bestHealth);
		// 	bestHunger = Math.max(f.cook.hunger || 0, bestHunger);
		// 	bestSanity = Math.max(f.cook.sanity || 0, bestSanity);
		// }
		// if (f.raw) {
		// 	bestHealth = Math.max(f.raw.health || 0, bestHealth);
		// 	bestHunger = Math.max(f.raw.hunger || 0, bestHunger);
		// 	bestSanity = Math.max(f.raw.sanity || 0, bestSanity);
		// }
		// f.bestHealth = bestHealth;
		// f.bestHunger = bestHunger;
		// f.bestSanity = bestSanity;

		f.info = [];
		info = f.info;
		f.fruit && info.push(taggify('fruit') + (f.fruit === 1 ? '' : '\xd7' + f.fruit));
		f.veggie && info.push(taggify('veggie', 'vegetable') + (f.veggie === 1 ? '' : '\xd7' + f.veggie));
		f.meat && info.push(taggify('meat') + (f.meat === 1 ? '' : '\xd7' + f.meat));
		f.egg && info.push(taggify('egg') + (f.egg === 1 ? '' : '\xd7' + f.egg));
		f.fish && info.push(taggify('fish') + (f.fish === 1 ? '' : '\xd7' + f.fish));
		f.magic && info.push(taggify('magic'));
		f.decoration && info.push(taggify('decoration'));
		f.inedible && info.push(taggify('inedible'));
		f.monster && info.push(taggify('monster', 'monster food'));
		f.sweetener && info.push(taggify('sweetener'));
		f.fat && info.push(taggify('fat'));
		f.dairy && info.push(taggify('dairy'));
		f.jellyfish && info.push(taggify('jellyfish'));
		f.antihistamine && info.push(taggify('antihistamine'));
		f.filter && info.push(taggify('filter'));
		f.bug && info.push(taggify('bug'));
		f.bone && info.push(taggify('bone'));
		f.comment && info.push(f.comment);
		f.roughage && info.push(taggify('roughage'));
		food[foodCount++] = f;
	}

	food.length = foodCount;

	let recipeCount = 0
	for (const i in recipes) {
		if (!recipes.hasOwnProperty(i)) {
			continue;
		}
		recipes[i].match = 0;
		recipes[i].name = recipes[i].name || i;
		recipes[i].id = i;
		recipes[i].lowerName = recipes[i].name.toLowerCase();
		recipes[i].weight = recipes[i].weight || 1;
		recipes[i].priority = recipes[i].priority || 0;
		recipes[i].img = 'img/' + recipes[i].name.replace(/ /g, '_').replace(/'/g, '').toLowerCase() + '.png';
		if (recipes[i].requirements) {
			recipes[i].requires = makeLinkable(recipes[i].requirements.join('; ') + (recipes[i].mode ? ('; [tag:' + recipes[i].mode + '|img/' + modes[recipes[i].mode].img + ']') : ''));
		}
		if (recipes[i].mode) {
			recipes[i][recipes[i].mode] = true;
		} else {
			recipes[i].vanilla = true;
			recipes[i].mode = 'vanilla';
		}
		recipes[i].modeMask = modes[recipes[i].mode].bit;
		if (recipes[i].temperature) {
			if (recipes[i].note) {
				recipes[i].note += '; ';
			} else {
				recipes[i].note = '';
			}
			recipes[i].note += 'Provides ' + recipes[i].temperature + ' heat for ' + recipes[i].temperatureduration + ' seconds';
		}
		if (recipes[i].temperaturebump) {
			if (recipes[i].note) {
				recipes[i].note += '; ';
			} else {
				recipes[i].note = '';
			}
			recipes[i].note += recipes[i].temperature + ' heat when consumed';
		}
		recipes[i].preparationType = 'recipe';
		recipes[recipeCount++] = recipes[i];
	}

	recipes.length = recipeCount;
	recipes.forEach = Array.prototype.forEach;
	recipes.filter = Array.prototype.filter;
	recipes.sort = Array.prototype.sort;

	recipes.byName = function (name) {
		let i = this.length;
		while (i--) {
			if (this[i].lowerName === name) {
				return this[i];
			}
		}
	};
	const reduceRecipeButton = (a, b) => {
		return a + '[recipe:' + b.name + '|' + b.img + ']';
	};
	const pl = (str, n, plr) => {
		return n === 1 ? str : str + (plr || 's');
	};

	for (let i = 0; i < food.length; i++) {
		const f = food[i];
		info = f.info;
		f.cooked && info.push('from [*' + f.raw.name + '|' + f.raw.img + ']');
		if (f.cook) {
			if (!(f.cook instanceof Object)) {
				f.cook = food[f.cook];
			}
			info.push('cook: [*' + f.cook.name + '|' + f.cook.img + ']');
		}
		if (f.dry) {
			if (!(f.dry instanceof Object)) {
				f.dry = food[f.dry];
			}
			info.push('dry in ' + (f.drytime / total_day_time) + ' ' + pl('day', (f.drytime / total_day_time)) + ': [*' + f.dry.name + '|' + f.dry.img + ']');
		}
		if (f.mode) {
			f[f.mode] = true;
			info.push('requires [tag:' + f.mode + '|img/' + modes[f.mode].img + ']');
		} else {
			f.vanilla = true;
			f.mode = 'vanilla';
		}
		f.modeMask = modes[f.mode].bit;
		f.info = info.join('; ');
		if (!f.uncookable) {
			f.recipes = [];
			recipes.forEach(recipe => {
				const r = recipe.requirements
				let qualifies = false
				let i = r.length;

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
			f.info += (f.info ? '[|]' : '') + ('cannot be added to crock pot');
		}
		if (f.note) {
			f.info += ('[|]' + f.note);
		}
		f.info = makeLinkable(f.info);
	}
	food.forEach = Array.prototype.forEach;
	food.filter = Array.prototype.filter;
	food.sort = Array.prototype.sort;
	food.byName = function (name) {
		let i = this.length;
		while (i--) {
			if (this[i].lowerName === name) {
				return this[i];
			}
		}
	};

	const combinationGenerator = (length, callback, startPos) => {
		const size = 4
		const index = 1
		const current = startPos || [0, 0, 0, 0]

		return batch => {
			while (batch-- && index <= length) {
				callback(current);
				current[0]++;
				let overflow = 0;
				while (current[overflow] >= length) {
					overflow++;
					current[overflow]++;
				}
				let check = size;
				let max = 0;
				while (check--) {
					if (current[check] >= length) {
						current[check] = max;
					} else if (current[check] > max) {
						max = current[check];
					}
				}
				if (overflow === size) {
					return false;
				}
			}
			return true;
		};
	};
	recipeCrunchData = {};

	/*
		// this isn't currently used for some reason?
		const usefulTags = ['id', 'health', 'hunger', 'fruit', 'veggie', 'meat', 'egg', 'fish', 'magic', 'decoration', 'inedible', 'monster', 'sweetener', 'fat', 'dairy'];
		recipeCrunchData.food = food.filter(item => {
			return !item.uncookable && !item.skip && (item.ideal || (!item.cook && (!item.raw || !item.raw.ideal)));
		}).map(item => {
			const f = {}
			let t = usefulTags.length;
			while (t--) {
				if (item.hasOwnProperty(usefulTags[t])) {
					f[usefulTags[t]] = item[usefulTags[t]];
				}
			}
			return f;
		});
	*/

	recipeCrunchData.recipes = recipes.filter(item => {
		return !item.trash;
	}).sort((a, b) => {
		return b.priority - a.priority;
	});

	recipeCrunchData.test = recipeCrunchData.recipes.map(a => { return a.test; })
	recipeCrunchData.tests = recipeCrunchData.recipes.map(a => { return a.test.toString(); })
	recipeCrunchData.priority = recipeCrunchData.recipes.map(a => { return a.priority; });

	const getRealRecipesFromCollection = (items, mainCallback, chunkCallback, endCallback) => {
		const l = recipeCrunchData.test.length;
		const built = [];
		const desiredTime = 38;
		let renderedTo = 0;
		let lastTime;
		let block = 60;
		const foodFromIndex = index => {
			return items[index];
		};
		const callback = combination => {
			const ingredients = combination.map(foodFromIndex);
			const names = {};
			const tags = {};
			const rcdTest = recipeCrunchData.test;
			const rcdRecipes = recipeCrunchData.recipes;

			let priority = null;
			let created = null;
			let multiple = false;

			setIngredientValues(ingredients, names, tags);
			// console.log('callback: ' + tags.bestHungerType);
			tags.hunger = tags.bestHunger;// * statMultipliers[tags.bestHungerType];
			tags.health = tags.bestHealth;// * statMultipliers[tags.bestHealthType];
			tags.sanity = tags.bestSanity;// * statMultipliers[tags.bestSanityType];
			for (let i = 0; i < l && (priority === null || rcdRecipes[i].priority >= priority); i++) {
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
		};
		const getCombinations = combinationGenerator(items.length, callback);
		const computeNextBlock = () => {
			const start = Date.now();
			let end = false;

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

	let setTab;
	(() => {
		const navtabs = navbar.getElementsByTagName('li');
		const tabs = {};
		const elements = {};
		let activePage;
		let activeTab;

		const showTab = e => {
			setTab(e.target.dataset.tab);
		};
		const setTab = tabID => {
			activeTab.className = '';
			activeTab = tabs[tabID];
			activePage.style.display = 'none';
			activePage = elements[tabID];
			activeTab.className = 'selected';
			activePage.style.display = 'block';
		};
		for (let i = 0; i < navtabs.length; i++) {
			const navtab = navtabs[i];
			if (navtab.dataset.tab) {
				tabs[navtab.dataset.tab] = navtab;
				elements[navtab.dataset.tab] = document.getElementById(navtab.dataset.tab);
				elements[navtab.dataset.tab].style.display = 'none';
				navtab.addEventListener('selectstart', e => { e.preventDefault(); }, false);
				navtab.addEventListener('click', showTab, false);
			}
		}
		activeTab = tabs['simulator'];
		activePage = elements['simulator'];
		try {
			if (window.localStorage && localStorage.foodGuideState) {
				const storage = JSON.parse(localStorage.foodGuideState);
				if (storage.activeTab && tabs[storage.activeTab]) {
					activeTab = tabs[storage.activeTab];
					activePage = elements[storage.activeTab];
					modeMask = storage.modeMask || modes.shipwrecked.mask;
				}
			}
		} catch(err) {
			console && console.warn('Unable to access localStorage', err);
		}
		activeTab.className = 'selected';
		activePage.style.display = 'block';
		window.addEventListener('beforeunload', () => {
			let obj;
			try {
				if (window.localStorage) {
					if (!localStorage.foodGuideState) {
						localStorage.foodGuideState = '{}';
					}
					obj = JSON.parse(localStorage.foodGuideState);
					obj.activeTab = activeTab.dataset.tab;
					obj.modeMask = modeMask;
					localStorage.foodGuideState = JSON.stringify(obj);
				}
			} catch(err) {
				console && console.warn('Unable to access localStorage', err);
			}
		});
	})();

	const queue = img => {
			if (img.dataset.pending) {
				makeImage.queue(img, img.dataset.pending, 32);
			}
		};
	const cells = (cellType, ...args) => {
		const tr = document.createElement('tr');

		for (let i = 0; i < args.length; i++) {
			const td = document.createElement(cellType);
			const cell = args[i];
			const celltext = cell && cell.indexOf ? cell : cell.toString();
			let image;
			if (cell instanceof DocumentFragment) {
				td.appendChild(cell.cloneNode(true));
				Array.prototype.forEach.call(td.getElementsByTagName('img'), queue);
			} else if (celltext.indexOf('img/') === 0) {
				image = makeImage(celltext);
				td.appendChild(image);
			} else if (cell && cell.nodeType && cell.nodeType === 1) {
				td.appendChild(cell);
			} else {
				td.appendChild(document.createTextNode(celltext));
			}
			tr.appendChild(td);
		}
		return tr;
	};
	const wikiaHref = name => {
			if (name && name === 'Combined') {
				return name;
			}
			const node = document.createElement('a');
			node.setAttribute('target', '_blank');
			node.setAttribute('href', 'http://dontstarve.wikia.com/wiki/' + name.replace(/\s/g, '_'));
			const text = document.createTextNode(name);
			node.appendChild(text);
			return node;
		};
	const makeSortableTable = (headers, dataset, rowGenerator, defaultSort, hasSummary, linkCallback, highlightCallback, filterCallback, startRow, maxRows) => {
		let table;
		let header;
		let sorting;
		let invertSort = false;
		let firstHighlight;
		let lastHighlight;
		let rows;

		const generateAndHighlight = (item, index, array) => {
			if ((!maxRows || rows < maxRows) && (!filterCallback || filterCallback(item))) {
				const row = rowGenerator(item);
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
		};
		const create = (e, sort, scrollHighlight) => {
			let summary;

			if (sort || (e && e.target.dataset.sort !== '') || sorting) {
				const sortBy = sort || (e && e.target.dataset.sort) || sorting;
				if (hasSummary) {
					summary = dataset.shift();
				}
				if (sortBy === 'name') {
					dataset.sort((a, b) => {
						const aname = a.basename ? a.basename : a.name;
						const bname = b.basename ? b.basename : b.name;

						if (aname !== bname) {
							return aname > bname ? 1 : aname < bname ? -1 : 0;
						}
						return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
					});
				} else {
					dataset.sort((a, b) => {
						const sa = a[sortBy];
						const sb = b[sortBy];
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
			const tr = document.createElement('tr');
			for (const header in headers) {
				const th = document.createElement('th');
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
			const oldTable = table;
			table = document.createElement('table');
			table.appendChild(tr);
			firstHighlight = null;
			lastHighlight = null;
			rows = 0;
			dataset.forEach(generateAndHighlight);
			if (linkCallback) {
				table.className = 'links';
				Array.prototype.forEach.call(table.getElementsByClassName('link'), element => {
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
		table.update = scrollHighlight => {
			create(null, null, scrollHighlight);
		};
		table.setMaxRows = max => {
			maxRows = max;
			table.update();
		};
		return table;
	};

	const sign = n => {
		if (isNaN(n)) {
			return '';
		}
		else {
			n = parseFloat(parseFloat(n).toFixed(4));
			return n > 0 ? '+' + n : n
		}
	};
	const rawpct = (base, val) => {
		return base < val ? (val - base) / Math.abs(base) : base > val ? -(base - val) / Math.abs(base) : 0;
	};
	const pct = (base, val) => {
		const result = !isNaN(base) && base !== val ? ' (' + sign(((base < val ? (val - base) / Math.abs(base) : base > val ? -(base - val) / Math.abs(base) : 0)*100).toFixed(0)) + '%)' : '';
		return result.indexOf('Infinity') === -1 ? result : ' (' + sign(val - base) + ')';
	};

	const makeFoodRow = item => {
		const mult = statMultipliers[item.preparationType];
		let health = sign(item.health * mult);
		let hunger = sign(item.hunger * mult);
		let sanity = isNaN(item.sanity) ? '' : (item.sanity * mult);

		if (item.cook) {
			const cookmult = statMultipliers[item.cook.preparationType]
			if (item.cook.health !== (item.health || 0)) {
				health += ' (' + sign((item.cook.health * cookmult) - (health || 0)) + ')';
			}
			if (item.cook.hunger !== (item.hunger || 0)) {
				hunger += ' (' + sign((item.cook.hunger * cookmult) - (hunger || 0)) + ')';
			}
			if (item.cook.sanity !== (item.sanity || 0)) {
				sanity += ' (' + sign((item.cook.sanity * cookmult) - (sanity || 0)) + ')';
			}
		}
		return cells('td', item.img ? item.img : '', wikiaHref(item.name), health, hunger, sanity, isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' ' + pl('day', item.perish / total_day_time), item.info || '');
	};

	const makeRecipeRow = (item, health, hunger, sanity) => {
		const mult = statMultipliers[item.preparationType] || 1;
		const ihealth = item.health * mult;
		const ihunger = item.hunger * mult;
		const isanity = item.sanity * mult;
		return cells('td', item.img ? item.img : '', wikiaHref(item.name), sign(ihealth) + pct(health, ihealth), sign(ihunger) + pct(hunger, ihunger), isNaN(isanity) ? '' : sign(isanity) + pct(sanity, isanity), isNaN(item.perish) ? 'Never' : item.perish / total_day_time + ' ' + pl('day', item.perish / total_day_time), (item.cooktime * base_cook_time + 0.5 | 0) + ' secs', item.priority || '0', item.requires || '', item.note || '');
	};

	// food list, recipe list
	(() => {
		let foodHighlight;
		let foodHighlighted = [];
		let recipeHighlighted = [];
		const setFoodHighlight = e => {
			let name = !e.target ? e : e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link;
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
		};
		const setRecipeHighlight = e => {
			const name = !e.target ? e : e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link;
			const modename = name.substring(name.indexOf(':') + 1);
			if (!!modes[modename]) {
				recipeHighlighted = matchingNames(recipes, name);
				recipeTable.update(true);
			} else {
				setTab('foodlist');
				foodHighlight = name;
				foodHighlighted = matchingNames(food, name);
				foodTable.update(true);
			}
		};
		const testFoodHighlight = item => {
			return foodHighlighted.indexOf(item) !== -1;
		};
		const testRecipeHighlight = item => {
			return recipeHighlighted.indexOf(item) !== -1;
		};
		const testmode = item => {
			return (item.modeMask & modeMask) !== 0;
		};
		const foodTable = makeSortableTable(
			{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Info': ''},
			Array.prototype.slice.call(food),
			makeFoodRow,
			'name',
			false,
			setFoodHighlight,
			testFoodHighlight,
			testmode
		);
		const recipeTable = makeSortableTable(
			{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': '', 'Notes' : ''},
			Array.prototype.slice.call(recipes),
			makeRecipeRow,
			'name',
			false,
			setRecipeHighlight,
			testRecipeHighlight,
			testmode
		);
		foodElement.appendChild(foodTable);
		recipesElement.appendChild(recipeTable);
		modeRefreshers.push(() => {
			foodTable.update();
			recipeTable.update();
		});
	})();

	// statistics analyzer
	const ingredientToIcon = (a, b) => {
		return a + '[ingredient:' + food[b.id].name + '|' + food[b.id].img + ']';
	};
	const makeRecipeGrinder = ingredients => {
		const makableButton = document.createElement('button');
		makableButton.appendChild(document.createTextNode('Calculate efficient recipes (may take some time)'));
		makableButton.className = 'makablebutton';
		makableButton.addEventListener('click', () => {
			const idealIngredients = [];
			const makableRecipes = [];
			const usesIngredients = [];
			const excludesIngredients = [];
			const excludedRecipes = [];
			const excludedRecipesElements = [];

			let i = ingredients ? ingredients.length : null;
			let selectedRecipe;
			let selectedRecipeElement;
			// let addedRecipes = 0;
			let makableRecipe;
			let makableSummary;
			let makableFootnote;
			let makableFilter;
			let customFilterHolder;
			let customFilterInput;
			let made;
			let makableDiv;
			let makableTable;

			const checkExcludes = item => {
				return excludesIngredients.indexOf(item.id) !== -1;
			};
			const checkIngredient = function (item) {
				return this.indexOf(food[item]) !== -1;
				//return usesIngredients.indexOf(item.id) !== -1;
			};
			const toggleFilter = e => {
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
			};
			const toggleExclude = e => {
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
			};
			const setRecipe = e => {
				if (selectedRecipeElement) {
					selectedRecipeElement.className = '';
				}
				for (let i = 0; i < excludedRecipesElements.length; i++) {
					excludedRecipesElements[i].className = '';
				}
				excludedRecipes.length = 0;
				excludedRecipesElements.length = 0;
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
			const excludeRecipe = e => {
				if (selectedRecipeElement) {
					selectedRecipeElement.className = '';
					selectedRecipeElement = null;
					selectedRecipe = null;
				}

				const index = excludedRecipesElements.indexOf(e.target);
				if (index !== -1) {
					excludedRecipes.splice(index, 1);
					excludedRecipesElements.splice(index, 1);
					e.target.className = '';
				} else {
					excludedRecipes.push(e.target.dataset.recipe);
					excludedRecipesElements.push(e.target);
					e.target.className = 'excluded';
				}
				makableTable.update();
				e.preventDefault();
			};

			//TODO: optimize so much around this
			if (i === null) {
				i = food.length;
				ingredients = food;
			}
			while (i--) {
				if (!ingredients[i].skip) {
					if (!ingredients[i].uncookable && (!ingredients[i].cooked || ingredients[i].ideal) && (!ingredients[i].rackdried || ingredients[i].ideal) && idealIngredients.indexOf(ingredients[i]) === -1) {
						idealIngredients.push(ingredients[i]);
					}
				} else {
					if (ingredients[i].cook && !ingredients[i].cook.uncookable && !ingredients[i].cook.skip && idealIngredients.indexOf(ingredients[i].cook) === -1) {
						idealIngredients.push(ingredients[i].cook);
					} else if (ingredients[i].dry && !ingredients[i].dry.uncookable && !ingredients[i].dry.skip && idealIngredients.indexOf(ingredients[i].dry) === -1) {
						idealIngredients.push(ingredients[i].dry);
					}
				}
				if (ingredients[i].cooked && !ingredients[i].raw.uncookable && !ingredients[i].raw.skip && idealIngredients.indexOf(ingredients[i].raw) === -1) {
					idealIngredients.push(ingredients[i].raw);
				}
				if (ingredients[i].rackdried && !ingredients[i].wet.uncookable && !ingredients[i].wet.skip && idealIngredients.indexOf(ingredients[i].wet) === -1) {
					idealIngredients.push(ingredients[i].wet);
				}
				/* if (ingredients[i].cook && idealIngredients.indexOf(ingredients[i].cook) === -1 && !ingredients[i].cook.uncookable) {
					idealIngredients.push(ingredients[i].cook);
				}
				if (!ingredients[i].uncookable && (ingredients[i].ideal || !ingredients[i].cook || ingredients[i].cook.uncookable) && idealIngredients.indexOf(ingredients[i]) === -1) {
					idealIngredients.push(ingredients[i]);
				} */
			}
			made = [];
			makableTable = makeSortableTable(
				{'': '', 'Name': 'name', 'Health': 'health', 'Health+:Health gained compared to ingredients': 'healthpls', 'Hunger': 'hunger', 'Hunger+:Hunger gained compared to ingredients': 'hungerpls', 'Ingredients': ''},
				made,
				data => {
					const item = data.recipe;

					return cells(
						'td',
						item.img ? item.img : '',
						item.name,
						sign(item.health),
						sign(data.healthpls) + ' (' + sign((data.healthpct * 100) | 0) + '%)',
						sign(item.hunger),
						sign(data.hungerpls) + ' (' + sign((data.hungerpct * 100) | 0) + '%)',
						makeLinkable(data.ingredients.reduce(ingredientToIcon, '') + (data.multiple ? '*' : ''))
					);
				},
				'hungerpls',
				false,
				null,
				null,
				data => {
					return (!selectedRecipe || data.recipe.name === selectedRecipe) && (excludedRecipes.length === 0 || excludedRecipes.indexOf(data.recipe.name) === -1) && (!excludesIngredients.length || !data.ingredients.some(checkExcludes)) && (!usesIngredients.length || usesIngredients.every(checkIngredient, data.ingredients));
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
			idealIngredients.forEach(item => {
				const img = makeImage(item.img, 32);
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
			getRealRecipesFromCollection(idealIngredients, data => { //row update
				if (makableRecipes.indexOf(data.recipe.name) === -1) {
					let i = 0;
					for (i = 0; i < makableRecipes.length; i++) {
						if (data.recipe.name < makableRecipes[i]) {
							break;
						}
					}
					makableRecipes.splice(i, 0, data.recipe.name);
					const img = makeImage(recipes.byName(makableRecipes[i].toLowerCase()).img);
					//TODO: optimize
					img.dataset.recipe = makableRecipes[i];
					img.addEventListener('click', setRecipe, false);
					img.addEventListener('contextmenu', excludeRecipe, false);
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
					data.healthpls = data.recipe.health - data.ihealth;
					data.hunger = data.recipe.hunger;
					data.ihunger = data.tags.hunger;
					data.hungerpls = data.recipe.hunger - data.ihunger;
					data.healthpct = rawpct(data.ihealth, data.recipe.health);
					data.hungerpct = rawpct(data.ihunger, data.recipe.hunger);
					data.sanity = data.recipe.sanity;
					data.perish = data.recipe.perish;
				}
				made.push(data);
			}, () => { // chunk update

				/*
				// this code provided updates to the table while the data was being crunched
				// there wasn't much point since it wasn't really usable until it was done calculating things anyway
				const l = makableRecipes.length;
				while (addedRecipes < l) {
					const img = makeImage(recipes.byName(makableRecipes[addedRecipes].toLowerCase()).img);
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
				makableSummary.firstChild.textContent = 'Found ' + made.length + ' valid recipes.. (you can change Food Guide tabs during this process)';
				//makableTable.update();
			}, () => { //computation finished
				makableTable.setMaxRows(30);
				makableSummary.firstChild.textContent = 'Found ' + made.length + ' valid recipes. Showing top 30 for selected recipe using all selected ingredients. Right-click to exclude recipes or ingredients.';
			});
		}, false);
		return makableButton;
	};
	document.getElementById('statistics').appendChild(makeRecipeGrinder());
	const highest = (array, property) => {
		return array.reduce((previous, current) => {
			return Math.max(previous, current[property] || 0);
		}, -100000);
	};

	window.food = food;
	window.recipes = recipes;
	window.matchingNames = matchingNames;
	const setSlot = (slotElement, item) => {
		if (item !== null) {
			slotElement.dataset.id = item.id;
		} else {
			if (slotElement.nextSibling && getSlot(slotElement.nextSibling) !== null) {
				setSlot(slotElement, getSlot(slotElement.nextSibling));
				setSlot(slotElement.nextSibling, null);
				return;
			} else {
				slotElement.dataset.id = null;
			}
		}
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
	};
	const getSlot = slotElement => {
		return slotElement && (food[slotElement.dataset.id] || recipes[slotElement.dataset.id] || null);
	};

	(() => {
		const pickers = document.getElementsByClassName('ingredientpicker');
		let i = pickers.length;

		while (i--) {
			const searchSelector = document.createElement('span');
			let searchSelectorControls;
			const dropdown = document.createElement('div');
			let ul = document.createElement('ul');
			const picker = pickers[i];
			const index = i;
			let state;
			const from = picker.dataset.type === 'recipes' ? recipes : food;
			const allowUncookable = !picker.dataset.cookable;
			const parent = picker.nextSibling;
			let slots = parent.getElementsByClassName('ingredient');
			let limited;
			let ingredients = [];
			let updateRecipes;
			const suggestions = [];
			const inventoryrecipes = [];
			let selected = null;
			let loaded = false;
			const results = document.getElementById('results');
			const discoverfood = document.getElementById('discoverfood');
			const discover = document.getElementById('discover');
			const makable = document.getElementById('makable');
			const clear = document.createElement('span');
			const toggleText = document.createElement('span');

			const findPreviousMatching = (el, test) => {
				let previous = el;
				while (previous.previousSibling) {
					previous = previous.previousSibling;
					if (test(previous)) {
						return previous;
					}
				}
				return null;
			};
			const findNextMatching = (el, test) => {
				let next = el;
				while (next.nextSibling) {
					next = next.nextSibling;
					if (test(next)) {
						return next;
					}
				}
				return null;
			};
			let displaying = false;
			const appendSlot = id => {
				const item = food[id] || recipes[id] || null;
				if (!id) {
					console && console.warn('ID not set');
					return -1;
				}
				if (limited) {
					for (let i = 0; i < slots.length; i++) {
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
						const i = document.createElement('span');
						i.className = 'ingredient';
						setSlot(i, item);
						i.addEventListener('click', removeSlot, false);
						parent.appendChild(i);
						loaded && updateRecipes();
						return 1;
					}
					return 1;
				}
			};
			const pickItem = e => {
				const target = !e.target.dataset.id ? e.target.parentNode : e.target;
				const result = appendSlot(target.dataset.id);
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
			};
			const liIntoPicker = function (item) {
				const img = makeImage(item.img, 32);
				const li = document.createElement('span');
				li.classList.add('item');
				li.appendChild(img);
				const name = document.createElement('span');
				name.classList.add('text');
				name.appendChild(document.createTextNode(item.name));
				li.appendChild(name);
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
			};
			const updateFaded = el => {
				if (ingredients.indexOf(food[el.dataset.id]) !== -1) {
					if (!el.style.opacity) {
						el.style.opacity = 0.5;
					}
				} else {
					if (el.style.opacity) {
						el.style.removeProperty('opacity');
					}
				}
			};
			const removeSlot = e => {
				const target = e.target.tagName === 'IMG' ? e.target.parentNode : e.target;
				if (limited) {
					if (getSlot(target) !== null) {
						setSlot(target, null);
						updateRecipes();
						return target.dataset.id;
					} else {
						//picker.focus();
					}
				} else {
					const i = slots.indexOf(target.dataset.id);
					slots.splice(i, 1);
					parent.removeChild(target);
					updateRecipes();
					return slots[i] || null;
				}
			};
			/* const refreshLocation = () => {
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
			}; */
			const refreshPicker = () => {
				searchSelectorControls.splitTag();
				const names = matchingNames(from, searchSelectorControls.getSearch(), allowUncookable);
				dropdown.removeChild(ul);
				ul = document.createElement('div');
				ul.dataset.length = 0;
				names.forEach(liIntoPicker, ul);
				dropdown.appendChild(ul);
				//refreshLocation();
				selected = null;
			};
			const searchFor = e => {
				const name = e.target.tagName === 'IMG' ? e.target.parentNode.dataset.link : e.target.dataset.link;
				const matches = matchingNames(from, name, allowUncookable);
				if (matches.length === 1) {
					appendSlot(matches[0].id);
				} else {
					picker.value = name;
					refreshPicker();
					//picker.focus();
				}
			};
			let coords;

			if (parent.id === 'ingredients') {
				//simulator
				updateRecipes = () => {
					ingredients = Array.prototype.map.call(slots, slot => {
						return getSlot(slot);
					});
					const cooking = getRecipes(ingredients);
					const health = cooking[0].health;
					const hunger = cooking[0].hunger;
					const sanity = cooking[0].sanity;
					let table = makeSortableTable(
						{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': '', 'Notes' : ''},
						cooking,
						item => {
							return makeRecipeRow(item, health, hunger, sanity);
						},
						'priority',
						true,
						searchFor,
						(item, array) => {
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
								{'': '', 'Name': 'name', 'Health:(% more than ingredients)': 'health', 'Hunger:(% more than ingredients)': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': '', 'Notes' : ''},
								suggestions,
								item => {
									return makeRecipeRow(item, health, hunger, sanity);
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
				updateRecipes = () => {
					ingredients = Array.prototype.map.call(parent.getElementsByClassName('ingredient'), slot => {
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
						const foodTable = makeSortableTable(
							{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Info': ''},
							ingredients,
							makeFoodRow,
							'name'
						);
						discoverfood.appendChild(foodTable);
						getSuggestions(inventoryrecipes, ingredients, null, true);
						if (inventoryrecipes.length > 0) {
							const table = makeSortableTable(
								{'': '', 'Name': 'name', 'Health': 'health', 'Hunger': 'hunger', 'Sanity': 'sanity', 'Perish:Time to turn to rot': 'perish', 'Cook Time': 'cooktime', 'Priority:One of the highest priority recipes for a combination will be made': 'priority', 'Requires:Dim, struck items cannot be used': '', 'Notes' : ''},
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
				Array.prototype.forEach.call(slots, slot => {
					setSlot(slot, null);
					slot.addEventListener('click', removeSlot, false);
				});
			} else {
				slots = [];
				limited = false;
			}
			try {
				if (window.localStorage && localStorage.foodGuideState) {
					state = JSON.parse(localStorage.foodGuideState).pickers;
					if (state && state[index]) {
						state[index].forEach(id => {
							if (food[id]) {
								appendSlot(id);
							}
						});
					}
				}
			} catch (err) {
				console && console.warn('Unable to access localStorage', err);
			}
			loaded = true;
			searchSelector.className = 'searchselector retracted';
			searchSelector.appendChild(document.createTextNode('name'));
			searchSelectorControls = (() => {
				const dropdown = document.createElement('div');
				let extended = false;
				let extendedHeight = null;
				const searchTypes = [{title: 'name', prefix: '', placeholder: 'Filter ingredients'}, {title: 'tag', prefix: 'tag:', placeholder: 'Meat, veggie, fruit, egg, monster...'}, {title: 'recipe', prefix: 'recipe:', placeholder: 'Find ingredients used in a recipe'}];
				let selectedType = searchTypes[0];
				let retractTimer = null;
				const retract = () => {
					extended = false;
					dropdown.style.height = '0px';
					searchSelector.style.borderBottomLeftRadius = '3px';
					dropdown.style.borderTopLeftRadius = '3px';
					if (retractTimer !== null) {
						clearTimeout(retractTimer);
						retractTimer = null;
					}
					searchSelector.className = 'searchselector retracted';
				};
				const extend = () => {
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
				};
				const setSearchType = searchType => {
					selectedType = searchType;
					picker.placeholder = selectedType.placeholder;
					searchSelector.firstChild.textContent = selectedType.title;
				};
				const setSearchTypeFromClick = e => {
					setSearchType(searchTypes[e.target.dataset.typeIndex]);
					refreshPicker();
					retract();
				};
				const tagsplit = /: */;
				const controls = {
					getTag: () => {
						return selectedType.title;
					},
					setSearchType: index => {
						setSearchType(searchTypes[index]);
					},
					getSearch: () => {
						return selectedType.prefix + picker.value;
					},
					splitTag: () => {
						const parts = picker.value.split(tagsplit);

						if (parts.length === 2) {
							const tag = parts[0].toLowerCase() + ':';
							const name = parts[1];
							for (let i = 0; i < searchTypes.length; i++) {
								if (tag === searchTypes[i].prefix) {
									setSearchType(searchTypes[i]);
									picker.value = name;
									break;
								}
							}
						}
					}
				};

				searchSelector.addEventListener('click', () => {
					if (extended) {
						retract();
					} else {
						extend();
					}
				}, false);
				searchSelector.addEventListener('selectstart', e => { e.preventDefault(); }, false);
				searchSelector.addEventListener('mouseout', () => {
					if (retractTimer !== null) {
						clearTimeout(retractTimer);
					}
					retractTimer = setTimeout(retract, 500);
				}, false);
				searchSelector.addEventListener('mouseover', () => {
					if (retractTimer !== null) {
						clearTimeout(retractTimer);
						retractTimer = null;
					}
				}, false);
				dropdown.addEventListener('mouseout', () => {
					if (retractTimer !== null) {
						clearTimeout(retractTimer);
					}
					retractTimer = setTimeout(retract, 500);
				}, false);
				dropdown.addEventListener('mouseover', () => {
					if (retractTimer !== null) {
						clearTimeout(retractTimer);
						retractTimer = null;
					}
				}, false);
				searchTypes.forEach((searchType, index) => {
					const element = document.createElement('div');
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
			})();
			dropdown.className = 'ingredientdropdown';
			dropdown.appendChild(ul);
			dropdown.addEventListener('mousedown', e => { e.preventDefault(); }, false);
			(() => {
				const names = matchingNames(from, searchSelectorControls.getSearch(), allowUncookable);
				dropdown.removeChild(ul);
				ul = document.createElement('div');
				ul.dataset.length = 0;
				names.forEach(liIntoPicker, ul);
				dropdown.appendChild(ul);
			})();
			clear.className = 'clearingredients';
			clear.appendChild(document.createTextNode('clear'));
			clear.addEventListener('click', () => {
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
			clear.addEventListener('mouseover', () => {
				if (picker.value === '' && searchSelectorControls.getTag() === 'name') {
					clear.firstChild.textContent = 'clear chosen ingredients';
				}
			}, false);
			clear.addEventListener('mouseout', () => {
				if (clear.firstChild.textContent !== 'clear') {
					clear.firstChild.textContent = 'clear';
				}
			}, false);
			toggleText.className = 'toggleingredients enabled';
			toggleText.addEventListener('click', () => {
				if (toggleText.classList.contains('enabled')) {
					toggleText.classList.remove('enabled')
					dropdown.classList.add('hidetext')
					toggleText.firstChild.textContent = 'Show names'
				} else {
					toggleText.classList.add('enabled')
					dropdown.classList.remove('hidetext')
					toggleText.firstChild.textContent = 'Icons only'
				}
			}, false);
			toggleText.appendChild(document.createTextNode('Icons only'));
			parent.parentNode.insertBefore(toggleText, parent);
			parent.parentNode.insertBefore(clear, parent);
			parent.parentNode.insertBefore(dropdown, parent);
			picker.addEventListener('keydown', e => {
				let find;
				if (movement.indexOf(e.keyCode) !== -1) {
					const current = selected;
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
									find = findNextMatching(selected, el => {
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
									find = findPreviousMatching(selected, el => {
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
								find = findPreviousMatching(selected, el => {
									return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
								});
								if (!find) {
									find = findPreviousMatching(ul.lastChild, el => {
										return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
									});
								}
								if (find) {
									selected = find;
								} else {
									selected = ul.firstChild;
								}
							} else if (e.keyCode === down) {
								find = findNextMatching(selected, el => {
									return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
								});
								if (!find) {
									find = findNextMatching(ul.firstChild, el => {
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
			const up = 38
			const left = 37
			const down = 40
			const right = 39
			const enter = 13;
			const movement = [16, 17, up, right, down, left, enter];
			picker.addEventListener('keyup', e => {
				// let items;
				// let i;
				// const current = selected;
				if (movement.indexOf(e.keyCode) === -1) {
					refreshPicker();
				} else if (selected !== null) {
					e.preventDefault();
				}
			}, false);
			picker.addEventListener('focus', () => {
				if (!displaying) {
					displaying = true;
				}
			}, false);
			picker.addEventListener('blur', () => {
				if (displaying) {
					displaying = false;
				}
			}, false);
			updateRecipes();
			window.addEventListener('beforeunload', () => {
				if (!window.localStorage) {
					return
				}
				if (!localStorage.foodGuideState) {
					localStorage.foodGuideState = '{}';
				}
				const obj = JSON.parse(localStorage.foodGuideState);
				if (!obj.pickers) {
					obj.pickers = [];
				}
				if (limited) {
					const serialized = Array.prototype.map.call(slots, slot => {
						const item = getSlot(slot);
						return item ? item.id : null;
					});
					obj.pickers[index] = serialized;
				} else {
					obj.pickers[index] = slots;
				}
				localStorage.foodGuideState = JSON.stringify(obj);
			});
			modeRefreshers.push(refreshPicker);
			modeRefreshers.push(updateRecipes);
		}
	})()

	const showmode = e => {
		setMode(modes[e.target.dataset.mode].mask);
	};
	const togglemode = e => {
		setMode(modeMask ^ modes[e.target.dataset.mode].bit);
		e.preventDefault();
	}
	const modeTab = document.createElement('li');
	navbar.insertBefore(modeTab, navbar.firstChild);
	modeTab.className = 'mode';

	for (const name in modes) {
		const modeButton = document.createElement('div');
		modeButton.dataset.mode = name;
		modeButton.addEventListener('click', showmode, false);
		modeButton.addEventListener('contextmenu', togglemode, false);

		modeButton.title = modes[name].name + '\nleft-click to select\nright-click to toggle';
		modeButton.className = 'mode-button'
		modeButton.appendChild(makeImage('img/' + modes[name].img));
		modeTab.appendChild(modeButton);
	}
	setMode(modeMask);
})();
