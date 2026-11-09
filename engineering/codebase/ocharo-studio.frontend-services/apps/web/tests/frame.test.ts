// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { defineComponent, h, type Plugin } from "vue";
import { RouterHistoryMode } from "@wow-two-beta/fe/router";

import {
  loadOcharoApps,
  ocharoAppsPlugin,
} from "../src/application/common/UseOcharoApps";
import AppRouter from "../src/bootstrap/AppRouter.vue";
import { createStudioRouter } from "../src/bootstrap/router";
import { MATERIALS } from "../src/domain/studio/catalog";
import { initializeIdentity } from "../src/integration/studio/IdentityAccess";

/** The informational version the stubbed `/api/system/status` reports: a release and the commit it was built from. */
const ApiVersion = "0.1.4+8f2c1d9e4b7a";
const SidebarCollapsedKey = "ocharo-studio.sidebar-collapsed";
const csrfToken = "verified-server-csrf-token-123456";
const EndSessionUrl = "https://identity.example/connect/logout";
/** A signed-in `/api/identity/session` body for `person`. */
const signedIn = (person: Record<string, unknown>) => ({
  isAuthenticated: true,
  person: { sub: "user-a", ...person },
  organization: { id: "org-a", name: "Ocharo", slug: "ocharo", role: "owner" },
  permissions: ["studio:edit"],
  csrfToken,
});
/** The WebGL scene is out of reach in happy-dom; the frame and the editor's controls are real. */
const ViewportStub = defineComponent({
  name: "StudioViewport",
  setup: () => () => h("canvas", { "data-viewport-stub": "" }),
});

let wrapper: VueWrapper | undefined;
let fetcher: ReturnType<typeof vi.fn>;

/** Answers every `min-width` media query for a viewport `width` wide; colour-scheme queries read as light. */
function stubViewport(width: number): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      width >= Number(query.match(/min-width:\s*(\d+)px/)?.[1] ?? Infinity),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

interface MountOptions {
  readonly width?: number;
  /** When given, `/api/runtime-config` serves it and the app menu resolves it the way startup does. */
  readonly runtimeConfig?: Record<string, string>;
  /** The session `/api/identity/session` serves; default signed out. `/api/identity/sign-out` ends it. */
  readonly identitySession?: Record<string, unknown>;
}

