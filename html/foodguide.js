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
	GIANTS,
	HAMLET,
	SHIPWRECKED,
	VANILLA,
	base_cook_time,
	defaultStatMultipliers,
	headings,
	modes,
	perish_fridge_mult,
	perish_ground_mult,
	perish_preserved,
	perish_summer_mult,
	perish_winter_mult,
	sanity_small,
	spoiled_food_hunger,
	stale_food_health,
	stale_food_hunger,
	total_day_time,
} from './constants.js';
import { food } from './food.js';
import { recipes, updateFoodRecipes } from './recipes.js';
import { isBestStat, isStat, makeImage, makeLinkable, pl } from './utils.js';

(() => {
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

		updateFoodRecipes(recipes.filter(r => (modeMask & r.modeMask) !== 0));

		if (document.getElementById('statistics').hasChildNodes) {
			document
				.getElementById('statistics')
				.replaceChildren(makeRecipeGrinder(null, true));
		}

		for (let i = 0; i < modeTab.childNodes.length; i++) {
			const img = modeTab.childNodes[i];
			const mode = modes[img.dataset.mode];
			img.className = 'mode-button';
			if (modeMask === mode.mask) {
				img.classList.add('selected');
				img.style.backgroundColor = mode.color;
			} else if ((modeMask & mode.bit) !== 0) {
				img.classList.add('enabled');
				img.style.backgroundColor = 'white';
			} else {
				img.style.backgroundColor = 'transparent';
			}

			if (mode.multipliers && (modeMask & mode.bit) !== 0) {
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

		const modeOrder = [
			'together',
			'hamlet',
			'shipwrecked',
			'giants',
			'vanilla',
		];

		// Set the background color based on selected game mode
		for (let i = 0; i < modeOrder.length; i++) {
			const mode = modes[modeOrder[i]];
			if ((modeMask & mode.bit) !== 0) {
				document.getElementById('background').style['background-color'] =
          mode.color;
				return;
			}
		}
	};

	const matchingNames = (() => {
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

		const allowedFilter = element => {
			if (
				(!allowUncookable && element.uncookable) ||
        (element.modeMask & modeMask) === 0
			) {
				element.match = 0;
				return false;
			}

			return true;
		};

		const filter = element => {
			if (
				element.lowerName.indexOf(name) === 0 ||
        (element.raw && element.raw.lowerName.indexOf(name) === 0)
			) {
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
			return (element.match = element[tag] + 0 || 0);
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
			return (element.match = failed ? 0 : 1);
		};

		const ingredientFilter = recipe => {
			let i = 0;
			let failed = true;

			while (i < recipe.requirements.length) {
				const result = recipe.requirements[i].test(
					null,
					ingredient.nameObject,
					ingredient,
				);
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
			return (recipe.match = failed ? 0 : 1);
		};

		const exact = element => {
			return (element.match = element.lowerName === name ? 1 : 0);
		};

		const like = element => {
			return (element.match =
        element.lowerName === name ||
        (element.raw && element.raw.lowerName === name) ||
        (element.cook && element.cook.lowerName === name)
        	? 1
        	: 0);
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

			arr = arr.filter(allowedFilter);

			if (tagsearch.test(name)) {
				// tag:
				tag = name.split(tagsplit)[1];

				return arr.filter(tagFilter).sort(byMatch);
			} else if (tagnotsearch.test(name)) {
				// tagnot:
				tag = name.split(tagnotsplit)[1];

				return arr
					.filter(element => {
						return !tagFilter(element);
					})
					.sort(byMatch);
			} else if (recipesearch.test(name)) {
				// recipe:
				recipe = recipes.byName(name.split(recipesplit)[1].toLowerCase());

				if (recipe) {
					recipe = recipe.requirements;

					return arr.filter(recipeFilter).sort(byMatch);
				} else {
					return [];
				}
			} else if (ingredientsearch.test(name)) {
				// ingredient:
				ingredient = food.byName(name.split(ingredientsplit)[1].toLowerCase());

				if (ingredient) {
					return arr.filter(ingredientFilter).sort(byMatch);
				} else {
					return [];
				}
			} else if (name.indexOf('*') === 0) {
				// *
				// Exact matches
				name = name.substring(1);

				return arr.filter(exact).sort(byMatch);
			} else if (name.indexOf('~') === 0) {
				// ~
				// Similar matches
				name = name.substring(1);

				return arr.filter(like).sort(byMatch);
			} else {
				// Otherwise, do a string comparison
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
						let val = item[k];

						if (isStat[k]) {
							val *= statMultipliers[item.preparationType];
						} else if (isBestStat[k]) {
							val *= statMultipliers[item[k + 'Type']];
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
			const names = {};
			const tags = {};

			recipeList.length = 0;
			setIngredientValues(items, names, tags);

			outer: for (let i = 0; i < recipes.length; i++) {
				let valid = false;

				if ((recipes[i].modeMask & modeMask) === 0) {
					continue;
				}

				for (let ii = 0; ii < recipes[i].requirements.length; ii++) {
					const requirement = recipes[i].requirements[ii];

					if (requirement.test(null, names, tags)) {
						if (!recipes[i].requirements[ii].cancel) {
							valid = true;
						}
					} else if (!itemComplete && !!recipes[i].requirements[ii].cancel) {
						continue outer;
					} else if (!!itemComplete && !recipes[i].requirements[ii].cancel) {
						continue outer;
					}
				}

				if (valid && (!exclude || exclude.indexOf(recipes[i]) === -1)) {
					recipeList.push(recipes[i]);
				}
			}

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

			for (let i = 0; i < recipes.length; i++) {
				if (
					(recipes[i].modeMask & modeMask) !== 0 &&
          recipes[i].test(null, names, tags)
				) {
					recipeList.push(recipes[i]);
				}
			}

			recipeList.sort((a, b) => {
				return b.priority - a.priority;
			});

			// Add best row
			const bestTags = { ...tags };
			bestTags.hunger = bestTags.bestHunger;
			bestTags.health = bestTags.bestHealth;
			bestTags.sanity = bestTags.bestSanity;

			bestTags.img = '';
			bestTags.name = 'Sum:Potential';
			bestTags.priority = ' ';
			bestTags.perish = 0;
			bestTags.cooktime = 0;
			delete bestTags.cook;

			recipeList.unshift(bestTags);

			// Add total row
			const totalTags = { ...tags };

			totalTags.bestHunger = totalTags.hunger;
			totalTags.bestHealth = totalTags.health;
			totalTags.bestSanity = totalTags.sanity;

			totalTags.img = '';
			totalTags.name = 'Sum:Total';
			totalTags.priority = ' ';
			totalTags.perish = 0;
			totalTags.cooktime = 0;
			delete totalTags.cook;

			recipeList.unshift(totalTags);

			return recipeList;
		};
	})();

	const mainElement = document.getElementById('main');
	const foodElement = document.getElementById('food');
	const recipesElement = document.getElementById('recipes');
	const navbar = document.getElementById('navbar');

	// TODO: process the rot: entries, and add the spoiled fish

	document
		.getElementById('stalehealth')
		.appendChild(
			document.createTextNode(Math.round(stale_food_health * 1000) / 10 + '%'),
		);
	document
		.getElementById('stalehunger')
		.appendChild(
			document.createTextNode(Math.round(stale_food_hunger * 1000) / 10 + '%'),
		);
	document
		.getElementById('spoiledhunger')
		.appendChild(
			document.createTextNode(Math.round(spoiled_food_hunger * 1000) / 10 + '%'),
		);
	document
		.getElementById('spoiledsanity')
		.appendChild(document.createTextNode(sanity_small));
	document
		.getElementById('perishground')
		.appendChild(
			document.createTextNode(Math.round(perish_ground_mult * 1000) / 10 + '%'),
		);
	document
		.getElementById('perishwinter')
		.appendChild(
			document.createTextNode(Math.round(perish_winter_mult * 1000) / 10 + '%'),
		);
	document
		.getElementById('perishsummer')
		.appendChild(
			document.createTextNode(Math.round(perish_summer_mult * 1000) / 10 + '%'),
		);
	document
		.getElementById('perishfridge')
		.appendChild(
			document.createTextNode(Math.round(perish_fridge_mult * 1000) / 10 + '%'),
		);

	const combinationGenerator = (length, callback, startPos) => {
		const size = 4;
		const index = 1;
		const current = startPos || [0, 0, 0, 0];

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

	const getRealRecipesFromCollection = (
		items,
		mainCallback,
		chunkCallback,
		endCallback,
	) => {
		const recipeCrunchData = {};
		const updateRecipeCrunchData = () => {
			recipeCrunchData.recipes = recipes
				.filter(item => {
					return (
						!item.trash &&
            (item.modeMask & modeMask) !== 0 &&
            item.foodtype !== 'roughage'
					);
				})
				.sort((a, b) => {
					return b.priority - a.priority;
				});

			recipeCrunchData.test = recipeCrunchData.recipes.map(a => {
				return a.test;
			});
			recipeCrunchData.tests = recipeCrunchData.recipes.map(a => {
				return a.test.toString();
			});
			recipeCrunchData.priority = recipeCrunchData.recipes.map(a => {
				return a.priority || 0;
			});

			window.recipeCrunchData = recipeCrunchData;
		};
		updateRecipeCrunchData();

		const built = [];
		// time in milliseconds to try to stay under in each block of calculations
		const desiredTime = 100;
		let renderedTo = 0;
		let lastTime;
		let block = 100;

		const foodFromIndex = index => {
			return items[index];
		};

		const callback = combination => {
			const ingredients = combination.map(foodFromIndex);
			const names = {};
			const tags = {};

			let created = null;
			let multiple = false;

			setIngredientValues(ingredients, names, tags);

			tags.hunger = tags.bestHunger; // * statMultipliers[tags.bestHungerType];
			tags.health = tags.bestHealth; // * statMultipliers[tags.bestHealthType];
			tags.sanity = tags.bestSanity; // * statMultipliers[tags.bestSanityType];

			const matches = recipeCrunchData.recipes.filter(recipe =>
				recipe.test(null, names, tags),
			);
			const maxPriority = matches.reduce(
				(max, recipe) => Math.max(recipe.priority, max),
				-Infinity,
			);

			for (const recipe of matches.filter(
				recipe => recipe.priority >= maxPriority,
			)) {
				if (created !== null) {
					multiple = true;
					created.multiple = true;
				}

				created = {
					recipe,
					ingredients,
					tags: { health: tags.health, hunger: tags.hunger },
					multiple,
				};
				built.push(created);
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
				block = ((desiredTime / lastTime) * block + 1) | 0;
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

		setTab = tabID => {
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
				elements[navtab.dataset.tab] = document.getElementById(
					navtab.dataset.tab,
				);
				elements[navtab.dataset.tab].style.display = 'none';
				navtab.addEventListener(
					'selectstart',
					e => {
						e.preventDefault();
					},
					false,
				);
				navtab.addEventListener('click', showTab, false);
			}
		}

		activeTab = tabs['simulator'];
		activePage = elements['simulator'];

		try {
			if (window.localStorage.foodGuideState) {
				const storage = JSON.parse(window.localStorage.foodGuideState);

				if (storage.activeTab && tabs[storage.activeTab]) {
					activeTab = tabs[storage.activeTab];
					activePage = elements[storage.activeTab];
					modeMask = storage.modeMask || modes.together.mask;
				}
			}
		} catch (err) {
			console.warn('Unable to access localStorage', err);
			try {
				window.localStorage.removeItem('foodGuideState');
			} catch {}
		}

		activeTab.className = 'selected';
		activePage.style.display = 'block';

		window.addEventListener('beforeunload', () => {
			let obj;

			try {
				if (!window.localStorage.foodGuideState) {
					window.localStorage.foodGuideState = '{}';
				}

				obj = JSON.parse(window.localStorage.foodGuideState);
				obj.activeTab = activeTab.dataset.tab;
				obj.modeMask = modeMask;
				window.localStorage.foodGuideState = JSON.stringify(obj);
			} catch (err) {
				console.warn('Unable to access localStorage', err);
			}
		});
	})();

	const queue = img => {
		if (img.dataset.pending) {
			makeImage.queue(img, img.dataset.pending);
		}
	};

	const cells = (cellType, ...args) => {
		const tr = document.createElement('tr');

		for (let i = 0; i < args.length; i++) {
			const td = document.createElement(cellType);
			const cell = args[i];
			const celltext = cell && cell.indexOf ? cell : cell.toString();

			if (cell instanceof DocumentFragment) {
				td.appendChild(cell.cloneNode(true));
				Array.prototype.forEach.call(td.getElementsByTagName('img'), queue);
			} else if (celltext.indexOf('img/') === 0) {
				let imgurl = celltext;
				let title = celltext;
				if (celltext.indexOf(':') !== -1) {
					const split = celltext.split(':');
					imgurl = split[0];
					title = split[1];
				}
				const image = makeImage(imgurl);
				image.title = title;
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
		if (name && name.startsWith('Sum:')) {
			return name.substring(name.indexOf(':') + 1);
		}

		const node = document.createElement('a');
		node.setAttribute('target', '_blank');
		node.setAttribute(
			'href',
			'https://dontstarve.fandom.com/wiki/' + name.replace(/\s/g, '_'),
		);

		const text = document.createTextNode(name);
		node.appendChild(text);

		return node;
	};
	
	const fractionChars = ['\u215b', '\u00bc', '\u215c', '\u00bd', '\u215d', '\u00be', '\u215e'];

	const makeSortableTable = (
		headers,
		dataset,
		rowGenerator,
		defaultSort,
		hasSummary,
		linkCallback,
		highlightCallback,
		filterCallback,
		startRow,
		maxRows,
	) => {
		let table;
		let sorting;
		let invertSort = false;
		let firstHighlight;
		let lastHighlight;
		let rows;

		const generateAndHighlight = (item, index, array) => {
			if (
				(!maxRows || rows < maxRows) &&
        (!filterCallback || filterCallback(item))
			) {
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
					summary = [dataset.shift(), dataset.shift()];
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

						return !isNaN(sa) && !isNaN(sb)
							? sb - sa
							: isNaN(sa) && isNaN(sb)
								? 0
								: isNaN(sa)
									? 1
									: -1;
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
					dataset.unshift(...summary);
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

				Array.prototype.forEach.call(
					table.getElementsByClassName('link'),
					element => {
						element.addEventListener('click', linkCallback, false);
					},
				);
			}

			if (oldTable) {
				oldTable.parentNode.replaceChild(table, oldTable);
			}

			if (scrollHighlight) {
				if (
					firstHighlight &&
          firstHighlight.offsetTop +
            table.offsetTop +
            mainElement.offsetTop +
            firstHighlight.offsetHeight >
            window.scrollY + window.innerHeight
				) {
					firstHighlight.scrollIntoView(true);
				} else if (
					lastHighlight &&
          lastHighlight.offsetTop + table.offsetTop + mainElement.offsetTop <
            window.scrollY
				) {
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

		const nEights = ((Math.abs(n) % 1) * 8) | 0;
		let fractStr = nEights < 1 || nEights > 7 ? '' : fractionChars[nEights];

		n = Math.floor(n);
		return (n > 0 ? '+' + n : n) + fractStr;
	};

	const rawpct = (base, val) => {
		return base < val
			? (val - base) / Math.abs(base)
			: base > val
				? -(base - val) / Math.abs(base)
				: 0;
	};

	const pct = (base, val) => {
		const result =
      !isNaN(base) && base !== val
      	? ' (' +
          sign(
          	(
          		(base < val
          			? (val - base) / Math.abs(base)
          			: base > val
          				? -(base - val) / Math.abs(base)
          				: 0) * 100
          	).toFixed(0),
          ) +
          '%)'
      	: '';

		return result.indexOf('Infinity') === -1
			? result
			: ' (' + sign(val - base) + ')';
	};

	const makeFoodRow = item => {
		const mult = statMultipliers[item.preparationType];
		let health = sign(item.health * mult);
		let hunger = sign(item.hunger * mult);
		let sanity = isNaN(item.sanity) ? '' : item.sanity * mult;
		let perish = isNaN(item.perish)
			? 'Never'
			: item.perish / total_day_time +
        ' ' +
        pl('day', item.perish / total_day_time);

		if (item.cook) {
			const cookmult = statMultipliers[item.cook.preparationType];

			if ((item.cook.health || 0) !== (item.health || 0)) {
				health +=
          ' (' +
          sign((item.cook.health || 0) * cookmult - (item.health || 0)) +
          ')';
			}
			if ((item.cook.hunger || 0) !== (item.hunger || 0)) {
				hunger +=
          ' (' +
          sign((item.cook.hunger || 0) * cookmult - (item.hunger || 0)) +
          ')';
			}
			if ((item.cook.sanity || 0) !== (item.sanity || 0)) {
				sanity +=
          ' (' +
          sign((item.cook.sanity || 0) * cookmult - (item.sanity || 0)) +
          ')';
			}
			if ((item.cook.perish || 0) !== (item.perish || 0)) {
				const dayDifference =
          ((item.cook.perish || 0) - (item.perish || 0)) / total_day_time;
				if (isNaN(dayDifference)) {
					perish += ' (to Never)';
				} else {
					perish +=
            ' (' +
            (item.perish
            	? sign(dayDifference)
            	: 'to ' + item.cook.perish / total_day_time) +
            ')';
				}
			}
		}

		return cells(
			'td',
			item.img ? item.img + ':' + item.name : '',
			wikiaHref(item.name),
			health,
			hunger,
			sanity,
			perish,
			item.info || '',
			item.modeNode || '',
		);
	};

	const makeRecipeRow = (item, health, hunger, sanity) => {
		const mult = statMultipliers[item.preparationType] || 1;
		const ihealth = item.health * mult;
		const ihunger = item.hunger * mult;
		const isanity = item.sanity * mult;

		return cells(
			'td',
			item.img ? item.img + ':' + item.name : '',
			wikiaHref(item.name),
			sign(ihealth) + pct(health, ihealth),
			sign(ihunger) + pct(hunger, ihunger),
			isNaN(isanity) ? '' : sign(isanity) + pct(sanity, isanity),
			isNaN(item.perish)
				? 'Never'
				: item.perish / total_day_time +
            ' ' +
            pl('day', item.perish / total_day_time),
			((item.cooktime * base_cook_time + 0.5) | 0) + ' secs',
			item.priority || '0',
			item.requires || '',
			item.note || '',
			item.modeNode || '',
		);
	};

	// food list, recipe list
	(() => {
		let foodHighlight;
		let foodHighlighted = [];
		let recipeHighlighted = [];

		const setFoodHighlight = e => {
			let name = !e.target
				? e
				: e.target.tagName === 'IMG'
					? e.target.parentNode.dataset.link
					: e.target.dataset.link;

			if (
				name.substring(0, 7) === 'recipe:' ||
        name.substring(0, 11) === 'ingredient:'
			) {
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
			const name = !e.target
				? e
				: e.target.tagName === 'IMG'
					? e.target.parentNode.dataset.link
					: e.target.dataset.link;
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
			{
				'': '',
				Name: 'name',
				[headings.health]: 'health',
				[headings.hunger]: 'hunger',
				[headings.sanity]: 'sanity',
				[headings.perish]: 'perish',
				Info: '',
				'Mode:DLC or Game Mode required': 'modeMask',
			},
			Array.prototype.slice.call(food),
			makeFoodRow,
			'name',
			false,
			setFoodHighlight,
			testFoodHighlight,
			testmode,
		);

		const recipeTable = makeSortableTable(
			{
				'': '',
				Name: 'name',
				[headings.health]: 'health',
				[headings.hunger]: 'hunger',
				[headings.sanity]: 'sanity',
				[headings.perish]: 'perish',
				'Cook Time': 'cooktime',
				'Priority:One of the highest priority recipes for a combination will be made':
          'priority',
				'Requires:Dim+struck items cannot be used': '',
				Notes: '',
				'Mode:DLC or Game Mode required': 'modeMask',
			},
			Array.prototype.slice.call(recipes),
			makeRecipeRow,
			'name',
			false,
			setRecipeHighlight,
			testRecipeHighlight,
			testmode,
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

	const makeRecipeGrinder = (ingredients, excludeDefault) => {
		const makableButton = document.createElement('button');
		let hasTable = false;

		makableButton.appendChild(
			document.createTextNode(
				'Calculate efficient recipes (may take some time)',
			),
		);
		makableButton.className = 'makablebutton';
		const initializeGrinder = () =>
			(() => {
				const idealIngredients = [];
				const makableRecipes = [];
				const usedIngredients = new Set();
				const excludedIngredients = new Set();
				const excludedRecipes = new Set();

				let i = ingredients ? ingredients.length : null;

				let selectedRecipe;
				let selectedRecipeElement;
				let makableRecipe;
				let makableSummary;
				let makableFootnote;
				let makableFilter;
				let customFilterHolder;
				let customFilterInput;
				let made;
				let makableDiv;
				let makableTable;

				const deleteButton = document.createElement('button');
				deleteButton.appendChild(document.createTextNode('Clear results'));
				deleteButton.className = 'deleteButton';
				deleteButton.addEventListener('click', () => {
					makableButton.parentNode.removeChild(makableDiv);
					hasTable = false;
				});
				if (hasTable) {
					makableButton.parentNode.removeChild(makableButton.nextSibling);
				}
				hasTable = true;

				const checkExcludes = item => excludedIngredients.has(item.id);
				const checkIngredient = function (item) {
					return this.includes(food[item]);
				};

				const toggleFilter = e => {
					if (excludedIngredients.has(e.target.dataset.id)) {
						excludedIngredients.delete(e.target.dataset.id);
					}
					if (usedIngredients.has(e.target.dataset.id)) {
						usedIngredients.delete(e.target.dataset.id);
						e.target.className = '';
					} else {
						usedIngredients.add(e.target.dataset.id);
						e.target.className = 'selected';
					}

					makableTable.update();
				};

				const toggleExclude = e => {
					if (usedIngredients.has(e.target.dataset.id)) {
						usedIngredients.delete(e.target.dataset.id);
					}

					if (excludedIngredients.has(e.target.dataset.id)) {
						excludedIngredients.delete(e.target.dataset.id);
						e.target.className = '';
					} else {
						excludedIngredients.add(e.target.dataset.id);
						e.target.className = 'excluded';
					}

					makableTable.update();

					e.preventDefault();
				};

				const setRecipe = e => {
					if (selectedRecipeElement) {
						selectedRecipeElement.className = '';
					}

					for (const e of makableRecipe.childNodes) {
						e.className = '';
					}

					excludedRecipes.clear();

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

					if (excludedRecipes.has(e.target.dataset.recipe)) {
						excludedRecipes.delete(e.target.dataset.recipe);
						e.target.className = '';
					} else {
						excludedRecipes.add(e.target.dataset.recipe);
						e.target.className = 'excluded';
					}

					makableTable.update();

					e.preventDefault();
				};

				//TODO: optimize so much around this
				if (i === null) {
					ingredients = food;
				}
				ingredients = ingredients.filter(f => (f.modeMask & modeMask) !== 0);
				i = ingredients.length;

				if (excludeDefault) {
					for (const ingredient of ingredients
						.filter(ingredient => ingredient.defaultExclude)
						.map(ingredient => ingredient.id)) {
						excludedIngredients.add(ingredient);
					}

					for (const recipe of recipes
						.filter(recipe => recipe.defaultExclude)
						.map(recipe => recipe.id)) {
						excludedRecipes.add(recipe);
					}
				}

				const tryPush = ingredient => {
					if (!ingredient.uncookable && !ingredient.skip) {
						idealIngredients.push(ingredient);
					}
				};

				while (i--) {
					if (!ingredients[i].skip) {
						if (
							!ingredients[i].uncookable &&
              (!ingredients[i].cooked || ingredients[i].ideal) &&
              idealIngredients.indexOf(ingredients[i]) === -1
						) {
							tryPush(ingredients[i]);
						}
					} else {
						if (
							ingredients[i].cook &&
              !ingredients[i].cook.uncookable &&
              !ingredients[i].cook.skip &&
              idealIngredients.indexOf(ingredients[i].cook) === -1
						) {
							tryPush(ingredients[i].cook);
						} else if (
							ingredients[i].dry &&
              !ingredients[i].dry.uncookable &&
              !ingredients[i].dry.skip &&
              idealIngredients.indexOf(ingredients[i].dry) === -1
						) {
							tryPush(ingredients[i].dry);
						}
					}

					if (
						ingredients[i].cooked &&
            !ingredients[i].raw.uncookable &&
            !ingredients[i].raw.skip &&
            idealIngredients.indexOf(ingredients[i].raw) === -1
					) {
						tryPush(ingredients[i].raw);
					}

					if (
						ingredients[i].rackdried &&
            !ingredients[i].wet.uncookable &&
            !ingredients[i].wet.skip &&
            idealIngredients.indexOf(ingredients[i].wet) === -1
					) {
						tryPush(ingredients[i].wet);
					}
				}

				made = [];

				makableTable = makeSortableTable(
					{
						'': '',
						Name: 'name',
						[headings.health]: 'health',
						'Health+:Health gained compared to ingredients': 'healthpls',
						[headings.hunger]: 'hunger',
						'Hunger+:Hunger gained compared to ingredients': 'hungerpls',
						Ingredients: '',
					},
					made,
					data => {
						const item = data.recipe;

						return cells(
							'td',
							item.img ? item.img : '',
							item.name,
							sign(item.health),
							sign(data.healthpls) +
                ' (' +
                sign((data.healthpct * 100) | 0) +
                '%)',
							sign(item.hunger),
							sign(data.hungerpls) +
                ' (' +
                sign((data.hungerpct * 100) | 0) +
                '%)',
							makeLinkable(
								data.ingredients.reduce(ingredientToIcon, '') +
                  (data.multiple ? '*' : ''),
							),
						);
					},
					'hungerpls',
					false,
					null,
					null,
					data =>
						(!selectedRecipe || data.recipe.id === selectedRecipe) &&
            !excludedRecipes.has(data.recipe.id) &&
            (excludedIngredients.size == 0 ||
              !data.ingredients.some(checkExcludes)) &&
            [...usedIngredients].every(checkIngredient, data.ingredients),
					0,
					25,
				);

				makableDiv = document.createElement('div');

				makableSummary = document.createElement('div');
				makableSummary.appendChild(
					document.createTextNode('Computing combinations..'),
				);

				makableFootnote = document.createElement('div');
				makableFootnote.appendChild(
					document.createTextNode('* combination has multiple possible results'),
				);

				makableDiv.appendChild(makableSummary);

				makableRecipe = document.createElement('div');
				makableRecipe.className = 'recipeFilter';
				makableDiv.appendChild(makableRecipe);

				makableFilter = document.createElement('div');
				makableFilter.className = 'foodFilter';

				idealIngredients.forEach(item => {
					const img = makeImage(item.img);
					img.dataset.id = item.id;
					img.addEventListener('click', toggleFilter, false);
					img.addEventListener('contextmenu', toggleExclude, false);
					if (excludedIngredients.has(item.id)) {
						img.className = 'excluded';
					}
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
				makableButton.after(makableDiv);
				makableDiv.appendChild(makableFootnote);

				updateFoodRecipes(recipes.filter(r => (modeMask & r.modeMask) !== 0));

				getRealRecipesFromCollection(
					idealIngredients,
					data => {
						// row update
						if (makableRecipes.indexOf(data.recipe.id) === -1) {
							let i = 0;

							for (i = 0; i < makableRecipes.length; i++) {
								if (data.recipe.id < makableRecipes[i]) {
									break;
								}
							}

							makableRecipes.splice(i, 0, data.recipe.id);

							const img = makeImage(
								recipes[makableRecipes[i].toLowerCase()].img,
							);

							img.dataset.recipe = makableRecipes[i];
							img.addEventListener('click', setRecipe, false);
							img.addEventListener('contextmenu', excludeRecipe, false);
							if (excludedRecipes.has(data.recipe.id)) {
								img.className = 'excluded';
							}
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
					},
					() => {
						makableSummary.firstChild.textContent =
              'Found ' +
              made.length +
              ' valid recipes.. (you can change Food Guide tabs during this process)';
					},
					() => {
						//computation finished
						window.analysis = {
							made,
						};

						makableTable.setMaxRows(250);
						makableSummary.firstChild.textContent =
              'Found ' + made.length + ' valid recipes.';

						makableSummary.appendChild(deleteButton);
					},
				);
			})();

		makableButton.addEventListener('click', initializeGrinder, false);

		return makableButton;
	};

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
			if (
				slotElement.nextSibling &&
        getSlot(slotElement.nextSibling) !== null
			) {
				setSlot(slotElement, getSlot(slotElement.nextSibling));
				setSlot(slotElement.nextSibling, null);

				return;
			} else {
				slotElement.dataset.id = null;
			}
		}

		if (item !== null) {
			const img = makeImage(item.img);
			img.title = item.name;
			if (slotElement.firstChild) {
				slotElement.replaceChild(img, slotElement.firstChild);
			} else {
				slotElement.appendChild(img);
			}
		} else {
			if (slotElement.firstChild) {
				slotElement.removeChild(slotElement.firstChild);
			}
		}

		slotElement.title = item ? item.name : '';
	};

	const getSlot = slotElement => {
		return (
			slotElement &&
      (food[slotElement.dataset.id] || recipes[slotElement.dataset.id] || null)
		);
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
					console.warn('ID not set');
					return -1;
				}

				if (limited) {
					for (let i = 0; i < slots.length; i++) {
						if (getSlot(slots[i]) === null) {
							setSlot(slots[i], item);
							if (loaded) {
								updateRecipes();
							}

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
						if (loaded) {
							updateRecipes();
						}
					}

					return 1;
				}
			};

			const pickItem = e => {
				const target = !e.target.dataset.id ? e.target.parentNode : e.target;
				const result = appendSlot(target.dataset.id);

				if (result !== -1) {
					e && e.preventDefault && e.preventDefault();
				}
			};

			const liIntoPicker = function (item) {
				const img = makeImage(item.img);

				img.title = item.name;

				const li = document.createElement('span');
				li.classList.add('item');
				li.appendChild(img);

				const name = document.createElement('span');
				name.classList.add('text');
				name.appendChild(document.createTextNode(item.name));
				li.appendChild(name);

				li.dataset.id = item.id;

				if (ingredients.indexOf(item) !== -1) {
					li.style.opacity = 0.5;
				}

				li.addEventListener('mousedown', pickItem, false);
				this.appendChild(li);

				this.dataset.length++;
			};

			const updateFaded = el => {
				if (ingredients.indexOf(food[el.dataset.id]) !== -1) {
					if (!el.style.opacity) {
						el.style.opacity = 0.5;
					}
				} else if (el.style.opacity) {
					el.style.removeProperty('opacity');
				}
			};

			const removeSlot = e => {
				const target =
          e.target.tagName === 'IMG' ? e.target.parentNode : e.target;

				if (limited) {
					if (getSlot(target) !== null) {
						setSlot(target, null);
						updateRecipes();

						return target.dataset.id;
					}
				} else {
					const i = slots.indexOf(target.dataset.id);

					slots.splice(i, 1);
					parent.removeChild(target);
					updateRecipes();

					return slots[i] || null;
				}
			};

			const refreshPicker = () => {
				searchSelectorControls.splitTag();
				const names = matchingNames(
					from,
					searchSelectorControls.getSearch(),
					allowUncookable,
				);

				dropdown.removeChild(ul);

				ul = document.createElement('div');
				ul.dataset.length = 0;
				names.forEach(liIntoPicker, ul);

				dropdown.appendChild(ul);

				selected = null;
			};

			const searchFor = e => {
				const name =
          e.target.tagName === 'IMG'
          	? e.target.parentNode.dataset.link
          	: e.target.dataset.link;
				const matches = matchingNames(from, name, allowUncookable);

				if (matches.length === 1) {
					appendSlot(matches[0].id);
				} else {
					picker.value = name;
					refreshPicker();
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
						{
							'': '',
							Name: 'name',
							[headings.health]: 'health',
							[headings.hunger]: 'hunger',
							[headings.sanity]: 'sanity',
							[headings.perish]: 'perish',
							'Cook Time': 'cooktime',
							'Priority:One of the highest priority recipes for a combination will be made':
                'priority',
							'Requires:Dim, struck items cannot be used': '',
							Notes: '',
							'Mode:DLC or Game Mode required': 'modeMask',
						},
						cooking,
						item => {
							return makeRecipeRow(item, health, hunger, sanity);
						},
						'priority',
						true,
						searchFor,
						(item, array) => {
							return (
								array.length > 0 && item.priority === highest(array, 'priority')
							);
						},
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
							results.appendChild(
								document.createTextNode('Add more ingredients to make:'),
							);
							table = makeSortableTable(
								{
									'': '',
									Name: 'name',
									'Health:(% more than ingredients)': 'health',
									'Hunger:(% more than ingredients)': 'hunger',
									[headings.sanity]: 'sanity',
									[headings.perish]: 'perish',
									'Cook Time': 'cooktime',
									'Priority:One of the highest priority recipes for a combination will be made':
                    'priority',
									'Requires:Dim, struck items cannot be used': '',
									Notes: '',
									'Mode:DLC or Game Mode required': 'modeMask',
								},
								suggestions,
								item => {
									return makeRecipeRow(item, health, hunger, sanity);
								},
								'priority',
								false,
								searchFor,
							);
							results.appendChild(table);
						}
					}

					ul &&
            ul.firstChild &&
            Array.prototype.forEach.call(
            	ul.getElementsByTagName('span'),
            	updateFaded,
            );
				};
			} else if (parent.id === 'inventory') {
				//discovery
				updateRecipes = () => {
					ingredients = Array.prototype.map.call(
						parent.getElementsByClassName('ingredient'),
						slot => {
							return getSlot(slot);
						},
					);

					if (discoverfood.firstChild) {
						discoverfood.removeChild(discoverfood.firstChild);
					}
					if (discover.firstChild) {
						discover.removeChild(discover.firstChild);
					}
					while (makable.firstChild) {
						makable.removeChild(makable.firstChild);
					}

					if (ingredients.length > 0) {
						const foodTable = makeSortableTable(
							{
								'': '',
								Name: 'name',
								[headings.health]: 'health',
								[headings.hunger]: 'hunger',
								[headings.sanity]: 'sanity',
								[headings.perish]: 'perish',
								Info: '',
								'Mode:DLC or Game Mode required': 'modeMask',
							},
							ingredients,
							makeFoodRow,
							'name',
						);

						discoverfood.appendChild(foodTable);
						getSuggestions(inventoryrecipes, ingredients, null, true);

						if (inventoryrecipes.length > 0) {
							const table = makeSortableTable(
								{
									'': '',
									Name: 'name',
									[headings.health]: 'health',
									[headings.hunger]: 'hunger',
									[headings.sanity]: 'sanity',
									[headings.perish]: 'perish',
									'Cook Time': 'cooktime',
									'Priority:One of the highest priority recipes for a combination will be made':
                    'priority',
									'Requires:Dim, struck items cannot be used': '',
									Notes: '',
									'Mode:DLC or Game Mode required': 'modeMask',
								},
								inventoryrecipes,
								makeRecipeRow,
								'name',
							);

							discover.appendChild(table);

							makable.appendChild(makeRecipeGrinder(ingredients));
						}
					}

					if (ul &&
            ul.firstChild) {
						Array.prototype.forEach.call(
            	ul.getElementsByTagName('span'),
            	updateFaded,
						);
					}
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
				if (window.localStorage.foodGuideState) {
					state = JSON.parse(window.localStorage.foodGuideState).pickers;

					if (state && state[index]) {
						state[index].forEach(id => {
							if (food[id]) {
								appendSlot(id);
							}
						});
					}
				}
			} catch (err) {
				console.warn('Unable to access localStorage', err);
			}

			loaded = true;
			searchSelector.className = 'searchselector retracted';
			searchSelector.appendChild(document.createTextNode('name'));

			searchSelectorControls = (() => {
				const dropdown = document.createElement('div');
				let extended = false;
				let extendedHeight = null;
				const searchTypes = [
					{ title: 'name', prefix: '', placeholder: 'Filter ingredients' },
					{
						title: 'tag',
						prefix: 'tag:',
						placeholder: 'Meat, veggie, fruit, egg, monster...',
					},
					{
						title: 'recipe',
						prefix: 'recipe:',
						placeholder: 'Find ingredients used in a recipe',
					},
				];
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
						dropdown.style.top =
              searchSelector.offsetTop + searchSelector.offsetHeight;
						extendedHeight = dropdown.offsetHeight + 'px';
						dropdown.style.height = '0px';
					}

					extended = true;
					dropdown.style.height = extendedHeight;
					searchSelector.style.borderBottomLeftRadius = '0px';
					dropdown.style.borderTopLeftRadius = '0px';
					dropdown.style.width = 'auto';
					dropdown.style.width =
            Math.max(dropdown.offsetWidth, searchSelector.offsetWidth + 1) +
            'px';

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
					},
				};

				searchSelector.addEventListener(
					'click',
					() => {
						if (extended) {
							retract();
						} else {
							extend();
						}
					},
					false,
				);

				searchSelector.addEventListener(
					'selectstart',
					e => {
						e.preventDefault();
					},
					false,
				);

				searchSelector.addEventListener(
					'mouseout',
					() => {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
						}
						retractTimer = setTimeout(retract, 500);
					},
					false,
				);

				searchSelector.addEventListener(
					'mouseover',
					() => {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
							retractTimer = null;
						}
					},
					false,
				);

				dropdown.addEventListener(
					'mouseout',
					() => {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
						}
						retractTimer = setTimeout(retract, 500);
					},
					false,
				);

				dropdown.addEventListener(
					'mouseover',
					() => {
						if (retractTimer !== null) {
							clearTimeout(retractTimer);
							retractTimer = null;
						}
					},
					false,
				);

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
			dropdown.addEventListener(
				'mousedown',
				e => {
					e.preventDefault();
				},
				false,
			);

			(() => {
				const names = matchingNames(
					from,
					searchSelectorControls.getSearch(),
					allowUncookable,
				);

				dropdown.removeChild(ul);
				ul = document.createElement('div');
				ul.dataset.length = 0;
				names.forEach(liIntoPicker, ul);
				dropdown.appendChild(ul);
			})();

			clear.className = 'clearingredients';
			clear.appendChild(document.createTextNode('clear'));

			clear.addEventListener(
				'click',
				() => {
					if (
						picker.value === '' &&
            searchSelectorControls.getTag() === 'name'
					) {
						while (getSlot(parent.firstChild)) {
							removeSlot({ target: parent.firstChild });
						}
					} else {
						picker.value = '';
						searchSelectorControls.setSearchType(0);
						refreshPicker();
					}
				},
				false,
			);

			clear.addEventListener(
				'mouseover',
				() => {
					if (
						picker.value === '' &&
            searchSelectorControls.getTag() === 'name'
					) {
						clear.firstChild.textContent = 'clear chosen ingredients';
					}
				},
				false,
			);

			clear.addEventListener(
				'mouseout',
				() => {
					if (clear.firstChild.textContent !== 'clear') {
						clear.firstChild.textContent = 'clear';
					}
				},
				false,
			);

			toggleText.className = 'toggleingredients enabled';

			toggleText.addEventListener(
				'click',
				() => {
					if (toggleText.classList.contains('enabled')) {
						toggleText.classList.remove('enabled');
						dropdown.classList.add('hidetext');
						toggleText.firstChild.textContent = 'Show names';
					} else {
						toggleText.classList.add('enabled');
						dropdown.classList.remove('hidetext');
						toggleText.firstChild.textContent = 'Icons only';
					}
				},
				false,
			);

			toggleText.appendChild(document.createTextNode('Icons only'));
			parent.parentNode.insertBefore(toggleText, parent);

			parent.parentNode.insertBefore(clear, parent);
			parent.parentNode.insertBefore(dropdown, parent);

			// picker.addEventListener('keydown', e => {
			// 	let find;

			// 	if (movement.indexOf(e.keyCode) !== -1) {
			// 		const current = selected;

			// 		if (e.keyCode === enter) {
			// 			if (selected === null) {
			// 				selected = ul.firstChild || null;
			// 			}

			// 			if (selected !== null) {
			// 				pickItem({target: selected});
			// 			}
			// 		} else {
			// 			if (selected === null) {
			// 				if (e.keyCode === down) {
			// 					selected = ul.childNodes[1] || ul.firstChild || null;

			// 					if (selected !== null) {
			// 						coords = (selected.offsetLeft + selected.offsetWidth / 2);
			// 						e.preventDefault();
			// 					}
			// 				}
			// 			} else {
			// 				e.preventDefault();

			// 				if (e.keyCode === left) {
			// 					if (selected.previousSibling && selected.previousSibling.offsetTop === selected.offsetTop) {
			// 						selected = selected.previousSibling;
			// 					} else {
			// 						find = findNextMatching(selected, el => {
			// 							//separate this out
			// 							return el.offsetTop !== selected.offsetTop;
			// 						});

			// 						if (find) {
			// 							selected = find.previousSibling;
			// 						} else {
			// 							selected = ul.lastChild;
			// 						}
			// 					}

			// 					if (selected !== null) {
			// 						coords = (selected.offsetLeft + selected.offsetWidth / 2);
			// 					}
			// 				} else if (e.keyCode === right) {
			// 					if (selected.nextSibling && selected.nextSibling.offsetTop === selected.offsetTop) {
			// 						selected = selected.nextSibling;
			// 					} else {
			// 						find = findPreviousMatching(selected, el => {
			// 							//separate this out
			// 							return el.offsetTop !== selected.offsetTop;
			// 						});

			// 						if (find) {
			// 							selected = find.nextSibling;
			// 						} else {
			// 							selected = ul.firstChild;
			// 						}
			// 					}

			// 					if (selected !== null) {
			// 						coords = (selected.offsetLeft + selected.offsetWidth / 2);
			// 					}
			// 				} else if (e.keyCode === up) {
			// 					find = findPreviousMatching(selected, el => {
			// 						return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
			// 					});

			// 					if (!find) {
			// 						find = findPreviousMatching(ul.lastChild, el => {
			// 							return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
			// 						});
			// 					}

			// 					if (find) {
			// 						selected = find;
			// 					} else {
			// 						selected = ul.firstChild;
			// 					}
			// 				} else if (e.keyCode === down) {
			// 					find = findNextMatching(selected, el => {
			// 						return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
			// 					});

			// 					if (!find) {
			// 						find = findNextMatching(ul.firstChild, el => {
			// 							return coords >= el.offsetLeft - 1 && coords <= el.offsetLeft + el.offsetWidth + 1;
			// 						});
			// 					}

			// 					if (find) {
			// 						selected = find;
			// 					} else {
			// 						selected = ul.lastChild;
			// 					}
			// 				}
			// 			}
			// 		}

			// 		if (selected !== current) {
			// 			if (current !== null) {
			// 				current.className = '';
			// 			}

			// 			if (selected !== null) {
			// 				selected.className = 'selected';
			// 			}
			// 		}
			// 	}
			// }, false);

			// const up = 38
			// const left = 37
			// const down = 40
			// const right = 39
			// const enter = 13;
			// const movement = [16, 17, up, right, down, left, enter];

			picker.addEventListener('keydown', _ => {
				refreshPicker();
			});
			picker.addEventListener('keyup', _ => {
				refreshPicker();
			});

			// picker.addEventListener('keyup', e => {
			// 	// let items;
			// 	// let i;
			// 	// const current = selected;
			// 	if (movement.indexOf(e.keyCode) === -1) {
			// 		refreshPicker();
			// 	} else if (selected !== null) {
			// 		e.preventDefault();
			// 	}
			// }, false);

			picker.addEventListener(
				'focus',
				() => {
					if (!displaying) {
						displaying = true;
					}
				},
				false,
			);

			picker.addEventListener(
				'blur',
				() => {
					if (displaying) {
						displaying = false;
					}
				},
				false,
			);

			updateRecipes();

			window.addEventListener('beforeunload', () => {
				if (!window.localStorage.foodGuideState) {
					window.localStorage.foodGuideState = '{}';
				}
				const obj = JSON.parse(window.localStorage.foodGuideState);
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
				window.localStorage.foodGuideState = JSON.stringify(obj);
			});

			modeRefreshers.push(refreshPicker);
			modeRefreshers.push(updateRecipes);
		}
	})();

	const showmode = e => {
		setMode(modes[e.target.dataset.mode].mask);
	};

	const togglemode = e => {
		setMode(modeMask ^ modes[e.target.dataset.mode].bit);
		e.preventDefault();
	};

	const modeTab = document.createElement('li');
	navbar.insertBefore(modeTab, navbar.firstChild);
	modeTab.className = 'mode';

	for (const name in modes) {
		const modeButton = document.createElement('div');

		modeButton.dataset.mode = name;
		modeButton.addEventListener('click', showmode, false);
		modeButton.addEventListener('contextmenu', togglemode, false);

		modeButton.title =
      modes[name].name + '\nleft-click to select\nright-click to toggle';
		// Other setup happens in setMode

		const img = makeImage('img/' + modes[name].img);
		img.title = name;
		modeButton.appendChild(img);

		modeTab.appendChild(modeButton);
	}

	setMode(modeMask);
})();
