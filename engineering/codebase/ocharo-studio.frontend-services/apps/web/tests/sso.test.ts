import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const csrfToken = "verified-server-csrf-token-123456";
const studio = {
  workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  userId: "user-a",
  canEdit: true,
  expiresAt: "2099-01-01T00:00:00Z",
};
const snapshot = {
  revision: 0,
  draft: null,
  looks: [],
  settings: {},
  materials: {},
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("shared Ocharo session", () => {
  it("keeps grants out of browser storage and removes obsolete manual tickets", async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("sessionStorage", storage);
    const { initializeSso, getSsoSession } =
      await import("../src/integration/studio/SsoAccess");
    await initializeSso(
      vi.fn().mockResolvedValue(
        response({
          data: {
            enabled: true,
            authenticated: true,
            csrfToken,
            refreshToken: "never-retained",
            ticket: "never-retained",
          },
        }),
      ),
    );
    expect(getSsoSession()).toEqual({
      enabled: true,
      authenticated: true,
      csrfToken,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledWith(
      "ocharo-studio:integration-ticket",
    );
  });

  it("limits the central account link to a plain HTTPS origin", async () => {
    const { initializeSso } =
      await import("../src/integration/studio/SsoAccess");
    for (const accountUrl of [
      "javascript:alert(1)",
      "https://user:pass@desk.test",
      "https://desk.test/path",
      "https://desk.test/?secret=x",
    ]) {
      const session = await initializeSso(
        vi.fn().mockResolvedValue(
          response({
            data: {
              enabled: true,
              authenticated: true,
              csrfToken,
              accountUrl,
            },
          }),
        ),
      );
      expect(session.accountUrl).toBeUndefined();
    }
    expect(
      (
        await initializeSso(
          vi.fn().mockResolvedValue(
            response({
              data: {
                enabled: true,
                authenticated: true,
                csrfToken,
                accountUrl: "https://desk.test",
              },
            }),
          ),
        )
      ).accountUrl,
    ).toBe("https://desk.test");
  });

  it("adds cookie credentials and CSRF only to acknowledged-session writes", async () => {
    const { initializeSso } =
      await import("../src/integration/studio/SsoAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeSso(
      vi
        .fn()
        .mockResolvedValue(
          response({ data: { enabled: true, authenticated: true, csrfToken } }),
        ),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(studio))
      .mockResolvedValueOnce(response(snapshot))
      .mockResolvedValueOnce(response({ ...snapshot, revision: 1 }));
    const ticketReader = vi.fn(() => "stale-ticket");
    const repository = createServerRepository(fetcher, ticketReader);
    await repository.read();
    await repository.write(snapshot);
    expect(ticketReader).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "same-origin",
      method: "GET",
    });
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty("X-CSRF-Token");
    expect(fetcher.mock.calls[2][1]).toMatchObject({
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": csrfToken,
        "X-Studio-Workspace": studio.workspaceId,
      },
    });
    for (const call of fetcher.mock.calls)
      expect(call[1].headers).not.toHaveProperty("Authorization");
  });

  it("does not downgrade unavailable authentication to a manual ticket", async () => {
    const { initializeSso, ssoUnavailable } =
      await import("../src/integration/studio/SsoAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await expect(
      initializeSso(vi.fn().mockResolvedValue(response({}, 503))),
    ).rejects.toThrow(/checked/);
    expect(ssoUnavailable()).toBe(true);
    const fetcher = vi.fn();
    await expect(
      createServerRepository(fetcher, () => "stale-ticket").read(),
    ).rejects.toThrow(/checked/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed sessions and authenticated sessions without CSRF", async () => {
    const { initializeSso } =
      await import("../src/integration/studio/SsoAccess");
    for (const data of [
      { enabled: true, authenticated: true },
      { enabled: "true", authenticated: true },
      null,
    ]) {
      await expect(
        initializeSso(vi.fn().mockResolvedValue(response({ data }))),
      ).rejects.toThrow(/Invalid/);
    }
  });

  it("requires an authenticated shared session even if an old ticket remains", async () => {
    const { initializeSso } =
      await import("../src/integration/studio/SsoAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeSso(
      vi
        .fn()
        .mockResolvedValue(
          response({ data: { enabled: true, authenticated: false } }),
        ),
    );
    const fetcher = vi.fn();
    await expect(
      createServerRepository(fetcher, () => "old-ticket").read(),
    ).rejects.toThrow(/Sign in/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps reader work local and never retries a revoked write", async () => {
    const { initializeSso } =
      await import("../src/integration/studio/SsoAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeSso(
      vi
        .fn()
        .mockResolvedValue(
          response({ data: { enabled: true, authenticated: true, csrfToken } }),
        ),
    );
    const readerFetch = vi
      .fn()
      .mockResolvedValue(response({ ...studio, canEdit: false }));
    await expect(
      createServerRepository(readerFetch).write(snapshot),
    ).rejects.toThrow(/viewing only/);
    expect(readerFetch).toHaveBeenCalledTimes(1);
    const writerFetch = vi
      .fn()
      .mockResolvedValueOnce(response(studio))
      .mockResolvedValueOnce(response({}, 401));
    await expect(
      createServerRepository(writerFetch).write(snapshot),
    ).rejects.toThrow(/access changed/);
    expect(writerFetch).toHaveBeenCalledTimes(2);
  });

  it("returns only local destinations to the backend redirect handler", async () => {
    const { ssoLoginUrl } = await import("../src/integration/studio/SsoAccess");
    expect(ssoLoginUrl("/studio/materials?tab=fabric")).toBe(
      "/api/sso/login?returnUrl=%2Fstudio%2Fmaterials%3Ftab%3Dfabric",
    );
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/api/sso/logout",
      "/%2f%2fevil.test",
      "/" + "a".repeat(2049),
      "/\\evil.test",
      "/\nLocation:evil",
    ]) {
      expect(ssoLoginUrl(value)).toBe("/api/sso/login?returnUrl=%2F");
    }
  });
});
