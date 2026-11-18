import type { FilterState } from './analysis-filters.js';
import { itemName, t } from './strings.js';
import type { GuideItem } from './models.js';
import { matchesNameFragment } from './recipe-calculator.js';
import { bindActivation } from './activation.js';

/** A compact filter toolbar: one Tab stop, native activation, and named three-state controls. */
export const createFilterControls = (
	container: HTMLElement,
	helpId: string,
	kind: 'recipe' | 'ingredient',
) => {
	const heading = document.createElement('h3');
	heading.className = 'section-subheading';
	const search = document.createElement('input');
	search.type = 'search';
	const count = document.createElement('span');
	count.setAttribute('role', 'status');
	const searchRow = document.createElement('div');
	searchRow.className = 'reference-filter';
	searchRow.append(search, count);
	container.id = helpId + '-' + kind;
	search.setAttribute('aria-controls', container.id);

	const updateLabels = () => {
		const title = t(kind === 'recipe' ? 'filterRecipes' : 'filterIngredients');
		heading.textContent = title;
		container.setAttribute('aria-label', title);
		search.placeholder = t(kind === 'recipe' ? 'findRecipeFilter' : 'findIngredientFilter');
		search.setAttribute('aria-label', search.placeholder);
	};
	updateLabels();
	searchRow.hidden = true;
	const controls: {
		button: HTMLButtonElement;
		icon: HTMLElement;
		label: HTMLElement;
		item: GuideItem;
		state: FilterState;
	}[] = [];
	container.setAttribute('role', 'toolbar');
	container.setAttribute('aria-describedby', helpId);
	const setCurrent = (button: HTMLButtonElement) => {
		for (const control of controls) {
			control.button.tabIndex = control.button === button ? 0 : -1;
		}
	};
	const visibleButtons = () =>
		Array.from(container.querySelectorAll<HTMLButtonElement>('.analysis-filter:not([hidden])'));
	const applySearch = () => {
		const query = search.value.trim();
		for (const { button, item } of controls) {
			button.hidden = !!query && !matchesNameFragment(item, query);
		}
		const visible = visibleButtons();
		if (!visible.some(button => button.tabIndex === 0) && visible.length) {
			setCurrent(visible[0]);
		}
		container.classList.toggle('searching-filters', !!query);
		const summary = query ? t('referenceMatchCount', { count: visible.length }) : '';
		container.hidden = !!query && !visible.length;
		if (count.textContent !== summary) {
			count.textContent = summary;
		}
	};
	const clearSearch = () => {
		search.value = '';
		applySearch();
	};
	search.addEventListener('input', applySearch);
	search.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !event.isComposing && search.value) {
			event.preventDefault();
			clearSearch();
		}
	});
	const update = (button: HTMLButtonElement, state: FilterState) => {
		const control = controls.find(control => control.button === button)!;
		control.state = state;
		const name = itemName(control.item);
		control.label.textContent = name;
		control.icon.title = name;
		control.icon.classList.toggle('selected', state === 'required');
		control.icon.classList.toggle('excluded', state === 'excluded');
		button.setAttribute(
			'aria-label',
			t('filterLabel', {
				name,
				state: t(
					state === 'required'
						? 'filterRequired'
						: state === 'excluded'
							? 'filterExcluded'
							: 'filterNormal',
				),
			}),
		);
	};
	return {
		heading,
		searchRow,
		clearSearch,
		add(
			icon: HTMLElement,
			item: GuideItem,
			onCycle: (reverse: boolean) => void,
			index = controls.length,
		) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'analysis-filter';
			button.tabIndex = controls.length ? -1 : 0;
			icon.setAttribute('aria-hidden', 'true');
			button.appendChild(icon);
			const label = document.createElement('span');
			label.className = 'analysis-filter-name';
			label.setAttribute('aria-hidden', 'true');
			button.appendChild(label);
			controls.push({ button, icon, label, item, state: 'normal' });
			container.insertBefore(button, container.children.item(index));
			searchRow.hidden = controls.length <= 10;
			if (search.value) {
				applySearch();
			}
			button.addEventListener('focus', () => setCurrent(button));
			bindActivation(
				button,
				() => onCycle(false),
				() => onCycle(true),
			);
			button.addEventListener('keydown', event => {
				if (event.altKey || event.ctrlKey || event.metaKey) {
					return;
				}
				if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
					event.preventDefault();
					onCycle(true);
					return;
				}
				// Use DOM order, since recipes are inserted alphabetically as they arrive.
				const buttons = visibleButtons();
				const index = buttons.indexOf(button);
				let next;
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
					next = (index + 1) % buttons.length;
				} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
					next = (index + buttons.length - 1) % buttons.length;
				} else if (event.key === 'Home') {
					next = 0;
				} else if (event.key === 'End') {
					next = buttons.length - 1;
				}
				if (next !== undefined) {
					event.preventDefault();
					buttons[next].focus();
				}
			});
			update(button, 'normal');
			return button;
		},
		update,
		updateLocale() {
			updateLabels();
			for (const control of controls) {
				update(control.button, control.state);
			}
			applySearch();
		},
	};
};
