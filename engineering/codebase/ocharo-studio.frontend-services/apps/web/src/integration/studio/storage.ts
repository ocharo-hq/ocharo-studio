import {
  localStorageStorageBroker,
  memoryStorageBroker,
  type StorageBroker,
} from "@wow-two-beta/ui-vue/foundation/storage";

export type JsonStorage = StorageBroker;

export function createLocalJsonStorage(): JsonStorage {
  return localStorageStorageBroker;
}

export function createMemoryJsonStorage(
  initial: Readonly<Record<string, unknown>> = {},
): JsonStorage {
  const broker = memoryStorageBroker();
  for (const [key, value] of Object.entries(initial)) broker.write(key, value);
  return broker;
}
