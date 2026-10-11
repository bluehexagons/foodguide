/** Use release-time clicks for primary actions, and reserve secondary actions for mouse/keyboard. */
export const bindActivation = (
	element: HTMLElement,
	activate: (event: MouseEvent) => void,
	secondaryActivate: (event: MouseEvent) => void,
) => {
	let pointerType = '';
	let touchContextMenu = false;
	element.addEventListener('pointerdown', event => {
		pointerType = event.pointerType;
		touchContextMenu = false;
	});
	element.addEventListener('keydown', () => {
		pointerType = '';
		touchContextMenu = false;
	});
	element.addEventListener('click', event => {
		// Keyboard and assistive-technology clicks (detail 0) need no preceding pointer event.
		const suppress = touchContextMenu && event.detail > 0;
		touchContextMenu = false;
		if (suppress) {
			event.preventDefault();
			return;
		}
		activate(event);
	});
	element.addEventListener('contextmenu', event => {
		event.preventDefault();
		// Some browsers expose contextmenu as a MouseEvent, so retain the initiating pointer type.
		if (pointerType === 'touch' || ('pointerType' in event && event.pointerType === 'touch')) {
			touchContextMenu = true;
			return;
		}
		secondaryActivate(event);
	});
};
