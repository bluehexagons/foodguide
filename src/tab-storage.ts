type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Each tab keeps its own work, while durable storage seeds newly opened tabs. */
export function createTabStorage(getSession: StorageAccess, getDefaults: StorageAccess) {
	const values = new Map<string, string | null>();
	const read = (getStorage: StorageAccess, key: string) => {
		try {
			return getStorage().getItem(key);
		} catch {
			return null;
		}
	};
	return {
		getItem(key: string) {
			if (!values.has(key)) {
				const value = read(getSession, key) ?? read(getDefaults, key);
				values.set(key, value);
				if (value !== null) {
					try {
						getSession().setItem(key, value);
					} catch {
						// The in-memory snapshot still isolates work when storage is blocked.
					}
				}
			}
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			values.set(key, value);
			for (const getStorage of [getSession, getDefaults]) {
				try {
					getStorage().setItem(key, value);
				} catch {
					// Failure in one store must not prevent recovery from the other.
				}
			}
		},
		removeItem(key: string) {
			values.set(key, null);
			for (const getStorage of [getSession, getDefaults]) {
				try {
					getStorage().removeItem(key);
				} catch {
					// Clearing corrupt preferences must not block initialization.
				}
			}
		},
	};
}
