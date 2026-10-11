import type { TextParams } from './models.js';
import type { StringKey } from './strings.js';

export interface ConsecutiveGroup<T> {
	item: T;
	key: string;
	items: T[];
}

/** Group the complete sorted, filtered snapshot before limiting rendered rows. */
export const groupConsecutiveRows = <T>(
	items: T[],
	keyOf: (item: T) => string,
	matches: (item: T) => boolean = () => true,
): ConsecutiveGroup<T>[] => {
	const groups: ConsecutiveGroup<T>[] = [];
	for (const item of items) {
		if (!matches(item)) {
			continue;
		}
		const key = keyOf(item);
		let group = groups.at(-1);
		if (!group || group.key !== key) {
			group = { item, key, items: [] };
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
};

export const pageRange = (total: number, requestedPage: number, size: number) => {
	const pages = Math.max(1, Math.ceil(total / size));
	const page = Math.max(0, Math.min(pages - 1, Math.trunc(requestedPage) || 0));
	return { page, pages, start: page * size, end: Math.min(total, (page + 1) * size) };
};

/** Native form controls give keyboard and touch users direct access to any page. */
export const createTablePagination = (
	translate: (key: StringKey, params?: TextParams) => string,
	onPage: (page: number) => void,
) => {
	const element = document.createElement('div');
	element.className = 'table-pagination';
	element.setAttribute('role', 'group');
	const range = document.createElement('span');
	range.className = 'table-page-range';
	const form = document.createElement('form');
	const input = document.createElement('input');
	input.type = 'number';
	input.min = '1';
	input.step = '1';
	input.required = true;
	input.inputMode = 'numeric';
	input.dataset.tableAction = 'page-number';
	const count = document.createElement('span');
	count.className = 'table-page-count';
	let currentPage = 0;
	let pages = 1;
	const buttons = (['first', 'previous', 'go', 'next', 'last'] as const).map(action => {
		const button = document.createElement('button');
		button.type = action === 'go' ? 'submit' : 'button';
		button.dataset.tableAction = `page-${action}`;
		if (action !== 'go') {
			button.addEventListener('click', () => {
				const page = {
					first: 0,
					previous: currentPage - 1,
					next: currentPage + 1,
					last: pages - 1,
				}[action];
				onPage(page);
			});
		}
		return { action, button };
	});
	form.addEventListener('submit', event => {
		event.preventDefault();
		if (form.reportValidity()) {
			onPage(input.valueAsNumber - 1);
		}
	});
	form.append(
		buttons[0].button,
		buttons[1].button,
		input,
		buttons[2].button,
		count,
		buttons[3].button,
		buttons[4].button,
	);
	element.append(range, form);
	return {
		element,
		update: (page: number, pageCount: number, label: string, rangeText: string) => {
			const pageChanged = currentPage !== page;
			currentPage = page;
			pages = pageCount;
			form.hidden = pages <= 1;
			element.setAttribute('aria-label', label);
			range.textContent = rangeText;
			input.setAttribute('aria-label', translate('paginationPageNumber'));
			input.max = String(pages);
			if (pageChanged || document.activeElement !== input) {
				input.value = String(page + 1);
			}
			count.textContent = translate('paginationPageCount', { page: page + 1, pages });
			for (const { action, button } of buttons) {
				button.textContent = translate(
					{
						first: 'paginationFirst',
						previous: 'paginationPrevious',
						go: 'paginationGo',
						next: 'paginationNext',
						last: 'paginationLast',
					}[action] as StringKey,
				);
				button.disabled =
					action === 'first' || action === 'previous'
						? page === 0
						: action === 'last' || action === 'next'
							? page === pages - 1
							: false;
				if (button.disabled && document.activeElement === button) {
					input.focus({ preventScroll: true });
				}
			}
		},
	};
};

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const createPageSizeControl = (
	translate: (key: StringKey) => string,
	labelKey: StringKey,
	action: string,
	onChange: (size: number) => void,
) => {
	const element = document.createElement('label');
	const text = document.createElement('span');
	const select = document.createElement('select');
	select.dataset.tableAction = action;
	for (const size of PAGE_SIZES) {
		const option = document.createElement('option');
		option.value = String(size);
		option.textContent = String(size);
		select.appendChild(option);
	}
	select.addEventListener('change', () => onChange(Number(select.value)));
	element.append(text, select);
	return {
		element,
		select,
		update: (size: number) => {
			text.textContent = translate(labelKey);
			select.value = String(size);
		},
	};
};

/** Carry expanded runs forward when incoming rows change a run's first item. */
export const reconcileGroupViews = <T>(
	previous: ConsecutiveGroup<T>[],
	current: ConsecutiveGroup<T>[],
	expanded: Set<T>,
	pages: Map<T, number>,
	size: number,
) => {
	const views = new Map(
		previous
			.filter(group => expanded.has(group.item) || pages.has(group.item))
			.map(group => [
				group.item,
				{
					expanded: expanded.has(group.item),
					page: pages.get(group.item) ?? 0,
					first: group.items[(pages.get(group.item) ?? 0) * size],
				},
			]),
	);
	const aliases = new Map<T, T>();
	expanded.clear();
	pages.clear();
	for (const group of current) {
		let source: ReturnType<typeof views.get>;
		for (const item of group.items) {
			const view = views.get(item);
			if (!view) {
				continue;
			}
			aliases.set(item, group.item);
			if (!source || (!source.expanded && view.expanded)) {
				source = view;
			}
		}
		if (!source) {
			continue;
		}
		if (source.expanded) {
			expanded.add(group.item);
		}
		const position = source.expanded ? group.items.indexOf(source.first) : -1;
		pages.set(
			group.item,
			pageRange(
				group.items.length,
				position >= 0 ? Math.floor(position / size) : source.page,
				size,
			).page,
		);
	}
	return aliases;
};
