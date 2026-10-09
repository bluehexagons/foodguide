import type { StringKey } from './strings.js';
import type { SortRow, TableSortKey } from './table-sort.js';
import { sortTableRows } from './table-sort.js';
import { makeImage } from './utils.js';

export interface SortableTable extends HTMLDivElement {
	update: (scrollHighlight?: boolean) => void;
	updateLocale: () => void;
	setMaxRows: (max: number) => void;
	updateResponsive?: () => void;
	updateAutoHide?: (labels?: string[]) => void;
}
interface TableFactoryOptions {
	mainElement: HTMLElement;
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
	linkCallback?: (key: string, control: HTMLElement) => void;
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
 * The page controller supplies labels, lifecycle registries, and the main
 * element so this module remains reusable and has no page-specific state.
 */
export const createSortableTableFactory = ({
	mainElement,
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
		let table = document.createElement('table');
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
			if (!table) {
				return;
			}
			const hidden = effectiveHiddenColumns();
			for (const row of table.querySelectorAll('tr')) {
				for (let index = 0; index < row.children.length; index++) {
					row.children[index].classList.toggle('col-hidden', hidden.has(index));
				}
			}
		};

		const selectSort = (sortKey: TableSortKey<T>) => {
			invertSort = sorting === sortKey ? !invertSort : false;
			sorting = sortKey;
			renderTable();
		};

		const renderTable = (scrollHighlight = false) => {
			sortTableRows(dataset, sorting, { summaryRows, invert: invertSort });

			const headerRow = document.createElement('tr');
			for (const header of headerKeys) {
				const th = document.createElement('th');
				const label = labelFromHeader(header);
				if (isNumericHeader(label)) {
					th.classList.add('numeric-cell');
				}
				if (!label || label === 'Mode') {
					th.classList.add('icon-cell');
				}
				th.appendChild(document.createTextNode(translateTableLabel(label)));
				if (header.includes(':')) {
					th.title = translateTableHint(header.split(':')[1]);
				}
				const sortKey = headers[header];
				if (sortKey) {
					if (sortKey === sorting) {
						th.classList.add(invertSort ? 'sort-desc' : 'sort-asc');
					}
					th.style.cursor = 'pointer';
					th.dataset.sort = sortKey;
					th.addEventListener('click', () => selectSort(sortKey), false);
				}
				headerRow.appendChild(th);
			}

			const oldTable = table;
			table = document.createElement('table');
			table.appendChild(headerRow);
			firstHighlight = null;
			lastHighlight = null;
			rows = 0;

			for (const item of dataset) {
				const items = dataset;
				if ((maxRows && rows >= maxRows) || (filterCallback && !filterCallback(item))) {
					continue;
				}
				const row = rowGenerator(item);
				iconColumns.forEach(column => row.children[column]?.classList.add('icon-cell'));
				numericColumns.forEach(column =>
					row.children[column]?.classList.add('numeric-cell'),
				);
				if (highlightCallback?.(item, items)) {
					row.className = 'highlighted';
					firstHighlight ||= row;
					lastHighlight = row;
				}
				table.appendChild(row);
				rows++;
			}

			if (linkCallback) {
				table.className = 'links';
				for (const link of table.querySelectorAll<HTMLElement>('.link[data-link]')) {
					const key = link.dataset.link!;
					link.addEventListener('click', () => linkCallback(key, link), false);
				}
			}
			applyColumnVisibility();
			if (oldTable) {
				oldTable.parentNode?.replaceChild(table, oldTable);
			}

			if (scrollHighlight) {
				if (
					firstHighlight &&
					firstHighlight.offsetTop +
						table.offsetTop +
						mainElement.offsetTop +
						firstHighlight.offsetHeight >
						window.scrollY + window.innerHeight
				) {
					firstHighlight.scrollIntoView(true);
				} else if (
					lastHighlight &&
					lastHighlight.offsetTop + table.offsetTop + mainElement.offsetTop <
						window.scrollY
				) {
					lastHighlight.scrollIntoView(false);
				}
			}
		};

		renderTable();

		const update = (scrollHighlight = false) => {
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;
			renderTable(scrollHighlight);
			requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
		};
		const setMaxRows = (max: number) => {
			maxRows = max;
			update();
		};

		if (!columnConfig?.toggleable) {
			const wrapper = document.createElement('div') as SortableTable;
			wrapper.className = 'table-scroll-wrapper';
			wrapper.appendChild(table);
			wrapper.update = update;
			wrapper.updateLocale = () => update();
			wrapper.setMaxRows = setMaxRows;
			localeTables.add(wrapper);
			return wrapper;
		}

		const container = document.createElement('div') as SortableTable;
		const toggleBar = document.createElement('div');
		toggleBar.className = 'column-toggle-bar';
		const label = document.createElement('span');
		label.className = 'col-toggle-label';
		toggleBar.appendChild(label);
		const autoButton = document.createElement('button');
		toggleBar.appendChild(autoButton);
		const toggleButtons: { button: HTMLButtonElement; index: number; label: string }[] = [];

		const updateToggleButtons = () => {
			const hidden = effectiveHiddenColumns();
			for (const { button, index } of toggleButtons) {
				button.className = hidden.has(index) ? '' : 'active';
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
			autoButton.className = autoMode ? 'active' : '';
			applyColumnVisibility();
			updateToggleButtons();
		});

		headerKeys.forEach((header, index) => {
			const label = labelFromHeader(header);
			if (!label || (columnConfig.columns && !columnConfig.columns.includes(label))) {
				return;
			}
			const button = document.createElement('button');
			button.addEventListener('click', () => {
				hiddenColumns.has(index) ? hiddenColumns.delete(index) : hiddenColumns.add(index);
				applyColumnVisibility();
				updateToggleButtons();
			});
			toggleBar.appendChild(button);
			toggleButtons.push({ button, index, label });
		});
		updateLabels();
		autoButton.className = autoMode ? 'active' : '';
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
