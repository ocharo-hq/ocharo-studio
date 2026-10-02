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
import {
  computed,
  effectScope,
  nextTick,
  shallowRef,
  type EffectScope,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  writable: true,
}));
vi.mock("../src/integration/studio/storage", () => ({
  createLocalJsonStorage: () => ({
    read: <T>(key: string): T | undefined => {
      const value = cache.values.get(key);
      return value === undefined ? undefined : (structuredClone(value) as T);
    },
    write: (key: string, value: unknown): boolean => {
      if (!cache.writable) return false;
      cache.values.set(key, structuredClone(value));
      return true;
    },
    remove: (key: string) => cache.values.delete(key),
    clear: () => cache.values.clear(),
  }),
}));

import {
  useStudio,
  type StudioControls,
} from "../src/application/studio/UseStudio";
import {
  useStudioOnboarding,
  type OnboardingRecord,
} from "../src/application/onboarding/UseStudioOnboarding";
import { createDesignDocument } from "../src/domain/studio/document";
import type { DesignDocument } from "../src/domain/studio/types";
import { createStudioRepository } from "../src/integration/studio/repository";
import type { StudioSnapshot } from "../src/integration/studio/serverRepository";

const scopes: EffectScope[] = [];
const empty = (
  revision = 0,
  draft: DesignDocument | null = null,
): StudioSnapshot => ({
  revision,
  draft,
  looks: [],
  settings: {},
});
const response = (snapshot: StudioSnapshot) =>
  new Response(JSON.stringify(snapshot), { status: 200 });
const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
};

