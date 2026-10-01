import {
  getGarment,
  getMaterial,
  isMaterialApplicable,
} from "../../domain/studio/catalog";
import {
  DEFAULT_PLACEMENT,
  clampPlacement,
  cloneDocument,
  copyDesignDocument,
  createDefaultAssignments,
  createDesignDocument,
  normalizeName,
  parseDocument,
  serializeDocument,
} from "../../domain/studio/document";
import {
  countMaterialUses,
  isMaterialScale,
  isMaterialScaleDate,
  resolveLookMaterialScales,
  resolveMaterialScales,
} from "../../domain/studio/materials";
import type {
  DesignDocument,
  GarmentId,
  MaterialScaleLibrary,
  PartId,
  SavedLook,
  TexturePlacement,
} from "../../domain/studio/types";

const MAX_HISTORY_LENGTH = 100;

export interface StudioState {
  document: DesignDocument;
  selectedPartId: PartId;
  selectedPartIds: readonly PartId[];
  looks: ReadonlyArray<SavedLook>;
  materials: MaterialScaleLibrary;
  notice?: string;
  undoStack: ReadonlyArray<DesignDocument>;
  redoStack: ReadonlyArray<DesignDocument>;
  savedFingerprint: string;
  documentGesture?: DesignDocument;
}

export type PlacementUpdate = Partial<Omit<TexturePlacement, "scale">>;

export function createStudioState(
  draft?: DesignDocument,
  looks: ReadonlyArray<SavedLook> = [],
  materials: MaterialScaleLibrary = {},
): StudioState {
  const document = resolveMaterialScales(
    cloneDocument(draft ?? createDesignDocument()),
    materials,
  );
  const resolvedLooks = looks.map((look) =>
    resolveLookMaterialScales(cloneLook(look), materials),
  );
  return {
    document,
    selectedPartId: firstPartId(document.garmentId),
    selectedPartIds: [firstPartId(document.garmentId)],
    looks: resolvedLooks,
    materials,
    undoStack: [],
    redoStack: [],
    savedFingerprint: fingerprintForLook(document, resolvedLooks),
  };
}

export function selectPart(
  state: StudioState,
  partId: PartId,
  additive = false,
): StudioState {
  const isValid = getGarment(state.document.garmentId).parts.some(
    (part) => part.id === partId,
  );
  if (!isValid) return state;
  if (!additive)
    return { ...state, selectedPartId: partId, selectedPartIds: [partId] };
  const selected = state.selectedPartIds.includes(partId)
    ? state.selectedPartIds.filter((id) => id !== partId)
    : [...state.selectedPartIds, partId];
  if (selected.length === 0) return state;
  return {
    ...state,
    selectedPartId: selected.at(-1)!,
    selectedPartIds: selected,
  };
}

/** Starts a fresh design while keeping meaningful unsaved work in the collection. */
export function newDesign(
  state: StudioState,
  now = new Date().toISOString(),
): StudioState {
  const pristine =
    state.document.name === "Untitled look" &&
    state.document.garmentId === "nimcha" &&
    JSON.stringify(state.document.parts) ===
      JSON.stringify(
        resolveMaterialScales(createDesignDocument("nimcha"), state.materials)
          .parts,
      );
  const retainDraft = isStudioDirty(state) && !pristine;
  if (retainDraft && state.looks.length >= 100) {
    return {
      ...state,
      notice:
        "Your collection has 100 looks. Export and remove a look before starting a new design.",
    };
  }
  const retained = retainDraft ? saveLook(state) : state;
  if (retainDraft && retained.looks === state.looks) return retained;
  const document = createDesignDocument("nimcha", now);
  return {
    ...commitDocument(retained, document, firstPartId(document.garmentId)),
    savedFingerprint: "",
    notice: retainDraft
      ? "Previous draft kept in My looks. New design ready."
      : "New design ready.",
  };
}