/** Mounts the whole app — the real route table, the frame and the editor — at `path`. */
async function mountStudio(path: string, options: MountOptions = {}) {
  stubViewport(options.width ?? 1440);
  fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const pathname = new URL(url, "https://localhost").pathname;
    if (pathname === "/api/runtime-config")
      return Promise.resolve(Response.json(options.runtimeConfig ?? {}));
    if (pathname === "/api/system/status")
      return Promise.resolve(
        Response.json({
          service: "OcharoStudio",
          status: "live",
          version: ApiVersion,
        }),
      );
    if (pathname === "/api/identity/session")
      return Promise.resolve(
        Response.json({
          data: options.identitySession ?? { isAuthenticated: false },
        }),
      );
    if (pathname === "/api/identity/sign-out")
      return Promise.resolve(
        Response.json({ data: { endSessionUrl: EndSessionUrl } }),
      );
    return Promise.resolve(
      Response.json({ title: "Not found" }, { status: 404 }),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  await initializeIdentity(fetcher as unknown as typeof fetch);
  const router = createStudioRouter({ history: RouterHistoryMode.Memory });
  await router.push(path);
  await router.isReady();
  const plugins: Plugin[] = [router];
  if (options.runtimeConfig)
    plugins.push(ocharoAppsPlugin(await loadOcharoApps()));
  wrapper = mount(AppRouter, {
    attachTo: document.body,
    global: { plugins, stubs: { StudioViewport: ViewportStub } },
  });
  await flushPromises();
  await vi.waitFor(() =>
    expect(document.querySelector("header[role=banner]")).not.toBeNull(),
  );
  await flushPromises();
  return { router };
}

/** The open menu or dialog the SDK portals to the body. */
function overlay(role: "menu" | "dialog"): DOMWrapper<HTMLElement> {
  const element = document.querySelector<HTMLElement>(`[role="${role}"]`);
  expect(element).not.toBeNull();
  return new DOMWrapper(element!);
}

/** Opens the account menu; its trigger is "Account menu", or "Account menu for {name}" once Identity names the person. */
async function openAccountMenu(): Promise<DOMWrapper<HTMLElement>> {
  await wrapper!
    .get('header button[aria-haspopup="menu"][aria-label^="Account menu"]')
    .trigger("click");
  await flushPromises();
  return overlay("menu");
}

function menuRow(menu: DOMWrapper<HTMLElement>, label: string) {
  return menu
    .findAll('[role="menuitem"]')
    .find((row) => row.text().trim() === label);
}

beforeEach(() => {
  // happy-dom rejects a cancelled animation's `finished` eagerly; the toast timer bar cancels its own on unmount.
  vi.spyOn(Element.prototype, "animate").mockImplementation(
    () =>
      ({
        pause: () => undefined,
        play: () => undefined,
        cancel: () => undefined,
      }) as unknown as Animation,
  );
  localStorage.clear();
  sessionStorage.clear();
  // The first-run invitation stays out of the way of the frame.
  localStorage.setItem(
    "ocharo-studio:settings",
    JSON.stringify({ onboarding: { invitations: 2, hiddenPermanently: true } }),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ocharo frame in Studio", () => {
  it.each([390, 1440])(
    "keeps one main landmark, the app button with the version and the account menu last at %ipx",
    async (width) => {
      await mountStudio("/studio", { width });

      expect(document.querySelectorAll("main")).toHaveLength(1);
      const main = document.querySelector("main")!;
      expect(main.id).toBe("app-shell-main");
      expect(
        document.querySelector(`a[href="#${main.id}"]`)?.textContent?.trim(),
      ).toBe("Skip to content");
      expect(main.querySelectorAll("h1")).toHaveLength(1);
      const header = wrapper!.get("header[role=banner]");
      expect(
        header.find('button[aria-label="Ocharo apps — Studio"]').exists(),
      ).toBe(true);
      expect(header.get('[title="App version"]').text()).toBe(__APP_VERSION__);
      // The Designer's controls sit in the one bar, with the account menu last.
      for (const name of ["New design", "Save look", "Export"])
        expect(header.find(`button[aria-label="${name}"]`).exists()).toBe(true);
      const controls = header.findAll("button");
      expect(controls.at(-1)!.attributes()).toMatchObject({
        "aria-label": "Account menu",
        "aria-haspopup": "menu",
      });
    },
  );

  it("opens the Ocharo apps from the app button with the addresses Studio serves at runtime", async () => {
    await mountStudio("/studio", {
      runtimeConfig: {
        OCHARO_DESK_URL: "https://ocharo-desk-dev.example.ts.net/",
        OCHARO_STUDIO_URL: "https://ocharo-studio-dev.example.ts.net/studio",
        OCHARO_ATLAS_URL: "https://ocharo-atlas-dev.example.ts.net/atlas/",
      },
    });

    await wrapper!
      .get('header button[aria-label="Ocharo apps — Studio"]')
      .trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("Ocharo apps");
    expect(
      document.querySelector('[aria-current="true"]')?.textContent,
    ).toContain("Studio");
    expect(
      document.querySelector(
        'a[href="https://ocharo-desk-dev.example.ts.net/"]',
      )?.textContent,
    ).toContain("Desk");
    expect(
      document.querySelector(
        'a[target="_blank"][href="https://ocharo-atlas-dev.example.ts.net/atlas/"]',
      ),
    ).not.toBeNull();
    // No address is compiled in: an app the environment does not serve is left out of the menu.
    expect(document.querySelector('a[href^="https://localhost"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Catalogue");
  });

  it.each([
    [390, true],
    [1440, false],
  ])(
    "opens the apps menu full screen only on a phone at %ipx",
    async (width, fullScreen) => {
      await mountStudio("/studio", { width });

      await wrapper!
        .get('header button[aria-label="Ocharo apps — Studio"]')
        .trigger("click");
      await flushPromises();

      expect(
        document.querySelector('[data-phone-layout="fullscreen"]') !== null,
      ).toBe(fullScreen);
    },
  );

  it("shows appearance, Studio and API versions and Studio settings, with no language, organization or sign-out locally", async () => {
    await mountStudio("/studio");

    const menu = await openAccountMenu();

    const versions = menu
      .findAll("[data-account-menu-version]")
      .map((entry) =>
        [...entry.element.children].map((part) => part.textContent?.trim()),
      );
    expect(versions).toEqual([
      ["Studio", __APP_VERSION__],
      ["API", `${ApiVersion.split("+")[0]} · 8f2c1d9`],
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/system/status",
      expect.objectContaining({ credentials: "omit" }),
    );
    expect(menu.find("[data-account-menu-appearance]").exists()).toBe(true);
    expect(menu.find("[data-account-menu-languages]").exists()).toBe(false);
    expect(menu.find("[data-account-menu-organizations]").exists()).toBe(false);
    expect(menu.find("[data-account-menu-identity]").exists()).toBe(false);
    expect(menu.find("[data-account-menu-sign-out]").exists()).toBe(false);
    expect(menuRow(menu, "Studio settings")).toBeDefined();
    expect(menuRow(menu, "Reconnect with Ocharo")).toBeUndefined();

    await menuRow(menu, "Studio settings")!.trigger("click");
    await flushPromises();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Studio settings"),
    );
    expect(document.body.textContent).toContain("Designs stay in this browser");
  });

  it("paints the bar, sidebar and menus with the SDK glass of the Ocharo theme", async () => {
    await mountStudio("/studio", { width: 1440 });

    const header = wrapper!.get("header[role=banner]");
    expect(header.classes()).toEqual(
      expect.arrayContaining(["surface-glass", "border-glass-edge"]),
    );
    expect(wrapper!.get("aside").classes()).toEqual(
      expect.arrayContaining(["surface-glass-side", "border-glass-edge"]),
    );
    const menu = await openAccountMenu();
    expect(menu.classes()).toEqual(
      expect.arrayContaining(["surface-glass-menu", "border-glass-edge"]),
    );
    // The SDK keeps the panel from scrolling sideways, so Studio no longer clips it.
    expect(menu.find(".overflow-x-hidden").exists()).toBe(false);
    expect(
      [...document.querySelectorAll("[class]")].some((element) =>
        [...element.classList].some((name) => name.startsWith("oc-glass")),
      ),
    ).toBe(false);
  });

  it("opens the app and section menus on the glass menu material", async () => {
    await mountStudio("/studio", { width: 1440 });
    await wrapper!
      .get('header button[aria-label="Ocharo apps — Studio"]')
      .trigger("click");
    await flushPromises();
    const titles = [...document.querySelectorAll(".surface-glass-menu h2")];
    expect(titles.map((title) => title.textContent?.trim())).toEqual([
      "Ocharo apps",
    ]);
    wrapper!.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";

    await mountStudio("/studio", { width: 390 });
    await wrapper!
      .get('header button[aria-label="Studio sections — Designer"]')
      .trigger("click");
    await flushPromises();
    expect(overlay("menu").classes()).toContain("surface-glass-menu");
  });

  it("names the Ocharo session and signs this app out through Identity", async () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);
    await mountStudio("/studio", {
      identitySession: signedIn({
        name: "Maftuna Rakhimova",
        email: "maftuna@ocharo.example",
      }),
    });

    expect(
      wrapper!
        .find('header button[aria-label="Account menu for Maftuna Rakhimova"]')
        .exists(),
    ).toBe(true);
    const menu = await openAccountMenu();
    const identity = menu.get("[data-account-menu-identity]");
    expect(identity.findAll("p").map((line) => line.text())).toEqual([
      "Maftuna Rakhimova",
      "maftuna@ocharo.example",
    ]);
    expect(menuRow(menu, "Reconnect with Ocharo")).toBeDefined();
    await menu.get("[data-account-menu-sign-out]").trigger("click");
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/identity/sign-out",
      expect.objectContaining({ method: "POST" }),
    );
    const signOut = fetcher!.mock.calls.find(
      ([input]) => input === "/api/identity/sign-out",
    )!;
    expect(new Headers(signOut[1]?.headers).get("X-Csrf-Token")).toBe(
      csrfToken,
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Signed out of Studio."),
    );
    expect(assign).toHaveBeenCalledWith(EndSessionUrl);
    const after = await openAccountMenu();
    expect(after.find("[data-account-menu-sign-out]").exists()).toBe(false);
    expect(after.find("[data-account-menu-identity]").exists()).toBe(false);
    expect(menuRow(after, "Sign in")).toBeDefined();
    // Signed out, the trigger no longer names anyone.
    expect(
      wrapper!
        .find('header button[aria-haspopup="menu"][aria-label="Account menu"]')
        .exists(),
    ).toBe(true);
  });

  it("offers Sign in to an anonymous visitor and keeps the editor open", async () => {
    await mountStudio("/studio");

    const menu = await openAccountMenu();
    expect(menuRow(menu, "Sign in")).toBeDefined();
    expect(menu.find("[data-account-menu-sign-out]").exists()).toBe(false);
    expect(document.querySelector("header[role=banner]")).not.toBeNull();
  });

  it("says where the person signed in when Identity sends no name or email", async () => {
    await mountStudio("/studio", {
      identitySession: signedIn({ name: null, email: null }),
    });

    expect(
      wrapper!
        .find('header button[aria-haspopup="menu"][aria-label="Account menu"]')
        .exists(),
    ).toBe(true);
    const menu = await openAccountMenu();
    const identity = menu.get("[data-account-menu-identity]");
    expect(identity.findAll("p").map((line) => line.text())).toEqual([
      "Signed in with your Ocharo account",
    ]);
    expect(menu.find("[data-account-menu-sign-out]").exists()).toBe(true);
  });

  it("names the person without an email, keeping where they signed in", async () => {
    await mountStudio("/studio", {
      identitySession: signedIn({ name: "Maftuna Rakhimova" }),
    });

    const menu = await openAccountMenu();
    expect(
      menu
        .get("[data-account-menu-identity]")
        .findAll("p")
        .map((line) => line.text()),
    ).toEqual(["Maftuna Rakhimova", "Signed in with your Ocharo account"]);
    expect(menu.find('a[role="menuitem"]').exists()).toBe(false);
  });

  it("holds sign-out while material edits are unsaved", async () => {
    const patterned = MATERIALS.find((material) => material.textureUrl)!;
    await mountStudio(`/studio/materials?material=${patterned.id}`, {
      identitySession: signedIn({}),
    });
    const scale = wrapper!.get('input[aria-label="Material scale"]');
    await scale.setValue("2");
    await flushPromises();

    const menu = await openAccountMenu();
    await menu.get("[data-account-menu-sign-out]").trigger("click");
    await flushPromises();

    expect(fetcher).not.toHaveBeenCalledWith(
      "/api/identity/sign-out",
      expect.anything(),
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        "Finish saving your work before signing out.",
      ),
    );
  });

  it("starts the sidebar as the icon rail and remembers an expanded choice", async () => {
    await mountStudio("/studio", { width: 1440 });

    const nav = wrapper!.get('aside nav[aria-label="Studio sections"]');
    expect(nav.findAll("a").map((link) => link.attributes("href"))).toEqual([
      "/studio",
      "/studio/materials",
    ]);
    expect(nav.get('[aria-current="page"]').text()).toBe("Designer");
    expect(nav.get('a[href="/studio"]').find("span.sr-only").text()).toBe(
      "Designer",
    );
    expect(localStorage.getItem(SidebarCollapsedKey)).toBeNull();

    await wrapper!.get('button[aria-label="Expand sidebar"]').trigger("click");

    expect(
      wrapper!.find('button[aria-label="Collapse sidebar"]').exists(),
    ).toBe(true);
    expect(localStorage.getItem(SidebarCollapsedKey)).toBe("false");
  });

  it("keeps an expanded sidebar this browser stored", async () => {
    localStorage.setItem(SidebarCollapsedKey, "false");
    await mountStudio("/studio", { width: 1440 });

    expect(
      wrapper!.find('button[aria-label="Collapse sidebar"]').exists(),
    ).toBe(true);
    expect(
      wrapper!
        .get('aside a[href="/studio/materials"]')
        .find("span.sr-only")
        .exists(),
    ).toBe(false);
  });

  it("moves between Designer and Materials from the sidebar", async () => {
    const { router } = await mountStudio("/studio", { width: 1440 });

    await wrapper!.get('aside a[href="/studio/materials"]').trigger("click");
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/studio/materials"),
    );
    await flushPromises();

    expect(wrapper!.get('aside [aria-current="page"]').text()).toBe(
      "Materials",
    );
    expect(wrapper!.get("h1").text()).toBe("Material Studio");
    expect(document.title).toBe("Material Studio · Ocharo Studio");
    // The Designer's bar controls leave with the place; Back is no longer needed.
    expect(wrapper!.find('header button[aria-label="Export"]').exists()).toBe(
      false,
    );
    expect(document.body.textContent).not.toContain("Garment studio");
  });

  it("switches places from the top bar on a phone, with no sidebar or bottom bar", async () => {
    const { router } = await mountStudio("/studio", { width: 390 });

    expect(
      document.querySelector('nav[aria-label="Studio sections"]'),
    ).toBeNull();
    expect(document.querySelector("footer")).toBeNull();
    // The look name sits above the canvas there.
    expect(wrapper!.find('header input[aria-label="Look name"]').exists()).toBe(
      false,
    );
    expect(
      wrapper!.find('.workspace input[aria-label="Look name"]').exists(),
    ).toBe(true);
    await wrapper!
      .get('header button[aria-label="Studio sections — Designer"]')
      .trigger("click");
    await flushPromises();
    const menu = overlay("menu");
    const rows = menu.findAll('[role="menuitemradio"]');
    expect(
      rows.map((row) => [row.text().trim(), row.attributes("aria-checked")]),
    ).toEqual([
      ["Designer", "true"],
      ["Materials", "false"],
    ]);
    await rows[1]!.trigger("click");
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/studio/materials"),
    );
    await flushPromises();
    expect(
      wrapper!
        .find('header button[aria-label="Studio sections — Materials"]')
        .exists(),
    ).toBe(true);
  });

  it("renders the landing introduction outside the frame, on the Ocharo theme", async () => {
    stubViewport(1440);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({}))),
    );
    const router = createStudioRouter({ history: RouterHistoryMode.Memory });
    await router.push("/");
    await router.isReady();
    wrapper = mount(AppRouter, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();
    await vi.waitFor(() =>
      expect(document.querySelector("#landing-main")).not.toBeNull(),
    );

    expect(document.querySelector("header[role=banner]")).toBeNull();
    expect(
      document.querySelector('button[aria-label="Ocharo apps — Studio"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Studio sections"]'),
    ).toBeNull();
    expect(document.querySelector(".landing-header")).not.toBeNull();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });
});