function setupStudio(): { scope: EffectScope; studio: StudioControls } {
  const scope = effectScope();
  scopes.push(scope);
  const studio = scope.run(() => useStudio(createStudioRepository()))!;
  return { scope, studio };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  cache.values.clear();
  cache.writable = true;
});
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Vue studio composition", () => {
  it.each([0, 4])(
    "blocks another workspace even when its revision is %i",
    async (targetRevision) => {
      const local = {
        ...createDesignDocument(),
        name: "Private workspace recovery",
      };
      cache.values.set("ocharo-studio:studio:recovery", {
        schemaVersion: 1,
        workspaceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        revision: 4,
        pending: true,
        draft: local,
        looks: [],
        settings: {},
        materials: {},
      });
      const puts: StudioSnapshot[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, options: RequestInit) => {
          if (options.method === "GET") return response(empty(targetRevision));
          const payload = JSON.parse(options.body as string) as StudioSnapshot;
          puts.push(payload);
          return response({ ...payload, revision: payload.revision + 1 });
        }),
      );
      const { studio } = setupStudio();
      await flush();
      await vi.advanceTimersByTimeAsync(400);
      expect(studio.persistenceStatus).toBe("conflict");
      expect(studio.document.name).toBe(local.name);
      expect(puts).toHaveLength(0);
      studio.resolveConflict();
      await flush();
      await vi.advanceTimersByTimeAsync(400);
      expect(studio.document.name).not.toBe(local.name);
      expect(puts.every((value) => value.draft?.name !== local.name)).toBe(
        true,
      );
      expect(cache.values.get("ocharo-studio:conflict-recovery")).toMatchObject(
        { draft: { name: local.name } },
      );
      expect(cache.values.get("ocharo-studio:studio:recovery")).toMatchObject({
        workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
      });
    },
  );

  it("hydrates without a write and caches every valid rename before a debounced save", async () => {
    const saved = { ...createDesignDocument(), name: "Server name" };
    const puts: StudioSnapshot[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        if (options.method === "GET") return response(empty(7, saved));
        const payload = JSON.parse(options.body as string) as StudioSnapshot;
        puts.push(payload);
        return response({ ...payload, revision: payload.revision + 1 });
      }),
    );
    const { studio } = setupStudio();
    const name = computed(() => studio.document.name);
    await flush();
    expect(name.value).toBe("Server name");
    expect(studio.persistenceStatus).toBe("synced");
    await vi.advanceTimersByTimeAsync(400);
    expect(puts).toHaveLength(0);
    studio.setSelectedPartId("trim");
    studio.clearNotice();
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    expect(puts).toHaveLength(0);

    studio.beginRename();
    for (const value of ["Spring", "Spring ", "Spring atlas"]) {
      studio.rename(value);
      const recovery = cache.values.get("ocharo-studio:studio:recovery") as {
        draft: DesignDocument;
      };
      expect(recovery.draft.name).toBe(value.trim());
      expect(name.value).toBe(value.trim());
    }
    studio.endRename();
    await nextTick();
    await vi.advanceTimersByTimeAsync(349);
    expect(puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      revision: 7,
      draft: { name: "Spring atlas" },
    });
    expect(studio.persistenceStatus).toBe("synced");
    studio.undo();
    expect(name.value).toBe("Server name");
    studio.redo();
    expect(name.value).toBe("Spring atlas");
  });

  it("retains edits made while the initial server read is pending", async () => {
    let resolveRead!: (value: Response) => void;
    const puts: StudioSnapshot[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        if (options.method === "GET")
          return new Promise<Response>((resolve) => {
            resolveRead = resolve;
          });
        const payload = JSON.parse(options.body as string) as StudioSnapshot;
        puts.push(payload);
        return Promise.resolve(
          response({ ...payload, revision: payload.revision + 1 }),
        );
      }),
    );
    const { studio } = setupStudio();
    studio.rename("Made while loading");
    await flush();
    resolveRead(response(empty()));
    await flush();
    expect(studio.document.name).toBe("Made while loading");
    expect(puts[0].draft?.name).toBe("Made while loading");
    await vi.advanceTimersByTimeAsync(350);
    expect(studio.persistenceStatus).toBe("synced");
  });

  it("requires a recovery copy before replacing conflicted local work", async () => {
    const local = { ...createDesignDocument(), name: "Local recovery" };
    const remote = { ...createDesignDocument(), name: "Other tab" };
    cache.values.set("ocharo-studio:studio:draft", {
      schemaVersion: 2,
      document: local,
    });
    cache.values.set("ocharo-studio:sync", { revision: 2, pending: true });
    const fetcher = vi.fn(async () => response(empty(3, remote)));
    vi.stubGlobal("fetch", fetcher);
    const { studio } = setupStudio();
    await flush();
    expect(studio.persistenceStatus).toBe("conflict");
    expect(studio.document.name).toBe("Local recovery");
    studio.retrySync();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    cache.writable = false;
    studio.resolveConflict();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(studio.document.name).toBe("Local recovery");
    expect(studio.notice).toMatch(/Recovery could not be stored/);
    cache.writable = true;
    studio.resolveConflict();
    await flush();
    expect(studio.document.name).toBe("Other tab");
    expect(studio.persistenceStatus).toBe("synced");
    expect(cache.values.get("ocharo-studio:conflict-recovery")).toMatchObject({
      draft: { name: "Local recovery" },
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("recovers loading edits after disposal without forgetting their acknowledged base revision", async () => {
    const saved = {
      ...createDesignDocument(),
      name: "Saved before navigation",
    };
    cache.values.set("ocharo-studio:studio:draft", {
      schemaVersion: 2,
      document: saved,
    });
    cache.values.set("ocharo-studio:sync", { revision: 4, pending: false });
    let resolveInitial!: (value: Response) => void;
    const puts: StudioSnapshot[] = [];
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        if (options.method === "GET") {
          reads += 1;
          if (reads === 1)
            return new Promise<Response>((resolve) => {
              resolveInitial = resolve;
            });
          return Promise.resolve(response(empty(4, saved)));
        }
        const payload = JSON.parse(options.body as string) as StudioSnapshot;
        puts.push(payload);
        return Promise.resolve(
          response({ ...payload, revision: payload.revision + 1 }),
        );
      }),
    );
    const first = setupStudio();
    first.studio.rename("Typed before leaving");
    expect(cache.values.get("ocharo-studio:sync")).toEqual({
      revision: 4,
      pending: true,
    });
    first.scope.stop();
    const second = setupStudio();
    await flush();
    resolveInitial(response(empty(4, saved)));
    await flush();
    expect(second.studio.document.name).toBe("Typed before leaving");
    expect(puts[0]).toMatchObject({
      revision: 4,
      draft: { name: "Typed before leaving" },
    });
    expect(first.studio.document.name).toBe("Typed before leaving");
  });

  it("aborts initial reads and ignores their results after scope disposal", async () => {
    let resolveRead!: (value: Response) => void;
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal;
      return new Promise<Response>((resolve) => {
        resolveRead = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const { scope, studio } = setupStudio();
    const original = studio.document;
    await flush();
    scope.stop();
    expect(signal?.aborted).toBe(true);
    resolveRead(
      response(empty(9, { ...createDesignDocument(), name: "Late result" })),
    );
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    expect(studio.document).toBe(original);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending debounce when the owning scope ends", async () => {
    const fetcher = vi.fn(async () =>
      response(empty(1, createDesignDocument())),
    );
    vi.stubGlobal("fetch", fetcher);
    const { scope, studio } = setupStudio();
    await flush();
    studio.rename("Cached only");
    await nextTick();
    scope.stop();
    await vi.advanceTimersByTimeAsync(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.values.get("ocharo-studio:studio:recovery")).toMatchObject({
      draft: { name: "Cached only" },
    });
  });

  it("recovers an atomic material save made during loading after disposal and remount", async () => {
    const document = createDesignDocument();
    const saved = {
      ...empty(4, document),
      looks: [{ document, thumbnail: "stale" }],
    };
    cache.values.set("ocharo-studio:studio:draft", {
      schemaVersion: 2,
      document,
    });
    cache.values.set("ocharo-studio:studio:saved-looks", {
      schemaVersion: 2,
      looks: saved.looks,
    });
    cache.values.set("ocharo-studio:sync", { revision: 4, pending: false });
    let readCount = 0;
    let resolveInitial!: (value: Response) => void;
    const puts: StudioSnapshot[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        if (options.method === "GET") {
          if (++readCount === 1)
            return new Promise<Response>((resolve) => {
              resolveInitial = resolve;
            });
          return Promise.resolve(response(saved));
        }
        const value = JSON.parse(options.body as string) as StudioSnapshot;
        puts.push(value);
        return Promise.resolve(
          response({ ...value, revision: value.revision + 1 }),
        );
      }),
    );
    const first = setupStudio();
    const scale = computed(() => first.studio.materials["atlas-rose"]?.scale);
    expect(first.studio.saveMaterialScale("atlas-rose", 2.5)).toBe(true);
    expect(scale.value).toBe(2.5);
    expect(first.studio.countMaterialUses("atlas-rose")).toEqual({
      draftParts: 1,
      savedParts: 1,
      savedLooks: 1,
      total: 2,
    });
    const recovery = cache.values.get("ocharo-studio:studio:recovery");
    expect(recovery).toMatchObject({
      revision: 4,
      pending: true,
      materials: { "atlas-rose": { scale: 2.5, revision: 1 } },
      draft: { parts: { body: { placement: { scale: 2.5 } } } },
      looks: [{ document: { parts: { body: { placement: { scale: 2.5 } } } } }],
    });
    expect(first.studio.looks[0]?.thumbnail).toBe("stale");
    expect(first.studio.saveMaterialScale("atlas-rose", NaN)).toBe(false);
    expect(cache.values.get("ocharo-studio:studio:recovery")).toEqual(recovery);
    first.scope.stop();
    const second = setupStudio();
    await flush();
    resolveInitial(response(saved));
    await flush();
    expect(second.studio.materials["atlas-rose"].scale).toBe(2.5);
    expect(second.studio.document.parts.body!.placement.scale).toBe(2.5);
    expect(second.studio.looks[0]?.thumbnail).toBe("stale");
    expect(puts[0]).toMatchObject({
      materials: { "atlas-rose": { scale: 2.5 } },
    });
    expect(
      JSON.parse(second.studio.exportLook()).parts.body.placement.scale,
    ).toBe(2.5);
  });

  it("rejects an invalid remote library without discarding the local library or look", async () => {
    const document = createDesignDocument();
    const materials = {
      "atlas-rose": {
        scale: 2,
        revision: 1,
        updatedAt: "2026-09-26T10:00:00.000Z",
      },
    };
    const repo = createStudioRepository();
    repo.writeRecovery({
      revision: 4,
      pending: false,
      draft: document,
      looks: [],
      materials,
      settings: {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          ...empty(5, createDesignDocument("abaya")),
          materials: {
            "atlas-rose": {
              scale: 20,
              revision: 2,
              updatedAt: "2026-09-26T10:00:00.000Z",
            },
          },
        }),
      ),
    );
    const { studio } = setupStudio();
    await flush();
    expect(studio.persistenceStatus).toBe("offline");
    expect(studio.document.garmentId).toBe("nimcha");
    expect(studio.materials).toEqual(materials);
    expect(studio.notice).not.toContain("Incompatible");
    expect(studio.notice).toContain("Changes remain in this browser");
    expect(repo.readRecovery()?.materials).toEqual(materials);
  });

  it("reacts to hydrated onboarding settings and keeps manual guides available", async () => {
    const enabled = shallowRef(false);
    const record = shallowRef<OnboardingRecord>({
      invitations: 0,
      hiddenPermanently: false,
    });
    const scope = effectScope();
    scopes.push(scope);
    const onboarding = scope.run(() =>
      useStudioOnboarding(() => ({
        value: record.value,
        enabled: enabled.value,
        onChange: (next) => {
          record.value = next;
        },
      })),
    )!;
    expect(onboarding.isOpen).toBe(false);
    enabled.value = true;
    await nextTick();
    expect(onboarding.isOpen).toBe(true);
    onboarding.skip();
    await nextTick();
    expect(record.value.invitations).toBe(1);
    expect(onboarding.showLauncher).toBe(true);
    expect(onboarding.isOpen).toBe(false);
    record.value = { invitations: 2, hiddenPermanently: true };
    await nextTick();
    expect(onboarding.showLauncher).toBe(false);
    onboarding.openGuide();
    expect(onboarding.isOpen).toBe(true);
    expect(onboarding.isGuide).toBe(true);
    onboarding.complete();
    expect(onboarding.isOpen).toBe(false);
    expect(record.value.invitations).toBe(2);
    expect(record.value.completedAt).toBeDefined();
  });
});