export function chooseGarment(
  state: StudioState,
  garmentId: GarmentId,
  now = new Date().toISOString(),
): StudioState {
  if (state.document.garmentId === garmentId) {
    return state;
  }

  return commitDocument(
    state,
    {
      ...state.document,
      garmentId,
      parts: createDefaultAssignments(garmentId),
      updatedAt: now,
    },
    firstPartId(garmentId),
  );
}

export function applyMaterial(
  state: StudioState,
  materialId: string,
  now = new Date().toISOString(),
): StudioState {
  if (
    !isKnownMaterial(materialId) ||
    !state.selectedPartIds.every((partId) =>
      isMaterialApplicable(state.document.garmentId, partId, materialId),
    )
  ) {
    return {
      ...state,
      notice: "That material is unavailable for the selected parts.",
    };
  }

  const parts = { ...state.document.parts };
  let changed = false;
  for (const partId of state.selectedPartIds) {
    const current = parts[partId];
    if (!current || current.materialId === materialId) continue;
    parts[partId] = {
      materialId,
      placement: {
        ...current.placement,
        scale: state.materials[materialId]?.scale ?? DEFAULT_PLACEMENT.scale,
      },
    };
    changed = true;
  }
  if (!changed) return state;

  return commitDocument(state, {
    ...state.document,
    parts,
    updatedAt: now,
  });
}

export function updatePlacement(
  state: StudioState,
  update: PlacementUpdate,
  now = new Date().toISOString(),
): StudioState {
  if (Object.hasOwn(update, "scale")) return state;
  if (
    state.selectedPartIds.length > 1 &&
    Object.keys(update).some((key) => !["offsetX", "offsetY"].includes(key))
  )
    return state;
  if (
    Object.values(update).some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  )
    return state;
  const parts = { ...state.document.parts };
  let changed = false;
  for (const partId of state.selectedPartIds) {
    const current = parts[partId];
    if (!current) continue;
    const placement = clampPlacement({ ...current.placement, ...update });
    if (
      Object.entries(placement).every(
        ([key, value]) =>
          value === current.placement[key as keyof TexturePlacement],
      )
    )
      continue;
    parts[partId] = { ...current, placement };
    changed = true;
  }
  if (!changed) return state;

  const document = {
    ...state.document,
    parts,
    updatedAt: now,
  };

  return state.documentGesture === undefined
    ? commitDocument(state, document)
    : { ...state, document: cloneDocument(document), notice: undefined };
}

export function beginDocumentGesture(state: StudioState): StudioState {
  return state.documentGesture === undefined
    ? { ...state, documentGesture: cloneDocument(state.document) }
    : state;
}

export function endDocumentGesture(state: StudioState): StudioState {
  const start = state.documentGesture;
  if (start === undefined) {
    return state;
  }

  if (serializeDocument(start) === serializeDocument(state.document)) {
    const { documentGesture: _, ...next } = state;
    return next;
  }

  const { documentGesture: _, ...next } = state;
  return {
    ...next,
    undoStack: appendHistory(state.undoStack, start),
    redoStack: [],
  };
}

export function resetPlacement(
  state: StudioState,
  now = new Date().toISOString(),
): StudioState {
  const { scale: _, ...placement } = DEFAULT_PLACEMENT;
  return updatePlacement(
    state,
    state.selectedPartIds.length > 1
      ? {
          offsetX: DEFAULT_PLACEMENT.offsetX,
          offsetY: DEFAULT_PLACEMENT.offsetY,
        }
      : placement,
    now,
  );
}

export function renameDocument(
  state: StudioState,
  name: string,
  now = new Date().toISOString(),
): StudioState {
  const normalized = normalizeName(name);
  if (normalized === undefined) {
    return { ...state, notice: "Use a name between 1 and 80 characters." };
  }

  if (state.document.name === normalized) {
    return state;
  }

  const document = {
    ...state.document,
    name: normalized,
    updatedAt: now,
  };
  return state.documentGesture === undefined
    ? commitDocument(state, document)
    : { ...state, document, notice: undefined };
}

