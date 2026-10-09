import type { FilterState } from './analysis-filters.js';
import { t } from './strings.js';
import { bindActivation } from './activation.js';

/** A compact filter toolbar: one Tab stop, native activation, and named three-state controls. */
export const createFilterControls = (container: HTMLElement, helpId: string) => {
	const controls: {
		button: HTMLButtonElement;
		icon: HTMLElement;
		name: string;
		state: FilterState;
	}[] = [];
	container.setAttribute('role', 'toolbar');
	container.setAttribute('aria-describedby', helpId);
	const setCurrent = (button: HTMLButtonElement) => {
		for (const control of controls) {
			control.button.tabIndex = control.button === button ? 0 : -1;
		}
	};
	const update = (button: HTMLButtonElement, state: FilterState) => {
		const control = controls.find(control => control.button === button)!;
		control.state = state;
		control.icon.classList.toggle('selected', state === 'required');
		control.icon.classList.toggle('excluded', state === 'excluded');
		button.setAttribute(
			'aria-label',
			t('filterLabel', {
				name: control.name,
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
		add(icon: HTMLElement, name: string, onCycle: (reverse: boolean) => void) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'analysis-filter';
			button.tabIndex = controls.length ? -1 : 0;
			icon.setAttribute('aria-hidden', 'true');
			button.appendChild(icon);
			const label = document.createElement('span');
			label.className = 'analysis-filter-name';
			label.textContent = name;
			label.setAttribute('aria-hidden', 'true');
			button.appendChild(label);
			controls.push({ button, icon, name, state: 'normal' });
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
				const buttons = Array.from(
					container.querySelectorAll<HTMLButtonElement>('.analysis-filter'),
				);
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
			for (const control of controls) {
				update(control.button, control.state);
			}
		},
	};
};
