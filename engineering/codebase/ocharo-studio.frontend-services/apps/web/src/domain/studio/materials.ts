import { MATERIALS } from "./catalog";
import type { DesignDocument, MaterialScaleLibrary, SavedLook } from "./types";

const MATERIAL_IDS = new Set(MATERIALS.map((material) => material.id));

export interface MaterialUseCount {
  draftParts: number;
  savedParts: number;
  savedLooks: number;
  total: number;
}

export function isMaterialScale(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.25 &&
    value <= 4
  );
}

/** Missing libraries are legacy snapshots; malformed libraries must not become empty ones. */
export function migrateMaterialScales(
  value: unknown,
): MaterialScaleLibrary | undefined {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const entries = Object.entries(value);
  const result: Record<string, MaterialScaleLibrary[string]> = {};
  for (const [id, raw] of entries) {
    if (
      !MATERIAL_IDS.has(id) ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      return undefined;
    const entry = raw as Record<string, unknown>;
    if (
      Object.keys(entry).sort().join(",") !== "revision,scale,updatedAt" ||
      !isMaterialScale(entry.scale) ||
      !Number.isSafeInteger(entry.revision) ||
      (entry.revision as number) < 1 ||
      !isMaterialScaleDate(entry.updatedAt)
    )
      return undefined;
    result[id] = {
      scale: entry.scale,
      revision: entry.revision as number,
      updatedAt: entry.updatedAt,
    };
  }
  return result;
}

export function isMaterialScaleDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/** Only explicitly saved material scales override portable, legacy per-part values. */
export function resolveMaterialScales(
  document: DesignDocument,
  materials: MaterialScaleLibrary,
): DesignDocument {
  let changed = false;
  const parts = { ...document.parts };
  for (const [id, assignment] of Object.entries(parts)) {
    const shared = materials[assignment.materialId];
    if (!shared || assignment.placement.scale === shared.scale) continue;
    parts[id as keyof typeof parts] = {
      ...assignment,
      placement: { ...assignment.placement, scale: shared.scale },
    };
    changed = true;
  }
  return changed ? { ...document, parts } : document;
}

export function resolveLookMaterialScales(
  look: SavedLook,
  materials: MaterialScaleLibrary,
): SavedLook {
  const document = resolveMaterialScales(look.document, materials);
  return document === look.document ? look : { document };
}

export function countMaterialUses(
  document: DesignDocument,
  looks: readonly SavedLook[],
  materialId: string,
): MaterialUseCount {
  const count = (value: DesignDocument) =>
    Object.values(value.parts).filter((part) => part.materialId === materialId)
      .length;
  const draftParts = count(document);
  const saved = looks.map((look) => count(look.document));
  const savedParts = saved.reduce((sum, uses) => sum + uses, 0);
  return {
    draftParts,
    savedParts,
    savedLooks: saved.filter(Boolean).length,
    total: draftParts + savedParts,
  };
}
