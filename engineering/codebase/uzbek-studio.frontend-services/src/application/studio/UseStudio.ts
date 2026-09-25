import { useEffect, useRef, useState } from "react";

import { serializeDocument } from "../../domain/studio/document";
import type { GarmentId, PartId } from "../../domain/studio/types";
import {
  createStudioRepository,
  type StudioRepository,
} from "../../integration/studio/repository";
import {
  applyMaterial as applyStudioMaterial,
  beginPlacementGesture,
  chooseGarment as chooseStudioGarment,
  clearStudioNotice,
  createStudioState,
  deleteLook as deleteStudioLook,
  importLook as importStudioLook,
  isStudioDirty,
  markStudioPersistenceFailure,
  openLook as openStudioLook,
  redoStudio,
  renameDocument,
  resetPlacement as resetStudioPlacement,
  saveLookAsCopy as saveStudioLookAsCopy,
  saveLook as saveStudioLook,
  selectPart,
  undoStudio,
  updatePlacement,
  endPlacementGesture,
  type PlacementUpdate,
  type StudioState,
} from "./state";

export interface StudioControls {
  document: StudioState["document"];
  selectedPartId: PartId;
  setSelectedPartId(partId: PartId): void;
  looks: StudioState["looks"];
  notice?: string;
  clearNotice(): void;
  chooseGarment(id: GarmentId): void;
  applyMaterial(id: string): void;
  setPlacement(update: PlacementUpdate): void;
  beginPlacement(): void;
  endPlacement(): void;
  resetPlacement(): void;
  rename(name: string): void;
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
}

export function useStudio(
  repository: StudioRepository = createStudioRepository(),
): StudioControls {
  const repositoryRef = useRef(repository);
  const [state, setState] = useState(() =>
    createStudioState(
      repositoryRef.current.readDraft(),
      repositoryRef.current.readLooks(),
    ),
  );

  useEffect(() => {
    if (!repositoryRef.current.writeDraft(state.document)) {
      setState((current) =>
        markStudioPersistenceFailure(
          current,
          "Draft autosave failed. Your latest edits may not survive reload.",
        ),
      );
    }
  }, [state.document]);

  useEffect(() => {
    if (!repositoryRef.current.writeLooks(state.looks)) {
      setState((current) =>
        markStudioPersistenceFailure(
          current,
          "Saving looks failed. This look is not safely stored.",
          true,
        ),
      );
    }
  }, [state.looks]);

  return {
    document: state.document,
    selectedPartId: state.selectedPartId,
    setSelectedPartId: (partId) =>
      setState((current) => selectPart(current, partId)),
    looks: state.looks,
    notice: state.notice,
    clearNotice: () => setState(clearStudioNotice),
    chooseGarment: (id) =>
      setState((current) => chooseStudioGarment(current, id)),
    applyMaterial: (id) =>
      setState((current) => applyStudioMaterial(current, id)),
    setPlacement: (update) =>
      setState((current) => updatePlacement(current, update)),
    beginPlacement: () => setState(beginPlacementGesture),
    endPlacement: () => setState(endPlacementGesture),
    resetPlacement: () => setState(resetStudioPlacement),
    rename: (name) => setState((current) => renameDocument(current, name)),
    undo: () => setState(undoStudio),
    redo: () => setState(redoStudio),
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    saveLook: (thumbnail) =>
      setState((current) => saveStudioLook(current, thumbnail)),
    saveLookAsCopy: (thumbnail) =>
      setState((current) => saveStudioLookAsCopy(current, thumbnail)),
    openLook: (id) => setState((current) => openStudioLook(current, id)),
    deleteLook: (id) => setState((current) => deleteStudioLook(current, id)),
    importLook: (json) =>
      setState((current) => importStudioLook(current, json)),
    exportLook: () => serializeDocument(state.document),
    isDirty: isStudioDirty(state),
  };
}
