import { perish_preserved } from './constants.js';

/**
 * Creates optimized images with caching and lazy loading
 * @param {string} url - Image URL to load
 * @param {number} [d] - Optional dimension parameter
 * @returns {HTMLImageElement} Cached image element
 */
export const makeImage = (() => {
	let canvas;
	let ctx;
	const cache = new Map();
	const queue = [];
	let activeLoads = 0;
	const MAX_CONCURRENT_LOADS = 6;

	const ensureCanvas = () => {
		if (!canvas) {
			canvas = document.createElement('canvas');
			ctx = canvas.getContext('2d');
			canvas.width = 64;
			canvas.height = 64;
		}
	};

	const finishWaiters = (url, src) => {
		const entry = cache.get(url);
		if (!entry || !entry.waiters) {
			return;
		}
		entry.waiters.forEach(img => {
			if (img.dataset.pending === url) {
				delete img.dataset.pending;
				img.src = src;
			}
		});
		delete entry.waiters;
	};

	const renderToCache = async url => {
		ensureCanvas();
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Image request failed: ${response.status}`);
			}
			const blob = await response.blob();
			const bitmap = await createImageBitmap(blob);

			ctx.clearRect(0, 0, 64, 64);
			ctx.drawImage(bitmap, 0, 0, 64, 64);
			if (typeof bitmap.close === 'function') {
				bitmap.close();
			}

			const pngBlob = await new Promise((resolve, reject) => {
				canvas.toBlob(
					result => (result ? resolve(result) : reject(new Error('Blob failed'))),
					'image/png',
				);
			});
			const cachedUrl = URL.createObjectURL(pngBlob);
			const existing = cache.get(url);
			cache.set(url, { status: 'ready', src: cachedUrl, waiters: existing && existing.waiters });
			finishWaiters(url, cachedUrl);
		} catch {
			const existing = cache.get(url);
			cache.set(url, { status: 'ready', src: url, waiters: existing && existing.waiters });
			finishWaiters(url, url);
		}
	};

	const scheduleLoads = () => {
		while (activeLoads < MAX_CONCURRENT_LOADS && queue.length > 0) {
			const url = queue.shift();
			const entry = cache.get(url);
			if (!entry || entry.status !== 'loading') {
				continue;
			}
			activeLoads += 1;
			renderToCache(url)
				.catch(() => {})
				.finally(() => {
					activeLoads -= 1;
					scheduleLoads();
				});
		}
	};

	/**
	 * Queues image for loading when cached
	 * @param {HTMLImageElement} img - Image element
	 * @param {string} url - Image URL
	 */
	const queueImage = (img, url) => {
		img.dataset.pending = url;
		const existing = cache.get(url);
		if (existing && existing.status === 'ready') {
			delete img.dataset.pending;
			img.src = existing.src;
			return;
		}
		if (!existing) {
			cache.set(url, { status: 'loading', waiters: [img] });
			queue.push(url);
			scheduleLoads();
			return;
		}
		existing.waiters.push(img);
	};

	/**
	 * Main image creation function
	 * @param {string} url - Image URL
	 * @param {number} [d] - Optional dimension
	 * @returns {HTMLImageElement} Image element
	 */
	const makeImage = (url, d) => {
		const img = new Image(d);
		img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

		img.width = 64;
		img.height = 64;

		const cached = cache.get(url);
		if (cached && cached.status === 'ready') {
			img.src = cached.src;
		} else {
			queueImage(img, url);
		}
		return img;
	};

	makeImage.queue = queueImage;

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
