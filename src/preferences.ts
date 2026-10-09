import { characters, gameVersions } from './constants.js';

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
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}
	const raw = value as Record<string, unknown>;
	const state: SavedState = {};
	for (const key of ['activeTab', 'version', 'baseMode'] as const) {
		if (typeof raw[key] === 'string') {
			state[key] = raw[key];
		}
	}
	if (typeof raw.character === 'string' || raw.character === null) {
		state.character = raw.character;
	}
	if (typeof raw.modeMask === 'number' || raw.modeMask === null) {
		state.modeMask = raw.modeMask;
	}
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

export interface GameSelection {
	version: string;
	dlc: Record<string, boolean>;
	character: string | null;
}

const legacyBaseModes: Record<string, Omit<GameSelection, 'character'>> = {
	vanilla: { version: 'dontstarve', dlc: { giants: false, shipwrecked: false } },
	giants: { version: 'dontstarve', dlc: { giants: true, shipwrecked: false } },
	shipwrecked: { version: 'dontstarve', dlc: { giants: true, shipwrecked: true } },
	hamlet: { version: 'hamlet', dlc: { giants: false, shipwrecked: false } },
	together: { version: 'together', dlc: { giants: false, shipwrecked: false } },
};

// These are persisted values from before version and character bits were split.
// Keep the historical numbers; the current constants use different bit assignments.
const legacyMasks: Record<number, { baseMode: string; character?: string }> = {
	1: { baseMode: 'vanilla' },
	3: { baseMode: 'giants' },
	7: { baseMode: 'shipwrecked' },
	8: { baseMode: 'together' },
	23: { baseMode: 'shipwrecked', character: 'warly' },
	39: { baseMode: 'hamlet' },
	119: { baseMode: 'hamlet', character: 'warly' },
	136: { baseMode: 'together', character: 'warly' },
};

/** Prefer the current format, then named modes, then the oldest numeric masks. */
export function restoreGameSelection(state: SavedState): GameSelection {
	const selection: GameSelection = {
		version: 'together',
		dlc: { giants: false, shipwrecked: false },
		character: null,
	};
	if (state.version && Object.hasOwn(gameVersions, state.version)) {
		selection.version = state.version;
		if (state.dlc) {
			selection.dlc = { ...state.dlc };
		}
	} else if (state.baseMode && Object.hasOwn(legacyBaseModes, state.baseMode)) {
		const legacy = legacyBaseModes[state.baseMode];
		selection.version = legacy.version;
		selection.dlc = { ...legacy.dlc };
	} else {
		if (typeof state.modeMask === 'number' && Object.hasOwn(legacyMasks, state.modeMask)) {
			const legacy = legacyMasks[state.modeMask];
			const base = legacyBaseModes[legacy.baseMode];
			selection.version = base.version;
			selection.dlc = { ...base.dlc };
			selection.character = legacy.character ?? null;
		}
		return selection;
	}
	if (state.character && Object.hasOwn(characters, state.character)) {
		selection.character = state.character;
	}
	return selection;
}

type StateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface SavedStateOptions {
	getStorage: () => StateStorage;
	onError?: (error: unknown) => void;
}
const storageKey = 'foodGuideState';

/** Centralize recovery and merge writes from the tabs and ingredient pickers. */
export function createSavedStateStore({ getStorage, onError }: SavedStateOptions) {
	const read = (storage: StateStorage): SavedState => {
		const text = storage.getItem(storageKey);
		if (!text) {
			return {};
		}
		try {
			return parseSavedState(text);
		} catch (error) {
			onError?.(error);
			storage.removeItem(storageKey);
			return {};
		}
	};
	return {
		load(): SavedState {
			try {
				return read(getStorage());
			} catch (error) {
				onError?.(error);
				return {};
			}
		},
		update(change: (state: SavedState) => void) {
			try {
				const storage = getStorage();
				const state = read(storage);
				change(state);
				storage.setItem(storageKey, JSON.stringify(state));
			} catch (error) {
				onError?.(error);
			}
		},
	};
}
