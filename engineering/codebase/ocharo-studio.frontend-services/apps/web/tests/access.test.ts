import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptTicketFragment,
  getIntegrationTicket,
  parseTicketFragment,
  setIntegrationTicket,
  signOutStudio,
} from "../src/integration/studio/access";
import { createServerRepository } from "../src/integration/studio/serverRepository";
const workspaceId = "d0a8c678-c27f-478f-b4e8-c9928bf88c21";
const session = {
  workspaceId,
  userId: "user-a",
  organizationId: "f74556b7-caf8-41db-a25c-030d1f7d7987",
  canEdit: true,
  expiresAt: "2099-01-01T00:00:00Z",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());
describe("Desk connection boundary", () => {
  it("removes the fragment before keeping the ticket only in session storage", () => {
    const events: string[] = [];
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (key: string, value: string) => {
        events.push("store");
        values.set(key, value);
      },
      getItem: (key: string) => values.get(key) ?? null,
    });
    const replaceState = vi.fn(() => events.push("remove-fragment"));
    vi.stubGlobal("window", {
      location: {
        pathname: "/studio",
        search: "",
        hash: "#ocharo-ticket=secret&audience=ocharo-studio&issuer=https%3A%2F%2Flocalhost%3A8264",
      },
      history: { replaceState },
    });
    expect(acceptTicketFragment()).toBeUndefined();
    expect(events).toEqual(["remove-fragment", "store"]);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/studio");
    expect(getIntegrationTicket()).toBe("secret");
  });
  it("rejects wrong audiences and issuers, including misleading origin prefixes", () => {
    for (const fragment of [
      "#ocharo-ticket=x&audience=ocharo-marketing&issuer=https://localhost:8264",
      "#ocharo-ticket=x&audience=ocharo-studio&issuer=https://localhost:8264.evil.test",
      "#ocharo-ticket=x&audience=ocharo-studio&issuer=https://other.test",
    ])
      expect(() => parseTicketFragment(fragment)).toThrow(/not issued/);
    expect(() => setIntegrationTicket(" ")).toThrow(/valid/);
  });
  it("uses the server-owned workspace and bearer without ambient cookies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(
        json({
          revision: 0,
          draft: null,
          looks: [],
          settings: {},
          materials: {},
        }),
      );
    const repo = createServerRepository(fetcher, () => "ticket");
    await repo.read();
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "omit",
      headers: {
        Authorization: "Bearer ticket",
        "X-Studio-Workspace": workspaceId,
      },
    });
  });
  it("keeps browser-only data local and stops on revoked membership", async () => {
    const fetcher = vi.fn();
    await expect(
      createServerRepository(fetcher, () => null).read(),
    ).rejects.toThrow(/Browser-only/);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({}, 403));
    await expect(
      createServerRepository(fetcher, () => "ticket").read(),
    ).rejects.toThrow(/access changed/);
  });
  it("aborts before a state request after cancelled authorization", async () => {
    const abort = new AbortController();
    const fetcher = vi.fn(async () => {
      abort.abort();
      return json(session);
    });
    await expect(
      createServerRepository(fetcher, () => "ticket").read(abort.signal),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("has no sign-out for a Desk ticket, so the connection stays this tab's", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    setIntegrationTicket("ticket");
    const fetcher = vi.fn();

    expect(await signOutStudio(fetcher)).toBe(false);

    expect(fetcher).not.toHaveBeenCalled();
    expect(getIntegrationTicket()).toBe("ticket");
  });
});
