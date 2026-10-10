import type { TextParams } from './models.js';
import { createTablePagination, groupConsecutiveRows, pageRange } from './table-pagination.js';
import type { ConsecutiveGroup } from './table-pagination.js';
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
	translate: (key: StringKey, params?: TextParams) => string;
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
export interface TableRowCounts {
	shown: number;
	total: number;
	groups?: { first: number; last: number; total: number };
}
export interface TableOptions<T extends SortRow> {
	captionKey: StringKey;
	/** Report visible and matching rows after rendering, excluding the empty placeholder. */
	onRender?: (counts: TableRowCounts) => void;
	/** Override the localized empty-table message for a view's current state. */
	emptyMessage?: () => string;
	headers: Record<string, TableSortKey<T> | ''>;
	dataset: T[];
	rowGenerator: (item: T) => HTMLTableRowElement;
	defaultSort: TableSortKey<T>;
	summaryRows?: number;
	linkCallback?: (key: string, control: HTMLButtonElement) => void;
	highlightCallback?: (item: T, items: T[]) => boolean;
	filterCallback?: (item: T) => boolean;
	maxRows?: number;
	/** Group the full sorted, filtered snapshot; page groups and expanded combinations separately. */
	groupRows?: {
		key: (item: T) => string;
		toggleLabel: (item: T, count: number, expanded: boolean) => string;
		description?: () => string;
	};
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
	let tableSequence = 0;
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
		captionKey,
		onRender,
		emptyMessage = () => translate('tableEmpty'),
		headers,
		dataset,
		rowGenerator,
		defaultSort,
		summaryRows = 0,
		linkCallback,
		highlightCallback,
		filterCallback,
		maxRows,
		groupRows,
		columnConfig,
	}: TableOptions<T>) => {
		const table = document.createElement('table');
		const tableId = `sortable-table-${++tableSequence}`;
		const expandedGroups = new Set<T>();
		const combinationPages = new Map<T, number>();
		let groupPage = 0;
		let groupedSnapshot: ConsecutiveGroup<T>[] = [];
		let matchingRows = 0;
		const container = document.createElement('div') as SortableTable;
		const wrapper =
			columnConfig?.toggleable || groupRows ? document.createElement('div') : container;
		wrapper.className = 'table-scroll-wrapper';
		const caption = table.createCaption();
		caption.className = 'sr-only';
		let disposed = false;
		const updateScrollAccess = () => {
			if (disposed) {
				return;
			}
			const overflowing = wrapper.scrollWidth > wrapper.clientWidth + 1;
			if (overflowing) {
				wrapper.tabIndex = 0;
				wrapper.setAttribute('role', 'region');
				wrapper.setAttribute('aria-label', translate(captionKey));
				wrapper.setAttribute('aria-description', translate('tableScrollHelp'));
			} else {
				for (const attribute of ['tabindex', 'role', 'aria-label', 'aria-description']) {
					wrapper.removeAttribute(attribute);
				}
			}
		};
		wrapper.addEventListener('keydown', event => {
			if (
				disposed ||
				event.target !== wrapper ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				wrapper.scrollWidth <= wrapper.clientWidth + 1 ||
				(event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
			) {
				return;
			}
			// Keep focused regions scrollable even when platform default key handling does nothing.
			event.preventDefault();
			wrapper.scrollLeft += event.key === 'ArrowLeft' ? -40 : 40;
		});
		const scrollObserver = new ResizeObserver(updateScrollAccess);
		let scrollFrame: number | undefined;
		container.dispose = () => {
			disposed = true;
			scrollObserver.disconnect();
			if (scrollFrame !== undefined) {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = undefined;
			}
			localeTables.delete(container);
			responsiveTables.delete(container);
		};
		let sorting = defaultSort;
		let invertSort = false;
		let rows: number;
		const headerKeys = Object.keys(headers);
		const nameColumn = headerKeys.findIndex(header => labelFromHeader(header) === 'Name');
		const iconColumns: number[] = [];
		const numericColumns: number[] = [];
		const manualHiddenColumns = new Set<number>();
		const toggleButtons: { button: HTMLButtonElement; index: number; label: string }[] = [];
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

		const effectiveHiddenColumns = () => {
			if (!autoMode) {
				return manualHiddenColumns;
			}
			return window.innerWidth <= 900 ? autoHiddenColumns : new Set<number>();
		};

		const applyColumnVisibility = () => {
			const hidden = effectiveHiddenColumns();
			const focusedCell = table.contains(document.activeElement)
				? document.activeElement?.closest<HTMLTableCellElement>('th, td')
				: null;
			for (const row of table.querySelectorAll('tr')) {
				if (
					row.classList.contains('table-empty-row') ||
					row.classList.contains('table-group-pager')
				) {
					(row.firstElementChild as HTMLTableCellElement).colSpan = Math.max(
						1,
						headerKeys.length - hidden.size,
					);
					continue;
				}
				for (let index = 0; index < row.children.length; index++) {
					row.children[index].classList.toggle('col-hidden', hidden.has(index));
				}
			}
			if (
				focusedCell &&
				!focusedCell.closest('.table-group-pager') &&
				hidden.has(focusedCell.cellIndex)
			) {
				const target =
					toggleButtons.find(({ index }) => index === focusedCell.cellIndex)?.button ??
					table.querySelector<HTMLButtonElement>('th:not(.col-hidden) button.table-sort');
				target?.focus();
			}
			updateScrollAccess();
		};

		const selectSort = (sortKey: TableSortKey<T>) => {
			if (disposed) {
				return;
			}
			invertSort = sorting === sortKey ? !invertSort : false;
			sorting = sortKey;
			expandedGroups.clear();
			combinationPages.clear();
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

		const paginationStatus = document.createElement('span');
		paginationStatus.className = 'sr-only';
		paginationStatus.setAttribute('role', 'status');
		const groupPagers = groupRows
			? [0, 1].map(position => {
					const pager = createTablePagination(translate, page => {
						const action = (document.activeElement as HTMLElement | null)?.dataset
							.tableAction;
						groupPage = page;
						renderTable(false, false);
						if (position === 1) {
							const top = groupPagers[0].element;
							const control = Array.from(
								top.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
									'button, input',
								),
							).find(control => control.dataset.tableAction === action);
							const target =
								control instanceof HTMLButtonElement && control.disabled
									? top.querySelector('input')
									: control;
							target?.focus({ preventScroll: true });
							top.scrollIntoView({ block: 'start' });
						}
						paginationStatus.textContent =
							pager.element.querySelector('.table-page-range')!.textContent;
					});
					pager.element.classList.add('table-group-pagination');
					return pager;
				})
			: [];

		const renderTable = (scrollHighlight = false, refreshSnapshot = true) => {
			if (disposed) {
				return;
			}
			caption.textContent = translate(captionKey);
			if (refreshSnapshot) {
				sortTableRows(dataset, sorting, { summaryRows, invert: invertSort });
				if (groupRows) {
					groupedSnapshot = groupConsecutiveRows(dataset, groupRows.key, filterCallback);
					matchingRows = groupedSnapshot.reduce(
						(sum, group) => sum + group.items.length,
						0,
					);
					groupPage = 0;
					const anchors = new Set(groupedSnapshot.map(group => group.item));
					for (const item of expandedGroups) {
						if (!anchors.has(item)) {
							expandedGroups.delete(item);
						}
					}
					for (const item of combinationPages.keys()) {
						if (!anchors.has(item)) {
							combinationPages.delete(item);
						}
					}
				}
			}
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
				(document.activeElement instanceof HTMLButtonElement ||
					document.activeElement instanceof HTMLInputElement) &&
				body.contains(document.activeElement)
					? document.activeElement
					: undefined;
			const focusedLink = focusedControl?.dataset.link;
			const focusedAction = focusedControl?.dataset.tableAction;
			const focusedRow = focusedControl?.closest('tr');
			const focusedItem = focusedRow ? rowItems.get(focusedRow) : undefined;
			const focusedIndex =
				focusedRow && focusedControl
					? Array.from(
							focusedRow.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
								'button, input',
							),
						)
							.filter(
								button =>
									button.dataset.link === focusedLink &&
									button.dataset.tableAction === focusedAction,
							)
							.indexOf(focusedControl)
					: -1;
			const restoredRows: HTMLTableRowElement[] = [];
			const content = document.createDocumentFragment();
			const highlightedRows: HTMLTableRowElement[] = [];
			rows = 0;
			const appendRow = (item: T, focusItem = item) => {
				const row = rowGenerator(item);
				row.children[nameColumn]?.classList.add('name-cell');
				rowItems.set(row, focusItem);
				if (focusItem === focusedItem) {
					restoredRows.push(row);
				}
				iconColumns.forEach(column => row.children[column]?.classList.add('icon-cell'));
				numericColumns.forEach(column =>
					row.children[column]?.classList.add('numeric-cell'),
				);
				if (highlightCallback?.(item, dataset)) {
					row.classList.add('highlighted');
					highlightedRows.push(row);
				}
				content.appendChild(row);
				rows++;
				return row;
			};
			const groupRange = pageRange(groupedSnapshot.length, groupPage, 25);
			groupPage = groupRange.page;
			if (groupRows) {
				for (let index = groupRange.start; index < groupRange.end; index++) {
					const group = groupedSnapshot[index];
					const expanded = expandedGroups.has(group.item);
					const range = pageRange(
						group.items.length,
						combinationPages.get(group.item) ?? 0,
						25,
					);
					combinationPages.set(group.item, range.page);
					const items = expanded
						? group.items.slice(range.start, range.end)
						: [group.item];
					const first = appendRow(items[0], group.item);
					first.classList.add('analysis-combination-row');
					first.id = `${tableId}-group-${index}-row-${expanded ? range.start : 0}`;
					const nameCell = first.children[nameColumn];
					if (group.items.length < 2 || !nameCell) {
						continue;
					}
					first.classList.add('table-group-start');
					const pagerRow = document.createElement('tr');
					pagerRow.className = 'table-group-pager';
					pagerRow.id = `${tableId}-group-${index}-pager`;
					pagerRow.hidden = !expanded;
					rowItems.set(pagerRow, group.item);
					if (group.item === focusedItem) {
						restoredRows.push(pagerRow);
					}
					const pager = createTablePagination(translate, page => {
						combinationPages.set(group.item, page);
						renderTable(false, false);
						const updated = pageRange(group.items.length, page, 25);
						paginationStatus.textContent = translate('paginationCombinationRange', {
							first: updated.start + 1,
							last: updated.end,
							total: group.items.length,
						});
					});
					pager.element.classList.add('table-combination-pagination');
					pager.update(
						range.page,
						range.pages,
						translate('paginationCombinations', { name: group.item.name ?? group.key }),
						translate('paginationCombinationRange', {
							first: range.start + 1,
							last: range.end,
							total: group.items.length,
						}),
					);
					pagerRow.insertCell().appendChild(pager.element);
					content.appendChild(pagerRow);
					const detailIds: string[] = [];
					for (let offset = 1; offset < items.length; offset++) {
						const row = appendRow(items[offset]);
						row.id = `${tableId}-group-${index}-row-${range.start + offset}`;
						row.classList.add('analysis-combination-row', 'table-group-detail');
						detailIds.push(row.id);
					}
					const toggle = document.createElement('button');
					toggle.type = 'button';
					toggle.className = 'table-group-toggle';
					toggle.dataset.tableAction = 'expand-group';
					toggle.dataset.count = String(group.items.length);
					toggle.setAttribute('aria-controls', [...detailIds, pagerRow.id].join(' '));
					toggle.setAttribute('aria-expanded', String(expanded));
					toggle.setAttribute(
						'aria-label',
						groupRows.toggleLabel(group.item, group.items.length, expanded),
					);
					if (groupRows.description) {
						toggle.setAttribute('aria-description', groupRows.description());
					}
					toggle.append(...nameCell.childNodes);
					nameCell.appendChild(toggle);
					toggle.addEventListener('click', () => {
						if (expandedGroups.has(group.item)) {
							expandedGroups.delete(group.item);
						} else {
							expandedGroups.add(group.item);
						}
						renderTable(false, false);
					});
				}
				const rangeText = translate('paginationGroupRange', {
					first: groupedSnapshot.length ? groupRange.start + 1 : 0,
					last: groupRange.end,
					total: groupedSnapshot.length,
				});
				for (const pager of groupPagers) {
					pager.element.hidden = groupedSnapshot.length === 0;
					pager.update(
						groupRange.page,
						groupRange.pages,
						translate('paginationGroups'),
						rangeText,
					);
				}
			} else {
				matchingRows = 0;
				for (const item of dataset) {
					if (maxRows && rows >= maxRows && !onRender) {
						break;
					}
					if (filterCallback && !filterCallback(item)) {
						continue;
					}
					matchingRows++;
					if (!maxRows || rows < maxRows) {
						appendRow(item);
					}
				}
			}
			if (!rows) {
				const row = document.createElement('tr');
				row.className = 'table-empty-row';
				const message = row.insertCell();
				message.textContent = emptyMessage();
				content.appendChild(row);
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
			onRender?.({
				shown: rows,
				total: matchingRows,
				...(groupRows
					? {
							groups: {
								first: groupedSnapshot.length ? groupRange.start + 1 : 0,
								last: groupRange.end,
								total: groupedSnapshot.length,
							},
						}
					: {}),
			});
			applyColumnVisibility();
			if (focusedLink !== undefined || focusedAction !== undefined) {
				const restored = restoredRows
					.flatMap(row =>
						Array.from(
							row.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
								'button, input',
							),
						),
					)
					.filter(
						control =>
							control.dataset.link === focusedLink &&
							control.dataset.tableAction === focusedAction,
					)[focusedIndex];
				if (
					restored instanceof HTMLInputElement &&
					focusedControl instanceof HTMLInputElement
				) {
					restored.value = focusedControl.value;
				}
				const target =
					restored instanceof HTMLButtonElement && restored.disabled
						? restored.closest('form')?.querySelector('input')
						: restored;
				target?.focus({ preventScroll: true });
			}

			const firstHighlight = highlightedRows[0];
			const lastHighlight = highlightedRows.at(-1);
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

		const update = (scrollHighlight = false, refreshSnapshot = true) => {
			if (disposed) {
				return;
			}
			if (scrollFrame !== undefined) {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = undefined;
			}
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;
			renderTable(scrollHighlight, refreshSnapshot);
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
		wrapper.appendChild(table);
		scrollObserver.observe(wrapper);
		scrollObserver.observe(table);
		const appendGroupPagers = () => {
			if (!groupRows) {
				return;
			}
			container.insertBefore(groupPagers[0].element, wrapper);
			container.append(groupPagers[1].element, paginationStatus);
		};

		if (!columnConfig?.toggleable) {
			if (groupRows) {
				container.appendChild(wrapper);
			}
			appendGroupPagers();
			container.update = update;
			container.updateLocale = () => update(false, false);
			container.setMaxRows = setMaxRows;
			localeTables.add(container);
			return container;
		}

		const toggleBar = document.createElement('div');
		toggleBar.className = 'column-toggle-bar';
		toggleBar.setAttribute('role', 'group');
		const label = document.createElement('span');
		label.className = 'col-toggle-label';
		toggleBar.appendChild(label);
		const autoButton = document.createElement('button');
		autoButton.type = 'button';
		toggleBar.appendChild(autoButton);

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
			toggleBar.setAttribute(
				'aria-label',
				`${translate('columns')}: ${translate(captionKey)}`,
			);
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
				if (autoMode) {
					// Begin manual control from the layout the user is currently seeing.
					const currentHidden = effectiveHiddenColumns();
					manualHiddenColumns.clear();
					for (const column of currentHidden) {
						manualHiddenColumns.add(column);
					}
					autoMode = false;
				}
				manualHiddenColumns.has(index)
					? manualHiddenColumns.delete(index)
					: manualHiddenColumns.add(index);
				applyColumnVisibility();
				updateToggleButtons();
			});
			toggleBar.appendChild(button);
			toggleButtons.push({ button, index, label });
		});
		updateLabels();
		updateToggleButtons();

		container.appendChild(toggleBar);
		container.appendChild(wrapper);
		appendGroupPagers();
		container.update = scrollHighlight => {
			update(scrollHighlight);
			applyColumnVisibility();
		};
		container.updateLocale = () => {
			update(false, false);
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
