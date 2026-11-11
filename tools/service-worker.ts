/// <reference lib="webworker" />
declare const config: { id: string; assets: { path: string; hash: string }[] };
const worker = self as unknown as ServiceWorkerGlobalScope;
const prefix = `foodguide:${worker.registration.scope}:`;
const cacheName = prefix + config.id;
const absolute = (path: string) => new URL(path, worker.registration.scope).href;
const assetURLs = new Set(config.assets.map(asset => absolute(asset.path)));

worker.addEventListener('install', event => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			try {
				// Bound concurrency so a full guide download also works on mobile connections.
				const pending = [...config.assets];
				const results = await Promise.allSettled(
					Array.from({ length: 6 }, async () => {
						while (pending.length) {
							const asset = pending.pop()!;
							const response = await fetch(absolute(asset.path), {
								cache: 'no-store',
								redirect: 'error',
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
						}
					}),
				);
				const failed = results.find(result => result.status === 'rejected');
				if (failed?.status === 'rejected') {
					throw failed.reason;
				}
			} catch (error) {
				// All writers have settled; a failed build must never become usable.
				await caches.delete(cacheName);
				throw error;
			}
		})(),
	);
});

worker.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			await Promise.all(
				(await caches.keys())
					.filter(key => key.startsWith(prefix) && key !== cacheName)
					.map(key => caches.delete(key)),
			);
			await worker.clients.claim();
		})(),
	);
});

worker.addEventListener('message', event => {
	if (event.data?.type !== 'ACTIVATE') {
		return;
	}
	event.waitUntil(
		(async () => {
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
	if (!url.href.startsWith(worker.registration.scope)) {
		return;
	}
	const path = url.href.slice(worker.registration.scope.length).split('?')[0];
	// Fragment routes and query parameters share the same entry document.
	const key =
		event.request.mode === 'navigate' && (path === '' || path === 'index.html')
			? 'index.html'
			: path;
	if (!assetURLs.has(absolute(key))) {
		return;
	}
	event.respondWith(
		(async () => {
			const response = await (await caches.open(cacheName)).match(absolute(key));
			// Never mix a newer server asset into this build if browser storage was cleared.
			return response ?? Response.error();
		})(),
	);
});
