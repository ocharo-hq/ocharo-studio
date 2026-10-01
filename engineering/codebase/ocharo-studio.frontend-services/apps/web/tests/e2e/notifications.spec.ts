import { expect, test } from "./fixtures/studioFixture";

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

test("route focus and notifications preserve the header separator", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await expect(page.locator(".workspace")).toBeFocused();
  await expect(page.locator(".workspace")).toHaveCSS("outline-style", "none");
  const headerBorder = await page
    .locator(".app-header")
    .evaluate((header) => getComputedStyle(header).borderBottom);
  await page.getByLabel("Import design file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator(".studio-toasts")).toContainText(
    "invalid or incompatible",
  );
  await expect(page.locator(".app-header")).toHaveCSS(
    "border-bottom",
    headerBorder,
  );
});

test("phone header actions remain clear of the design name input", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.locator(".viewport canvas")).toBeVisible();

  const actionNames = [
    "New design",
    "Material Studio",
    "Settings",
    "Save look",
    "Export",
  ];
  for (const width of [560, 480, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const nameInput = page.getByRole("textbox", { name: "Look name" });
    const inputBox = await nameInput.boundingBox();
    expect(inputBox).not.toBeNull();

    for (const name of actionNames) {
      const action = page.getByRole("button", { name, exact: true });
      await expect(action).toBeVisible();
      const actionBox = await action.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.y + actionBox!.height).toBeLessThan(inputBox!.y);
      expect(
        await action.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const target = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.bottom - 3,
          );
          return target?.closest("button") === button;
        }),
      ).toBe(true);
    }
    await expect(
      page.getByRole("button", { name: "Save look", exact: true }),
    ).toHaveAccessibleDescription(/^(Saving|Saved|Save|Offline|Resolve)$/);
    const version = page.locator(".app-header .build-identity");
    await version.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(version.getByText("Backend", { exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(version.getByText("Backend", { exact: true })).toBeHidden();
  }
});
