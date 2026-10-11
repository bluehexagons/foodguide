/** Keep the same controls in visual and keyboard order as the header changes size. */
export function createHeaderActions(documentRef: Document, narrowScreen: MediaQueryList) {
	const header = documentRef.querySelector('header')!;
	const title = documentRef.getElementById('site-title')!;
	const identity = documentRef.createElement('div');
	identity.className = 'header-identity';
	title.before(identity);
	identity.append(title);
	const actions = documentRef.createElement('div');
	actions.className = 'personal-toolbar';
	const navigation = header.querySelector('.tab-navigation')!;
	const placeActions = () => {
		const focused = documentRef.activeElement;
		const restoreFocus = focused instanceof HTMLElement && actions.contains(focused);
		if (narrowScreen.matches) {
			identity.append(actions);
		} else {
			navigation.insertBefore(actions, navigation.querySelector('.game-link'));
		}
		if (restoreFocus) {
			focused.focus({ preventScroll: true });
		}
	};
	narrowScreen.addEventListener('change', placeActions);
	placeActions();
	return actions;
}
