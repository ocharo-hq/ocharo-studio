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
import { describe, it, expect, vi } from "vitest";
import {
  StudioConflict,
  StudioSyncQueue,
  createServerRepository,
  type StudioSnapshot,
} from "../src/integration/studio/serverRepository";
import { createDesignDocument } from "../src/domain/studio/document";

const snapshot = (): StudioSnapshot => ({
  revision: 0,
  draft: createDesignDocument(),
  looks: [],
  settings: {},
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("database synchronization", () => {
  it("serializes overlapping writes using acknowledged revisions", async () => {
    const pending: Array<(state: StudioSnapshot) => void> = [];
    const writes: StudioSnapshot[] = [];
    const status = vi.fn();
    const queue = new StudioSyncQueue(
      {
        read: async () => snapshot(),
        write: async (state) => {
          writes.push(state);
          return new Promise((resolve) => pending.push(resolve));
        },
      },
      5,
      status,
    );
    const first = snapshot(),
      last = { ...snapshot(), settings: { theme: "dark" } };
    queue.push(first);
    queue.push(last);
    expect(writes).toHaveLength(1);
    expect(writes[0].revision).toBe(5);
    pending[0]({ ...first, revision: 6 });
    await tick();
    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({
      revision: 6,
      settings: { theme: "dark" },
    });
    pending[1]({ ...last, revision: 7 });
    await tick();
    expect(status).toHaveBeenLastCalledWith("synced", undefined, 7, last);
    queue.stop();
  });
  it("halts after a conflict without silently overwriting server state", async () => {
    const write = vi.fn().mockRejectedValue(new StudioConflict());
    const status = vi.fn();
    const queue = new StudioSyncQueue(
      { read: async () => snapshot(), write },
      0,
      status,
    );
    queue.push(snapshot());
    await tick();
    queue.push(snapshot());
    await tick();
    expect(write).toHaveBeenCalledTimes(1);
    expect(status.mock.calls.at(-1)?.[0]).toBe("conflict");
    expect(status.mock.calls.at(-1)?.[1]).toBeInstanceOf(StudioConflict);
    queue.stop();
  });
  it("retries an offline write without claiming it was saved", async () => {
    const state = snapshot();
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ...state, revision: 1 });
    const status = vi.fn();
    const queue = new StudioSyncQueue(
      { read: async () => state, write },
      0,
      status,
    );
    queue.push(state);
    await tick();
    expect(status.mock.calls.at(-1)?.[0]).toBe("offline");
    queue.retry();
    await tick();
    expect(status.mock.calls.at(-1)?.[0]).toBe("synced");
    queue.stop();
  });
  it("uses isolated workspace headers and rejects invalid server responses", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ revision: 1, draft: {}, looks: [], settings: {} }),
          { status: 200 },
        ),
      );
    const repo = createServerRepository(fetcher, () => "fixture-ticket");
    await expect(repo.read()).rejects.toThrow(/Incompatible/);
    expect(fetcher.mock.calls[0][1].headers["X-Studio-Workspace"]).toBe(
      "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
    );
  });
});
