import type {
	Food,
	GuideItem,
	IngredientNames,
	IngredientTags,
	SpriteManifest,
	StatMultipliers,
	Stat,
	BestStat,
} from './models.js';
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
	/** @type {null | {cellSize: number, columns: number, rows: number[], sheets: string[], images: Record<string, {sheet: number, col: number, row: number}>}} */
	let manifest: SpriteManifest | null = null;

	/** @type {boolean} */
	let manifestLoaded = false;

	/** @type {Array<{el: HTMLSpanElement, url: string}>} */
	const pending: { el: HTMLSpanElement; url: string }[] = [];

	/**
	 * Applies sprite sheet background to an icon element.
	 * Uses percentage-based positioning so the sprite scales with the
	 * element's CSS dimensions regardless of context.
	 * @param {HTMLSpanElement} el
	 * @param {string} url
	 */
	const applySprite = (el: HTMLSpanElement, url: string) => {
		const entry = manifest && manifest.images[url];
		if (entry && manifest) {
			const cols = manifest.columns;
			const rows = manifest.rows[entry.sheet];
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

	// Load sprite manifest (browser-only; skipped when imported in Node).
	if (typeof document !== 'undefined' && typeof fetch !== 'undefined') {
		fetch('img/sprites/sprites.json')
			.then(r => {
				if (!r.ok) {
					throw new Error(`${r.status}`);
				}
				return r.json();
			})
			.then(data => {
				manifest = parseSpriteManifest(data);
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
	const queueIcon = (el: HTMLSpanElement, url: string) => {
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
	const makeImage = (url: string) => {
		const el = document.createElement('span');
		el.className = 'icon';
		el.dataset.src = url;
		el.setAttribute('role', 'img');

		// Sync aria-label whenever title is set so screen readers can announce the icon.
		Object.defineProperty(el, 'title', {
			get(this: HTMLSpanElement) {
				return this.getAttribute('title') || '';
			},
			set(this: HTMLSpanElement, v: string) {
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
	const addLeftClass = (_a: string, b: string, c: string) => {
		return `${b}|${c.length === 0 ? 'left' : `${c} left`}`;
	};
	const addRightClass = (_a: string, b: string, c: string) => {
		return `${b}|${c.length === 0 ? 'right' : `${c} right`}`;
	};
	const titleCase = /_(\w)/g;
	const toTitleCase = (_a: string, b: string) => {
		return ` ${b.toUpperCase()}`;
	};

	return (str: string) => {
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
						span.appendChild(
							document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')),
						);
						const url = results[i + 1].split(' ')[0];
						const image = makeImage(url);

						image.title = (
							url.substr(4, 1).toUpperCase() +
							url.substr(5).replace(titleCase, toTitleCase)
						).split('.')[0];
						span.appendChild(image);
					} else {
						span.appendChild(
							document.createTextNode(results[i + 1] ? results[i + 1] : results[i]),
						);
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

export const stats: Stat[] = ['hunger', 'health', 'sanity'];
export const isStat: Record<string, boolean> = {
	hunger: true,
	health: true,
	sanity: true,
};
export const isBestStat: Record<string, boolean> = {
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
export const numericTags = (item: object): IngredientTags => {
	const tags: IngredientTags = {};
	for (const [key, value] of Object.entries(item)) {
		if (typeof value === 'number' || typeof value === 'boolean') tags[key] = Number(value);
	}
	return tags;
};
export const accumulateIngredients = (
	items: (GuideItem | null)[],
	names: IngredientNames,
	tags: IngredientTags,
	statMultipliers: StatMultipliers,
) => {
	for (const item of items) {
		if (item === null) continue;
		names[item.id] = 1 + (names[item.id] || 0);
		for (const [key, value] of Object.entries(numericTags(item))) {
			if (key === 'perish') {
				tags[key] = Math.min(tags[key] || perish_preserved, value);
			} else {
				let val = value;
				if (isStat[key]) val *= statMultipliers[item.preparationType] ?? 1;
				else if (isBestStat[key] && 'bestHealth' in item)
					val *= statMultipliers[item[`${key as BestStat}Type`]] ?? 1;
				tags[key] = val + (tags[key] || 0);
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
export const pl = (str: string, n: number, suffix?: string) => {
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
export const makeElement = <K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	textContent?: string,
	className?: string,
) => {
	const el = document.createElement(tagName);

	if (textContent) {
		el.appendChild(document.createTextNode(textContent));
	}

	if (className) {
		el.className = className;
	}

	return el;
};

/** Validate JSON at the fetch boundary; malformed manifests use individual icons. */
export function parseSpriteManifest(value: unknown): SpriteManifest {
	if (!value || typeof value !== 'object') throw new Error('Invalid sprite manifest');
	const m = value as Record<string, unknown>;
	const positive = (n: unknown): n is number =>
		typeof n === 'number' && Number.isInteger(n) && n > 0;
	if (
		!positive(m.cellSize) ||
		!positive(m.columns) ||
		!Array.isArray(m.rows) ||
		!m.rows.every(positive) ||
		!Array.isArray(m.sheets) ||
		m.sheets.length !== m.rows.length ||
		!m.sheets.every(s => typeof s === 'string' && /^img\/sprites\/sheet-\d+\.png$/.test(s)) ||
		!m.images ||
		typeof m.images !== 'object' ||
		Array.isArray(m.images)
	)
		throw new Error('Invalid sprite manifest');
	const images: SpriteManifest['images'] = {};
	for (const [url, entry] of Object.entries(m.images)) {
		if (!entry || typeof entry !== 'object') throw new Error('Invalid sprite entry');
		const e = entry as Record<string, unknown>;
		const index = (n: unknown): n is number =>
			typeof n === 'number' && Number.isInteger(n) && n >= 0;
		if (
			!index(e.sheet) ||
			e.sheet >= m.rows.length ||
			!index(e.col) ||
			e.col >= m.columns ||
			!index(e.row) ||
			e.row >= m.rows[e.sheet]
		)
			throw new Error('Invalid sprite entry');
		images[url] = { sheet: e.sheet, col: e.col, row: e.row };
	}
	return { cellSize: m.cellSize, columns: m.columns, rows: m.rows, sheets: m.sheets, images };
}
