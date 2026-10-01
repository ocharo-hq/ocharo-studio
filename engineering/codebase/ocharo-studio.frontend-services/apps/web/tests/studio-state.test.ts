import { describe, expect, it } from "vitest";

import {
  applyMaterial,
  beginDocumentGesture,
  chooseGarment,
  createStudioState,
  deleteLook,
  endDocumentGesture,
  importLook,
  isStudioDirty,
  markStudioPersistenceFailure,
  redoStudio,
  renameDocument,
  saveLook,
  saveLookAsCopy,
  selectPart,
  undoStudio,
  updatePlacement,
} from "../src/application/studio/state";
import {
  DEFAULT_PLACEMENT,
  createDesignDocument,
  serializeDocument,
} from "../src/domain/studio/document";
import { createStudioRepository } from "../src/integration/studio/repository";
import {
  createLocalJsonStorage,
  createMemoryJsonStorage,
} from "../src/integration/studio/storage";

describe("studio state", () => {
  it("persists each valid name edit while retaining one undo step", () => {
    const initial = createStudioState();
    let state = beginDocumentGesture(initial);
    for (const name of ["Spring", "Spring ", "Spring atlas"])
      state = renameDocument(state, name);
    expect(state.document.name).toBe("Spring atlas");
    expect(state.undoStack).toHaveLength(0);
    state = endDocumentGesture(state);
    expect(state.undoStack).toHaveLength(1);
    expect(undoStudio(state).document).toEqual(initial.document);
    expect(redoStudio(undoStudio(state)).document.name).toBe("Spring atlas");
  });

  it("keeps material and placement edits isolated by garment part", () => {
    let state = createStudioState();
    state = selectPart(state, "body");
    state = applyMaterial(state, "adras-indigo", "2026-09-25T10:00:00.000Z");
    state = updatePlacement(
      state,
      { rotation: 1, offsetX: 0.25 },
      "2026-09-25T10:01:00.000Z",
    );
    state = selectPart(state, "trim");
    state = applyMaterial(state, "bekasam-gold", "2026-09-25T10:02:00.000Z");

    expect(state.document.parts.body).toMatchObject({
      materialId: "adras-indigo",
      placement: { rotation: 1, offsetX: 0.25, offsetY: 0 },
    });
    expect(state.document.parts.trim?.materialId).toBe("bekasam-gold");
    expect(state.document.parts.trim?.placement).toEqual({
      ...DEFAULT_PLACEMENT,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("round-trips degree rotations used by the editor", () => {
    let state = createStudioState();
    state = updatePlacement(state, { rotation: 45, offsetX: 0.25 });

    const imported = importLook(
      createStudioState(),
      serializeDocument(state.document),
    );
    expect(imported.document.parts.body?.placement).toEqual({
      ...DEFAULT_PLACEMENT,
      rotation: 45,
      offsetX: 0.25,
      offsetY: 0,
    });

    state = updatePlacement(state, { rotation: 90 });
    expect(state.document.parts.body?.placement.rotation).toBe(90);
  });

  it("rejects malformed imports without overwriting the active document", () => {
    const state = createStudioState();
    const malformed = JSON.stringify({
      ...state.document,
      garmentId: "unknown",
      parts: {
        body: {
          materialId: "missing",
          placement: { rotation: Infinity, offsetX: 0, offsetY: 0 },
        },
      },
    });

    const imported = importLook(state, malformed);

    expect(imported.document).toEqual(state.document);
    expect(imported.notice).toMatch(/invalid|incompatible/i);
  });

  it("rejects documents missing any garment-defined part", () => {
    const state = createStudioState();
    const missingParts = serializeDocument({
      ...state.document,
      parts: {
        body: state.document.parts.body,
      },
    });

    const imported = importLook(state, missingParts);

    expect(imported.document).toEqual(state.document);
    expect(imported.notice).toMatch(/invalid|incompatible/i);
  });

  it("undoes and redoes complete document edits", () => {
    const initial = createStudioState();
    const edited = applyMaterial(
      initial,
      "adras-indigo",
      "2026-09-25T10:00:00.000Z",
    );
    const undone = undoStudio(edited);
    const redone = redoStudio(undone);

    expect(undone.document).toEqual(initial.document);
    expect(redone.document).toEqual(edited.document);
    expect(redone.undoStack).toHaveLength(1);
    expect(redone.redoStack).toHaveLength(0);
  });

  it("switches garment in one operation and replaces incompatible parts with defaults", () => {
    let state = createStudioState();
    state = applyMaterial(state, "adras-indigo", "2026-09-25T10:00:00.000Z");

    const switched = chooseGarment(state, "korset", "2026-09-25T10:01:00.000Z");

    expect(switched.document.garmentId).toBe("korset");
    expect(switched.selectedPartId).toBe("body");
    expect(Object.keys(switched.document.parts).sort()).toEqual([
      "body",
      "trim",
    ]);
    expect(switched.undoStack).toHaveLength(2);
  });

  it("coalesces a placement gesture into one bounded history entry", () => {
    let state = beginDocumentGesture(createStudioState());
    for (let step = 1; step <= 150; step += 1) {
      state = updatePlacement(
        state,
        { offsetX: step / 100 },
        `2026-09-25T10:00:${String(step % 60).padStart(2, "0")}.000Z`,
      );
    }
    state = endDocumentGesture(state);

    expect(state.undoStack).toHaveLength(1);
    expect(state.document.parts.body?.placement.offsetX).toBe(1);
    expect(undoStudio(state).document.parts.body?.placement.offsetX).toBe(0);
  });

  it("caps uncoalesced edit history at one hundred documents", () => {
    let state = createStudioState();
    for (let step = 1; step <= 125; step += 1) {
      state = updatePlacement(state, { offsetX: step / 100 });
    }

    expect(state.undoStack).toHaveLength(100);
  });

  it("saves a renamed variant as a new look without replacing its source", () => {
    const original = saveLook(createStudioState());
    const sourceId = original.document.id;
    expect(original.notice).toBe("New look saved.");
    expect(saveLook(original).notice).toBe("Saved look updated.");

    const renamed = renameDocument(
      original,
      "Evening variant",
      "2026-09-25T10:30:00.000Z",
    );

    const copied = saveLookAsCopy(
      renamed,
      undefined,
      "2026-09-25T11:00:00.000Z",
    );

    expect(copied.looks).toHaveLength(2);
    expect(copied.document.id).not.toBe(sourceId);
    expect(copied.looks.map((look) => look.document.id)).toContain(sourceId);
    expect(copied.looks.map((look) => look.document.name)).toEqual([
      "Untitled look",
      "Evening variant",
    ]);
    expect(copied.notice).toBe("New look saved.");
  });

  it("keeps collection limits recoverable while allowing existing look updates", () => {
    const looks = Array.from({ length: 100 }, () => ({
      document: createDesignDocument(),
    }));
    const state = createStudioState(undefined, looks);
    expect(saveLook(state).looks).toBe(state.looks);
    expect(saveLook(state).notice).toMatch(/100 looks/);
    expect(saveLookAsCopy(state).document).toBe(state.document);
    expect(saveLookAsCopy(state).notice).toMatch(/100 looks/);
    const existing = createStudioState(looks[0].document, looks);
    expect(saveLook(existing).looks).toHaveLength(100);
    expect(saveLook(existing).notice).toBe("Saved look updated.");
  });

  it("ignores corrupt saved looks and recovers after a valid write", () => {
    const storage = createMemoryJsonStorage({
      "ocharo-studio:studio:saved-looks": {
        schemaVersion: 1,
        looks: [{ document: { schemaVersion: 999 } }],
      },
    });
    const repository = createStudioRepository(storage);
    const document = createDesignDocument("nimcha", "2026-09-25T10:00:00.000Z");

    expect(repository.readLooks()).toEqual([]);
    expect(repository.writeLooks([{ document }])).toBe(true);
    expect(repository.readLooks()).toEqual([{ document }]);
  });

  it("ignores a malformed draft with unknown identifiers and dates", () => {
    const valid = createDesignDocument("nimcha", "2026-09-25T10:00:00.000Z");
    const storage = createMemoryJsonStorage({
      "ocharo-studio:studio:draft": {
        schemaVersion: 1,
        document: {
          ...valid,
          id: "not-a-uuid",
          updatedAt: "2026-02-31T10:00:00.000Z",
          parts: {
            ...valid.parts,
            body: {
              materialId: "future-material",
              placement: { rotation: 0, offsetX: 0, offsetY: 0 },
            },
          },
        },
      },
    });

    expect(createStudioRepository(storage).readDraft()).toBeUndefined();
  });

  it("degrades blocked and quota-failing local storage calls without throwing", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
        removeItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      },
    });

    try {
      const storage = createLocalJsonStorage();
      expect(storage.read("draft")).toBeNull();
      expect(storage.write("draft", { schemaVersion: 1 })).toBe(false);
      expect(storage.remove("draft")).toBe(false);
    } finally {
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, "localStorage");
      } else {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      }
    }
  });

  it("marks a failed saved-look write as dirty with an explicit warning", () => {
    const saved = saveLook(createStudioState());
    const failed = markStudioPersistenceFailure(
      saved,
      "Saving looks failed. This look is not safely stored.",
      true,
    );

    expect(isStudioDirty(failed)).toBe(true);
    expect(failed.notice).toMatch(/not safely stored/i);
  });

  it("lets the same save action retry after a transient persistence failure", () => {
    const saved = saveLook(createStudioState());
    const failed = markStudioPersistenceFailure(
      saved,
      "Saving looks failed. This look is not safely stored.",
      true,
    );

    const retried = saveLook(failed);

    expect(retried.looks).toHaveLength(1);
    expect(retried.notice).toBe("Saved look updated.");
    expect(isStudioDirty(retried)).toBe(false);
  });

  it("keeps an autosaved draft dirty when it differs from its saved look", () => {
    const saved = saveLook(createStudioState());
    const changedDraft = renameDocument(
      saved,
      "Unsaved draft",
      "2026-09-25T12:00:00.000Z",
    ).document;

    const reloaded = createStudioState(changedDraft, saved.looks);

    expect(isStudioDirty(reloaded)).toBe(true);
  });

  it("marks the active document dirty when its saved look is deleted", () => {
    const saved = saveLook(createStudioState());

    const deleted = deleteLook(saved, saved.document.id);

    expect(deleted.looks).toEqual([]);
    expect(isStudioDirty(deleted)).toBe(true);
  });

  it("accepts a complete portable document and keeps its identity", () => {
    const state = createStudioState();
    const document = createDesignDocument("baska", "2026-09-25T10:00:00.000Z");

    const imported = importLook(state, serializeDocument(document));

    expect(imported.document).toEqual(document);
    expect(imported.document.id).toBe(document.id);
  });
});
