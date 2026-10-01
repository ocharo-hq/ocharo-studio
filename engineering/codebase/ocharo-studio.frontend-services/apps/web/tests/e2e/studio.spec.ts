import { test, expect } from "./fixtures/studioFixture";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("ocharo-studio:settings"))
      localStorage.setItem(
        "ocharo-studio:settings",
        JSON.stringify({
          onboarding: { invitations: 2, hiddenPermanently: true },
        }),
      );
  });
});

async function setTheme(
  page: import("./fixtures/studioFixture").Page,
  theme: "dark" | "light",
) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: `Use ${theme} theme` }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

function partButton(
  page: import("./fixtures/studioFixture").Page,
  name: string,
) {
  return page.locator(".part-chips").getByRole("button", {
    name,
    exact: true,
  });
}

test("designs remain independent, editable, saved and portable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await page.getByRole("tab", { name: "Textiles" }).click();
  await page
    .getByRole("button", {
      name: "Indigo adras Generated textile",
      exact: true,
    })
    .click();
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("45");
  await page
    .getByRole("slider", { name: "Horizontal", exact: true })
    .fill("0.25");
  await partButton(page, "Lapel & collar").click();
  await page
    .getByRole("button", { name: "Garden ikat Generated textile", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("0");
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("-90");
  await partButton(page, "Main panels").click();
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("45");
  await expect(
    page.getByRole("slider", { name: "Horizontal", exact: true }),
  ).toHaveValue("0.25");
  await page.getByRole("button", { name: "Reset pattern placement" }).click();
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("45");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("0");
  await page.getByRole("textbox", { name: "Look name" }).fill("Indigo garden");
  await page.locator(".save-status-button").click();
  await page.getByRole("tab", { name: "My looks" }).click();
  await expect(
    page.getByRole("button", { name: "Open Indigo garden", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".save-status-button")).toContainText("Saved");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Indigo garden",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Editable design/ }).click();
  const file = await jsonDownload;
  expect(file.suggestedFilename()).toBe("Indigo-garden.ocharo.json");
  const exported = await file.path();
  expect(exported).toBeTruthy();
  await page.getByRole("tab", { name: "Garments" }).click();
  await page.getByRole("button", { name: /Baska The waist peplum/ }).click();
  await page.getByLabel("Import design file").setInputFiles(exported!);
  await expect(page.locator(".garment-card.selected")).toContainText("Nimcha");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Preview image/ }),
  ).toBeEnabled();
  const imageDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Preview image/ }).click();
  expect((await imageDownload).suggestedFilename()).toBe("Indigo-garden.png");
  await page.getByLabel("Import design file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator(".studio-toasts")).toContainText(
    "invalid or incompatible",
  );
  await expect(page.locator(".garment-card.selected")).toContainText("Nimcha");
  expect(errors).toEqual([]);
});

for (const name of ["Nimcha", "Baska", "Kostyum", "Korset", "Abaya"]) {
  test(`${name} renders all views, parts and built-in details`, async ({
    page,
  }) => {
    // Software-rendered CI verifies each garment independently with all views and parts.
    test.setTimeout(90_000);
    const failedAssets: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/assets/") && response.status() >= 400)
        failedAssets.push(response.url());
    });
    await page.goto("/studio");
    await page
      .getByRole("button", { name: new RegExp(`\\d+ ${name} The`) })
      .click();
    await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
    for (const view of ["front", "back", "side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      await page.screenshot({
        path: `test-results/${name.toLowerCase()}-${view.toLowerCase()}.png`,
      });
    }
    const options = await page
      .locator(".part-chips")
      .getByRole("button")
      .allTextContents();
    for (const part of options) {
      await partButton(page, part.trim()).click();
      await page.getByRole("tab", { name: "Textiles" }).click();
      await page
        .getByRole("button", {
          name: "Pomegranate atlas Generated textile",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("slider", { name: "Rotation", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "90°", exact: true }).click();
      await expect(
        page.getByRole("slider", { name: "Rotation", exact: true }),
      ).toHaveValue("90");
    }
    expect(failedAssets).toEqual([]);
  });
}

test("responsive studio and dark theme keep controls reachable", async ({
  page,
}) => {
  await page.goto("/studio");
  await setTheme(page, "dark");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.evaluate(() =>
    Promise.allSettled(
      document.getAnimations().map((animation) => animation.finished),
    ),
  );
  await page.screenshot({
    path: "test-results/studio-dark.png",
    fullPage: true,
  });
  await setTheme(page, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".save-status-button")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("tab", { name: "Textiles" }).click();
  await page
    .getByRole("button", { name: "Garden ikat Generated textile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit part", exact: true }).click();
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("30");
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("30");
  await page.screenshot({
    path: "test-results/studio-mobile.png",
    fullPage: true,
  });
});

test("keyboard navigation and automated accessibility checks pass", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/studio");
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.getByRole("tab", { name: "Garments" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Textiles" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Textiles" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await setTheme(page, "dark");
  await page.evaluate(() =>
    Promise.allSettled(
      document.getAnimations().map((animation) => animation.finished),
    ),
  );
  const darkResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    darkResult.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Take your idea with you." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("canvas changes with materials and orbiting does not change selected parts", async ({
  page,
}) => {
  // Material loading, full-canvas readback and a multi-frame orbit use software rendering in CI.
  test.setTimeout(90_000);
  await page.goto("/studio");
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  const canvas = page.locator(".viewport canvas");
  const initial = await canvas.evaluate(canvasHash);
  await page.getByRole("tab", { name: "Textiles" }).click();
  await page
    .getByRole("button", {
      name: "Indigo adras Generated textile",
      exact: true,
    })
    .click();
  await expect.poll(() => canvas.evaluate(canvasHash)).not.toBe(initial);
  await partButton(page, "Lapel & collar").click();
  await page.getByRole("button", { name: "Fit garment" }).click();
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  await partButton(page, "Main panels").click();
  await expect(partButton(page, "Main panels")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const beforeOrbit = await canvas.evaluate(canvasHash);
  await page.mouse.move(
    rect!.x + rect!.width * 0.5,
    rect!.y + rect!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect!.x + rect!.width * 0.7,
    rect!.y + rect!.height * 0.52,
    { steps: 15 },
  );
  await page.mouse.up();
  await expect(partButton(page, "Main panels")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => canvas.evaluate(canvasHash)).not.toBe(beforeOrbit);
});

function canvasHash(node: Element): string {
  const data = (node as HTMLCanvasElement).toDataURL();
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++)
    hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
