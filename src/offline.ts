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
		const ready = () => {
			if (registration?.waiting) {
				setStatus('offlineUpdateReady');
				update.hidden = false;
				notice.append(update, updateStatus);
				document.querySelector('header')?.append(notice);
			} else if (registration?.active) {
				setStatus('offlineReady');
			}
		};
		const watch = (worker: ServiceWorker | null) => {
			worker?.addEventListener('statechange', () => {
				if (worker.state === 'installed' || worker.state === 'activated') {
					ready();
				}
				if (worker.state === 'redundant') {
					setStatus(registration?.active ? 'offlineUpdateFailed' : 'offlineFailed');
					retry.hidden = false;
				}
			});
		};
		const register = async () => {
			try {
				registration = await navigator.serviceWorker.register(
					new URL('sw.js', import.meta.url),
					{ updateViaCache: 'none' },
				);
				registration.addEventListener('updatefound', () => {
					watch(registration!.installing);
				});
				watch(registration.installing);
				ready();
			} catch {
				setStatus('offlineFailed');
				retry.hidden = false;
			}
		};
		void register();
		retry.addEventListener('click', () => {
			retry.hidden = true;
			setStatus('offlineDownloading');
			void register()
				.then(() => registration?.update())
				.catch(() => {
					setStatus('offlineFailed');
					retry.hidden = false;
				});
		});
		update.addEventListener('click', () => {
			if (!registration?.waiting) {
				return;
			}
			const channel = new MessageChannel();
			applying = true;
			channel.port1.onmessage = event => {
				channel.port1.close();
				if (event.data === 'CLOSE_TABS') {
					applying = false;
					setStatus('offlineCloseTabs');
				}
			};
			registration.waiting.postMessage({ type: 'ACTIVATE' }, [channel.port2]);
		});
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (applying) {
				location.reload();
			} else {
				ready();
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
