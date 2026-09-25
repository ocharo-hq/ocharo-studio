import {
  cloneDocument,
  isDesignDocument,
  isSavedLookCollection,
} from "../../domain/studio/document";
import type { DesignDocument, SavedLook } from "../../domain/studio/types";
import { createLocalJsonStorage, type JsonStorage } from "./storage";

const DRAFT_KEY = "uzbek-studio:studio:draft";
const LOOKS_KEY = "uzbek-studio:studio:saved-looks";

interface StoredDraft {
  schemaVersion: 1;
  document: DesignDocument;
}

interface StoredLooks {
  schemaVersion: 1;
  looks: ReadonlyArray<SavedLook>;
}

export interface StudioRepository {
  readDraft(): DesignDocument | undefined;
  writeDraft(document: DesignDocument): boolean;
  readLooks(): ReadonlyArray<SavedLook>;
  writeLooks(looks: ReadonlyArray<SavedLook>): boolean;
}

export function createStudioRepository(
  storage: JsonStorage = createLocalJsonStorage(),
): StudioRepository {
  return {
    readDraft(): DesignDocument | undefined {
      const stored = storage.read<unknown>(DRAFT_KEY);
      return isStoredDraft(stored) ? cloneDocument(stored.document) : undefined;
    },
    writeDraft(document: DesignDocument): boolean {
      return storage.write<StoredDraft>(DRAFT_KEY, {
        schemaVersion: 1,
        document: cloneDocument(document),
      });
    },
    readLooks(): ReadonlyArray<SavedLook> {
      const stored = storage.read<unknown>(LOOKS_KEY);
      return isStoredLooks(stored) ? stored.looks : [];
    },
    writeLooks(looks: ReadonlyArray<SavedLook>): boolean {
      return storage.write<StoredLooks>(LOOKS_KEY, {
        schemaVersion: 1,
        looks,
      });
    },
  };
}

function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["document", "schemaVersion"]) &&
    value.schemaVersion === 1 &&
    isDesignDocument(value.document)
  );
}

function isStoredLooks(value: unknown): value is StoredLooks {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["looks", "schemaVersion"]) &&
    value.schemaVersion === 1 &&
    isSavedLookCollection(value.looks)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: ReadonlyArray<string>,
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
