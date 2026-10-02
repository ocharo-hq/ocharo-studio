vi.mock("../src/integration/studio/access", () => ({
  getIntegrationTicket: () => "fixture-ticket",
  loadStudioSession: async () => ({
    workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
    userId: "fixture-member",
    organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
    canEdit: true,
    expiresAt: "2099-01-01T00:00:00Z",
  }),
}));
import { describe, expect, it, vi } from "vitest";
import {
  applyMaterial,
  chooseGarment,
  createStudioState,
  importLook,
  newDesign,
  openLook,
  redoStudio,
  resetPlacement,
  saveMaterialScale,
  selectPart,
  undoStudio,
  updatePlacement,
} from "../src/application/studio/state";
import {
  createDesignDocument,
  serializeDocument,
} from "../src/domain/studio/document";
import {
  countMaterialUses,
  migrateMaterialScales,
} from "../src/domain/studio/materials";
import type {
  MaterialScaleLibrary,
  TexturePlacement,
} from "../src/domain/studio/types";
import { createStudioRepository } from "../src/integration/studio/repository";
import { createServerRepository } from "../src/integration/studio/serverRepository";
import { createMemoryJsonStorage } from "../src/integration/studio/storage";

const NOW = "2026-09-26T10:00:00.000Z";
const scales = (scale = 2): MaterialScaleLibrary => ({
  "atlas-rose": { scale, revision: 1, updatedAt: NOW },
});
function legacyDocument() {
  const document = createDesignDocument("nimcha", NOW);
  document.parts.body!.placement = {
    ...document.parts.body!.placement,
    scale: 1.5,
    rotation: 37,
    offsetX: 0.3,
    materialAnchorX: 0.2,
    garmentAnchorY: 0.8,
  };
  document.parts.collar = {
    materialId: "atlas-rose",
    placement: { ...document.parts.collar!.placement, scale: 0.75 },
  };
  return document;
}

