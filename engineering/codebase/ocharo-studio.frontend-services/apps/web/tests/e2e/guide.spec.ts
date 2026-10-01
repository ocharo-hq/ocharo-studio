import { waitForStudioReady, test, expect } from "./fixtures/studioFixture";

for (const width of [1440, 390, 320]) {
  test(`interactive guide reaches real controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/studio");
    await waitForStudioReady(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    let tour = page.getByRole("dialog", { name: "Start a new design" });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Name the design" });
    await expect(
      tour.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await page.getByRole("textbox", { name: "Look name" }).click();
    const [nameBounds, spotlightBounds] = await Promise.all([
      page.getByRole("textbox", { name: "Look name" }).boundingBox(),
      page.locator(".tour-popover-highlight").boundingBox(),
    ]);
    expect(nameBounds!.x).toBeGreaterThanOrEqual(spotlightBounds!.x);
    expect(nameBounds!.x + nameBounds!.width).toBeLessThanOrEqual(
      spotlightBounds!.x + spotlightBounds!.width,
    );
    await expect(
      tour.getByRole("button", { name: "Next", exact: true }),
    ).toBeEnabled();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Choose a garment" });
    await page.locator('[data-tour="garments-tab"]').click();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Edit one part or several" });
    await page.locator(".part-multiselect-trigger").click();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Choose a textile" });
    await page.locator('[data-tour="change-material"]').click();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    for (const title of [
      "Set the pattern's size",
      "Connect textile and garment",
    ]) {
      tour = page.getByRole("dialog", { name: title });
      await expect(tour).toBeVisible();
      const bounds = await tour.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        844 + (width === 1440 ? 156 : 0),
      );
      await tour.getByRole("button", { name: "Next", exact: true }).click();
    }
    tour = page.getByRole("dialog", { name: "Look around the piece" });
    await page
      .locator('[data-tour="camera"]')
      .getByRole("button", { name: "back", exact: true })
      .click();
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Keep your look" });
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    tour = page.getByRole("dialog", { name: "Take the idea with you" });
    await tour.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator("[data-tour-popover]")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
      "Untitled look",
    );
    await expect(page.locator(".scene-caption")).toHaveCount(0);
    await expect(page.locator(".document-garment")).toHaveText("Nimcha");
  });
}

test("guide Escape restores editor access and can reopen from Settings", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("[data-tour-popover]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-tour-popover]")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: /guide/i })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Start a new design" }),
  ).toBeVisible();
});

test("canvas tools, navigation hint and guide remain separate on small screens", async ({
  page,
}) => {
  await page.goto("/studio");
  await waitForStudioReady(page);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  for (const viewport of [
    { width: 820, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    const controls = page.locator(".camera-tools");
    const hint = page.locator(".orbit-hint");
    const guide = page.getByRole("button", { name: "Open studio guide" });
    await expect(controls).toBeVisible();
    await expect(hint).toBeVisible();
    await expect(guide).toBeVisible();
    const [cameraBox, hintBox, guideBox] = await Promise.all([
      controls.boundingBox(),
      hint.boundingBox(),
      guide.boundingBox(),
    ]);
    expect(cameraBox!.height).toBeLessThan(80);
    expect(hintBox!.y).toBeGreaterThanOrEqual(cameraBox!.y + cameraBox!.height);
    expect(hintBox!.x).toBeGreaterThanOrEqual(0);
    expect(hintBox!.x + hintBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(viewport.height);
    const overlapWidth =
      Math.min(cameraBox!.x + cameraBox!.width, guideBox!.x + guideBox!.width) -
      Math.max(cameraBox!.x, guideBox!.x);
    const overlapHeight =
      Math.min(
        cameraBox!.y + cameraBox!.height,
        guideBox!.y + guideBox!.height,
      ) - Math.max(cameraBox!.y, guideBox!.y);
    expect(overlapWidth <= 0 || overlapHeight <= 0).toBeTruthy();
  }
});
