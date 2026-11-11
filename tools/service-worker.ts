/// <reference lib="webworker" />
declare const config: { id: string; assets: { path: string; hash: string }[] };
const worker = self as unknown as ServiceWorkerGlobalScope;
const prefix = `foodguide:${worker.registration.scope}:`;
const cacheName = prefix + config.id;
const absolute = (path: string) => new URL(path, worker.registration.scope).href;
const assetURLs = new Set(config.assets.map(asset => absolute(asset.path)));

const completeURL = absolute('__offline_complete__');
let downloading: Promise<void> | undefined;

async function isReady() {
	if (!(await caches.has(cacheName))) {
		return false;
	}
	const cache = await caches.open(cacheName);
	if ((await cache.match(completeURL)) === undefined) {
		return false;
	}
	const stored = new Set((await cache.keys()).map(request => request.url));
	return [...assetURLs].every(url => stored.has(url));
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
			await cache.put(completeURL, new Response(config.id));
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
	if (!assetURLs.has(absolute(key))) {
		return;
	}
	event.respondWith(
		(async () => {
			const cache = await caches.open(cacheName);
			// An evicted cache must not trap the site behind a permanently broken worker.
			// Use the network for the entire page until a complete build is restored.
			const complete =
				event.request.mode === 'navigate'
					? await isReady()
					: !!(await cache.match(completeURL));
			if (!complete) {
				await cache.delete(completeURL);
				return fetch(event.request);
			}
			const response = await cache.match(absolute(key));
			// Never mix a newer server asset into this build if browser storage was cleared.
			return response ?? Response.error();
		})(),
	);
});
