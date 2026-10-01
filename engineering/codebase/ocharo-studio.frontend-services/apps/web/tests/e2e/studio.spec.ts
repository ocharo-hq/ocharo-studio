import {
  waitForStudioReady,
  test,
  expect,
  type Locator,
} from "./fixtures/studioFixture";

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
  // Includes a reload, garment replacement, editable-file roundtrip and full-size PNG export.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await waitForStudioReady(page);
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
  await waitForStudioReady(page);
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
    await waitForStudioReady(page);
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
  await waitForStudioReady(page);
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
  await waitForStudioReady(page);
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

test("canvas pixels change when a different material is selected", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/studio");
  await waitForStudioReady(page);
  const canvas = page.locator(".viewport canvas");
  const initial = await stableCanvasHash(canvas);
  await page.getByRole("tab", { name: "Textiles" }).click();
  await page
    .getByRole("button", {
      name: "Indigo adras Generated textile",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await canvas.evaluate(canvasSample)).hash)
    .not.toBe(initial);
});

test("orbiting changes the view without changing the selected parts", async ({
  page,
}) => {
  // Real pointer steps still render every view; camera animation has separate coverage.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio");
  await waitForStudioReady(page);
  const canvas = page.locator(".viewport canvas");
  await partButton(page, "Lapel & collar").click();
  await page.getByRole("button", { name: "Fit garment" }).click();
  await partButton(page, "Main panels").click();
  await expect(partButton(page, "Main panels")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const beforeOrbit = await stableCanvasHash(canvas);
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const start = {
    x: rect!.x + rect!.width * 0.5,
    y: rect!.y + rect!.height * 0.5,
  };
  const end = {
    x: rect!.x + rect!.width * 0.7,
    y: rect!.y + rect!.height * 0.52,
  };
  for (const point of [start, end])
    expect(
      await canvas.evaluate(
        (node, point) => document.elementFromPoint(point.x, point.y) === node,
        point,
      ),
      "The drag must target the canvas, not an overlaid control.",
    ).toBe(true);
  await canvas.evaluate((node) => {
    for (const type of ["pointerdown", "pointermove", "pointerup"]) {
      node.setAttribute(`data-review-${type}`, "0");
      node.addEventListener(type, (event) => {
        if (type === "pointermove" && !(event as PointerEvent).buttons) return;
        const key = `data-review-${type}`;
        node.setAttribute(key, String(Number(node.getAttribute(key)) + 1));
      });
    }
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 15 });
  await page.mouse.up();
  const delivered = await canvas.evaluate((node) =>
    Object.fromEntries(
      ["pointerdown", "pointermove", "pointerup"].map((type) => [
        type,
        Number(node.getAttribute(`data-review-${type}`)),
      ]),
    ),
  );
  expect(delivered.pointerdown, JSON.stringify(delivered)).toBe(1);
  expect(delivered.pointerup, JSON.stringify(delivered)).toBe(1);
  expect(delivered.pointermove, JSON.stringify(delivered)).toBeGreaterThan(0);
  await expect(partButton(page, "Main panels")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => (await canvas.evaluate(canvasSample)).hash, {
      message: `The view must change after the canvas drag: ${JSON.stringify(delivered)}; baseline=${beforeOrbit}`,
    })
    .not.toBe(beforeOrbit);
});

interface CanvasSample {
  hash: string;
  garmentCoverage: number;
  tonalRange: number;
}

async function stableCanvasHash(canvas: Locator): Promise<string> {
  let previous: CanvasSample | undefined;
  await expect
    .poll(
      async () => {
        await canvas.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        );
        const current = await canvas.evaluate(canvasSample);
        const visible =
          current.garmentCoverage > 0.25 && current.tonalRange > 12;
        const settled = visible && previous?.hash === current.hash;
        previous = visible ? current : undefined;
        return { visible, settled };
      },
      {
        message:
          "The garment must be visible and stable across animation frames.",
      },
    )
    .toEqual({ visible: true, settled: true });
  return previous!.hash;
}

function canvasSample(node: Element): CanvasSample {
  // Hash the full view at thumbnail size; render tests cover full-size export.
  const sample = document.createElement("canvas");
  sample.width = 96;
  sample.height = 96;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas readback is unavailable.");
  context.drawImage(node as HTMLCanvasElement, 0, 0, 96, 96);
  const data = context.getImageData(0, 0, 96, 96).data;
  let hash = 2166136261;
  for (const value of data) hash = Math.imul(hash ^ value, 16777619);

  // The centered torso must contain opaque detail, not a transparent canvas or floor shadow.
  let opaque = 0;
  let darkest = 255;
  let lightest = 0;
  for (let y = 24; y < 60; y++)
    for (let x = 38; x < 58; x++) {
      const offset = (y * 96 + x) * 4;
      if (data[offset + 3]! < 200) continue;
      opaque++;
      const luminance =
        (data[offset]! + data[offset + 1]! + data[offset + 2]!) / 3;
      darkest = Math.min(darkest, luminance);
      lightest = Math.max(lightest, luminance);
    }
  return {
    hash: (hash >>> 0).toString(16),
    garmentCoverage: opaque / (20 * 36),
    tonalRange: opaque > 0 ? lightest - darkest : 0,
  };
}
