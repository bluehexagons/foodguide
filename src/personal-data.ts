import { characters, gameVersions } from './constants.js';
import { isCharacterApplicable } from './mode-utils.js';
import type { GameSelection } from './preferences.js';

export interface Inventory {
	id: string;
	name: string;
	ingredients: string[];
}
export interface CookbookDish extends Inventory {
	selection: GameSelection;
}
export interface PersonalData {
	format: 'foodguide-personal-data';
	version: 1;
	inventories: Inventory[];
	dishes: CookbookDish[];
}
export const personalDataKey = 'foodGuidePersonalData';
export const maxPersonalDataBytes = 2_000_000;
export const emptyPersonalData = (): PersonalData => ({
	format: 'foodguide-personal-data',
	version: 1,
	inventories: [],
	dishes: [],
});

/** Reject an entire invalid import before changing any saved records. */
export function parsePersonalData(
	text: string,
	validIngredient: (id: string) => boolean,
	validDish: (dish: CookbookDish) => boolean = () => true,
): PersonalData {
	if (
		text.length > maxPersonalDataBytes ||
		new TextEncoder().encode(text).byteLength > maxPersonalDataBytes
	) {
		throw new Error('Data is too large');
	}
	const raw: unknown = JSON.parse(text);
	if (!raw || typeof raw !== 'object') {
		throw new Error('Invalid data');
	}
	const data = raw as Record<string, unknown>;
	if (data.format !== 'foodguide-personal-data' || data.version !== 1) {
		throw new Error('Unsupported format');
	}
	const ids = new Set<string>();
	const records = (value: unknown, limit: number, dish: boolean) => {
		if (!Array.isArray(value) || value.length > limit) {
			throw new Error('Invalid records');
		}
		return value.map((record: unknown) => {
			if (!record || typeof record !== 'object') {
				throw new Error('Invalid record');
			}
			const entry = record as Record<string, unknown>;
			if (
				typeof entry.id !== 'string' ||
				!/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id) ||
				ids.has(entry.id)
			) {
				throw new Error('Invalid ID');
			}
			ids.add(entry.id);
			if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 150) {
				throw new Error('Invalid name');
			}
			if (
				!Array.isArray(entry.ingredients) ||
				entry.ingredients.length > (dish ? 4 : 1024) ||
				(dish && entry.ingredients.length !== 4)
			) {
				throw new Error('Invalid ingredients');
			}
			const ingredients = entry.ingredients.map((id: unknown) => {
				if (typeof id !== 'string' || id.length > 100 || !validIngredient(id)) {
					throw new Error('Unknown ingredient');
				}
				return id;
			});
			const result: Inventory = {
				id: entry.id,
				name: entry.name.trim(),
				ingredients: dish ? ingredients : [...new Set(ingredients)],
			};
			if (!dish) {
				return result;
			}
			if (!entry.selection || typeof entry.selection !== 'object') {
				throw new Error('Invalid game');
			}
			const selection = entry.selection as Record<string, unknown>;
			if (
				typeof selection.version !== 'string' ||
				!Object.hasOwn(gameVersions, selection.version)
			) {
				throw new Error('Unknown game');
			}
			const dlc = selection.dlc as Record<string, unknown> | undefined;
			if (!dlc || typeof dlc.giants !== 'boolean' || typeof dlc.shipwrecked !== 'boolean') {
				throw new Error('Invalid DLC');
			}
			const character = selection.character;
			if (
				character !== null &&
				(typeof character !== 'string' ||
					!Object.hasOwn(characters, character) ||
					!isCharacterApplicable(
						character,
						selection.version,
						dlc as Record<string, boolean>,
						characters,
					))
			) {
				throw new Error('Unknown character');
			}
			const savedDish = {
				...result,
				selection: {
					version: selection.version,
					dlc: { giants: dlc.giants, shipwrecked: dlc.shipwrecked },
					character,
				},
			} as CookbookDish;
			if (!validDish(savedDish)) {
				throw new Error('Ingredients are unavailable for this dish');
			}
			return savedDish;
		});
	};
	return {
		format: 'foodguide-personal-data',
		version: 1,
		inventories: records(data.inventories, 200, false),
		dishes: records(data.dishes, 2000, true) as CookbookDish[],
	};
}

type DataStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Change = (data: PersonalData) => void;
interface StoreOptions {
	getStorage: () => DataStorage;
	validIngredient: (id: string) => boolean;
	validDish?: (dish: CookbookDish) => boolean;
	withLock?: (change: () => Promise<void>) => Promise<void>;
	onError?: (reason?: 'limit' | 'storage') => void;
}

/** Serialize read/modify/write with a Web Lock, including across tabs/windows.
 * Mutations apply deltas to the latest saved data; a stale view never replaces it.
 * Pending deltas also overlay incoming storage events so edits cannot flicker away.
 */
export function createPersonalDataStore({
	getStorage,
	validIngredient,
	validDish,
	withLock,
	onError,
}: StoreOptions) {
	let memory = emptyPersonalData();
	const listeners = new Set<() => void>();
	const pending: Change[] = [];
	let queue = Promise.resolve();
	let storageFailed = false;
	const read = () => {
		if (storageFailed) {
			return structuredClone(memory);
		}
		try {
			const text = getStorage().getItem(personalDataKey);
			return text ? parsePersonalData(text, validIngredient, validDish) : emptyPersonalData();
		} catch {
			storageFailed = true;
			onError?.();
			return structuredClone(memory);
		}
	};
	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};
	memory = read();
	const refresh = () => {
		memory = read();
		for (const change of pending) {
			change(memory);
		}
		notify();
	};
	const update = (change: Change) => {
		const preview = structuredClone(memory);
		change(preview);
		try {
			parsePersonalData(JSON.stringify(preview), validIngredient, validDish);
		} catch {
			onError?.('limit');
			return Promise.resolve(false);
		}
		pending.push(change);
		memory = preview;
		notify();
		let applied = true;
		const commit = async () => {
			const latest = read();
			change(latest);
			const text = JSON.stringify(latest);
			try {
				parsePersonalData(text, validIngredient, validDish);
			} catch {
				// Another tab can fill the remaining capacity while this edit waits.
				// Keep its valid data and reject our edit rather than retaining an invalid backup.
				applied = false;
				pending.shift();
				memory = read();
				for (const next of pending) {
					next(memory);
				}
				onError?.('limit');
				notify();
				return;
			}
			try {
				if (storageFailed) {
					throw new Error('Storage is unavailable');
				}
				getStorage().setItem(personalDataKey, text);
			} catch {
				storageFailed = true;
				onError?.();
			}
			pending.shift();
			memory = latest;
			for (const next of pending) {
				next(memory);
			}
			notify();
		};
		queue = queue
			.then(() => (withLock ? withLock(commit) : commit()))
			.catch(() => {
				applied = false;
				storageFailed = true;
				pending.shift();
				onError?.();
				notify();
			});
		return queue.then(() => applied);
	};
	return {
		get: () => structuredClone(memory),
		refresh,
		update,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		settled: () => queue,
	};
}
export type PersonalDataStore = ReturnType<typeof createPersonalDataStore>;

/** Apply only the user's additions/removals, preserving concurrent and hidden items. */
export function editInventory(data: PersonalData, id: string, added: string[], removed: string[]) {
	const inventory = data.inventories.find(item => item.id === id);
	if (inventory) {
		inventory.ingredients = [
			...new Set([
				...inventory.ingredients.filter(item => !removed.includes(item)),
				...added,
			]),
		];
	}
}
