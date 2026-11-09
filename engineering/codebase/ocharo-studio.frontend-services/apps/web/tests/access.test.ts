import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStatus } from "@wow-two-beta/fe/auth";

const workspaceId = "d0a8c678-c27f-478f-b4e8-c9928bf88c21";
const session = {
  workspaceId,
  userId: "user-a",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  canEdit: true,
};
const csrfToken = "verified-server-csrf-token-123456";
const json = (value: unknown, status = 200) => Response.json(value, { status });
const state = {
  revision: 0,
  draft: null,
  looks: [],
  settings: {},
  materials: {},
};

/** Signs the cached account state in, as startup does for a returning visitor. */
async function signIn() {
  const { initializeIdentity } =
    await import("../src/integration/studio/clients/IdentityAccess");
  await initializeIdentity(
    vi.fn().mockResolvedValue(
      json({
        data: {
          isAuthenticated: true,
          person: { sub: "user-a" },
          permissions: [],
          csrfToken,
        },
      }),
    ),
  );
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
describe("Studio session boundary", () => {
  it("uses the server-owned workspace and the session cookie without a bearer", async () => {
    await signIn();
    const { createServerRepository } =
      await import("../src/integration/studio/clients/ServerRepository");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json(state));
    await createServerRepository(fetcher).read();
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "same-origin",
    });
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "same-origin",
    });
    const headers = new Headers(fetcher.mock.calls[1][1].headers);
    expect(headers.get("X-Studio-Workspace")).toBe(workspaceId);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("keeps browser-only data local and stops on revoked membership", async () => {
    const { createServerRepository } =
      await import("../src/integration/studio/clients/ServerRepository");
    const fetcher = vi.fn();
    await expect(createServerRepository(fetcher).read()).rejects.toThrow(
      /Browser-only/,
    );
    expect(fetcher).not.toHaveBeenCalled();
    await signIn();
    fetcher
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({}, 403));
    await expect(createServerRepository(fetcher).read()).rejects.toThrow(
      /access changed/,
    );
  });

  it("rejects a member with no organization role without expiring the session", async () => {
    await signIn();
    const { createServerRepository } =
      await import("../src/integration/studio/clients/ServerRepository");
    const { studioAuth } =
      await import("../src/integration/studio/clients/StudioAuth");
    const unauthorized = vi.fn();
    studioAuth.subscribeUnauthorized(unauthorized);
    await expect(
      createServerRepository(vi.fn(async () => json({}, 403))).read(),
    ).rejects.toThrow(/no role/);
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it("rejects a malformed Studio session", async () => {
    const { loadStudioSession } =
      await import("../src/integration/studio/clients/StudioAuth");
    for (const value of [
      { ...session, workspaceId: "not-a-uuid" },
      { ...session, userId: "" },
      { ...session, canEdit: "yes" },
    ])
      await expect(
        loadStudioSession(vi.fn(async () => json(value))),
      ).rejects.toThrow(/Invalid/);
  });

  it("aborts before a state request after cancelled authorization", async () => {
    await signIn();
    const { createServerRepository } =
      await import("../src/integration/studio/clients/ServerRepository");
    const abort = new AbortController();
    const fetcher = vi.fn(async () => {
      abort.abort();
      return json(session);
    });
    await expect(
      createServerRepository(fetcher).read(abort.signal),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("settles the bridge anonymous after an Identity sign-out", async () => {
    await signIn();
    const access = await import("../src/integration/studio/clients/StudioAuth");
    await access.loadStudioSession(vi.fn(async () => json(session)));
    expect(access.studioAuth.getSession().status).toBe(
      AuthStatus.Authenticated,
    );
    expect(
      await access.signOutStudio(
        vi.fn(async () => json({ data: {} })),
        vi.fn(),
      ),
    ).toBe(true);
    expect(access.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    expect(access.getConnectedSession()).toBeUndefined();
  });
});
