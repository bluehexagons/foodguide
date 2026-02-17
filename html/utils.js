import { perish_preserved } from './constants.js';

/**
 * Creates icon elements using a pre-generated sprite sheet for efficient
 * rendering. Falls back to individual image files if the sprite sheet
 * manifest is not available.
 *
 * Returns <span> elements with the class "icon" styled via CSS
 * background-image and background-position from the sprite sheet.
 * Uses percentage-based background-size and background-position so that
 * icons scale correctly at any display size (20px, 32px, 40px, 64px, etc.)
 *
 * @param {string} url - Image URL (e.g. "img/carrot.png")
 * @returns {HTMLSpanElement} Icon element
 */
export const makeImage = (() => {
	/** @type {null | {cellSize: number, columns: number, rows: number, sheets: string[], images: Record<string, {sheet: number, col: number, row: number}>}} */
	let manifest = null;

	/** @type {boolean} */
	let manifestLoaded = false;

	/** @type {Array<{el: HTMLSpanElement, url: string}>} */
	const pending = [];

	/**
	 * Applies sprite sheet background to an icon element.
	 * Uses percentage-based positioning so the sprite scales with the
	 * element's CSS dimensions regardless of context.
	 * @param {HTMLSpanElement} el
	 * @param {string} url
	 */
	const applySprite = (el, url) => {
		const entry = manifest && manifest.images[url];
		if (entry) {
			const cols = manifest.columns;
			const rows = manifest.rows;
			el.style.backgroundImage = `url('${manifest.sheets[entry.sheet]}')`;
			// Scale sprite so each cell fills the element exactly
			el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
			// Position using percentage formula: col/(cols-1)*100%, row/(rows-1)*100%
			const xPct = cols > 1 ? (entry.col / (cols - 1)) * 100 : 0;
			const yPct = rows > 1 ? (entry.row / (rows - 1)) * 100 : 0;
			el.style.backgroundPosition = `${xPct}% ${yPct}%`;
		} else {
			// Image not in sprite sheet; fall back to individual file
			el.style.backgroundImage = `url('${url}')`;
			el.style.backgroundSize = 'contain';
		}
	};

	// Load sprite manifest
	if (typeof fetch !== 'undefined') {
		fetch('img/sprites/sprites.json')
			.then(r => {
				if (!r.ok) {
					throw new Error(`${r.status}`);
				}
				return r.json();
			})
			.then(data => {
				manifest = data;
				manifestLoaded = true;
				// Apply sprites to any elements created before manifest loaded
				for (const item of pending) {
					applySprite(item.el, item.url);
				}
				pending.length = 0;
			})
			.catch(() => {
				manifestLoaded = true;
				// No sprite sheet available; apply individual image fallbacks
				for (const item of pending) {
					applySprite(item.el, item.url);
				}
				pending.length = 0;
			});
	}

	/**
	 * Re-applies sprite background to an icon element (used when cloning nodes)
	 * @param {HTMLSpanElement} el - Icon element
	 * @param {string} url - Image URL
	 */
	const queueIcon = (el, url) => {
		if (manifestLoaded) {
			applySprite(el, url);
		} else {
			pending.push({ el, url });
		}
	};

	/**
	 * Main icon creation function
	 * @param {string} url - Image URL (e.g. "img/carrot.png")
	 * @returns {HTMLSpanElement} Icon element
	 */
	const makeImage = url => {
		const el = document.createElement('span');
		el.className = 'icon';
		el.dataset.src = url;
		el.setAttribute('role', 'img');

		// Sync aria-label whenever title is set so screen readers can announce the icon.
		Object.defineProperty(el, 'title', {
			get() {
				return this.getAttribute('title') || '';
			},
			set(v) {
				this.setAttribute('title', v);
				this.setAttribute('aria-label', v);
			},
			configurable: true,
		});

		if (manifestLoaded) {
			applySprite(el, url);
		} else {
			pending.push({ el, url });
		}

		return el;
	};

	/**
	 * Re-applies sprite to cloned icon elements
	 * @param {HTMLSpanElement} el - Icon element
	 * @param {string} url - Image URL
	 */
	makeImage.queue = queueIcon;

	return makeImage;
})();

/**
 * Parses text with linkable content syntax into interactive elements
 * @param {string} str - Text with link syntax [id|text|classes]
 * @returns {DocumentFragment|string} Parsed content or original string
 */
