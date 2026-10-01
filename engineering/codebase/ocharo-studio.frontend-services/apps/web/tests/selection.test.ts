import { describe, expect, it } from "vitest";
import { createDesignDocument } from "../src/domain/studio/document";
import {
  applyMaterial,
  beginDocumentGesture,
  chooseGarment,
  createStudioState,
  endDocumentGesture,
  newDesign,
  redoStudio,
  renameDocument,
  resetPlacement,
  selectPart,
  undoStudio,
  updatePlacement,
} from "../src/application/studio/state";

const initial = () => createStudioState(createDesignDocument("kostyum"));

describe("grouped garment editing", () => {
  it("keeps at least one valid selection and supports replacing or extending it", () => {
    let state = selectPart(initial(), "sleeves", true);
    expect(state.selectedPartIds).toEqual(["body", "sleeves"]);
    expect(state.selectedPartId).toBe("sleeves");
    state = selectPart(state, "sleeves", true);
    expect(state.selectedPartIds).toEqual(["body"]);
    expect(selectPart(state, "body", true)).toBe(state);
    expect(selectPart(state, "belt", true)).toBe(state);
    expect(selectPart(state, "collar").selectedPartIds).toEqual(["collar"]);
  });
  it("changes all compatible selected materials in one undoable action", () => {
    const state = selectPart(initial(), "sleeves", true);
    const changed = applyMaterial(state, "ikat-garden");
    expect(changed.document.parts.body?.materialId).toBe("ikat-garden");
    expect(changed.document.parts.sleeves?.materialId).toBe("ikat-garden");
    expect(changed.document.parts.collar).toEqual(state.document.parts.collar);
    expect(changed.undoStack).toHaveLength(1);
    expect(undoStudio(changed).document).toEqual(state.document);
    expect(redoStudio(undoStudio(changed)).document).toEqual(changed.document);
  });
  it("rejects incompatible materials atomically instead of partially applying", () => {
    const state = selectPart(initial(), "sleeves", true);
    const changed = applyMaterial(state, "catalogue-scarf-blue-paisley");
    // Catalogue scarves belong to nimcha; the selection remains intact.
    expect(changed.document).toBe(state.document);
    expect(changed.notice).toContain("unavailable");
  });
  it("groups shifts and preserves individual rotations and anchors", () => {
    let state = updatePlacement(initial(), {
      rotation: 90,
      materialAnchorX: 0.3,
    });
    state = selectPart(state, "sleeves", true);
    const starting = state;
    state = beginDocumentGesture(state);
    state = updatePlacement(state, { offsetX: 0.2 });
    state = updatePlacement(state, { offsetX: 0.4, offsetY: -0.3 });
    state = endDocumentGesture(state);
    for (const id of ["body", "sleeves"] as const) {
      expect(state.document.parts[id]?.placement).toMatchObject({
        scale: 1,
        offsetX: 0.4,
        offsetY: -0.3,
      });
    }
    expect(state.document.parts.body?.placement).toMatchObject({
      rotation: 90,
      materialAnchorX: 0.3,
    });
    expect(state.document.parts.sleeves?.placement.rotation).toBe(0);
    expect(updatePlacement(state, { rotation: 45 })).toBe(state);
    expect(updatePlacement(state, { garmentAnchorX: 0.8 })).toBe(state);
    expect(undoStudio(state).document).toEqual(starting.document);
    const reset = resetPlacement(state);
    expect(reset.document.parts.body?.placement).toMatchObject({
      rotation: 90,
      materialAnchorX: 0.3,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
  it("clears stale selections when changing garments", () => {
    const state = selectPart(initial(), "sleeves", true);
    const changed = chooseGarment(state, "korset");
    expect(changed.selectedPartIds).toEqual(["body"]);
    expect(changed.selectedPartId).toBe("body");
  });
});

describe("new designs", () => {
  it("keeps meaningful unsaved work while starting a fresh identity", () => {
    const state = renameDocument(initial(), "Silk idea");
    const next = newDesign(state);
    expect(next.document.id).not.toBe(state.document.id);
    expect(next.document.name).toBe("Untitled look");
    expect(next.document.garmentId).toBe("nimcha");
    expect(next.looks[0]?.document).toEqual(state.document);
    expect(undoStudio(next).document).toEqual(state.document);
  });
  it("avoids empty duplicate looks and refuses to discard drafts at collection capacity", () => {
    expect(newDesign(createStudioState()).looks).toHaveLength(0);
    const full = createStudioState(
      createDesignDocument("abaya"),
      Array.from({ length: 100 }, () => ({ document: createDesignDocument() })),
    );
    const next = newDesign(full);
    expect(next.document).toBe(full.document);
    expect(next.notice).toContain("100 looks");

    const saved = createDesignDocument("kostyum");
    const fullWithActiveLook = createStudioState(saved, [
      { document: saved },
      ...Array.from({ length: 99 }, () => ({
        document: createDesignDocument(),
      })),
    ]);
    const modified = renameDocument(fullWithActiveLook, "Changed saved look");
    const refused = newDesign(modified);
    expect(refused.document).toBe(modified.document);
    expect(refused.looks).toBe(modified.looks);
    expect(refused.notice).toContain("100 looks");
  });
});
