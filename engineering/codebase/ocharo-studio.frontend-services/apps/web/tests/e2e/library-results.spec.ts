import { readFile } from "node:fs/promises";
import {
  expectStudioResponse,
  waitForStudioReady,
  readRemote,
  writeRemote,
  test,
  expect,
  type Page,
} from "./fixtures/studioFixture";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    );
  });
});

async function holdNextRead(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observe!: () => void;
  const observed = new Promise<void>((resolve) => {
    observe = resolve;
  });
  let captured = false;
  await page.route("**/api/studio/state", async (route) => {
    if (route.request().method() === "GET" && !captured) {
      captured = true;
      observe();
      await held;
    }
    await route.fallback().catch(() => {});
  });
  return { observed, release };
}

const refreshButton = (page: Page) =>
  page.getByRole("button", { name: "Refresh", exact: true });

async function expectRefreshSettled(page: Page) {
  await expect(refreshButton(page)).not.toHaveAttribute("aria-busy", "true");
}

test("saved-library initial skeletons match previews and known-empty refresh stays plain", async ({
  page,
}) => {
  const initial = await holdNextRead(page);
  await page.goto("/studio");
  await initial.observed;
  await page.getByRole("tab", { name: "My looks" }).click();
  const refresh = refreshButton(page);
  await expect(refresh).toBeVisible();
  await expect(refresh).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".saved-card-skeleton")).toHaveCount(3);
  for (const preview of await page
    .locator(".saved-card-skeleton .saved-preview")
    .all())
    await expect(preview).toHaveCSS("height", "135px");
  await expect(page.getByText("No saved looks", { exact: true })).toHaveCount(
    0,
  );
  const toolbar = await refresh.boundingBox();
  initial.release();
  await waitForStudioReady(page);
  await expectRefreshSettled(page);
  const label = page.getByText("No saved looks", { exact: true });
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".saved-card")).toHaveCount(0);
  const nextToolbar = await refresh.boundingBox();
  expect(nextToolbar?.y).toBe(toolbar?.y);

  const next = await holdNextRead(page);
  await refresh.click();
  await next.observed;
  await expect(refresh).toHaveAttribute("aria-busy", "true");
  await expect(refresh).toBeFocused();
  await expect(label).toBeVisible();
  await expect(page.locator(".saved-card")).toHaveCount(0);
  next.release();
  await expectRefreshSettled(page);
  await expect(label).toBeVisible();
});

test("unavailable saved library recovers through read-only refresh without submitting the browser draft", async ({
  page,
}) => {
  let unavailable = true;
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      new URL(request.url()).pathname === "/api/studio/state"
    )
      writes.push(request.method());
  });
  await page.route("**/api/studio/state", async (route) => {
    if (unavailable && route.request().method() === "GET") {
      await route.fulfill({
        status: 503,
        json: {
          type: "about:blank",
          title: "Synthetic unavailable storage",
          status: 503,
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.goto("/studio");
  await waitForStudioReady(page);
  await page.getByRole("tab", { name: "My looks" }).click();
  await expect(
    page.getByText("Saved looks unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No saved looks", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Browser recovery");
  unavailable = false;
  await refreshButton(page).click();
  await expectRefreshSettled(page);
  await expect(page.getByText("No saved looks", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Browser recovery",
  );
  await expect(page.locator(".save-status-button")).toContainText("Offline");
  expect(writes).toEqual([]);
});

test("populated refresh masks previews while keeping names and actions, then retains results after failure", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expectStudioResponse(page, "PUT", async () => {
    await page
      .getByRole("textbox", { name: "Look name" })
      .fill("Confirmed look");
    await page.locator(".save-status-button").click();
  });
  await page.getByRole("tab", { name: "My looks" }).click();
  const open = page.getByRole("button", {
    name: "Open Confirmed look",
    exact: true,
  });
  const remove = page.getByRole("button", {
    name: "Delete Confirmed look",
    exact: true,
  });
  await expect(open).toBeVisible();
  await expectRefreshSettled(page);
  const preview = page.locator(".saved-preview");
  await expect(preview).toHaveCSS("height", "135px");
  const next = await holdNextRead(page);
  await refreshButton(page).click();
  await next.observed;
  await expect(open).toBeVisible();
  await expect(open).toBeEnabled();
  await expect(remove).toBeVisible();
  await expect(remove).toBeEnabled();
  await expect(page.locator(".saved-card [data-loading='true']")).toHaveCount(
    1,
  );
  await expect(preview).toHaveCSS("height", "135px");
  next.release();
  await expectRefreshSettled(page);
  await expect(page.locator(".saved-card [data-loading='true']")).toHaveCount(
    0,
  );
  await page.route("**/api/studio/state", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 503,
        json: {
          type: "about:blank",
          title: "Synthetic unavailable storage",
          status: 503,
        },
      });
      return;
    }
    await route.fallback();
  });
  await refreshButton(page).click();
  await expectRefreshSettled(page);
  await expect(open).toBeVisible();
  await expect(open).toBeEnabled();
  await expect(remove).toBeEnabled();
  await expect(
    page.getByText("Saved looks unavailable", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".studio-toasts")).toContainText(
    "could not refresh",
  );
});

test("a remote-only look has an explained unavailable Delete and a full recovery download", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  const remote = await readRemote(page);
  const elsewhere = {
    ...remote.draft,
    id: crypto.randomUUID(),
    name: "Elsewhere look",
  };
  await writeRemote(page, { ...remote, looks: [{ document: elsewhere }] });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      new URL(request.url()).pathname === "/api/studio/state"
    )
      writes.push(request.method());
  });
  await page.getByRole("tab", { name: "My looks" }).click();
  await refreshButton(page).click();
  await expectRefreshSettled(page);
  const remove = page.getByRole("button", {
    name: "Delete Elsewhere look",
    exact: true,
  });
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAccessibleDescription(
    /Download recovery before reloading saved work/,
  );
  await expect(
    page.getByRole("button", { name: "Open Elsewhere look", exact: true }),
  ).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("ocharo-studio-recovery.json");
  const recovery = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(recovery).toMatchObject({
    schemaVersion: 1,
    revision: remote.revision,
    pending: false,
    draft: { id: remote.draft.id },
    looks: [],
    materials: remote.materials,
    settings: remote.settings,
  });
  expect(recovery.workspaceId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(writes).toEqual([]);
});

test("a pending deletion retains the confirmed card with unavailable Delete and recoverable collection", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expectStudioResponse(page, "PUT", async () => {
    await page
      .getByRole("textbox", { name: "Look name" })
      .fill("Pending deletion");
    await page.locator(".save-status-button").click();
  });
  await page.getByRole("tab", { name: "My looks" }).click();
  const remove = page.getByRole("button", {
    name: "Delete Pending deletion",
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await expectRefreshSettled(page);
  await page.route("**/api/studio/state", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 503,
        json: {
          type: "about:blank",
          title: "Synthetic unavailable storage",
          status: 503,
        },
      });
      return;
    }
    await route.fallback();
  });
  await remove.click();
  await page.getByRole("button", { name: "Delete look", exact: true }).click();
  await expect(page.locator(".save-status-button")).toContainText("Offline");
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAccessibleDescription(
    /Download recovery before reloading saved work/,
  );
  await expect(
    page.getByRole("button", { name: "Open Pending deletion", exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery", exact: true })
    .click();
  const recovery = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(recovery).toMatchObject({
    schemaVersion: 1,
    pending: true,
    looks: [],
    draft: { name: "Pending deletion" },
  });
  await expect(remove).toBeDisabled();
});
