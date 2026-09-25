import { getGarment, getMaterial } from "./catalog";
import type {
  DesignDocument,
  GarmentId,
  PartAssignment,
  PartId,
  SavedLook,
  TexturePlacement,
} from "./types";

const MAX_NAME_LENGTH = 80;
const MAX_ROTATION = 180;
const MAX_OFFSET = 1;
const DOCUMENT_KEYS = [
  "assetVersion",
  "createdAt",
  "garmentId",
  "id",
  "name",
  "parts",
  "schemaVersion",
  "updatedAt",
];
const ASSIGNMENT_KEYS = ["materialId", "placement"];
const PLACEMENT_KEYS = ["offsetX", "offsetY", "rotation"];
const SAVED_LOOK_KEYS = ["document", "thumbnail"];

export const DEFAULT_PLACEMENT: TexturePlacement = {
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

export function createDesignDocument(
  garmentId: GarmentId = "nimcha",
  now = new Date().toISOString(),
): DesignDocument {
  return {
    schemaVersion: 1,
    assetVersion: 1,
    id: createId(),
    name: "Untitled look",
    garmentId,
    parts: createDefaultAssignments(garmentId),
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultAssignments(
  garmentId: GarmentId,
): Partial<Record<PartId, PartAssignment>> {
  const garment = getGarment(garmentId);
  const parts: Partial<Record<PartId, PartAssignment>> = {};

  for (const part of garment.parts) {
    parts[part.id] = {
      materialId: part.defaultMaterialId,
      placement: { ...DEFAULT_PLACEMENT },
    };
  }

  return parts;
}

export function cloneDocument(document: DesignDocument): DesignDocument {
  return {
    ...document,
    parts: Object.fromEntries(
      Object.entries(document.parts).map(([partId, assignment]) => [
        partId,
        assignment === undefined
          ? undefined
          : {
              materialId: assignment.materialId,
              placement: { ...assignment.placement },
            },
      ]),
    ),
  };
}

export function copyDesignDocument(
  document: DesignDocument,
  now = new Date().toISOString(),
): DesignDocument {
  return {
    ...cloneDocument(document),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeDocument(document: DesignDocument): string {
  return JSON.stringify(document, undefined, 2);
}

export function parseDocument(json: string): DesignDocument | undefined {
  try {
    const value: unknown = JSON.parse(json);
    return isDesignDocument(value) ? cloneDocument(value) : undefined;
  } catch {
    return undefined;
  }
}

export function isDesignDocument(value: unknown): value is DesignDocument {
  if (!isRecord(value) || !hasExactKeys(value, DOCUMENT_KEYS)) {
    return false;
  }

  if (
    value.schemaVersion !== 1 ||
    value.assetVersion !== 1 ||
    !isId(value.id) ||
    !isName(value.name) ||
    !isIsoDate(value.createdAt) ||
    !isIsoDate(value.updatedAt) ||
    typeof value.garmentId !== "string" ||
    !isRecord(value.parts)
  ) {
    return false;
  }

  const garment = getGarmentIfKnown(value.garmentId);
  if (garment === undefined) {
    return false;
  }

  const parts = value.parts as Record<string, unknown>;
  const validPartIds = new Set(garment.parts.map((part) => part.id));
  const assignments = Object.entries(parts);
  if (
    assignments.length !== garment.parts.length ||
    assignments.some(([partId]) => !validPartIds.has(partId as PartId)) ||
    garment.parts.some((part) => !Object.hasOwn(parts, part.id))
  ) {
    return false;
  }

  return assignments.every(([, assignment]) => isPartAssignment(assignment));
}

export function isSavedLook(value: unknown): value is SavedLook {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => SAVED_LOOK_KEYS.includes(key)) &&
    Object.hasOwn(value, "document") &&
    isDesignDocument(value.document) &&
    (value.thumbnail === undefined || typeof value.thumbnail === "string")
  );
}

export function isSavedLookCollection(
  value: unknown,
): value is ReadonlyArray<SavedLook> {
  return Array.isArray(value) && value.every(isSavedLook);
}

export function normalizeName(name: string): string | undefined {
  const normalized = name.trim();
  return normalized.length > 0 && normalized.length <= MAX_NAME_LENGTH
    ? normalized
    : undefined;
}

export function clampPlacement(placement: TexturePlacement): TexturePlacement {
  return {
    rotation: clamp(placement.rotation, -MAX_ROTATION, MAX_ROTATION),
    offsetX: clamp(placement.offsetX, -MAX_OFFSET, MAX_OFFSET),
    offsetY: clamp(placement.offsetY, -MAX_OFFSET, MAX_OFFSET),
  };
}

function isPartAssignment(value: unknown): value is PartAssignment {
  return (
    isRecord(value) &&
    hasExactKeys(value, ASSIGNMENT_KEYS) &&
    typeof value.materialId === "string" &&
    getMaterialIfKnown(value.materialId) &&
    isPlacement(value.placement)
  );
}

function isPlacement(value: unknown): value is TexturePlacement {
  return (
    isRecord(value) &&
    hasExactKeys(value, PLACEMENT_KEYS) &&
    isBoundedNumber(value.rotation, MAX_ROTATION) &&
    isBoundedNumber(value.offsetX, MAX_OFFSET) &&
    isBoundedNumber(value.offsetY, MAX_OFFSET)
  );
}

function getGarmentIfKnown(id: string) {
  try {
    return getGarment(id as GarmentId);
  } catch {
    return undefined;
  }
}

function getMaterialIfKnown(id: string): boolean {
  try {
    return getMaterial(id) !== undefined;
  } catch {
    return false;
  }
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

function isBoundedNumber(value: unknown, limit: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  );
}

function isName(value: unknown): value is string {
  return typeof value === "string" && normalizeName(value) === value;
}

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isIsoDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}
