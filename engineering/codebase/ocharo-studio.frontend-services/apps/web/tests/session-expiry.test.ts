import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStatus } from "@wow-two-beta/fe/auth";

const session = {
  workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
  userId: "user-a",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  canEdit: true,
  expiresAt: "2099-01-01T00:00:00Z",
};
const state = {
  revision: 0,
  draft: null,
  looks: [],
  settings: {},
  materials: {},
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

/** Answers the session endpoint and then each state request with the next status. */
function desk(...statuses: number[]) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/session")) return json(session);
    const status = statuses.shift() ?? 200;
    return json(status === 200 ? state : {}, status);
  });
}

async function connect(ticket: string) {
  const access = await import("../src/integration/studio/access");
  const { createServerRepository } =
    await import("../src/integration/studio/serverRepository");
  access.setIntegrationTicket(ticket);
  const expired = vi.fn();
  const unauthorized = vi.fn();
  access.studioAuth.subscribeExpired(expired);
  access.studioAuth.subscribeUnauthorized(unauthorized);
  return { ...access, createServerRepository, expired, unauthorized };
}

beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Desk session expiry", () => {
  it("expires a connected session once across parallel 401s and clears its ticket", async () => {
    const studio = await connect("ticket");
    const fetcher = desk(200, 401, 401, 401);
    const repository = studio.createServerRepository(fetcher);
    await repository.read();
    expect(studio.studioAuth.getSession()).toMatchObject({
      status: AuthStatus.Authenticated,
      user: session,
    });

    const results = await Promise.allSettled([
      repository.read(),
      repository.read(),
      repository.read(),
    ]);

    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        studio.StudioSessionExpired,
      );
    }
    expect(studio.expired).toHaveBeenCalledTimes(1);
    expect(studio.expired.mock.calls[0]![0]).toMatchObject({ returnUrl: "/" });
    expect(studio.getIntegrationTicket()).toBeNull();
    expect(studio.getConnectedSession()).toBeUndefined();
    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    await expect(repository.read()).rejects.toThrow(/Browser-only/);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("settles a stale ticket anonymous on its first resolve without an expiry", async () => {
    const studio = await connect("stale-ticket");
    const fetcher = vi.fn(async () => json({}, 401));

    await expect(
      studio.createServerRepository(fetcher).read(),
    ).rejects.toBeInstanceOf(studio.StudioSessionExpired);

    expect(studio.unauthorized).toHaveBeenCalledTimes(1);
    expect(studio.expired).not.toHaveBeenCalled();
    expect(studio.getIntegrationTicket()).toBeNull();
    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
  });

  it("keeps a 403 an access change that neither expires the session nor drops its ticket", async () => {
    const studio = await connect("ticket");
    const repository = studio.createServerRepository(desk(200, 403));
    await repository.read();

    await expect(repository.read()).rejects.toThrow(/access changed/);

    expect(studio.unauthorized).not.toHaveBeenCalled();
    expect(studio.expired).not.toHaveBeenCalled();
    expect(studio.getIntegrationTicket()).toBe("ticket");
  });

  it("settles an Ocharo sign-out anonymous without an expiry notice", async () => {
    const { initializeSso, getSsoSession } =
      await import("../src/integration/studio/SsoAccess");
    const access = await import("../src/integration/studio/access");
    await initializeSso(
      vi.fn().mockResolvedValue(
        json({
          data: {
            enabled: true,
            authenticated: true,
            csrfToken: "verified-server-csrf-token-123456",
          },
        }),
      ),
    );
    const expired = vi.fn();
    access.studioAuth.subscribeExpired(expired);
    await access.loadStudioSession(
      vi.fn().mockResolvedValue(json(session)),
      null,
    );
    expect(access.studioAuth.getSession().status).toBe(
      AuthStatus.Authenticated,
    );

    expect(
      await access.signOutStudio(
        vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
      ),
    ).toBe(true);

    expect(access.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    expect(access.getConnectedSession()).toBeUndefined();
    expect(getSsoSession().authenticated).toBe(false);
    expect(expired).not.toHaveBeenCalled();
  });

  it("signs out without an expiry when the member disconnects", async () => {
    const studio = await connect("ticket");
    await studio.createServerRepository(desk(200)).read();

    studio.setIntegrationTicket(null);

    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    expect(studio.expired).not.toHaveBeenCalled();
  });
});
