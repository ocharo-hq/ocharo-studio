import { readRemote } from "./fixtures/studioFixture";
import { test, expect, type Page } from "./fixtures/studioFixture";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    ),
  );
});

const remote = readRemote;

test("material scale updates saved looks atomically and preserves placement through reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await expect(page.locator(".save-status-button")).not.toContainText("Saving");
  await page.getByRole("textbox", { name: "Look name" }).fill("Shared atlas");
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("35");
  await page
    .getByRole("slider", { name: "Horizontal", exact: true })
    .fill("0.2");
  await page.getByRole("button", { name: "Save look", exact: true }).click();
  await expect(page.locator(".save-status-button")).toContainText("Saved");
  const before = await remote(page);
  const materialId = before.draft.parts.body.materialId;
  const placement = before.draft.parts.body.placement;
  const canvasHandle = await page.locator(".viewport canvas").elementHandle();
  await page
    .getByRole("button", { name: "Edit material", exact: true })
    .click();
  await expect(page).toHaveURL(/\/studio\/materials\?material=/);
  await expect(
    page.getByRole("heading", { name: "Material Studio", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Material scale", exact: true })
    .fill("1.75");
  expect((await remote(page)).draft.parts.body.placement).toEqual(placement);
  await page
    .getByRole("button", { name: "Save material", exact: true })
    .click();
  await expect
    .poll(async () => (await remote(page)).materials[materialId]?.scale)
    .toBe(1.75);
  const after = await remote(page);
  expect(after.draft.parts.body.placement).toEqual({
    ...placement,
    scale: 1.75,
  });
  expect(after.looks[0].document.parts.body.placement).toEqual({
    ...placement,
    scale: 1.75,
  });
  expect(after.looks[0].thumbnail).toBeUndefined();
  await page
    .getByRole("button", { name: "Garment studio", exact: true })
    .click();
  await expect(page).toHaveURL(/\/studio$/);
  expect(await canvasHandle!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Shared atlas",
  );
  await page.getByRole("button", { name: "Reset pattern placement" }).click();
  await expect
    .poll(async () => (await remote(page)).draft.parts.body.placement.rotation)
    .toBe(0);
  expect((await remote(page)).draft.parts.body.placement.scale).toBe(1.75);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await remote(page)).draft.parts.body.placement.rotation)
    .toBe(35);
  expect((await remote(page)).draft.parts.body.placement.scale).toBe(1.75);
  await page
    .getByRole("button", { name: "Material Studio", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("slider", { name: "Material scale", exact: true }),
  ).toHaveValue("1.75");
  expect(errors).toEqual([]);
});

test("material preview cancellation protects drafts across selection and browser navigation", async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto("/studio");
  await expect(page.locator(".save-status-button")).not.toContainText("Saving");
  const before = await remote(page);
  await page
    .getByRole("button", { name: "Material Studio", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Material scale", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Garment studio", exact: true })
    .click();
  let dialog = page.getByRole("alertdialog", {
    name: "Discard material changes?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/studio\/materials/);
  await expect(
    page.getByRole("slider", { name: "Material scale" }),
  ).toHaveValue("2");
  await page
    .locator(".material-browser-item")
    .filter({ hasText: "Indigo adras" })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.locator(".material-tile-heading h2")).toHaveText(
    "Indigo adras",
  );
  await page.getByRole("slider", { name: "Material scale" }).fill("3");
  await page.goBack();
  dialog = page.getByRole("alertdialog", { name: "Discard material changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  expect((await remote(page)).draft.parts).toEqual(before.draft.parts);
  expect((await remote(page)).materials).toEqual(before.materials);
  expect(nativeDialogs).toEqual([]);
});

test("Material Studio direct routes, solids, tablet and phone controls remain accessible", async ({
  page,
}) => {
  await page.goto("/materials");
  await expect(page).toHaveURL(/\/studio\/materials$/);
  await expect(
    page.getByRole("heading", { name: "Material Studio", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 1024, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("button", { name: "Save material", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const save = await page
      .getByRole("button", { name: "Save material", exact: true })
      .boundingBox();
    expect(save!.x).toBeGreaterThanOrEqual(0);
    expect(save!.x + save!.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole("searchbox", { name: "Find material" }).fill("velvet");
  await page.locator(".material-browser-item").first().click();
  await expect(
    page.getByRole("slider", { name: "Material scale" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save material", exact: true }),
  ).toBeDisabled();
  await page.getByRole("searchbox", { name: "Find material" }).fill("adras");
  await page
    .locator(".material-browser-item")
    .filter({ hasText: "Indigo adras" })
    .click();
  await expect(
    page.getByRole("slider", { name: "Material scale" }),
  ).toBeVisible();
  for (const dark of [false, true]) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle("dark", value),
      dark,
    );
    // Audit the chosen theme after button foreground/background transitions settle.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  }
});
