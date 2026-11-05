import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const csrfToken = "verified-server-csrf-token-123456";
const studio = {
  workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  userId: "user-a",
  canEdit: true,
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
/** A signed-in `/api/identity/session` body; `person` fields override the defaults. */
const signedIn = (person: Record<string, unknown> = {}) => ({
  data: {
    isAuthenticated: true,
    person: { sub: "user-a", ...person },
    organization: { id: studio.organizationId, role: "owner" },
    permissions: ["studio:edit"],
    csrfToken,
    expiresAt: "2099-01-01T00:00:00Z",
  },
});
const signedOut = { data: { isAuthenticated: false } };
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("shared Ocharo session", () => {
  it("keeps grants out of the cached state and browser storage", async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("sessionStorage", storage);
    const { initializeIdentity, getIdentitySession } =
      await import("../src/integration/studio/IdentityAccess");
    await initializeIdentity(
      vi.fn().mockResolvedValue(
        response({
          data: {
            ...signedIn().data,
            refreshToken: "never-retained",
            permissions: ["never-retained"],
          },
        }),
      ),
    );
    expect(getIdentitySession()).toEqual({ authenticated: true, csrfToken });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("carries the person's name and email while authenticated", async () => {
    const { initializeIdentity, getIdentitySession } =
      await import("../src/integration/studio/IdentityAccess");
    await initializeIdentity(
      vi.fn().mockResolvedValue(
        response(
          signedIn({
            name: "  Maftuna Rakhimova ",
            email: "maftuna@ocharo.example",
          }),
        ),
      ),
    );
    expect(getIdentitySession()).toEqual({
      authenticated: true,
      csrfToken,
      name: "Maftuna Rakhimova",
      email: "maftuna@ocharo.example",
    });
  });

  it("reads a session without a name or email, or with null ones, as unnamed", async () => {
    const { initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    for (const person of [{}, { name: null, email: null }]) {
      const session = await initializeIdentity(
        vi.fn().mockResolvedValue(response(signedIn(person))),
      );
      expect(session).toEqual({ authenticated: true, csrfToken });
    }
  });

  it("drops a name or email that is blank, oversized, not text or holds control characters", async () => {
    const { initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    for (const [name, email] of [
      ["   ", ""],
      ["a".repeat(201), `${"a".repeat(250)}@ocharo.example`],
      [42, { address: "maftuna@ocharo.example" }],
      ["Maftuna\nRakhimova", "maftuna@ocharo.example\u0000"],
    ]) {
      const session = await initializeIdentity(
        vi.fn().mockResolvedValue(response(signedIn({ name, email }))),
      );
      expect(session.name).toBeUndefined();
      expect(session.email).toBeUndefined();
    }
  });

  it("names no one in a session that is not signed in, and forgets the name on sign-out", async () => {
    const { getIdentitySession, initializeIdentity, signOutIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    const anonymous = await initializeIdentity(
      vi.fn().mockResolvedValue(
        response({
          data: {
            isAuthenticated: false,
            person: { sub: "user-a", name: "Maftuna Rakhimova" },
          },
        }),
      ),
    );
    expect(anonymous).toEqual({ authenticated: false });
    await initializeIdentity(
      vi
        .fn()
        .mockResolvedValue(response(signedIn({ name: "Maftuna Rakhimova" }))),
    );
    expect(
      await signOutIdentity(
        vi.fn().mockResolvedValue(response({ data: {} })),
        vi.fn(),
      ),
    ).toBe(true);
    expect(getIdentitySession()).toEqual({ authenticated: false });
  });

  it("adds cookie credentials and CSRF only to writes of the signed-in session", async () => {
    const { initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeIdentity(vi.fn().mockResolvedValue(response(signedIn())));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(studio))
      .mockResolvedValueOnce(response(snapshot))
      .mockResolvedValueOnce(response({ ...snapshot, revision: 1 }));
    const repository = createServerRepository(fetcher);
    await repository.read();
    await repository.write(snapshot);
    expect(fetcher.mock.calls[0][0]).toBe("/api/studio/session");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "same-origin",
    });
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "same-origin",
      method: "GET",
    });
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty("X-Csrf-Token");
    expect(fetcher.mock.calls[2][1]).toMatchObject({
      credentials: "same-origin",
      headers: {
        "X-Csrf-Token": csrfToken,
        "X-Studio-Workspace": studio.workspaceId,
      },
    });
    for (const call of fetcher.mock.calls)
      expect(call[1].headers ?? {}).not.toHaveProperty("Authorization");
  });

  it("does not sync when the account session could not be checked", async () => {
    const { initializeIdentity, identityUnavailable } =
      await import("../src/integration/studio/IdentityAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await expect(
      initializeIdentity(vi.fn().mockResolvedValue(response({}, 503))),
    ).rejects.toThrow(/checked/);
    expect(identityUnavailable()).toBe(true);
    const fetcher = vi.fn();
    await expect(createServerRepository(fetcher).read()).rejects.toThrow(
      /checked/,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed sessions and authenticated sessions without a person or CSRF", async () => {
    const { initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    for (const data of [
      { isAuthenticated: true, person: { sub: "user-a" } },
      { isAuthenticated: true, csrfToken },
      { isAuthenticated: true, person: { sub: "" }, csrfToken },
      { isAuthenticated: "true" },
      null,
    ]) {
      await expect(
        initializeIdentity(vi.fn().mockResolvedValue(response({ data }))),
      ).rejects.toThrow(/Invalid/);
    }
  });

  it("stays browser-only without a session", async () => {
    const { initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeIdentity(vi.fn().mockResolvedValue(response(signedOut)));
    const fetcher = vi.fn();
    await expect(createServerRepository(fetcher).read()).rejects.toThrow(
      /Browser-only/,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps reader work local and signs an ended account session out once", async () => {
    const { getIdentitySession, initializeIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    const { StudioSessionExpired, studioAuth } =
      await import("../src/integration/studio/access");
    const { createServerRepository } =
      await import("../src/integration/studio/serverRepository");
    await initializeIdentity(vi.fn().mockResolvedValue(response(signedIn())));
    const readerFetch = vi
      .fn()
      .mockResolvedValue(response({ ...studio, canEdit: false }));
    await expect(
      createServerRepository(readerFetch).write(snapshot),
    ).rejects.toThrow(/viewing only/);
    expect(readerFetch).toHaveBeenCalledTimes(1);
    const expired = vi.fn();
    studioAuth.subscribeExpired(expired);
    const writerFetch = vi
      .fn()
      .mockResolvedValueOnce(response(studio))
      .mockResolvedValueOnce(response({}, 401));
    const writer = createServerRepository(writerFetch);
    await expect(writer.write(snapshot)).rejects.toBeInstanceOf(
      StudioSessionExpired,
    );
    expect(writerFetch).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(getIdentitySession()).toEqual({ authenticated: false });
    await expect(writer.write(snapshot)).rejects.toThrow(/Browser-only/);
    expect(writerFetch).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("signs this app out with the session's CSRF token, tells every subscriber and leaves for Identity", async () => {
    const {
      getIdentitySession,
      initializeIdentity,
      signOutIdentity,
      subscribeIdentitySession,
    } = await import("../src/integration/studio/IdentityAccess");
    await initializeIdentity(vi.fn().mockResolvedValue(response(signedIn())));
    const seen = vi.fn();
    const stop = subscribeIdentitySession(seen);
    const signOut = vi.fn().mockResolvedValue(
      response({
        data: { endSessionUrl: "https://identity.test/connect/logout" },
      }),
    );
    const navigate = vi.fn();

    expect(await signOutIdentity(signOut, navigate)).toBe(true);

    expect(signOut).toHaveBeenCalledWith(
      "/api/identity/sign-out",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Csrf-Token": csrfToken },
      }),
    );
    expect(getIdentitySession()).toEqual({ authenticated: false });
    expect(seen).toHaveBeenCalledWith({ authenticated: false });
    expect(navigate).toHaveBeenCalledWith(
      "https://identity.test/connect/logout",
    );
    stop();
    // Signed out, there is nothing left to end.
    expect(await signOutIdentity(signOut, navigate)).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("leaves for the app root when the end-session address is missing or unsafe", async () => {
    const { initializeIdentity, signOutIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    for (const endSessionUrl of [
      undefined,
      "javascript:alert(1)",
      "https://user:pass@identity.test/logout",
      "//evil.test",
      "/relative",
    ]) {
      await initializeIdentity(vi.fn().mockResolvedValue(response(signedIn())));
      const navigate = vi.fn();
      await signOutIdentity(
        vi.fn().mockResolvedValue(response({ data: { endSessionUrl } })),
        navigate,
      );
      expect(navigate).toHaveBeenCalledWith("/");
    }
  });

  it("keeps the session when Identity refuses or cannot be reached", async () => {
    const { getIdentitySession, initializeIdentity, signOutIdentity } =
      await import("../src/integration/studio/IdentityAccess");
    await initializeIdentity(vi.fn().mockResolvedValue(response(signedIn())));
    const navigate = vi.fn();
    expect(
      await signOutIdentity(
        vi.fn().mockResolvedValue(response({}, 503)),
        navigate,
      ),
    ).toBe(false);
    expect(
      await signOutIdentity(
        vi.fn().mockRejectedValue(new TypeError("offline")),
        navigate,
      ),
    ).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(getIdentitySession()).toEqual({ authenticated: true, csrfToken });
  });

  it("returns only local destinations to the backend redirect handler", async () => {
    const { signInUrl } =
      await import("../src/integration/studio/IdentityAccess");
    expect(signInUrl("/studio/materials?tab=fabric")).toBe(
      "/api/identity/sign-in?returnUrl=%2Fstudio%2Fmaterials%3Ftab%3Dfabric",
    );
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/api/identity/sign-out",
      "/%2f%2fevil.test",
      "/" + "a".repeat(2049),
      "/\\evil.test",
      "/\nLocation:evil",
    ]) {
      expect(signInUrl(value)).toBe("/api/identity/sign-in?returnUrl=%2F");
    }
  });

  it("does not carry a failed sign-in mark into the next sign-in", async () => {
    const { signInUrl, hasSignInError } =
      await import("../src/integration/studio/IdentityAccess");
    expect(hasSignInError("?signInError=1")).toBe(true);
    expect(hasSignInError("?tab=fabric")).toBe(false);
    expect(signInUrl("/studio?signInError=1&tab=fabric")).toBe(
      "/api/identity/sign-in?returnUrl=%2Fstudio%3Ftab%3Dfabric",
    );
  });
});
