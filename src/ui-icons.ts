/** Small, theme-aware line icons. Labels belong to their surrounding controls. */
const paths = {
	share: 'M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
	globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
	options: 'M4 7h9m4 0h3M13 4h4v6h-4zM4 17h3m4 0h9M7 14h4v6H7z',
	close: 'm6 6 12 12M6 18 18 6',
	copy: 'M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM16 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1',
	download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
	upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
	sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
	moon: 'M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z',
	device: 'M3 3h18v13H3zM8 21h8m-4-5v5',
	book: 'M12 5C8 2 4 3 2 4v15c3-1 7-1 10 1m0-15c4-3 8-2 10-1v15c-3-1-7-1-10 1V5Z',
	pot: 'M4 8h16v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM2 11h2m16 0h2M3 8h18M9 8V4h6v4',
	bag: 'M5 8h14l2 13H3L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
	list: 'M9 5h12M9 12h12M9 19h12M3 5h1m-1 7h1m-1 7h1',
	chart: 'M4 3v18h17M9 16v-4m5 4V7m5 9V4',
	arrow: 'M4 12h16m-6-6 6 6-6 6',
	leaf: 'M4 20C-1 8 9 2 21 3c0 12-6 19-17 17Zm0 0L16 8',
	shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6',
	trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
} as const;

export type IconName = keyof typeof paths;

export function createIcon(name: IconName, documentRef: Document = document) {
	const namespace = 'http://www.w3.org/2000/svg';
	const icon = documentRef.createElementNS(namespace, 'svg');
	icon.classList.add('ui-icon');
	icon.setAttribute('viewBox', '0 0 24 24');
	icon.setAttribute('fill', 'none');
	icon.setAttribute('stroke', 'currentColor');
	icon.setAttribute('stroke-width', '1.7');
	icon.setAttribute('stroke-linecap', 'round');
	icon.setAttribute('stroke-linejoin', 'round');
	icon.setAttribute('aria-hidden', 'true');
	icon.setAttribute('focusable', 'false');
	const path = documentRef.createElementNS(namespace, 'path');
	path.setAttribute('d', paths[name]);
	icon.append(path);
	return icon;
}

export function initializeInformationPages() {
	for (const node of document.querySelectorAll<HTMLElement>('[data-ui-icon]')) {
		const name = node.dataset.uiIcon;
		if (name && Object.hasOwn(paths, name)) {
			node.replaceChildren(createIcon(name as IconName));
		}
	}
	for (const node of document.querySelectorAll<HTMLButtonElement>('[data-info-scroll]')) {
		node.addEventListener('click', () => {
			const target = document.getElementById(node.dataset.infoScroll!);
			if (target) {
				target.focus({ preventScroll: true });
				target.scrollIntoView({ block: 'start' });
			}
		});
	}
	for (const node of document.querySelectorAll<HTMLButtonElement>('[data-header-action]')) {
		node.addEventListener('click', () => {
			document.getElementById(`personal-${node.dataset.headerAction}-button`)?.click();
		});
	}
}
