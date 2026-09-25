import { getGarment, getMaterial } from "../../domain/studio/catalog";
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
import type {
  DesignDocument,
  GarmentId,
  PartId,
  SavedLook,
} from "../../domain/studio/types";

const MAX_HISTORY_LENGTH = 100;

export interface StudioState {
  document: DesignDocument;
  selectedPartId: PartId;
  looks: ReadonlyArray<SavedLook>;
  notice?: string;
  undoStack: ReadonlyArray<DesignDocument>;
  redoStack: ReadonlyArray<DesignDocument>;
  savedFingerprint: string;
  placementGesture?: DesignDocument;
}

export interface PlacementUpdate {
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
}

export function createStudioState(
  draft?: DesignDocument,
  looks: ReadonlyArray<SavedLook> = [],
): StudioState {
  const document = cloneDocument(draft ?? createDesignDocument());
  return {
    document,
    selectedPartId: firstPartId(document.garmentId),
    looks: looks.map(cloneLook),
    undoStack: [],
    redoStack: [],
    savedFingerprint: fingerprintForLook(document, looks),
  };
}

export function selectPart(state: StudioState, partId: PartId): StudioState {
  const isValid = getGarment(state.document.garmentId).parts.some(
    (part) => part.id === partId,
  );
  return isValid ? { ...state, selectedPartId: partId } : state;
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
  if (!isKnownMaterial(materialId)) {
    return { ...state, notice: "That material is unavailable." };
  }

  const current = state.document.parts[state.selectedPartId];
  if (current === undefined || current.materialId === materialId) {
    return state;
  }

  return commitDocument(state, {
    ...state.document,
    parts: {
      ...state.document.parts,
      [state.selectedPartId]: {
        materialId,
        placement: { ...current.placement },
      },
    },
    updatedAt: now,
  });
}

export function updatePlacement(
  state: StudioState,
  update: PlacementUpdate,
  now = new Date().toISOString(),
): StudioState {
  const current = state.document.parts[state.selectedPartId];
  if (current === undefined) {
    return state;
  }

  const placement = clampPlacement({ ...current.placement, ...update });
  if (
    placement.rotation === current.placement.rotation &&
    placement.offsetX === current.placement.offsetX &&
    placement.offsetY === current.placement.offsetY
  ) {
    return state;
  }

  const document = {
    ...state.document,
    parts: {
      ...state.document.parts,
      [state.selectedPartId]: {
        ...current,
        placement,
      },
    },
    updatedAt: now,
  };

  return state.placementGesture === undefined
    ? commitDocument(state, document)
    : { ...state, document: cloneDocument(document), notice: undefined };
}

export function beginPlacementGesture(state: StudioState): StudioState {
  return state.placementGesture === undefined
    ? { ...state, placementGesture: cloneDocument(state.document) }
    : state;
}

export function endPlacementGesture(state: StudioState): StudioState {
  const start = state.placementGesture;
  if (start === undefined) {
    return state;
  }

  if (serializeDocument(start) === serializeDocument(state.document)) {
    const { placementGesture: _, ...next } = state;
    return next;
  }

  const { placementGesture: _, ...next } = state;
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
  return updatePlacement(state, DEFAULT_PLACEMENT, now);
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

  return commitDocument(state, {
    ...state.document,
    name: normalized,
    updatedAt: now,
  });
}

export function undoStudio(state: StudioState): StudioState {
  const previous = state.undoStack.at(-1);
  if (previous === undefined) {
    return state;
  }

  return {
    ...state,
    document: cloneDocument(previous),
    selectedPartId: validSelectedPart(previous, state.selectedPartId),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: appendHistory(state.redoStack, state.document),
    placementGesture: undefined,
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
    document: cloneDocument(next),
    selectedPartId: validSelectedPart(next, state.selectedPartId),
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: state.redoStack.slice(0, -1),
    placementGesture: undefined,
    notice: undefined,
  };
}

export function saveLook(state: StudioState, thumbnail?: string): StudioState {
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
    placementGesture: undefined,
    notice: "New look saved.",
  };
}

export function openLook(state: StudioState, id: string): StudioState {
  const look = state.looks.find((item) => item.document.id === id);
  if (look === undefined) {
    return { ...state, notice: "That saved look is unavailable." };
  }

  const document = cloneDocument(look.document);
  return {
    ...state,
    document,
    selectedPartId: firstPartId(document.garmentId),
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
  const document = parseDocument(json);
  if (document === undefined) {
    return { ...state, notice: "The design file is invalid or incompatible." };
  }

  return {
    ...state,
    document,
    selectedPartId: firstPartId(document.garmentId),
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: [],
    placementGesture: undefined,
    notice: "Design imported.",
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
    document: cloneDocument(document),
    selectedPartId,
    undoStack: appendHistory(state.undoStack, state.document),
    redoStack: [],
    placementGesture: undefined,
    notice: undefined,
  };
}

function validSelectedPart(
  document: DesignDocument,
  candidate: PartId,
): PartId {
  return getGarment(document.garmentId).parts.some(
    (part) => part.id === candidate,
  )
    ? candidate
    : firstPartId(document.garmentId);
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
