import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const setupDom = () => {
	const listeners = new Map();
	const htmlAttrs = new Map();
	const docAttrs = new Map();
	class FakeElement {}
	class FakeDocumentFragment {}
	const getNodeText = node => {
		if (!node) {
			return '';
		}
		if (
			typeof node.textContent === 'string' &&
			(!node.childNodes || node.childNodes.length === 0)
		) {
			return node.textContent;
		}
		return (node.childNodes || []).map(getNodeText).join('');
	};
	const makeNode = tagName => {
		const attrs = new Map();
		const base = tagName === '#fragment' ? new FakeDocumentFragment() : new FakeElement();
		const node = Object.assign(base, {
			tagName: String(tagName || '').toUpperCase(),
			nodeType: tagName === '#fragment' ? 11 : tagName === '#text' ? 3 : 1,
			children: [],
			childNodes: [],
			dataset: {},
			className: '',
			style: {},
			textContent: '',
			appendChild(child) {
				this.children.push(child);
				this.childNodes.push(child);
				this.textContent += getNodeText(child);
				return child;
			},
			setAttribute(name, value) {
				attrs.set(name, String(value));
			},
			getAttribute(name) {
				return attrs.get(name) || null;
			},
			querySelectorAll() {
				return [];
			},
			cloneNode() {
				const clone = makeNode(tagName);
				clone.className = this.className;
				clone.textContent = this.textContent;
				clone.dataset = { ...this.dataset };
				for (const child of this.childNodes) {
					clone.appendChild(child.cloneNode ? child.cloneNode(true) : child);
				}
				return clone;
			},
			classList: {
				add() {},
				contains() {
					return false;
				},
			},
		});
		return node;
	};
	const html = {
		setAttribute(name, value) {
			htmlAttrs.set(name, value);
		},
		getAttribute(name) {
			return htmlAttrs.get(name) || null;
		},
	};
	const document = {
		documentElement: html,
		addEventListener(type, handler) {
			if (!listeners.has(type)) {
				listeners.set(type, []);
			}
			listeners.get(type).push(handler);
		},
		dispatchEvent(event) {
			for (const handler of listeners.get(event.type) || []) {
				handler(event);
			}
		},
		querySelectorAll() {
			return [];
		},
		setAttribute(name, value) {
			docAttrs.set(name, value);
		},
		getAttribute(name) {
			return docAttrs.get(name) || null;
		},
		createElement(tagName) {
			return makeNode(tagName);
		},
		createTextNode(text) {
			const node = makeNode('#text');
			node.textContent = String(text);
			return node;
		},
		createDocumentFragment() {
			return makeNode('#fragment');
		},
	};
	globalThis.document = document;
	globalThis.DocumentFragment = FakeDocumentFragment;
	globalThis.Element = FakeElement;
	globalThis.CustomEvent = class {
		constructor(type, init = {}) {
			this.type = type;
			this.detail = init.detail;
		}
	};
	const store = new Map();
	globalThis.localStorage = {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(key, String(value));
		},
	};
	return { document, html };
};

