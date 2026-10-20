import { waitForStudioReady, expect, test } from "./fixtures/studioFixture";

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

test("route focus and notifications preserve the frame bar's separator", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expect(page.locator(".viewport canvas")).toBeVisible();
  // A place change moves focus to the frame's one main region, without a visible ring.
  await page.getByRole("link", { name: "Materials" }).click();
  await page.getByRole("link", { name: "Designer" }).click();
  await waitForStudioReady(page);
  const main = page.locator("main#app-shell-main");
  await expect(main).toBeFocused();
  expect(
    await main.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        style.outlineStyle === "none" ||
        style.outlineColor === "rgba(0, 0, 0, 0)"
      );
    }),
  ).toBe(true);
  // One 56px bar: the frame's banner holds it above its separator.
  await expect(page.locator(".studio-frame-bar")).toHaveCSS("height", "56px");
  const bar = page.getByRole("banner");
  const headerBorder = await bar.evaluate(
    (header) => getComputedStyle(header).borderBottom,
  );
  await page.getByLabel("Import design file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator(".studio-toasts")).toContainText(
    "invalid or incompatible",
  );
  await expect(bar).toHaveCSS("border-bottom", headerBorder);
});

test("phone bar actions remain clear of the design name input", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expect(page.locator(".viewport canvas")).toBeVisible();

  const actionNames = [
    "Ocharo apps — Studio",
    "Studio sections — Designer",
    "New design",
    "Save look",
    "Export",
    "Account menu",
  ];
  for (const width of [560, 480, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Phones keep the look name in a row above the canvas, below the bar.
    const nameInput = page
      .locator(".workspace")
      .getByRole("textbox", { name: "Look name" });
    await expect(nameInput).toBeVisible();
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
    // The versions moved from the old pill into the account menu.
    await page
      .getByRole("button", { name: "Account menu", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu.getByText("Versions", { exact: true })).toBeVisible();
    await expect(menu.getByText("API", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  }
});
