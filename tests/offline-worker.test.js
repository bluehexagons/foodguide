import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';

// Exercise a real worker download with a controllable stalled network request.
test('a stalled offline download aborts, removes its cache, and can be retried', async () => {
	const listeners = new Map();
	const stores = new Map([['unrelated-cache', new Map()]]);
	const timers = new Map();
	const scope = 'https://guide.example/foodguide/';
	const cacheName = `foodguide:${scope}:test`;
	let stalled = true;
	const caches = {
		has: async name => stores.has(name),
		delete: async name => stores.delete(name),
		keys: async () => [...stores.keys()],
		open: async name => {
			if (!stores.has(name)) {
				stores.set(name, new Map());
			}
			const store = stores.get(name);
			return {
				match: async key => store.get(key)?.clone(),
				put: async (key, response) => {
					store.set(key, response.clone());
				},
				delete: async key => store.delete(key),
				keys: async () => [...store.keys()].map(url => new Request(url)),
			};
		},
	};
	const worker = {
		registration: { scope },
		addEventListener: (name, listener) => listeners.set(name, listener),
	};
	runInNewContext(
		await readFile(new URL('../build/worker/service-worker.js', import.meta.url), 'utf8'),
		{
			config: {
				id: 'test',
				assets: [
					{
						path: 'index.html',
						hash: createHash('sha256').update('guide').digest('hex'),
					},
				],
			},
			self: worker,
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
			fetch: (_url, { signal }) =>
				stalled
					? new Promise((_resolve, reject) =>
							signal.addEventListener('abort', () => reject(new Error('aborted')), {
								once: true,
							}),
						)
					: Promise.resolve(new Response('guide')),
		},
	);
	let install;
	listeners.get('install')({
		waitUntil: promise => {
			install = promise;
		},
	});
	await new Promise(setImmediate);
	assert.equal(timers.size, 1);
	const failure = assert.rejects(install, /aborted/);
	[...timers.values()][0]();
	await failure;
	assert.equal(stores.has(cacheName), false);
	assert.equal(stores.has('unrelated-cache'), true);
	assert.equal(timers.size, 0);
	stalled = false;
	let restore;
	let reply;
	listeners.get('message')({
		data: { type: 'RESTORE' },
		ports: [
			{
				postMessage: value => {
					reply = value;
				},
			},
		],
		waitUntil: promise => {
			restore = promise;
		},
	});
	await restore;
	assert.equal(reply, 'READY');
	assert.equal(
		await (
			await caches.open(cacheName)
		)
			.match(scope + 'index.html')
			.then(response => response.text()),
		'guide',
	);
	assert.equal(stores.get(cacheName).size, 2, 'The restored build includes a completion marker');
});