describe('strings locale behavior', () => {
	beforeEach(() => {
		delete globalThis.document;
		delete globalThis.Element;
		delete globalThis.CustomEvent;
		delete globalThis.localStorage;
	});

	it('bundled locales preserve interpolation parameters and dynamic HTML hooks', async () => {
		const { strings } = await import('../html/strings.js');
		const locales = await Promise.all([
			import('../html/locales/es.js'),
			import('../html/locales/zh.js'),
			import('../html/locales/ru.js'),
			import('../html/locales/pt-BR.js'),
		]);
		const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
		const htmlIds = text =>
			[...text.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]).sort();
		for (const [index, { dict }] of locales.entries()) {
			const compare = (key, english, translated) => {
				const context = `${['es', 'zh', 'ru', 'pt-BR'][index]}: ${key}`;
				assert.ok(translated?.trim(), `Empty translation: ${context}`);
				assert.deepEqual(
					placeholders(translated),
					placeholders(english),
					`Parameters: ${context}`,
				);
				assert.deepEqual(htmlIds(translated), htmlIds(english), `HTML hooks: ${context}`);
			};
			for (const [key, english] of Object.entries(strings)) {
				if (typeof english === 'string') {
					compare(key, english, dict[key]);
				} else {
					for (const [nestedKey, value] of Object.entries(english)) {
						compare(`${key}.${nestedKey}`, value, dict[key][nestedKey]);
					}
				}
			}
		}
	});

	it('applies translations to the root element itself', async () => {
		setupDom();
		const { applyTranslations } = await import(`../html/strings.js?root=${Date.now()}`);

		class FakeElement extends globalThis.Element {
			constructor() {
				super();
				this.attrs = new Map([['data-i18n', 'tableName']]);
				this.textContent = '';
			}
			hasAttribute(name) {
				return this.attrs.has(name);
			}
			getAttribute(name) {
				return this.attrs.get(name) || null;
			}
			querySelectorAll() {
				return [];
			}
			get attributes() {
				return Array.from(this.attrs.entries()).map(([name, value]) => ({ name, value }));
			}
		}

		const root = new FakeElement();
		applyTranslations(root);
		assert.equal(root.textContent, 'Name');
	});

	it('icon titles use canonical names even when a translation is unchanged', async () => {
		setupDom();
		const { setLocale } = await import('../html/strings.js');
		const { makeLinkable } = await import('../html/utils.js');
		await import('../html/locales/es.js');
		await import('../html/locales/zh.js');
		const title = text => makeLinkable(text).children[0].children[1].children[1].title;
		try {
			for (const locale of ['en', 'es', 'zh']) {
				setLocale(locale);
				assert.equal(
					title('[tag:warlydst|img/warly.png]'),
					locale === 'zh' ? '沃利（联机版）' : 'Warly (DST)',
				);
			}
			setLocale('en');
			assert.equal(title('[*Raw Fish|img/fish_meat.png]'), 'Raw Fish');
			assert.equal(title("[recipe:Chef's Dish|img/other.png]"), "Chef's Dish");
			assert.equal(title('[unknown|img/rare_food.png]'), 'Rare Food');
		} finally {
			setLocale('en');
		}
	});

	it('updates document lang and dispatches localechange', async () => {
		const { document, html } = setupDom();
		const strings = await import('../html/strings.js');
		await import('../html/locales/es.js');

		let changedTo = null;
		document.addEventListener('foodguide:localechange', event => {
			changedTo = event.detail.code;
		});

		strings.setLocale('es');

		assert.equal(strings.t('tableName'), 'Nombre');
		assert.equal(html.getAttribute('lang'), 'es');
		assert.equal(changedTo, 'es');
	});

	it('falls back to English for unknown locale codes', async () => {
		const { html } = setupDom();
		const strings = await import(`../html/strings.js?fallback=${Date.now()}`);

		strings.registerLocale('x-test-fallback', 'Test Fallback', {
			tableName: 'TEST NAME',
		});
		strings.setLocale('x-test-fallback');
		assert.equal(strings.t('tableName'), 'TEST NAME');

		for (const code of ['missing-code', 'constructor', 'toString', '__proto__']) {
			strings.setLocale(code);
			assert.equal(strings.getLocale(), 'en');
			assert.equal(strings.t('tableName'), 'Name');
			assert.equal(html.getAttribute('lang'), 'en');
			assert.equal(strings.localeName(code), code);
		}
	});

	it('package entrypoint registers bundled locales', async () => {
		const data = await import(`../html/foodguide-data.js?locales=${Date.now()}`);

		for (const code of ['es', 'zh', 'ru', 'pt-BR']) {
			assert.ok(data.listLocales().includes(code));
		}
		data.setLocale('es');
		assert.equal(data.t('tableName'), 'Nombre');
		data.setLocale('en');
	});

	it('browser locale detection matches regional codes without losing a saved choice', async t => {
		const strings = await import('../html/strings.js');
		await import('../html/locales/index.js');
		const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
		t.after(() => {
			if (original) {
				Object.defineProperty(globalThis, 'navigator', original);
			} else {
				delete globalThis.navigator;
			}
			strings.setLocale('en');
		});
		for (const [language, expected] of [
			['pt-BR', 'pt-BR'],
			['pt-br', 'pt-BR'],
			['ru-RU', 'ru'],
			['es-MX', 'es'],
			['unknown', 'en'],
		]) {
			const { html } = setupDom();
			Object.defineProperty(globalThis, 'navigator', {
				value: { language },
				configurable: true,
			});
			strings.initLocale();
			assert.equal(strings.getLocale(), expected, language);
			assert.equal(html.getAttribute('lang'), expected, language);
		}
		setupDom();
		localStorage.setItem('foodGuideLocale', 'pt-BR');
		strings.initLocale();
		assert.equal(strings.getLocale(), 'pt-BR');
	});

	it('Russian and Brazilian Portuguese duration labels handle singular, plural, and fractions', async () => {
		const strings = await import('../html/strings.js');
		await import('../html/locales/index.js');
		try {
			strings.setLocale('ru');
			for (const [count, unit] of [
				[0, 'дней'],
				[1, 'день'],
				[2, 'дня'],
				[5, 'дней'],
				[11, 'дней'],
				[21, 'день'],
				[22, 'дня'],
				[25, 'дней'],
				[1.5, 'дня'],
			]) {
				assert.equal(strings.formatDuration('day', count), `${count} ${unit}`);
			}
			assert.equal(strings.formatDuration('sec', 90), '90 сек.');
			strings.setLocale('pt-BR');
			assert.equal(strings.formatDuration('day', 1), '1 dia');
			assert.equal(strings.formatDuration('day', 2), '2 dias');
			assert.equal(strings.formatDuration('day', 1.5), '1.5 dias');
			assert.equal(strings.formatDuration('sec', 90), '90 s');
		} finally {
			strings.setLocale('en');
		}
	});

	it('resolveNote prefers stable keyed notes over raw-note wording', async () => {
		setupDom();
		const strings = await import(`../html/strings.js?notes-keyed=${Date.now()}`);
		strings.registerLocale('x-test-notes', 'Test Notes', {
			noteLightSeconds: 'LIGHT {seconds}',
			notes: {
				'Gives 90 seconds of light': 'RAW LIGHT 90',
			},
		});

		strings.setLocale('x-test-notes');
		assert.equal(
			strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'Gives 90 seconds of light'),
			'LIGHT 90',
		);
		assert.equal(
			strings.resolveNote(undefined, undefined, 'Gives 90 seconds of light'),
			'RAW LIGHT 90',
		);
		assert.equal(strings.resolveNote(undefined, undefined, 'unknown note'), 'unknown note');
	});

	it('tagLabel resolves through active locale, default, and fallback', async () => {
		setupDom();
		const strings = await import('../html/strings.js');
		await import('../html/locales/es.js');
		await import('../html/locales/zh.js');

		strings.setLocale('en');
		assert.equal(strings.tagLabel('meat'), 'meat');
		assert.equal(strings.tagLabel('veggie'), 'vegetable');
		assert.equal(strings.tagLabel('monstermeat'), 'monster meat');

		strings.setLocale('es');
		assert.equal(strings.tagLabel('meat'), 'carne');
		assert.equal(strings.tagLabel('monstermeat'), 'carne de monstruo');

		strings.setLocale('zh');
		assert.equal(strings.tagLabel('meat'), '肉');
		assert.equal(strings.tagLabel('honeyed'), '蜂蜜调味');

		// Unknown key falls back to English default if present, else fallback, else key
		strings.setLocale('zh');
		assert.equal(
			strings.tagLabel('not-a-real-tag', 'fallback text'),
			'fallback text',
			'fallback used when no entry exists',
		);
		assert.equal(
			strings.tagLabel('not-a-real-tag'),
			'not-a-real-tag',
			'raw key returned when no fallback supplied',
		);

		// Restore for other tests
		strings.setLocale('en');
	});

	it('locale helpers can be customized without relying on translation wording', async () => {
		setupDom();
		const strings = await import(`../html/strings.js?helper-custom=${Date.now()}`);
		strings.registerLocale('x-test-helpers', 'Test Helpers', {
			tags: { fruit: 'FRUITX' },
			durationSeconds: 'SEC<{count}|{unit}>',
			noteProvidesHeatFor: 'HEAT<{heat}|{duration}>',
			noteLightSeconds: 'LIGHT<{seconds}>',
			notes: { 'Legacy note': 'LEGACYX' },
		});

		strings.setLocale('x-test-helpers');
		assert.equal(strings.tagLabel('fruit'), 'FRUITX');
		assert.equal(strings.formatDuration('sec', 5), 'SEC<5|secs>');
		assert.equal(
			strings.t('noteProvidesHeatFor', {
				heat: -40,
				duration: strings.formatDuration('sec', 5),
			}),
			'HEAT<-40|SEC<5|secs>>',
		);
		assert.equal(
			strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'ignored'),
			'LIGHT<90>',
		);
		assert.equal(strings.resolveNote(undefined, undefined, 'Legacy note'), 'LEGACYX');
	});

	it('registered locale dictionaries expose translated food labels and notes', async () => {
		const strings = await import('../html/strings.js');
		await import('../html/locales/es.js');
		await import('../html/locales/zh.js');

		strings.setLocale('es');
		assert.equal(strings.t('simulatorSummaryPotential'), 'Potencial');

		strings.setLocale('zh');
		assert.equal(strings.tagLabel('fruit'), '水果');
		assert.equal(strings.t('simulatorSummaryTotal'), '总计');
		assert.equal(strings.t('foodInfoRecipes'), '配方');
		assert.equal(
			strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'Gives 90 seconds of light'),
			'提供90秒照明',
		);
		assert.equal(strings.resolveNote('notePoisonous'), '有毒');

		strings.setLocale('en');
	});
});