describe("shared material scales", () => {
  it("migrates an absent library without adopting legacy per-part scales", () => {
    expect(migrateMaterialScales(undefined)).toEqual({});
    const document = legacyDocument();
    const state = createStudioState(document, [
      { document, thumbnail: "existing" },
    ]);
    expect(state.materials).toEqual({});
    expect(state.document).toEqual(document);
    expect(state.looks[0].thumbnail).toBe("existing");
  });

  it("rejects malformed IDs, ranges, revisions, timestamps and unknown fields", () => {
    for (const value of [
      null,
      [],
      { missing: { scale: 2, revision: 1, updatedAt: NOW } },
      ...[0, 4.01, NaN, "2"].map((scale) => ({
        "atlas-rose": { scale, revision: 1, updatedAt: NOW },
      })),
      ...[0, 1.5, Number.MAX_SAFE_INTEGER + 1].map((revision) => ({
        "atlas-rose": { scale: 2, revision, updatedAt: NOW },
      })),
      {
        "atlas-rose": {
          scale: 2,
          revision: 1,
          updatedAt: "2026-02-31T10:00:00.000Z",
        },
      },
      {
        "atlas-rose": {
          scale: 2,
          revision: 1,
          updatedAt: "2026-09-26T10:00:00Z",
        },
      },
      { "atlas-rose": { scale: 2, revision: 1, updatedAt: NOW, extra: true } },
    ])
      expect(migrateMaterialScales(value)).toBeUndefined();
    expect(migrateMaterialScales(scales(0.25))).toEqual(scales(0.25));
    expect(migrateMaterialScales(scales(4))).toEqual(scales(4));
  });

  it("atomically updates every matching assignment and clears only changed thumbnails", () => {
    const document = legacyDocument();
    const other = createDesignDocument("baska", NOW);
    const state = createStudioState(document, [
      { document, thumbnail: "stale" },
      { document: other, thumbnail: "unaffected" },
    ]);
    const next = saveMaterialScale(state, "atlas-rose", 2.5, NOW);
    expect(next.materials).toEqual(scales(2.5));
    for (const value of [next.document, next.looks[0].document]) {
      expect(value.parts.body!.placement).toEqual({
        ...document.parts.body!.placement,
        scale: 2.5,
      });
      expect(value.parts.collar!.placement.scale).toBe(2.5);
      expect(value.parts.trim).toEqual(document.parts.trim);
    }
    expect(next.looks[0]).not.toHaveProperty("thumbnail");
    expect(next.looks[1]).toBe(state.looks[1]);
    expect(countMaterialUses(next.document, next.looks, "atlas-rose")).toEqual({
      draftParts: 2,
      savedParts: 2,
      savedLooks: 1,
      total: 4,
    });
    expect(state.document.parts.body!.placement.scale).toBe(1.5);
    expect(state.looks[0].thumbnail).toBe("stale");
  });

  it("preserves already-correct thumbnails and does not increment unchanged scales", () => {
    const document = createDesignDocument("nimcha", NOW);
    const state = createStudioState(document, [
      { document, thumbnail: "still-correct" },
    ]);
    const next = saveMaterialScale(state, "atlas-rose", 1, NOW);
    expect(next.looks).toBe(state.looks);
    expect(next.materials["atlas-rose"].revision).toBe(1);
    expect(saveMaterialScale(next, "atlas-rose", 1, NOW)).toBe(next);
    expect(
      saveMaterialScale(next, "atlas-rose", 2, NOW).materials["atlas-rose"]
        .revision,
    ).toBe(2);
  });

  it("rejects invalid shared writes and generic scale edits without partial changes", () => {
    const state = createStudioState(legacyDocument());
    for (const value of [NaN, Infinity, 0.2, 4.1])
      expect(saveMaterialScale(state, "atlas-rose", value, NOW)).toBe(state);
    expect(saveMaterialScale(state, "unknown", 2, NOW)).toBe(state);
    expect(saveMaterialScale(state, "atlas-rose", 2, "invalid")).toBe(state);
    expect(
      updatePlacement(state, {
        scale: 2,
        offsetX: 0.7,
      } as Partial<TexturePlacement>),
    ).toBe(state);
  });

  it("prevents undo or redo from resurrecting a superseded shared scale", () => {
    let state = createStudioState();
    state = updatePlacement(state, { rotation: 45 });
    state = applyMaterial(state, "adras-indigo");
    state = saveMaterialScale(state, "atlas-rose", 3, NOW);
    const undo = undoStudio(state);
    expect(undo.document.parts.body).toMatchObject({
      materialId: "atlas-rose",
      placement: { scale: 3, rotation: 45 },
    });
    expect(undoStudio(undo).document.parts.body!.placement.scale).toBe(3);
    const redone = redoStudio(undoStudio(undo));
    expect(redone.document.parts.body!.placement.scale).toBe(3);
    expect(redone.materials).toBe(state.materials);
  });

  it("resolves shared scales for assignments, new designs, garment changes and saved looks", () => {
    let state = createStudioState(undefined, [], scales(3));
    expect(state.document.parts.body!.placement.scale).toBe(3);
    state = chooseGarment(state, "baska");
    state = applyMaterial(state, "atlas-rose");
    expect(state.document.parts.body!.placement.scale).toBe(3);
    expect(
      chooseGarment(state, "nimcha").document.parts.body!.placement.scale,
    ).toBe(3);
    expect(newDesign(state).document.parts.body!.placement.scale).toBe(3);
    const document = legacyDocument();
    const loaded = createStudioState(
      undefined,
      [{ document, thumbnail: "stale" }],
      scales(3),
    );
    expect(
      openLook(loaded, document.id).document.parts.body!.placement.scale,
    ).toBe(3);
    expect(loaded.looks[0]).not.toHaveProperty("thumbnail");
  });

  it("placement reset preserves shared and legacy scales while resetting allowed fields", () => {
    const legacy = createStudioState(legacyDocument());
    const resetLegacy = resetPlacement(legacy);
    expect(resetLegacy.document.parts.body!.placement.scale).toBe(1.5);
    expect(resetLegacy.document.parts.body!.placement.rotation).toBe(0);
    let shared = createStudioState(legacyDocument(), [], scales(3));
    shared = selectPart(shared, "collar", true);
    const reset = resetPlacement(shared);
    expect(reset.document.parts.body!.placement).toMatchObject({
      scale: 3,
      offsetX: 0,
      rotation: 37,
      materialAnchorX: 0.2,
    });
    expect(reset.document.parts.collar!.placement.scale).toBe(3);
    expect(reset.materials).toBe(shared.materials);
  });

  it("new assignments use the target scale without inheriting the previous fabric's legacy scale", () => {
    const initial = createStudioState(legacyDocument());
    const next = applyMaterial(initial, "adras-indigo", NOW);
    expect(next.document.parts.body!.placement).toEqual({
      ...initial.document.parts.body!.placement,
      scale: 1,
    });
    expect(next.document.parts.collar!.placement.scale).toBe(0.75);
    const shared = saveMaterialScale(initial, "adras-indigo", 2.75, NOW);
    expect(
      applyMaterial(shared, "adras-indigo", NOW).document.parts.body!.placement
        .scale,
    ).toBe(2.75);
    // Selecting the same material is not a new assignment: existing legacy scale survives.
    expect(applyMaterial(initial, "atlas-rose", NOW)).toBe(initial);
  });

  it("imports portable documents using workspace overrides with an explicit notice", () => {
    const source = legacyDocument();
    const imported = importLook(
      createStudioState(undefined, [], scales(2)),
      serializeDocument(source),
    );
    expect(imported.document.schemaVersion).toBe(2);
    expect(imported.document.parts.body!.placement.scale).toBe(2);
    expect(imported.notice).toContain("workspace's saved material scales");
    expect(
      JSON.parse(serializeDocument(imported.document)).parts.body.placement
        .scale,
    ).toBe(2);
    expect(source.parts.body!.placement.scale).toBe(1.5);
  });
});

