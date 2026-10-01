import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLACEMENT,
  createDesignDocument,
  migrateDocument,
} from "../src/domain/studio/document";
import {
  materialTransform,
  sampleMaterial,
} from "../src/domain/studio/placement";
import {
  createStudioState,
  updatePlacement,
  undoStudio,
  beginDocumentGesture,
  endDocumentGesture,
  applyMaterial,
} from "../src/application/studio/state";
import { createStudioRepository } from "../src/integration/studio/repository";
import { createMemoryJsonStorage } from "../src/integration/studio/storage";

describe("anchored placement", () => {
  for (const rotation of [-180, -90, 0, 45, 90, 180]) {
    it(`pins the material point to the garment point at ${rotation} degrees`, () => {
      const p = {
        ...DEFAULT_PLACEMENT,
        rotation,
        scale: 1.7,
        materialAnchorX: 0.23,
        materialAnchorY: 0.81,
        garmentAnchorX: 0.66,
        garmentAnchorY: 0.31,
        offsetX: 0.17,
        offsetY: -0.09,
      };
      const sample = sampleMaterial(materialTransform(p, [1, 2.075]), {
        x: p.garmentAnchorX + p.offsetX,
        y: p.garmentAnchorY - p.offsetY,
      });
      expect(sample.x).toBeCloseTo(p.materialAnchorX, 10);
      expect(sample.y).toBeCloseTo(p.materialAnchorY, 10);
    });
    it(`moves a motif horizontally in garment coordinates at ${rotation} degrees`, () => {
      const before = materialTransform(
        { ...DEFAULT_PLACEMENT, rotation },
        [1, 2.075],
      );
      const after = materialTransform(
        { ...DEFAULT_PLACEMENT, rotation, offsetX: 0.2 },
        [1, 2.075],
      );
      const original = sampleMaterial(before, { x: 0.61, y: 0.43 });
      const moved = sampleMaterial(after, { x: 0.81, y: 0.43 });
      expect(moved.x).toBeCloseTo(original.x, 10);
      expect(moved.y).toBeCloseTo(original.y, 10);
    });
  }
  it("groups an orb drag into one undo entry", () => {
    const initial = createStudioState();
    let state = beginDocumentGesture(initial);
    state = updatePlacement(state, {
      materialAnchorX: 0.2,
      garmentAnchorY: 0.6,
    });
    state = updatePlacement(state, {
      materialAnchorX: 0.3,
      garmentAnchorY: 0.8,
    });
    state = endDocumentGesture(state);
    expect(state.undoStack).toHaveLength(1);
    expect(undoStudio(state).document).toEqual(initial.document);
  });
  it("rejects nonfinite edits and bounds anchors without changing scale", () => {
    const initial = createStudioState();
    expect(updatePlacement(initial, { materialAnchorX: NaN })).toBe(initial);
    const next = updatePlacement(initial, {
      materialAnchorX: -3,
      garmentAnchorY: 3,
    });
    expect(next.document.parts.body?.placement).toMatchObject({
      scale: 1,
      materialAnchorX: 0,
      garmentAnchorY: 1,
    });
  });
  it("limits catalogue materials to supported garment kinds", () => {
    const initial = createStudioState();
    const next = applyMaterial(
      initial,
      "catalogue-synthetic-poplin-paisley-ivory-on-black",
    );
    expect(next.document).toEqual(initial.document);
    expect(next.notice).toMatch(/unavailable/);
  });
  it("migrates old browser keys without changing design IDs or deleting recovery data", () => {
    const current = createDesignDocument();
    const legacy = {
      ...current,
      schemaVersion: 1,
      parts: Object.fromEntries(
        Object.entries(current.parts).map(([key, value]) => [
          key,
          {
            ...value,
            placement: { rotation: 90, offsetX: 0.25, offsetY: -0.3 },
          },
        ]),
      ),
    };
    const storage = createMemoryJsonStorage({
      "uzbek-studio:studio:draft": { schemaVersion: 1, document: legacy },
      "uzbek-studio:studio:saved-looks": {
        schemaVersion: 1,
        looks: [{ document: legacy }],
      },
    });
    const repo = createStudioRepository(storage);
    const migrated = repo.readDraft();
    expect(migrated?.id).toBe(current.id);
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.parts.body?.placement).toEqual({
      ...DEFAULT_PLACEMENT,
      rotation: 90,
      offsetX: 0.25,
      offsetY: -0.3,
    });
    expect(repo.readLooks()[0]?.document).toEqual(migrated);
    expect(storage.read("uzbek-studio:studio:draft")).toBeTruthy();
    expect(migrateDocument({ ...legacy, parts: {} })).toBeUndefined();
  });
  it("falls back to valid legacy designs when newer cache entries are corrupt", () => {
    const document = createDesignDocument();
    const storage = createMemoryJsonStorage({
      "ocharo-studio:studio:draft": { document: { schemaVersion: 999 } },
      "ocharo-studio:studio:saved-looks": { looks: [{ document: {} }] },
      "uzbek-studio:studio:draft": { document },
      "uzbek-studio:studio:saved-looks": { looks: [{ document }] },
    });
    const repo = createStudioRepository(storage);
    expect(repo.readDraft()).toEqual(document);
    expect(repo.readLooks()).toEqual([{ document }]);
  });
  it("preserves original metallic assignments when migrating schema-one documents", () => {
    const current = createDesignDocument();
    const legacy = {
      ...current,
      schemaVersion: 1,
      parts: Object.fromEntries(
        Object.entries(current.parts).map(([key, value]) => [
          key,
          {
            ...value,
            materialId: "gold",
            placement: { rotation: 0, offsetX: 0, offsetY: 0 },
          },
        ]),
      ),
    };
    const migrated = migrateDocument(legacy);
    expect(migrated?.parts.body?.materialId).toBe("gold");
    expect(migrateDocument(migrated)).toEqual(migrated);
  });
});
