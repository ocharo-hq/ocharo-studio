import { expect, test } from "./fixtures/studioFixture";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    );
  });
});

test("SDK confirmation cancels safely, restores focus, and accepts deletion", async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => nativeDialogs.push(dialog.type()));
  await page.goto("/studio");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  const save = page.locator(".save-status-button");
  await expect(save).toBeEnabled();
  await save.click();
  await page.getByRole("tab", { name: "My looks" }).click();
  const savedLook = page.getByRole("button", {
    name: "Open Untitled look",
    exact: true,
  });
  const deleteLook = page.getByRole("button", {
    name: "Delete Untitled look",
    exact: true,
  });
  await expect(savedLook).toBeVisible();

  await deleteLook.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this look?",
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  const backdrop = page.locator(".ui-backdrop-overlay-blurred");
  await expect(backdrop).toHaveCSS("position", "fixed");
  expect(
    await backdrop.evaluate(
      (element) => getComputedStyle(element).backdropFilter,
    ),
  ).toContain("blur");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(savedLook).toBeVisible();
  await expect(deleteLook).toBeFocused();

  await deleteLook.click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(savedLook).toBeVisible();
  await expect(deleteLook).toBeFocused();

  await deleteLook.click();
  await page.getByRole("button", { name: "Delete look" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(savedLook).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
});
