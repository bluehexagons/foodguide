import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const source = await readFile(
	new URL('../build/worker/service-worker.js', import.meta.url),
	'utf8',
);
const scope = 'https://guide.example/foodguide/';
const cacheName = `foodguide:${scope}:test`;
const completeURL = scope + '__offline_complete__';

function createWorker({ assetCount = 1 } = {}) {
	const listeners = new Map();
	const stores = new Map([['unrelated-cache', new Map()]]);
	const timers = new Map();
	const state = { stalled: false, storageFails: false, beforePut: async () => {} };
	const network = [];
	const caches = {
		has: async name => stores.has(name),
		delete: async name => stores.delete(name),
		keys: async () => [...stores.keys()],
		open: async name => {
			if (state.storageFails) {
				throw new Error('Cache Storage unavailable');
			}
			if (!stores.has(name)) {
				stores.set(name, new Map());
			}
			const store = stores.get(name);
			return {
				match: async key => store.get(key)?.clone(),
				put: async (key, response) => {
					await state.beforePut(key);
					store.set(key, response.clone());
				},
				delete: async key => store.delete(key),
				keys: async () => [...store.keys()].map(url => new Request(url)),
			};
		},
	};
	const assets = Array.from({ length: assetCount }, (_, index) => ({
		path: index === 0 ? 'index.html' : `asset-${index}.js`,
		hash: createHash('sha256').update('guide').digest('hex'),
	}));
	runInNewContext(source, {
		config: { id: 'test', assets },
		self: {
			registration: { scope },
			addEventListener: (name, listener) => listeners.set(name, listener),
		},
		caches,
		crypto: webcrypto,
		URL,
		Response,
		Uint8Array,
		AbortController,
		setTimeout: callback => {
			const id = {};
			timers.set(id, callback);
			return id;
		},
		clearTimeout: id => timers.delete(id),
		fetch: (request, { signal } = {}) => {
			network.push(typeof request === 'string' ? request : request.url);
			return state.stalled
				? new Promise((_resolve, reject) =>
						signal.addEventListener('abort', () => reject(new Error('aborted')), {
							once: true,
						}),
					)
				: Promise.resolve(new Response('guide'));
		},
	});
	const install = () => {
		let result;
		listeners.get('install')({
			waitUntil: promise => {
				result = promise;
			},
		});
		return result;
	};
	const message = async type => {
		let result;
		let reply;
		listeners.get('message')({
			data: { type },
			ports: [
				{
					postMessage: value => {
						reply = value;
					},
				},
			],
			waitUntil: promise => {
				result = promise;
			},
		});
		await result;
		return reply;
	};
	const request = (url = scope, mode = 'navigate') => {
		let result;
		listeners.get('fetch')({
			request: { method: 'GET', url, mode },
			respondWith: promise => {
				result = promise;
			},
		});
		return result;
	};
	return { stores, timers, state, network, install, message, request };
}

test('a stalled offline download aborts, removes its cache, and can be retried', async () => {
	const fixture = createWorker();
	fixture.state.stalled = true;
	const install = fixture.install();
	await new Promise(setImmediate);
	assert.equal(fixture.timers.size, 1);
	const failure = assert.rejects(install, /aborted/);
	[...fixture.timers.values()][0]();
	await failure;
	assert.equal(fixture.stores.has(cacheName), false);
	assert.equal(fixture.stores.has('unrelated-cache'), true);
	assert.equal(fixture.timers.size, 0);
	fixture.state.stalled = false;
	assert.equal(await fixture.message('RESTORE'), 'READY');
	assert.equal(
		await fixture.stores
			.get(cacheName)
			.get(scope + 'index.html')
			.text(),
		'guide',
	);
	assert.equal(
		fixture.stores.get(cacheName).size,
		2,
		'The restored build includes a completion marker',
	);
});

test('a timeout during cache writes cannot activate a partially downloaded build', async () => {
	const fixture = createWorker({ assetCount: 7 });
	const previous = `foodguide:${scope}:previous`;
	fixture.stores.set(previous, new Map());
	let release;
	const gate = new Promise(resolve => {
		release = resolve;
	});
	let writersReady;
	const waiting = new Promise(resolve => {
		writersReady = resolve;
	});
	let writers = 0;
	fixture.state.beforePut = async key => {
		if (key === completeURL) {
			return;
		}
		writers++;
		if (writers === 6) {
			writersReady();
		}
		await gate;
	};
	const install = fixture.install();
	await waiting;
	const failure = assert.rejects(install, /abort|incomplete|timed out/i);
	[...fixture.timers.values()][0]();
	release();
	await failure;
	assert.equal(fixture.stores.has(cacheName), false);
	assert.equal(fixture.stores.has('unrelated-cache'), true);
	assert.equal(fixture.stores.has(previous), true, 'The previous build survives');
});

test('Cache Storage failures do not block an online navigation', async () => {
	const fixture = createWorker();
	await fixture.install();
	fixture.state.storageFails = true;
	const response = await fixture.request();
	assert.equal(await response.text(), 'guide');
	assert.equal(fixture.network.at(-1), scope);
	assert.equal(await fixture.message('STATUS'), 'MISSING');
});

test('cache hits normalize query and fragment URLs without using the network', async () => {
	const fixture = createWorker();
	await fixture.install();
	fixture.network.length = 0;
	assert.equal(await (await fixture.request(scope + '?installed=1#about')).text(), 'guide');
	assert.deepEqual(fixture.network, []);
	assert.equal(fixture.request('https://elsewhere.example/'), undefined);
	assert.equal(fixture.request(scope + 'not-an-asset'), undefined);
});

test('a missing cached member never mixes a newer asset into a complete build', async () => {
	const fixture = createWorker({ assetCount: 2 });
	await fixture.install();
	fixture.network.length = 0;
	fixture.stores.get(cacheName).delete(scope + 'asset-1.js');
	assert.equal((await fixture.request(scope + 'asset-1.js', 'cors')).type, 'error');
	assert.deepEqual(fixture.network, []);
	assert.equal(await fixture.message('STATUS'), 'MISSING');
	assert.equal(await (await fixture.request()).text(), 'guide');
	assert.equal(fixture.stores.get(cacheName).has(completeURL), false);
	assert.deepEqual(fixture.network, [scope]);
});

test('simultaneous restore requests share one verified download', async () => {
	const fixture = createWorker();
	let release;
	const gate = new Promise(resolve => {
		release = resolve;
	});
	let writerReady;
	const waiting = new Promise(resolve => {
		writerReady = resolve;
	});
	fixture.state.beforePut = async key => {
		if (key !== completeURL) {
			writerReady();
			await gate;
		}
	};
	const first = fixture.message('RESTORE');
	const second = fixture.message('RESTORE');
	await waiting;
	release();
	assert.deepEqual(await Promise.all([first, second]), ['READY', 'READY']);
	assert.deepEqual(fixture.network, [scope + 'index.html']);
});