export function undoStudio(state: StudioState): StudioState {
  const previous = state.undoStack.at(-1);
  if (previous === undefined) {
    return state;
  }

  return {
    ...state,
    document: resolveMaterialScales(cloneDocument(previous), state.materials),
    selectedPartId: validSelectedParts(previous, state.selectedPartIds).at(-1)!,
    selectedPartIds: validSelectedParts(previous, state.selectedPartIds),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: appendHistory(state.redoStack, state.document),
    documentGesture: undefined,
    notice: undefined,
  };
}

export function redoStudio(state: StudioState): StudioState {
  const next = state.redoStack.at(-1);
  if (next === undefined) {
    return state;
  }

  return {
    ...state,
    document: resolveMaterialScales(cloneDocument(next), state.materials),
    selectedPartId: validSelectedParts(next, state.selectedPartIds).at(-1)!,
    selectedPartIds: validSelectedParts(next, state.selectedPartIds),
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: state.redoStack.slice(0, -1),
    documentGesture: undefined,
    notice: undefined,
  };
}

export function saveLook(state: StudioState, thumbnail?: string): StudioState {
  if (
    state.looks.length >= 100 &&
    !state.looks.some((look) => look.document.id === state.document.id)
  ) {
    return {
      ...state,
      notice:
        "Your collection has 100 looks. Export and remove a look before saving another.",
    };
  }
  const look: SavedLook = {
    document: cloneDocument(state.document),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };
  const looks = [
    ...state.looks.filter((item) => item.document.id !== look.document.id),
    look,
  ];

  return {
    ...state,
    looks,
    savedFingerprint: serializeDocument(state.document),
    notice: state.looks.some((item) => item.document.id === look.document.id)
      ? "Saved look updated."
      : "New look saved.",
  };
}

export function saveLookAsCopy(
  state: StudioState,
  thumbnail?: string,
  now = new Date().toISOString(),
): StudioState {
  if (state.looks.length >= 100) {
    return {
      ...state,
      notice:
        "Your collection has 100 looks. Export and remove a look before saving a copy.",
    };
  }
  const document = copyDesignDocument(state.document, now);
  const look: SavedLook = {
    document: cloneDocument(document),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };

  return {
    ...state,
    document,
    looks: [...state.looks, look],
    undoStack: [],
    redoStack: [],
    savedFingerprint: serializeDocument(document),
    documentGesture: undefined,
    notice: "New look saved.",
  };
}

export function openLook(state: StudioState, id: string): StudioState {
  const look = state.looks.find((item) => item.document.id === id);
  if (look === undefined) {
    return { ...state, notice: "That saved look is unavailable." };
  }

  const document = resolveMaterialScales(
    cloneDocument(look.document),
    state.materials,
  );
  return {
    ...state,
    document,
    selectedPartId: firstPartId(document.garmentId),
    selectedPartIds: [firstPartId(document.garmentId)],
    undoStack: [],
    redoStack: [],
    savedFingerprint: serializeDocument(document),
    notice: undefined,
  };
}

export function deleteLook(state: StudioState, id: string): StudioState {
  const looks = state.looks.filter((look) => look.document.id !== id);
  if (looks.length === state.looks.length) {
    return state;
  }

  return {
    ...state,
    looks,
    savedFingerprint: state.document.id === id ? "" : state.savedFingerprint,
    notice: "Saved look deleted.",
  };
}

export function importLook(state: StudioState, json: string): StudioState {
  const imported = parseDocument(json);
  if (imported === undefined) {
    return { ...state, notice: "The design file is invalid or incompatible." };
  }
  const document = resolveMaterialScales(imported, state.materials);
  const usesSharedScale = Object.values(imported.parts).some(
    (part) => state.materials[part.materialId],
  );

  return {
    ...state,
    document,
    selectedPartId: firstPartId(document.garmentId),
    selectedPartIds: [firstPartId(document.garmentId)],
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: [],
    documentGesture: undefined,
    notice: usesSharedScale
      ? "Design imported using this workspace's saved material scales."
      : "Design imported.",
  };
}

