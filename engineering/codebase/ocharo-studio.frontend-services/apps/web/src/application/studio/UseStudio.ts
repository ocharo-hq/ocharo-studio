import { shallowRef } from "vue";

import { useStudioPersistence } from "./UseStudioPersistence";
import type { PersistenceStatus } from "../../integration/studio/serverRepository";
import { serializeDocument } from "../../domain/studio/document";
import {
  countMaterialUses,
  resolveMaterialScales,
  type MaterialUseCount,
} from "../../domain/studio/materials";
import type { GarmentId, PartId } from "../../domain/studio/types";
import {
  createStudioRepository,
  type StudioRepository,
  type StudioRecovery,
} from "../../integration/studio/repository";
import {
  applyMaterial as applyStudioMaterial,
  beginDocumentGesture,
  chooseGarment as chooseStudioGarment,
  clearStudioNotice,
  createStudioState,
  deleteLook as deleteStudioLook,
  importLook as importStudioLook,
  isStudioDirty,
  openLook as openStudioLook,
  redoStudio,
  renameDocument,
  resetPlacement as resetStudioPlacement,
  saveLookAsCopy as saveStudioLookAsCopy,
  saveLook as saveStudioLook,
  saveMaterialScale as saveStudioMaterialScale,
  selectPart,
  newDesign,
  undoStudio,
  updatePlacement,
  endDocumentGesture,
  type PlacementUpdate,
  type StudioState,
} from "./state";

export interface StudioControls {
  document: StudioState["document"];
  selectedPartId: PartId;
  selectedPartIds: readonly PartId[];
  setSelectedPartId(partId: PartId, additive?: boolean): void;
  newDesign(): void;
  looks: StudioState["looks"];
  refreshingLooks: boolean;
  materials: StudioState["materials"];
  saveMaterialScale(materialId: string, scale: number): boolean;
  countMaterialUses(materialId: string): MaterialUseCount;
  notice?: string;
  clearNotice(): void;
  chooseGarment(id: GarmentId): void;
  applyMaterial(id: string): void;
  setPlacement(update: PlacementUpdate): void;
  beginPlacement(): void;
  endPlacement(): void;
  resetPlacement(): void;
  rename(name: string): void;
  beginRename(): void;
  endRename(): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  saveLook(thumbnail?: string): void;
  saveLookAsCopy(thumbnail?: string): void;
  openLook(id: string): void;
  deleteLook(id: string): void;
  importLook(json: string): void;
  exportLook(): string;
  isDirty: boolean;
  persistenceStatus: PersistenceStatus;
  retrySync(): void;
  reconnect(): void;
  revision: number;
  resolveConflict(): void;
  settings: Record<string, unknown>;
  updateSettings(update: Record<string, unknown>): void;
}

export function useStudio(
  repository: StudioRepository = createStudioRepository(),
): StudioControls {
  let recovery: StudioRecovery | undefined;
  let recoveryError: string | undefined;
  try {
    recovery = repository.readRecovery();
  } catch (error) {
    recoveryError =
      error instanceof Error
        ? error.message
        : "The browser recovery copy is invalid.";
  }
  const state = shallowRef(
    createStudioState(
      recovery
        ? (recovery.draft ?? undefined)
        : recoveryError
          ? undefined
          : repository.readDraft(),
      recovery ? recovery.looks : recoveryError ? [] : repository.readLooks(),
      recovery?.materials,
    ),
  );
  if (recoveryError) state.value = { ...state.value, notice: recoveryError };

  const persistence = useStudioPersistence(
    state,
    repository,
    recovery,
    recoveryError,
  );

  function setState(update: (current: StudioState) => StudioState): void {
    state.value = update(state.value);
  }

  return {
    get persistenceStatus() {
      return persistence.persistenceStatus;
    },
    get settings() {
      return persistence.settings;
    },
    updateSettings: persistence.updateSettings,
    retrySync: persistence.retrySync,
    reconnect: persistence.reconnect,
    get revision() {
      return persistence.revision;
    },
    resolveConflict: persistence.resolveConflict,
    get document() {
      return state.value.document;
    },
    get selectedPartId() {
      return state.value.selectedPartId;
    },
    get selectedPartIds() {
      return state.value.selectedPartIds;
    },
    setSelectedPartId: (partId, additive = false) =>
      setState((current) => selectPart(current, partId, additive)),
    newDesign: () => setState(newDesign),
    get looks() {
      return persistence.looks;
    },
    get refreshingLooks() {
      return persistence.refreshingLooks;
    },
    get materials() {
      return state.value.materials;
    },
    saveMaterialScale: (id, scale) => {
      const current = state.value;
      const next = saveStudioMaterialScale(current, id, scale);
      state.value = next;
      return next !== current || current.materials[id]?.scale === scale;
    },
    countMaterialUses: (id) =>
      countMaterialUses(state.value.document, state.value.looks, id),
    get notice() {
      return state.value.notice;
    },
    clearNotice: () => setState(clearStudioNotice),
    chooseGarment: (id) =>
      setState((current) => chooseStudioGarment(current, id)),
    applyMaterial: (id) =>
      setState((current) => applyStudioMaterial(current, id)),
    setPlacement: (update) =>
      setState((current) => updatePlacement(current, update)),
    beginPlacement: () => setState(beginDocumentGesture),
    endPlacement: () => setState(endDocumentGesture),
    resetPlacement: () => setState(resetStudioPlacement),
    rename: (name) => setState((current) => renameDocument(current, name)),
    beginRename: () => setState(beginDocumentGesture),
    endRename: () => setState(endDocumentGesture),
    undo: () => setState(undoStudio),
    redo: () => setState(redoStudio),
    get canUndo() {
      return state.value.undoStack.length > 0;
    },
    get canRedo() {
      return state.value.redoStack.length > 0;
    },
    saveLook: (thumbnail) =>
      setState((current) => {
        const next = saveStudioLook(current, thumbnail);
        return next.looks === current.looks
          ? next
          : { ...next, notice: "Saving look…" };
      }),
    saveLookAsCopy: (thumbnail) =>
      setState((current) => {
        const next = saveStudioLookAsCopy(current, thumbnail);
        return next.looks === current.looks
          ? next
          : { ...next, notice: "Saving look…" };
      }),
    openLook: (id) => setState((current) => openStudioLook(current, id)),
    deleteLook: (id) => setState((current) => deleteStudioLook(current, id)),
    importLook: (json) =>
      setState((current) => importStudioLook(current, json)),
    exportLook: () =>
      serializeDocument(
        resolveMaterialScales(state.value.document, state.value.materials),
      ),
    get isDirty() {
      return (
        isStudioDirty(state.value) || persistence.persistenceStatus !== "synced"
      );
    },
  };
}
