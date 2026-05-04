import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const setupDom = () => {
	const listeners = new Map();
	const htmlAttrs = new Map();
	const docAttrs = new Map();
	class FakeElement {}
	class FakeDocumentFragment {}
	const getNodeText = node => {
		if (!node) return '';
		if (typeof node.textContent === 'string' && (!node.childNodes || node.childNodes.length === 0)) {
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
			if (!listeners.has(type)) listeners.set(type, []);
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
		assert.equal(strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'Gives 90 seconds of light'), 'LIGHT 90');
		assert.equal(strings.resolveNote(undefined, undefined, 'Gives 90 seconds of light'), 'RAW LIGHT 90');
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
		assert.equal(strings.t('noteProvidesHeatFor', { heat: -40, duration: strings.formatDuration('sec', 5) }), 'HEAT<-40|SEC<5|secs>>');
		assert.equal(strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'ignored'), 'LIGHT<90>');
		assert.equal(strings.resolveNote(undefined, undefined, 'Legacy note'), 'LEGACYX');
	});

	it('registered locale dictionaries expose translated food labels and notes', async () => {
		const strings = await import('../html/strings.js');
		await import('../html/locales/zh.js');

		strings.setLocale('zh');
		assert.equal(strings.tagLabel('fruit'), '水果');
		assert.equal(strings.t('foodInfoRecipes'), '配方');
		assert.equal(strings.resolveNote('noteLightSeconds', { seconds: 90 }, 'Gives 90 seconds of light'), '提供90秒照明');
		assert.equal(strings.resolveNote('notePoisonous'), '有毒');

		strings.setLocale('en');
	});
});
