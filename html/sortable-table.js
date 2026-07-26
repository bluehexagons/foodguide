import { makeImage } from './utils.js';

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

const labelFromHeader = header => header.split(':')[0];
const isNumericHeader = header =>
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
}) => {
	const queueIcon = icon => {
		if (icon.dataset.src) {
			makeImage.queue(icon, icon.dataset.src);
		}
	};

	const cells = (cellType, ...values) => {
		const row = document.createElement('tr');

		for (const cell of values) {
			const td = document.createElement(cellType);
			const text = cell && cell.indexOf ? cell : cell.toString();

			if (cell instanceof DocumentFragment) {
				td.appendChild(cell.cloneNode(true));
				Array.prototype.forEach.call(td.querySelectorAll('.icon'), queueIcon);
			} else if (text.startsWith('img/')) {
				const [url, title = text] = text.split(':');
				const image = makeImage(url);
				image.title = title;
				td.appendChild(image);
			} else if (cell && cell.nodeType === 1) {
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

	const fandomHref = name => {
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

	const makeSortableTable = (
		headers,
		dataset,
		rowGenerator,
		defaultSort,
		hasSummary,
		linkCallback,
		highlightCallback,
		filterCallback,
		_startRow,
		maxRows,
		columnConfig,
	) => {
		let table;
		let sorting;
		let invertSort = false;
		/** @type {HTMLElement | null} */
		let firstHighlight = null;
		/** @type {HTMLElement | null} */
		let lastHighlight = null;
		let rows;
		const headerKeys = Object.keys(headers);
		const iconColumns = [];
		const numericColumns = [];
		const hiddenColumns = new Set();
		let autoMode = true;
		let autoHiddenColumns = new Set();

		headerKeys.forEach((header, index) => {
			const label = labelFromHeader(header);
			if (!label || label === 'Mode') {
				iconColumns.push(index);
			}
			if (isNumericHeader(label)) {
				numericColumns.push(index);
			}
		});

		const setAutoHiddenColumns = labels => {
			autoHiddenColumns = new Set(
				headerKeys
					.map((header, index) => [labelFromHeader(header), index])
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

		const sortDataset = (sortBy, shouldToggle) => {
			let summary;
			if (hasSummary) {
				summary = [dataset.shift(), dataset.shift()];
			}

			if (sortBy === 'name') {
				dataset.sort((a, b) => {
					const aname = a.basename || a.name;
					const bname = b.basename || b.name;
					if (aname !== bname) {
						return aname > bname ? 1 : -1;
					}
					return a.name === b.name ? 0 : a.raw === b ? 1 : -1;
				});
			} else {
				dataset.sort((a, b) => {
					const left = a[sortBy];
					const right = b[sortBy];
					return !isNaN(left) && !isNaN(right)
						? right - left
						: isNaN(left) && isNaN(right)
							? 0
							: isNaN(left)
								? 1
								: -1;
				});
			}

			if (shouldToggle) {
				if (sorting === sortBy) {
					invertSort = !invertSort;
				} else {
					sorting = sortBy;
					invertSort = false;
				}
			}
			if (invertSort) {
				dataset.reverse();
			}
			if (hasSummary) {
				dataset.unshift(...summary);
			}
		};

		const create = (event, explicitSort, scrollHighlight) => {
			const sortBy = explicitSort || event?.target.dataset.sort || sorting;
			if (sortBy) {
				sortDataset(sortBy, Boolean(explicitSort || event));
			}

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
				if (headers[header]) {
					if (headers[header] === sorting) {
						th.classList.add(invertSort ? 'sort-desc' : 'sort-asc');
					}
					th.style.cursor = 'pointer';
					th.dataset.sort = headers[header];
					th.addEventListener('click', create, false);
				}
				headerRow.appendChild(th);
			}

			const oldTable = table;
			table = document.createElement('table');
			table.appendChild(headerRow);
			firstHighlight = null;
			lastHighlight = null;
			rows = 0;

			dataset.forEach((item, index, items) => {
				if ((maxRows && rows >= maxRows) || (filterCallback && !filterCallback(item))) {
					return;
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
			});

			if (linkCallback) {
				table.className = 'links';
				Array.prototype.forEach.call(table.getElementsByClassName('link'), link =>
					link.addEventListener('click', linkCallback, false),
				);
			}
			applyColumnVisibility();
			if (oldTable) {
				oldTable.parentNode.replaceChild(table, oldTable);
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

		create(null, defaultSort);

		const update = scrollHighlight => {
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;
			create(null, null, scrollHighlight);
			requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
		};
		const setMaxRows = max => {
			maxRows = max;
			update();
		};

		if (!columnConfig?.toggleable) {
			const wrapper = /** @type {any} */ (document.createElement('div'));
			wrapper.className = 'table-scroll-wrapper';
			wrapper.appendChild(table);
			wrapper.update = (...args) => update(...args);
			wrapper.updateLocale = () => update();
			wrapper.setMaxRows = (...args) => setMaxRows(...args);
			localeTables.add(wrapper);
			return wrapper;
		}

		const container = /** @type {any} */ (document.createElement('div'));
		const toggleBar = document.createElement('div');
		toggleBar.className = 'column-toggle-bar';
		const label = document.createElement('span');
		label.className = 'col-toggle-label';
		toggleBar.appendChild(label);
		const autoButton = document.createElement('button');
		toggleBar.appendChild(autoButton);
		const toggleButtons = [];

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
