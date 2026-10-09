/** Saved state is untrusted JSON, including state from older guide versions. */
export interface SavedState {
	activeTab?: string;
	version?: string;
	character?: string | null;
	baseMode?: string;
	modeMask?: number | null;
	dlc?: { giants: boolean; shipwrecked: boolean };
	pickers?: (string | null)[][];
}
export function parseSavedState(text: string): SavedState {
	const value: unknown = JSON.parse(text);
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const raw = value as Record<string, unknown>;
	const state: SavedState = {};
	for (const key of ['activeTab', 'version', 'baseMode'] as const) {
		if (typeof raw[key] === 'string') state[key] = raw[key];
	}
	if (typeof raw.character === 'string' || raw.character === null)
		state.character = raw.character;
	if (typeof raw.modeMask === 'number' || raw.modeMask === null) state.modeMask = raw.modeMask;
	if (raw.dlc && typeof raw.dlc === 'object') {
		const dlc = raw.dlc as Record<string, unknown>;
		state.dlc = { giants: dlc.giants === true, shipwrecked: dlc.shipwrecked === true };
	}
	if (Array.isArray(raw.pickers)) {
		state.pickers = raw.pickers.map(picker =>
			Array.isArray(picker) ? picker.map(id => (typeof id === 'string' ? id : null)) : [],
		);
	}
	return state;
}