export const makeLinkable = (() => {
	const linkSearch = /\[([^|]*)\|([^|\]]*)\|?([^|\]]*)\]/;
	const leftSearch = /([^|]\]\[[^|]+\|[^|\]]+)\|?([^|\](?:left)]*)(?=\])/g;
	const rightSearch = /(\[[^|]+\|[^|\]]+)\|?([^|\]]*)(?=\]\[)(?!\]\[\|)/g;
	const addLeftClass = (_a, b, c) => {
		return `${b}|${c.length === 0 ? 'left' : `${c} left`}`;
	};
	const addRightClass = (_a, b, c) => {
		return `${b}|${c.length === 0 ? 'right' : `${c} right`}`;
	};
	const titleCase = /_(\w)/g;
	const toTitleCase = (_a, b) => {
		return ` ${b.toUpperCase()}`;
	};

	return str => {
		const processed =
			str &&
			str
				.replace(leftSearch, addLeftClass)
				.replace(leftSearch, addLeftClass)
				.replace(rightSearch, addRightClass);
		const results = processed && processed.split(linkSearch);

		if (!results || results.length === 1) {
			return processed;
		} else if (typeof document === 'undefined') {
			return processed;
		} else {
			const fragment = document.createDocumentFragment();
			let row = document.createElement('div');
			row.className = 'cellRow';
			row.appendChild(document.createTextNode(results[0]));

			for (let i = 1; i < results.length; i += 4) {
				if (results[i] === '' && results[i + 1] === '') {
					fragment.appendChild(row);
					row = document.createElement('div');
					row.className = 'cellRow';
				} else {
					const span = document.createElement('span');

					span.classList.add('link');
					if (results[i + 2] !== '') {
						span.classList.add(...results[i + 2].split(' '));
					}
					span.dataset.link = results[i];

					if (results[i + 1] && results[i + 1].indexOf('img/') === 0) {
						span.appendChild(document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')));
						const url = results[i + 1].split(' ')[0];
						const image = makeImage(url);

						image.title = (
							url.substr(4, 1).toUpperCase() + url.substr(5).replace(titleCase, toTitleCase)
						).split('.')[0];
						span.appendChild(image);
					} else {
						span.appendChild(document.createTextNode(results[i + 1] ? results[i + 1] : results[i]));
					}

					row.appendChild(span);
				}

				row.appendChild(document.createTextNode(results[i + 3]));
			}

			fragment.appendChild(row);

			return fragment;
		}
	};
})();

export const stats = ['hunger', 'health', 'sanity'];
export const isStat = {
	hunger: true,
	health: true,
	sanity: true,
};
export const isBestStat = {
	bestHunger: true,
	bestHealth: true,
	bestSanity: true,
};

/**
 * Accumulates ingredient properties into names and tags objects.
 *
 * For each non-null item, counts its id in `names` and sums numeric
 * properties into `tags` (applying stat multipliers based on preparation
 * type). Perish values use the minimum across all items.
 *
 * @param {Array} items - Array of ingredient objects (may contain nulls)
 * @param {Record<string, number>} names - Name count accumulator (mutated)
 * @param {Record<string, number>} tags - Tag value accumulator (mutated)
 * @param {Record<string, number>} statMultipliers - Multipliers keyed by preparation type
 */
export const accumulateIngredients = (items, names, tags, statMultipliers) => {
	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if (item !== null) {
			names[item.id] = 1 + (names[item.id] || 0);

			for (const k in item) {
				if (Object.prototype.hasOwnProperty.call(item, k)) {
					if (k !== 'perish' && !isNaN(item[k])) {
						let val = item[k];

						if (isStat[k]) {
							val *= statMultipliers[item.preparationType] ?? 1;
						} else if (isBestStat[k]) {
							val *= statMultipliers[item[`${k}Type`]] ?? 1;
						}

						tags[k] = val + (tags[k] || 0);
					} else if (k === 'perish') {
						tags[k] = Math.min(tags[k] || perish_preserved, item[k]);
					}
				}
			}
		}
	}
};

/**
 * Simple pluralization helper
 * @param {string} str - Base string
 * @param {number} n - Count
 * @param {string} [suffix] - Custom plural suffix
 * @returns {string} Pluralized string
 */
export const pl = (str, n, suffix) => {
	if (n === 1) {
		return str;
	}
	if (suffix) {
		return `${str}${suffix}`;
	}
	if (str.endsWith('y') && !/[aeiou]y$/.test(str)) {
		return `${str.slice(0, -1)}ies`;
	}
	return `${str}s`;
};

/**
 * Creates DOM element with optional text and class
 * @param {string} tagName - HTML tag name
 * @param {string} [textContent] - Optional text content
 * @param {string} [className] - Optional CSS class
 * @returns {HTMLElement} Created element
 */
export const makeElement = (tagName, textContent, className) => {
	const el = document.createElement(tagName);

	if (textContent) {
		el.appendChild(document.createTextNode(textContent));
	}

	if (className) {
		el.className = className;
	}

	return el;
};
