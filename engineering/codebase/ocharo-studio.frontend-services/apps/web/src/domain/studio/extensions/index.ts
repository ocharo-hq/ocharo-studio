export {
  DEFAULT_PLACEMENT,
  clampPlacement,
  cloneDocument,
  copyDesignDocument,
  createDefaultAssignments,
  createDesignDocument,
  migrateDocument,
  normalizeName,
  parseDocument,
  serializeDocument,
} from "./DesignDocumentExtensions";
export {
  countMaterialUses,
  isMaterialScale,
  isMaterialScaleDate,
  migrateMaterialScales,
  resolveLookMaterialScales,
  resolveMaterialScales,
  type MaterialUseCount,
} from "./MaterialScaleExtensions";
export {
  materialTransform,
  sampleMaterial,
  type AffinePlacement,
} from "./PlacementExtensions";
