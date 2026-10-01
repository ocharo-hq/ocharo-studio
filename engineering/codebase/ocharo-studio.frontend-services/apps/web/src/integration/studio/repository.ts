import { cloneDocument, migrateDocument } from "../../domain/studio/document";
import { migrateMaterialScales } from "../../domain/studio/materials";
import type {
  DesignDocument,
  MaterialScaleLibrary,
  SavedLook,
} from "../../domain/studio/types";
import { createLocalJsonStorage, type JsonStorage } from "./storage";

const DRAFT_KEY = "ocharo-studio:studio:draft";
const LOOKS_KEY = "ocharo-studio:studio:saved-looks";
const LEGACY_DRAFT_KEY = "uzbek-studio:studio:draft";
const LEGACY_LOOKS_KEY = "uzbek-studio:studio:saved-looks";
const RECOVERY_KEY = "ocharo-studio:studio:recovery";

export interface StudioRecovery {
  workspaceId?: string;
  revision: number;
  pending: boolean;
  draft: DesignDocument | null;
  looks: readonly SavedLook[];
  materials: MaterialScaleLibrary;
  settings: Record<string, unknown>;
}

export interface StudioRepository {
  readRecovery(): StudioRecovery | undefined;
  writeRecovery(snapshot: StudioRecovery): boolean;
  readDraft(): DesignDocument | undefined;
  writeDraft(document: DesignDocument): boolean;
  readLooks(): ReadonlyArray<SavedLook>;
  writeLooks(looks: ReadonlyArray<SavedLook>): boolean;
}

export function migrateRecovery(value: unknown): StudioRecovery | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const raw = value as Record<string, unknown>;
  const draft = raw.draft === null ? null : migrateDocument(raw.draft);
  const looks = migrateLooks(raw.looks);
  const materials = migrateMaterialScales(raw.materials);
  if (
    raw.schemaVersion !== 1 ||
    (raw.workspaceId !== undefined &&
      (typeof raw.workspaceId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          raw.workspaceId,
        ))) ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.revision as number) < 0 ||
    typeof raw.pending !== "boolean" ||
    draft === undefined ||
    !looks ||
    !materials ||
    !raw.settings ||
    typeof raw.settings !== "object" ||
    Array.isArray(raw.settings)
  )
    return undefined;
  return {
    ...(typeof raw.workspaceId === "string"
      ? { workspaceId: raw.workspaceId }
      : {}),
    revision: raw.revision as number,
    pending: raw.pending,
    draft,
    looks,
    materials,
    settings: { ...raw.settings },
  };
}

export function migrateLooks(value: unknown): SavedLook[] | undefined {
  if (!Array.isArray(value) || value.length > 100) return undefined;
  const looks: SavedLook[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const document = migrateDocument(item.document);
    if (
      !document ||
      (item.thumbnail !== undefined && typeof item.thumbnail !== "string")
    )
      return undefined;
    looks.push({
      document,
      ...(item.thumbnail === undefined ? {} : { thumbnail: item.thumbnail }),
    });
  }
  return looks;
}

/** A tab retains its own recovery copy across reloads, even when another tab saves. */
export function studioCacheKey(key: string): string {
  if (typeof window === "undefined") return key;
  try {
    let id = window.sessionStorage.getItem("ocharo-studio:tab");
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem("ocharo-studio:tab", id);
    }
    return `${key}:${id}`;
  } catch {
    return key;
  }
}

/** Browser cache also preserves the original keys as a recovery copy during the Ocharo migration. */
export function createStudioRepository(
  storage: JsonStorage = createLocalJsonStorage(),
): StudioRepository {
  const draftKey = studioCacheKey(DRAFT_KEY),
    looksKey = studioCacheKey(LOOKS_KEY),
    recoveryKey = studioCacheKey(RECOVERY_KEY);
  function readRecovery(): StudioRecovery | undefined {
    const raw = storage.read<unknown>(recoveryKey);
    if (raw === undefined || raw === null) return undefined;
    const result = migrateRecovery(raw);
    if (!result)
      throw new Error(
        "The browser recovery copy is invalid. It has been preserved; reconnect to restore saved studio data.",
      );
    return result;
  }
  return {
    readRecovery,
    writeRecovery(snapshot) {
      const value = migrateRecovery({ schemaVersion: 1, ...snapshot });
      return value
        ? storage.write(recoveryKey, { schemaVersion: 1, ...value })
        : false;
    },
    readDraft() {
      const recovery = readRecovery();
      if (recovery) return recovery.draft ?? undefined;
      return [draftKey, DRAFT_KEY, LEGACY_DRAFT_KEY].reduce<
        DesignDocument | undefined
      >(
        (result, key) =>
          result ??
          migrateDocument(storage.read<{ document?: unknown }>(key)?.document),
        undefined,
      );
    },
    writeDraft(document) {
      return storage.write(draftKey, {
        schemaVersion: 2,
        document: cloneDocument(document),
      });
    },
    readLooks() {
      const recovery = readRecovery();
      if (recovery) return recovery.looks;
      return (
        [looksKey, LOOKS_KEY, LEGACY_LOOKS_KEY].reduce<SavedLook[] | undefined>(
          (result, key) =>
            result ??
            migrateLooks(storage.read<{ looks?: unknown }>(key)?.looks),
          undefined,
        ) ?? []
      );
    },
    writeLooks(looks) {
      return storage.write(looksKey, { schemaVersion: 2, looks });
    },
  };
}