describe("material library recovery and transport", () => {
  it("commits documents, library and revision together or preserves the previous recovery", () => {
    const storage = createMemoryJsonStorage();
    const write = vi.spyOn(storage, "write");
    const repo = createStudioRepository(storage);
    const initial = {
      draft: legacyDocument(),
      looks: [],
      materials: {},
      settings: {},
      revision: 4,
      pending: false,
    };
    expect(repo.writeRecovery(initial)).toBe(true);
    const state = saveMaterialScale(
      createStudioState(initial.draft),
      "atlas-rose",
      2,
      NOW,
    );
    const next = {
      ...initial,
      draft: state.document,
      materials: state.materials,
      pending: true,
    };
    write.mockReturnValueOnce(false);
    expect(repo.writeRecovery(next)).toBe(false);
    expect(repo.readRecovery()).toEqual(initial);
    expect(repo.writeRecovery(next)).toBe(true);
    expect(repo.readRecovery()).toEqual(next);
    expect(repo.readDraft()).toEqual(next.draft);
    expect(
      write.mock.calls.every(
        ([key]) => key === "ocharo-studio:studio:recovery",
      ),
    ).toBe(true);
  });

  it("rejects corrupted recovery libraries without falling back to stale split records", () => {
    const storage = createMemoryJsonStorage({
      "ocharo-studio:studio:recovery": {
        schemaVersion: 1,
        draft: legacyDocument(),
        looks: [],
        materials: null,
        settings: {},
        revision: 1,
        pending: true,
      },
      "ocharo-studio:studio:draft": {
        schemaVersion: 2,
        document: createDesignDocument(),
      },
    });
    expect(() => createStudioRepository(storage).readRecovery()).toThrow(
      /invalid/,
    );
  });

  it("accepts legacy server snapshots but rejects malformed material responses and writes", async () => {
    const value = {
      revision: 1,
      draft: legacyDocument(),
      looks: [],
      settings: {},
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(value)));
    const repo = createServerRepository(fetcher, () => "fixture-ticket");
    expect((await repo.read()).materials).toEqual({});
    fetcher.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ...value,
            materials: {
              "atlas-rose": { scale: 20, revision: 1, updatedAt: NOW },
            },
          }),
        ),
    );
    await expect(repo.read()).rejects.toThrow(/Incompatible/);
    const before = fetcher.mock.calls.length;
    await expect(
      repo.write({ ...value, materials: scales(20) }),
    ).rejects.toThrow(/Invalid material/);
    expect(fetcher).toHaveBeenCalledTimes(before);
  });

  it("surfaces backend validation details while retaining a fallback for invalid error bodies", async () => {
    const message =
      "Material metadata is required. Reload or upgrade the studio before saving.";
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ errors: { materials: [message] } }), {
          status: 400,
        }),
    );
    const repo = createServerRepository(fetcher, () => "fixture-ticket");
    await expect(repo.read()).rejects.toThrow("Review your design settings. Your browser keeps a recovery copy.");
    fetcher.mockImplementation(
      async () => new Response("Bad request", { status: 400 }),
    );
    await expect(repo.read()).rejects.toThrow(
      "Review your design settings. Your browser keeps a recovery copy.",
    );
  });
});
