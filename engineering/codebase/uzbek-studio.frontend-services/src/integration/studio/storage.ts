export interface JsonStorage {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): boolean;
  remove(key: string): boolean;
}

export function createLocalJsonStorage(): JsonStorage {
  return {
    read<T>(key: string): T | null {
      try {
        const value = globalThis.localStorage?.getItem(key);
        return value === null || value === undefined
          ? null
          : (JSON.parse(value) as T);
      } catch {
        return null;
      }
    },
    write<T>(key: string, value: T): boolean {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
        return globalThis.localStorage !== undefined;
      } catch {
        return false;
      }
    },
    remove(key: string): boolean {
      try {
        globalThis.localStorage?.removeItem(key);
        return globalThis.localStorage !== undefined;
      } catch {
        return false;
      }
    },
  };
}

export function createMemoryJsonStorage(
  initial: Readonly<Record<string, unknown>> = {},
): JsonStorage {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    read<T>(key: string): T | null {
      const value = values.get(key);
      if (value === undefined) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    write<T>(key: string, value: T): boolean {
      try {
        values.set(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key: string): boolean {
      values.delete(key);
      return true;
    },
  };
}