describe("server-confirmed Studio look library", () => {
  it("keeps the saved library unchanged until an acknowledged write and the independent GET", async () => {
    let reads = 0;
    let acknowledge!: (value: Response) => void;
    let project!: (value: Response) => void;
    const initial = createDesignDocument();
    const request = vi.fn((_url: string, options: RequestInit) => {
      if (options.method === "GET") {
        reads++;
        if (reads === 1) return Promise.resolve(response(empty(1, initial)));
        return new Promise<Response>((resolve) => {
          project = resolve;
        });
      }
      return new Promise<Response>((resolve) => {
        acknowledge = resolve;
      });
    });
    vi.stubGlobal("fetch", request);
    const { studio } = setupStudio();
    await flush();
    studio.saveLook();
    expect(studio.looks).toEqual([]);
    expect(studio.refreshingLooks).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(reads).toBe(1);
    expect(studio.looks).toEqual([]);
    const submitted = JSON.parse(
      String(
        request.mock.calls.find((call) => call[1].method === "PUT")![1].body,
      ),
    ) as StudioSnapshot;
    acknowledge(response({ ...submitted, revision: 2 }));
    await flush();
    expect(reads).toBe(2);
    expect(studio.looks).toEqual([]);
    expect(studio.refreshingLooks).toBe(true);
    const authoritative = {
      ...submitted,
      revision: 2,
      looks: submitted.looks.map((look) => ({
        ...look,
        document: { ...look.document, name: "Read-confirmed look" },
      })),
    };
    project(response(authoritative));
    await flush();
    expect(studio.refreshingLooks).toBe(false);
    expect(studio.looks[0]?.document.name).toBe("Read-confirmed look");
  });
  it("retains the saved library and recoverable local work after a failed write", async () => {
    const document = createDesignDocument();
    const saved = {
      ...empty(3, document),
      looks: [{ document, thumbnail: "confirmed" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) =>
        options.method === "GET"
          ? response(saved)
          : new Response("private transport detail", { status: 503 }),
      ),
    );
    const { studio } = setupStudio();
    await flush();
    studio.deleteLook(document.id);
    expect(studio.looks[0]?.thumbnail).toBe("confirmed");
    await vi.advanceTimersByTimeAsync(400);
    expect(studio.looks[0]?.thumbnail).toBe("confirmed");
    expect(studio.persistenceStatus).toBe("offline");
    expect(studio.notice).not.toContain("private transport detail");
    expect(createStudioRepository().readRecovery()?.looks).toEqual([]);
  });
});
