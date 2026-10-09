import type { CalculatorRow, Food } from '../../html/models.js';
import type { TableOptions } from '../../html/sortable-table.js';

const foods: TableOptions<Food> = {
	headers: { Name: 'name', Health: 'health', Info: '' },
	dataset: [],
	rowGenerator: item => {
		const row = document.createElement('tr');
		row.textContent = item.name;
		return row;
	},
	defaultSort: 'health',
};

const cooking: TableOptions<CalculatorRow> = {
	headers: { Name: 'name', Mode: 'modeMask', Priority: 'priority' },
	dataset: [],
	rowGenerator: () => document.createElement('tr'),
	defaultSort: 'priority',
	summaryRows: 2,
};

const invalidHeader: TableOptions<Food> = {
	...foods,
	// @ts-expect-error Unknown row properties must not silently become unsortable columns.
	headers: { Health: 'helth' },
};
const invalidDefault: TableOptions<Food> = {
	...foods,
	// @ts-expect-error Default sorting must refer to a property of the dataset.
	defaultSort: 'missing',
};
void cooking;
void invalidHeader;
void invalidDefault;