/** A material edit belongs to the workspace library, outside garment undo history. */
export function saveMaterialScale(
  state: StudioState,
  materialId: string,
  scale: number,
  now = new Date().toISOString(),
): StudioState {
  const prior = state.materials[materialId];
  if (
    !isKnownMaterial(materialId) ||
    !isMaterialScale(scale) ||
    !isMaterialScaleDate(now) ||
    (prior && prior.revision >= Number.MAX_SAFE_INTEGER)
  )
    return state;
  if (prior?.scale === scale) return state;
  const materials: MaterialScaleLibrary = {
    ...state.materials,
    [materialId]: {
      scale,
      revision: (prior?.revision ?? 0) + 1,
      updatedAt: now,
    },
  };
  const next = endDocumentGesture(state);
  const resolved = resolveMaterialScales(next.document, materials);
  const document =
    resolved === next.document ? resolved : { ...resolved, updatedAt: now };
  const looks = next.looks.map((look) => {
    const resolvedLook = resolveLookMaterialScales(look, materials);
    return resolvedLook === look
      ? look
      : { document: { ...resolvedLook.document, updatedAt: now } };
  });
  const uses = countMaterialUses(document, looks, materialId);
  return {
    ...next,
    materials,
    document,
    looks: looks.every((look, index) => look === next.looks[index])
      ? next.looks
      : looks,
    savedFingerprint: next.savedFingerprint
      ? fingerprintForLook(document, looks)
      : "",
    notice: `Material scale saved across ${uses.total} garment ${uses.total === 1 ? "part" : "parts"}.`,
  };
}

export function clearStudioNotice(state: StudioState): StudioState {
  return state.notice === undefined ? state : { ...state, notice: undefined };
}

export function isStudioDirty(state: StudioState): boolean {
  return serializeDocument(state.document) !== state.savedFingerprint;
}

export function markStudioPersistenceFailure(
  state: StudioState,
  message: string,
  savedLookFailed = false,
): StudioState {
  return {
    ...state,
    notice: message,
    ...(savedLookFailed ? { savedFingerprint: "" } : {}),
  };
}

function commitDocument(
  state: StudioState,
  document: DesignDocument,
  selectedPartId = state.selectedPartId,
): StudioState {
  return {
    ...state,
    document: resolveMaterialScales(cloneDocument(document), state.materials),
    selectedPartId,
    selectedPartIds:
      document.garmentId !== state.document.garmentId ||
      document.id !== state.document.id
        ? [selectedPartId]
        : validSelectedParts(document, state.selectedPartIds),
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: [],
    documentGesture: undefined,
    notice: undefined,
  };
}

function validSelectedParts(
  document: DesignDocument,
  candidates: readonly PartId[],
): readonly PartId[] {
  const valid = candidates.filter((id) =>
    getGarment(document.garmentId).parts.some((part) => part.id === id),
  );
  return valid.length ? valid : [firstPartId(document.garmentId)];
}

function firstPartId(garmentId: GarmentId): PartId {
  const part = getGarment(garmentId).parts[0];
  if (part === undefined) {
    throw new Error(`Garment ${garmentId} has no editable parts.`);
  }

  return part.id;
}

function fingerprintForLook(
  document: DesignDocument,
  looks: ReadonlyArray<SavedLook>,
): string {
  const saved = looks.find((look) => look.document.id === document.id);
  return saved === undefined ? "" : serializeDocument(saved.document);
}

function cloneLook(look: SavedLook): SavedLook {
  return {
    document: cloneDocument(look.document),
    ...(look.thumbnail === undefined ? {} : { thumbnail: look.thumbnail }),
  };
}

function isKnownMaterial(materialId: string): boolean {
  try {
    getMaterial(materialId);
    return true;
  } catch {
    return false;
  }
}

function appendHistory(
  history: ReadonlyArray<DesignDocument>,
  document: DesignDocument,
): ReadonlyArray<DesignDocument> {
  return [...history, cloneDocument(document)].slice(-MAX_HISTORY_LENGTH);
}
