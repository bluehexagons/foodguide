import type { StringKey } from './strings.js';
import type { SortRow, TableSortKey } from './table-sort.js';
import { sortTableRows } from './table-sort.js';
import { makeImage } from './utils.js';

export interface SortableTable extends HTMLDivElement {
	update: (scrollHighlight?: boolean) => void;
	updateLocale: () => void;
	setMaxRows: (max: number) => void;
	/** Release registrations and scheduled scrolling before removing the container. */
	dispose: () => void;
	updateResponsive?: () => void;
	updateAutoHide?: (labels?: string[]) => void;
}
interface TableFactoryOptions {
	translate: (key: StringKey) => string;
	translateTableLabel: (label: string) => string;
	translateTableHint: (hint: string) => string;
	translateSummaryLabel: (label: string) => string;
	localeTables: Set<SortableTable>;
	responsiveTables: Set<SortableTable>;
}
interface ColumnConfig {
	toggleable?: boolean;
	columns?: string[];
	autoHide?: string[];
}
export interface TableOptions<T extends SortRow> {
	headers: Record<string, TableSortKey<T> | ''>;
	dataset: T[];
	rowGenerator: (item: T) => HTMLTableRowElement;
	defaultSort: TableSortKey<T>;
	summaryRows?: number;
	linkCallback?: (key: string, control: HTMLButtonElement) => void;
	highlightCallback?: (item: T, items: T[]) => boolean;
	filterCallback?: (item: T) => boolean;
	maxRows?: number;
	columnConfig?: ColumnConfig;
}

const statHeaders = new Set([
	'Health',
	'Health+',
	'Hunger',
	'Hunger+',
	'Sanity',
	'Perish',
	'Cook Time',
	'Priority',
]);

const labelFromHeader = (header: string) => header.split(':')[0];
const isNumericHeader = (header: string) =>
	statHeaders.has(header) || header.includes('Health') || header.includes('Hunger');

/**
 * Builds the shared sortable table renderer used across the guide.
 *
 * The page controller supplies labels and lifecycle registries so this module
 * remains reusable and has no page-specific state.
 */
