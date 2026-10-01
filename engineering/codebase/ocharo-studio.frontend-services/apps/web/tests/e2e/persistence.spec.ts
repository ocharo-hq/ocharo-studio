import {
  waitForStudioReady,
  waitForStudioStorage,
  readRemote,
  writeRemote,
  test,
  expect,
  type Page,
} from "./fixtures/studioFixture";

async function load(page: Page) {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expect(page.locator(".viewport canvas")).toBeVisible({
    timeout: 20_000,
  });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.isVisible({ timeout: 2000 })) await skip.click();
  await waitForStudioStorage(page);
}
const remote = readRemote;

test("conflicted tabs keep separate recovery drafts across reloads", async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    ),
  );
  await load(page);
  const other = await context.newPage();
  await load(other);
  const a = await page.evaluate(() =>
    sessionStorage.getItem("ocharo-studio:tab"),
  );
  const b = await other.evaluate(() =>
    sessionStorage.getItem("ocharo-studio:tab"),
  );
  expect(a).not.toBe(b);
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("40");
  await expect
    .poll(async () => (await remote(page)).draft.parts.body.placement.rotation)
    .toBe(40);
  await other.getByRole("slider", { name: "Rotation", exact: true }).fill("90");
  await expect(other.locator(".save-status-button")).toContainText("Resolve");
  await other.reload();
  await waitForStudioReady(other);
  await expect(other.locator(".save-status-button")).toContainText("Resolve");
  await expect(
    other.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("90");
  expect((await remote(page)).draft.parts.body.placement.rotation).toBe(40);
  await other.getByRole("button", { name: "Settings", exact: true }).click();
  await other
    .getByRole("button", { name: "Load server version", exact: true })
    .click();
  await expect(
    other.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("40");
  await other.close();
});

test("offline edits retry without claiming an acknowledged save", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    ),
  );
  await load(page);
  await page.route("**/api/studio/state", (route) =>
    route.request().method() === "PUT" &&
    route.request().postDataJSON()?.draft?.parts?.body?.placement?.rotation ===
      67
      ? route.abort("failed")
      : route.fallback(),
  );
  const savedBeforeFailure = await remote(page);
  const failedWrite = () =>
    page.waitForEvent("requestfailed", {
      predicate: (request) =>
        new URL(request.url()).pathname === "/api/studio/state" &&
        request.method() === "PUT",
      timeout: 20_000,
    });
  const firstFailure = failedWrite();
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("67");
  await firstFailure;
  await expect(page.locator(".save-status-button")).toContainText("Offline");
  expect((await remote(page)).draft.parts.body.placement.rotation).toBe(
    savedBeforeFailure.draft.parts.body.placement.rotation,
  );
  const recoveryFailure = failedWrite();
  await page.reload();
  await waitForStudioReady(page);
  await recoveryFailure;
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("67");
  await expect(page.locator(".save-status-button")).toContainText("Offline");
  await page.unroute("**/api/studio/state");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect
    .poll(async () => (await remote(page)).draft.parts.body.placement.rotation)
    .toBe(67);
  await expect(page.locator(".save-status-button")).not.toContainText(
    "Offline",
  );
});

test("storybook invites twice then remains inside settings", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open studio guide", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await remote(page)).settings.onboarding?.invitations)
    .toBe(1);
  const saved = await remote(page);
  saved.settings.onboarding.lastInvitationAt = new Date(
    Date.now() - 13 * 60 * 60 * 1000,
  ).toISOString();
  await writeRemote(page, saved);
  await page.reload();
  await waitForStudioReady(page);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.locator(".guide-launcher")).toHaveCount(0);
  await expect
    .poll(async () => (await remote(page)).settings.onboarding?.invitations)
    .toBe(2);
  await page.reload();
  await waitForStudioReady(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Open studio guide/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("material and garment anchors persist independently with rotation and scale", async ({
  page,
}) => {
  // Multiple material edits and a cold reload render each state on the CI software GPU.
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    ),
  );
  await load(page);
  const anchor = page.getByRole("slider", {
    name: "Textile pattern anchor",
    exact: true,
  });
  await anchor.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.getByRole("button", { name: "On garment", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Garment anchor horizontal" })
    .fill("0.62");
  await page
    .getByRole("spinbutton", { name: "Garment anchor vertical" })
    .fill("0.55");
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("90");
  await page
    .getByRole("button", { name: "Edit material", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Material scale", exact: true })
    .fill("1.5");
  await page
    .getByRole("button", { name: "Save material", exact: true })
    .click();
  await expect
    .poll(async () => (await remote(page)).draft.parts.body.placement.scale)
    .toBe(1.5);
  const placement = (await remote(page)).draft.parts.body.placement;
  expect(placement).toMatchObject({
    rotation: 90,
    scale: 1.5,
    garmentAnchorX: 0.62,
    garmentAnchorY: 0.55,
  });
  expect(placement.materialAnchorX).toBeGreaterThan(0.5);
  expect(placement.materialAnchorY).toBeGreaterThan(0.5);
  await page.reload();
  await waitForStudioReady(page);
  await expect(
    page.getByRole("slider", { name: "Material scale", exact: true }),
  ).toHaveValue("1.5");
});
