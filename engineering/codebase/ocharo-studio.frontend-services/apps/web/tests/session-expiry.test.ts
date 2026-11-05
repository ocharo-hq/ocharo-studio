import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStatus } from "@wow-two-beta/fe/auth";

const session = {
  workspaceId: "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
  userId: "user-a",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  canEdit: true,
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

async function connect() {
  const { initializeIdentity } =
    await import("../src/integration/studio/IdentityAccess");
  await initializeIdentity(
    vi.fn().mockResolvedValue(
      json({
        data: {
          isAuthenticated: true,
          person: { sub: "user-a" },
          permissions: [],
          csrfToken: "verified-server-csrf-token-123456",
        },
      }),
    ),
  );
  const access = await import("../src/integration/studio/access");
  const { createServerRepository } =
    await import("../src/integration/studio/serverRepository");
  const expired = vi.fn();
  const unauthorized = vi.fn();
  access.studioAuth.subscribeExpired(expired);
  access.studioAuth.subscribeUnauthorized(unauthorized);
  return { ...access, createServerRepository, expired, unauthorized };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("Studio session expiry", () => {
  it("expires a connected session once across parallel 401s", async () => {
    const studio = await connect();
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
    expect(studio.getConnectedSession()).toBeUndefined();
    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    await expect(repository.read()).rejects.toThrow(/Browser-only/);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("settles a stale cookie anonymous on its first resolve without an expiry", async () => {
    const studio = await connect();
    const fetcher = vi.fn(async () => json({}, 401));

    await expect(
      studio.createServerRepository(fetcher).read(),
    ).rejects.toBeInstanceOf(studio.StudioSessionExpired);

    expect(studio.unauthorized).toHaveBeenCalledTimes(1);
    expect(studio.expired).not.toHaveBeenCalled();
    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
  });

  it("keeps a 403 an access change that does not expire the session", async () => {
    const studio = await connect();
    const repository = studio.createServerRepository(desk(200, 403));
    await repository.read();

    await expect(repository.read()).rejects.toThrow(/access changed/);

    expect(studio.unauthorized).not.toHaveBeenCalled();
    expect(studio.expired).not.toHaveBeenCalled();
  });

  it("settles an Ocharo sign-out anonymous without an expiry notice", async () => {
    const { getIdentitySession } =
      await import("../src/integration/studio/IdentityAccess");
    const studio = await connect();
    await studio.loadStudioSession(vi.fn().mockResolvedValue(json(session)));
    expect(studio.studioAuth.getSession().status).toBe(
      AuthStatus.Authenticated,
    );

    expect(
      await studio.signOutStudio(
        vi.fn().mockResolvedValue(json({ data: {} })),
        vi.fn(),
      ),
    ).toBe(true);

    expect(studio.studioAuth.getSession().status).toBe(AuthStatus.Anonymous);
    expect(studio.getConnectedSession()).toBeUndefined();
    expect(getIdentitySession().authenticated).toBe(false);
    expect(studio.expired).not.toHaveBeenCalled();
  });
});