export const createSortableTableFactory = ({
	translate,
	translateTableLabel,
	translateTableHint,
	translateSummaryLabel,
	localeTables,
	responsiveTables,
}: TableFactoryOptions) => {
	const queueIcon = (icon: HTMLSpanElement) => {
		if (icon.dataset.src) {
			makeImage.queue(icon, icon.dataset.src);
		}
	};

	const cells = (cellType: 'td' | 'th', ...values: (string | number | Node)[]) => {
		const row = document.createElement('tr');

		for (const cell of values) {
			const td = document.createElement(cellType);
			const text = String(cell);

			if (cell instanceof DocumentFragment) {
				td.appendChild(cell.cloneNode(true));
				Array.prototype.forEach.call(td.querySelectorAll('.icon'), queueIcon);
			} else if (text.startsWith('img/')) {
				const [url, title = text] = text.split(':');
				const image = makeImage(url);
				image.title = title;
				td.appendChild(image);
			} else if (cell instanceof Element) {
				td.appendChild(cell);
			} else {
				td.appendChild(document.createTextNode(text));
				if (/^[+-]?\d/.test(text.trim()) || text.trim() === '') {
					td.classList.add('numeric-cell');
				}
			}

			row.appendChild(td);
		}

		return row;
	};

	const fandomHref = (name: string) => {
		if (name && name.startsWith('Sum:')) {
			return translateSummaryLabel(name.slice(name.indexOf(':') + 1));
		}

		const link = document.createElement('a');
		link.target = '_blank';
		link.rel = 'noopener';
		link.href = `https://dontstarve.wiki.gg/wiki/${name.replace(/\s/g, '_')}`;
		link.appendChild(document.createTextNode(name));
		return link;
	};

	const makeSortableTable = <T extends SortRow>({
		headers,
		dataset,
		rowGenerator,
		defaultSort,
		summaryRows = 0,
		linkCallback,
		highlightCallback,
		filterCallback,
		maxRows,
		columnConfig,
	}: TableOptions<T>) => {
		const table = document.createElement('table');
		const container = document.createElement('div') as SortableTable;
		let disposed = false;
		let scrollFrame: number | undefined;
		container.dispose = () => {
			disposed = true;
			if (scrollFrame !== undefined) {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = undefined;
			}
			localeTables.delete(container);
			responsiveTables.delete(container);
		};
		let sorting = defaultSort;
		let invertSort = false;
		let firstHighlight: HTMLElement | null = null;
		let lastHighlight: HTMLElement | null = null;
		let rows: number;
		const headerKeys = Object.keys(headers);
		const iconColumns: number[] = [];
		const numericColumns: number[] = [];
		const hiddenColumns = new Set<number>();
		let autoMode = true;
		let autoHiddenColumns = new Set<number>();

		headerKeys.forEach((header, index) => {
			const label = labelFromHeader(header);
			if (!label || label === 'Mode') {
				iconColumns.push(index);
			}
			if (isNumericHeader(label)) {
				numericColumns.push(index);
			}
		});

		const setAutoHiddenColumns = (labels: string[]) => {
			autoHiddenColumns = new Set(
				headerKeys
					.map((header, index): [string, number] => [labelFromHeader(header), index])
					.filter(([label]) => labels?.includes(label))
					.map(([, index]) => index),
			);
		};
		setAutoHiddenColumns(columnConfig?.autoHide || []);

		const effectiveHiddenColumns = () =>
			autoMode && window.innerWidth <= 900
				? new Set([...hiddenColumns, ...autoHiddenColumns])
				: hiddenColumns;

		const applyColumnVisibility = () => {
			const hidden = effectiveHiddenColumns();
			for (const row of table.querySelectorAll('tr')) {
				for (let index = 0; index < row.children.length; index++) {
					row.children[index].classList.toggle('col-hidden', hidden.has(index));
				}
			}
		};

		const selectSort = (sortKey: TableSortKey<T>) => {
			if (disposed) {
				return;
			}
			invertSort = sorting === sortKey ? !invertSort : false;
			sorting = sortKey;
			renderTable();
		};

		// Keep header controls mounted so sorting and locale changes preserve focus.
		const head = table.createTHead();
		const headerRow = head.insertRow();
		const body = table.createTBody();
		const rowItems = new WeakMap<HTMLTableRowElement, T>();
		const headerCells = headerKeys.map(header => {
			const th = document.createElement('th');
			th.scope = 'col';
			const label = labelFromHeader(header);
			if (isNumericHeader(label)) {
				th.classList.add('numeric-cell');
			}
			if (!label || label === 'Mode') {
				th.classList.add('icon-cell');
			}
			const sortKey = headers[header];
			let control: HTMLElement = th;
			if (!label) {
				control = document.createElement('span');
				control.className = 'sr-only';
				th.appendChild(control);
			}
			if (sortKey) {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'table-sort';
				th.appendChild(button);
				control = button;
				th.dataset.sort = sortKey;
				button.addEventListener('click', () => selectSort(sortKey));
			}
			headerRow.appendChild(th);
			return { header, label, sortKey, th, control };
		});

		const renderTable = (scrollHighlight = false) => {
			if (disposed) {
				return;
			}
			sortTableRows(dataset, sorting, { summaryRows, invert: invertSort });
			for (const { header, label, sortKey, th, control } of headerCells) {
				const translatedLabel = translateTableLabel(label || 'Image');
				if (control.textContent !== translatedLabel) {
					control.textContent = translatedLabel;
				}
				if (sortKey) {
					control.setAttribute('aria-label', translatedLabel);
				}
				if (header.includes(':')) {
					th.title = translateTableHint(header.split(':')[1]);
					control.setAttribute('aria-description', th.title);
				}
				const selected = sortKey === sorting;
				const ascending = sorting === 'name' ? !invertSort : invertSort;
				th.classList.toggle('sort-asc', selected && ascending);
				th.classList.toggle('sort-desc', selected && !ascending);
				if (selected) {
					th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
				} else {
					th.removeAttribute('aria-sort');
				}
			}
			const focusedControl =
				document.activeElement instanceof HTMLButtonElement &&
				body.contains(document.activeElement)
					? document.activeElement
					: undefined;
			const focusedLink = focusedControl?.dataset.link;
			const focusedRow = focusedControl?.closest('tr');
			const focusedItem = focusedRow ? rowItems.get(focusedRow) : undefined;
			const focusedIndex =
				focusedRow && focusedControl
					? Array.from(focusedRow.querySelectorAll<HTMLButtonElement>('button.link'))
							.filter(button => button.dataset.link === focusedLink)
							.indexOf(focusedControl)
					: -1;
			let restoredRow: HTMLTableRowElement | undefined;
			const content = document.createDocumentFragment();
			firstHighlight = null;
			lastHighlight = null;
			rows = 0;

			for (const item of dataset) {
				const items = dataset;
				if ((maxRows && rows >= maxRows) || (filterCallback && !filterCallback(item))) {
					continue;
				}
				const row = rowGenerator(item);
				rowItems.set(row, item);
				if (item === focusedItem) {
					restoredRow = row;
				}
				iconColumns.forEach(column => row.children[column]?.classList.add('icon-cell'));
				numericColumns.forEach(column =>
					row.children[column]?.classList.add('numeric-cell'),
				);
				if (highlightCallback?.(item, items)) {
					row.className = 'highlighted';
					firstHighlight ||= row;
					lastHighlight = row;
				}
				content.appendChild(row);
				rows++;
			}

			if (linkCallback) {
				table.className = 'links';
				for (const link of content.querySelectorAll<HTMLElement>('.link[data-link]')) {
					const key = link.dataset.link!;
					const button = document.createElement('button');
					button.type = 'button';
					for (const attribute of link.attributes) {
						button.setAttribute(attribute.name, attribute.value);
					}
					button.append(...link.childNodes);
					button.addEventListener('click', () => linkCallback(key, button));
					link.replaceWith(button);
				}
			}
			body.replaceChildren(content);
			applyColumnVisibility();
			if (focusedLink !== undefined && restoredRow) {
				Array.from(restoredRow.querySelectorAll<HTMLButtonElement>('button.link'))
					.filter(button => button.dataset.link === focusedLink)
					[focusedIndex]?.focus({ preventScroll: true });
			}

			if (scrollHighlight) {
				if (
					firstHighlight &&
					firstHighlight.getBoundingClientRect().bottom > window.innerHeight
				) {
					firstHighlight.scrollIntoView(true);
				} else if (lastHighlight && lastHighlight.getBoundingClientRect().top < 0) {
					lastHighlight.scrollIntoView(false);
				}
			}
		};

		renderTable();

		const update = (scrollHighlight = false) => {
			if (disposed) {
				return;
			}
			if (scrollFrame !== undefined) {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = undefined;
			}
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;
			renderTable(scrollHighlight);
			if (!scrollHighlight) {
				scrollFrame = requestAnimationFrame(() => {
					scrollFrame = undefined;
					window.scrollTo(scrollX, scrollY);
				});
			}
		};
		const setMaxRows = (max: number) => {
			maxRows = max;
			update();
		};

		if (!columnConfig?.toggleable) {
			container.className = 'table-scroll-wrapper';
			container.appendChild(table);
			container.update = update;
			container.updateLocale = () => update();
			container.setMaxRows = setMaxRows;
			localeTables.add(container);
			return container;
		}

		const toggleBar = document.createElement('div');
		toggleBar.className = 'column-toggle-bar';
		const label = document.createElement('span');
		label.className = 'col-toggle-label';
		toggleBar.appendChild(label);
		const autoButton = document.createElement('button');
		autoButton.type = 'button';
		toggleBar.appendChild(autoButton);
		const toggleButtons: { button: HTMLButtonElement; index: number; label: string }[] = [];

		const updateToggleButtons = () => {
			autoButton.className = autoMode ? 'active' : '';
			autoButton.setAttribute('aria-pressed', String(autoMode));
			const hidden = effectiveHiddenColumns();
			for (const { button, index } of toggleButtons) {
				button.className = hidden.has(index) ? '' : 'active';
				button.setAttribute('aria-pressed', String(!hidden.has(index)));
			}
		};
		const updateLabels = () => {
			label.textContent = translate('columns');
			autoButton.textContent = translate('autoColumns');
			autoButton.title = translate('autoColumnsTitle');
			for (const { button, label } of toggleButtons) {
				button.textContent = translateTableLabel(label);
			}
		};
		autoButton.addEventListener('click', () => {
			autoMode = !autoMode;
			applyColumnVisibility();
			updateToggleButtons();
		});

		headerKeys.forEach((header, index) => {
			const label = labelFromHeader(header);
			if (!label || (columnConfig.columns && !columnConfig.columns.includes(label))) {
				return;
			}
			const button = document.createElement('button');
			button.type = 'button';
			button.addEventListener('click', () => {
				hiddenColumns.has(index) ? hiddenColumns.delete(index) : hiddenColumns.add(index);
				applyColumnVisibility();
				updateToggleButtons();
			});
			toggleBar.appendChild(button);
			toggleButtons.push({ button, index, label });
		});
		updateLabels();
		updateToggleButtons();

		const wrapper = document.createElement('div');
		wrapper.className = 'table-scroll-wrapper';
		wrapper.appendChild(table);
		container.appendChild(toggleBar);
		container.appendChild(wrapper);
		container.update = scrollHighlight => {
			update(scrollHighlight);
			applyColumnVisibility();
		};
		container.updateLocale = () => {
			update();
			updateLabels();
		};
		container.setMaxRows = setMaxRows;
		container.updateResponsive = () => {
			if (autoMode) {
				applyColumnVisibility();
				updateToggleButtons();
			}
		};
		container.updateAutoHide = labels => {
			setAutoHiddenColumns(labels || []);
			applyColumnVisibility();
			updateToggleButtons();
		};
		localeTables.add(container);
		responsiveTables.add(container);
		return container;
	};

	return { cells, fandomHref, makeSortableTable };
};
