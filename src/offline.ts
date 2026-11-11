import { t, type StringKey } from './strings.js';

// Electron ships its own complete copy and uses file: URLs.
if (location.protocol === 'https:' || location.protocol === 'http:') {
	const panel = document.getElementById('offline-panel')!;
	panel.hidden = false;
	const status = document.getElementById('offline-status')!;
	const update = document.getElementById('offline-update') as HTMLButtonElement;
	const retry = document.getElementById('offline-retry') as HTMLButtonElement;
	const persist = document.getElementById('offline-persist') as HTMLButtonElement;
	const storageStatus = document.getElementById('offline-storage-status')!;
	let statusKey: StringKey = 'offlineDownloading';
	let storageKey: StringKey | undefined;
	let registration: ServiceWorkerRegistration | undefined;
	let applying = false;
	const notice = document.createElement('div');
	notice.className = 'personal-status';
	const updateStatus = document.createElement('p');
	updateStatus.setAttribute('role', 'status');
	const render = () => {
		status.textContent = t(statusKey);
		updateStatus.textContent = statusKey === 'offlineCloseTabs' ? t(statusKey) : '';
		if (storageKey) {
			storageStatus.textContent = t(storageKey);
		}
	};
	const setStatus = (key: StringKey) => {
		statusKey = key;
		render();
	};
	document.addEventListener('foodguide:localechange', render);
	render();
	if (!('serviceWorker' in navigator) || !window.isSecureContext) {
		setStatus('offlineUnsupported');
	} else {
		const send = (worker: ServiceWorker, type: string): Promise<string> =>
			new Promise(resolve => {
				const channel = new MessageChannel();
				const finish = (value: string) => {
					clearTimeout(timer);
					channel.port1.close();
					resolve(value);
				};
				const timer = setTimeout(
					() => finish('MISSING'),
					type === 'RESTORE' ? 180000 : 5000,
				);
				channel.port1.onmessage = event => finish(event.data);
				try {
					worker.postMessage({ type }, [channel.port2]);
				} catch {
					finish('MISSING');
				}
			});
		let statusRequest = 0;
		const ready = async () => {
			const request = ++statusRequest;
			const active = registration?.active;
			const waiting = registration?.waiting;
			const [available, updateAvailable] = await Promise.all([
				active ? send(active, 'STATUS').then(status => status === 'READY') : false,
				waiting ? send(waiting, 'STATUS').then(status => status === 'READY') : false,
			]);
			if (request !== statusRequest) {
				return;
			}
			update.hidden = !updateAvailable;
			retry.hidden = true;
			if (updateAvailable) {
				setStatus('offlineUpdateReady');
				notice.append(update, updateStatus);
				document.querySelector('header')?.append(notice);
			} else if (waiting) {
				setStatus(available ? 'offlineUpdateFailed' : 'offlineFailed');
				retry.hidden = false;
			} else if (available) {
				setStatus('offlineReady');
			} else if (active || !registration?.installing) {
				setStatus('offlineFailed');
				retry.hidden = false;
			}
		};
		const watched = new WeakSet<ServiceWorker>();
		const watch = (worker: ServiceWorker | null) => {
			if (!worker || watched.has(worker)) {
				return;
			}
			watched.add(worker);
			let activated = worker.state === 'activated';
			worker.addEventListener('statechange', () => {
				if (worker.state === 'activated') {
					activated = true;
				}
				if (worker.state === 'installed' || worker.state === 'activated') {
					void ready();
				}
				if (worker.state === 'redundant' && !activated) {
					if (registration?.installing && registration.installing !== worker) {
						return;
					}
					statusRequest++;
					setStatus(registration?.active ? 'offlineUpdateFailed' : 'offlineFailed');
					retry.hidden = false;
				}
			});
		};
		const observed = new WeakSet<ServiceWorkerRegistration>();
		const observe = (next: ServiceWorkerRegistration) => {
			registration = next;
			if (!observed.has(next)) {
				observed.add(next);
				next.addEventListener('updatefound', () => {
					statusRequest++;
					setStatus('offlineDownloading');
					retry.hidden = true;
					watch(next.installing);
				});
			}
			watch(next.installing);
		};
		const register = async () => {
			try {
				observe(
					await navigator.serviceWorker.register(new URL('sw.js', import.meta.url), {
						updateViaCache: 'none',
					}),
				);
				await ready();
			} catch {
				registration = await navigator.serviceWorker
					.getRegistration(new URL('./', import.meta.url))
					.catch(() => undefined);
				if (registration?.active) {
					observe(registration);
					await ready();
				} else {
					setStatus('offlineFailed');
					retry.hidden = false;
				}
			}
		};
		void register();
		retry.addEventListener('click', async () => {
			retry.hidden = true;
			retry.disabled = true;
			setStatus('offlineDownloading');
			try {
				if (!registration || (!registration.active && !registration.installing)) {
					await register();
				} else {
					await registration.update();
					const target =
						registration.waiting ??
						(!registration.installing ? registration.active : null);
					if (target) {
						await send(target, 'RESTORE');
					}
					await ready();
				}
			} catch {
				setStatus('offlineFailed');
				retry.hidden = false;
			} finally {
				retry.disabled = false;
			}
		});
		window.addEventListener('pageshow', () => {
			if (registration?.active) {
				void ready();
			}
		});
		update.addEventListener('click', async () => {
			if (!registration?.waiting) {
				return;
			}
			applying = true;
			update.disabled = true;
			const result = await send(registration.waiting, 'ACTIVATE');
			if (result !== 'ACTIVATING') {
				applying = false;
				if (result === 'CLOSE_TABS') {
					setStatus('offlineCloseTabs');
				} else {
					await register();
				}
			}
			update.disabled = false;
		});
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (applying) {
				location.reload();
			} else {
				void ready();
			}
		});
	}
	if (navigator.storage?.persist) {
		persist.hidden = false;
		persist.addEventListener('click', async () => {
			try {
				storageKey = (await navigator.storage.persist())
					? 'offlinePersisted'
					: 'offlineNotPersisted';
			} catch {
				storageKey = 'offlineNotPersisted';
			}
			render();
		});
	}
}
