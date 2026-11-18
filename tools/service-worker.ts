/// <reference lib="webworker" />
declare const config: { id: string; assets: { path: string; hash: string }[] };
const worker = self as unknown as ServiceWorkerGlobalScope;
const prefix = `foodguide:${worker.registration.scope}:`;
const cacheName = prefix + config.id;
const absolute = (path: string) => new URL(path, worker.registration.scope).href;
const assetURLs = new Set(config.assets.map(asset => absolute(asset.path)));

const completeURL = absolute('__offline_complete__');
const fallbackURL = absolute('__offline_fallback__');
const clientURL = (id: string) => absolute(`__offline_fallback_client__/${id}`);
let downloading: Promise<void> | undefined;
let fallbackCache: Promise<Cache | undefined> | undefined;

async function hasAssets(cache: Cache, urls: Iterable<string>) {
	const stored = new Set((await cache.keys()).map(request => request.url));
	return Array.from(urls).every(url => stored.has(url));
}

async function isReady(cache?: Cache) {
	if (!cache) {
		if (!(await caches.has(cacheName))) {
			return false;
		}
		cache = await caches.open(cacheName);
	}
	if ((await cache.match(completeURL)) === undefined) {
		return false;
	}
	return hasAssets(cache, assetURLs);
}

async function olderCaches() {
	return (await caches.keys()).filter(key => key.startsWith(prefix) && key !== cacheName);
}

async function findFallback(mark = false) {
	for (const name of (await olderCaches()).reverse()) {
		const cache = await caches.open(name);
		if (!mark) {
			if ((await (await cache.match(fallbackURL))?.text()) === config.id) {
				return cache;
			}
			continue;
		}
		const marker = await (await cache.match(completeURL))?.text();
		// Older workers stored only the build ID. Those caches still need an entry page.
		if (
			marker &&
			(await cache.match(absolute('index.html'))) &&
			(marker === name.slice(prefix.length) ||
				(marker.startsWith('[') && (await hasAssets(cache, JSON.parse(marker)))))
		) {
			await cache.put(fallbackURL, new Response(config.id));
			return cache;
		}
	}
}

function getFallback() {
	return (fallbackCache ??= findFallback().catch(() => {
		fallbackCache = undefined;
		return undefined;
	}));
}

function download() {
	if (downloading) {
		return downloading;
	}
	downloading = (async () => {
		const cache = await caches.open(cacheName);
		const controller = new AbortController();
		await cache.delete(completeURL);
		try {
			const pending = [...config.assets];
			const results = await Promise.allSettled(
				Array.from({ length: 6 }, async () => {
					try {
						while (pending.length && !controller.signal.aborted) {
							const asset = pending.pop()!;
							// A stalled file must not leave installation or retry hanging indefinitely.
							const timer = setTimeout(() => controller.abort(), 30000);
							try {
								const response = await fetch(absolute(asset.path), {
									cache: 'no-store',
									redirect: 'error',
									signal: controller.signal,
								});
								if (!response.ok) {
									throw new Error(`Download failed: ${asset.path}`);
								}
								const digest = await crypto.subtle.digest(
									'SHA-256',
									await response.clone().arrayBuffer(),
								);
								const hash = Array.from(new Uint8Array(digest), b =>
									b.toString(16).padStart(2, '0'),
								).join('');
								if (hash !== asset.hash) {
									throw new Error(`Build changed: ${asset.path}`);
								}
								await cache.put(absolute(asset.path), response);
							} finally {
								clearTimeout(timer);
							}
						}
					} catch (error) {
						controller.abort();
						throw error;
					}
				}),
			);
			const failed = results.find(result => result.status === 'rejected');
			if (failed?.status === 'rejected') {
				throw failed.reason;
			}
			// A timer can fire after fetch has finished, while digesting or storing a file.
			// In that case all runners can settle successfully despite skipping queued assets.
			if (controller.signal.aborted || pending.length) {
				throw new Error('Offline download aborted before completion');
			}
			await cache.put(completeURL, new Response(JSON.stringify([...assetURLs])));
		} catch (error) {
			// All writers have settled; a failed build must never become usable.
			await caches.delete(cacheName);
			throw error;
		}
	})().finally(() => {
		downloading = undefined;
	});
	return downloading;
}

worker.addEventListener('install', event => {
	event.waitUntil(download());
});

worker.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			try {
				if (await isReady()) {
					await Promise.all((await olderCaches()).map(key => caches.delete(key)));
				} else {
					// The browser can activate a waiting worker after the last tab closes,
					// even if its verified cache was evicted in the meantime.
					fallbackCache = findFallback(true);
					await fallbackCache;
				}
			} catch {
				fallbackCache = undefined;
				// Claim clients even when cache storage is unavailable so they can use the network.
			}
			await worker.clients.claim();
		})(),
	);
});

worker.addEventListener('message', event => {
	if (!['ACTIVATE', 'STATUS', 'RESTORE'].includes(event.data?.type)) {
		return;
	}
	event.waitUntil(
		(async () => {
			if (event.data.type === 'STATUS' || event.data.type === 'RESTORE') {
				try {
					if (event.data.type === 'RESTORE' && !(await isReady())) {
						await download();
					}
					event.ports[0]?.postMessage((await isReady()) ? 'READY' : 'MISSING');
				} catch {
					event.ports[0]?.postMessage('MISSING');
				}
				return;
			}
			if (!(await isReady())) {
				event.ports[0]?.postMessage('MISSING');
				return;
			}
			const clients = (
				await worker.clients.matchAll({ type: 'window', includeUncontrolled: true })
			).filter(client => client.url.startsWith(worker.registration.scope));
			if (clients.length > 1) {
				event.ports[0]?.postMessage('CLOSE_TABS');
			} else {
				event.ports[0]?.postMessage('ACTIVATING');
				await worker.skipWaiting();
			}
		})(),
	);
});

worker.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') {
		return;
	}
	const url = new URL(event.request.url);
	url.hash = '';
	url.search = '';
	if (!url.href.startsWith(worker.registration.scope)) {
		return;
	}
	const path = url.href.slice(worker.registration.scope.length);
	// Fragment routes and query parameters share the same entry document.
	const key =
		event.request.mode === 'navigate' && (path === '' || path === 'index.html')
			? 'index.html'
			: path;
	const cacheKey = absolute(key);
	event.respondWith(
		(async () => {
			try {
				const navigate = event.request.mode === 'navigate';
				const fallback = await getFallback();
				if (
					!navigate &&
					fallback &&
					event.clientId &&
					(await fallback.match(clientURL(event.clientId)))
				) {
					// A tab that opened the previous build keeps using it after a retry
					// restores the current cache. Store the association across worker restarts.
					return (await fallback.match(cacheKey)) ?? Response.error();
				}
				if (assetURLs.has(cacheKey) && (await caches.has(cacheName))) {
					const cache = await caches.open(cacheName);
					const complete = navigate
						? await isReady(cache)
						: !!(await cache.match(completeURL));
					if (complete) {
						// Never mix a newer response into a cached build.
						return (await cache.match(cacheKey)) ?? Response.error();
					}
					if (navigate) {
						await cache.delete(completeURL);
					}
				}
				if (navigate && fallback && event.resultingClientId) {
					const response = await fallback.match(cacheKey);
					if (response) {
						await fallback.put(clientURL(event.resultingClientId), new Response());
						return response;
					}
				}
			} catch {
				// Cache Storage can become unavailable independently of the network.
			}
			return fetch(event.request);
		})(),
	);
});
