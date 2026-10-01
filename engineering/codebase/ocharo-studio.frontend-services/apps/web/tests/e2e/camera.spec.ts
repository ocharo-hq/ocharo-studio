import {
  waitForStudioReady,
  expect,
  test,
  type Locator,
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

async function openStudio(page: Page): Promise<Locator> {
  await page.goto("/studio");
  await waitForStudioReady(page);
  const canvas = page.locator(".viewport canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  // The lazy editor must mount before absence of its loading overlay means ready.
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  return canvas;
}

async function hash(canvas: Locator): Promise<string> {
  return canvas.evaluate((node) => {
    // Read the full view at thumbnail size; render tests cover full-size export.
    const sample = document.createElement("canvas");
    sample.width = 96;
    sample.height = 96;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas readback is unavailable.");
    context.drawImage(node as HTMLCanvasElement, 0, 0, 96, 96);
    const data = context.getImageData(0, 0, 96, 96).data;
    let value = 2166136261;
    for (const byte of data) value = Math.imul(value ^ byte, 16777619);
    return (value >>> 0).toString(16);
  });
}

async function waitForStableFrame(canvas: Locator): Promise<string> {
  let previous = await hash(canvas);
  await expect
    .poll(
      async () => {
        const current = await hash(canvas);
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { intervals: [80, 100, 120], timeout: 2_000 },
    )
    .toBe(true);
  return previous;
}

async function waitForChangedFrame(
  canvas: Locator,
  previous: string,
): Promise<string> {
  await expect.poll(() => hash(canvas)).not.toBe(previous);
  return waitForStableFrame(canvas);
}

test("camera presets animate to a stable shortest-route view", async ({
  page,
}) => {
  // Software-rendered clock steps include every frame on the CI runner.
  test.setTimeout(90_000);
  // Advance time explicitly so slow readback cannot skip the intermediate frame.
  const startedAt = Date.now();
  await page.clock.install({ time: startedAt });
  const canvas = await openStudio(page);
  await waitForStableFrame(canvas);
  // Keep the pause target beyond the remaining test budget and protocol latency.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 120_000));
  const front = await hash(canvas);

  await page.getByRole("button", { name: "back", exact: true }).click();
  await page.clock.runFor(120);
  const middle = await hash(canvas);
  expect(middle).not.toBe(front);

  await page.clock.runFor(450);
  const back = await hash(canvas);
  expect(back).not.toBe(middle);
  await page.clock.runFor(150);
  expect(await hash(canvas)).toBe(back);
});

test("wheel and trackpad gestures preserve their distinct camera controls", async ({
  page,
}) => {
  const canvas = await openStudio(page);
  const front = await waitForStableFrame(canvas);

  await canvas.dispatchEvent("wheel", {
    deltaX: 0,
    deltaY: -3,
    deltaMode: 1,
  });
  const zoomed = await waitForChangedFrame(canvas, front);

  await canvas.dispatchEvent("wheel", {
    deltaX: 0,
    deltaY: 120,
    deltaMode: 0,
  });
  const fastVerticalOrbit = await waitForChangedFrame(canvas, zoomed);

  await canvas.dispatchEvent("wheel", {
    deltaX: 24,
    deltaY: 5,
    deltaMode: 0,
  });
  const orbited = await waitForChangedFrame(canvas, fastVerticalOrbit);

  await page.getByRole("button", { name: "Fit garment" }).click();
  await page.waitForTimeout(550);
  const fitted = await waitForStableFrame(canvas);
  expect(fitted).not.toBe(orbited);
  expect(fastVerticalOrbit).not.toBe(zoomed);
  expect(orbited).not.toBe(front);
});

test("reduced motion snaps presets and garment changes preserve zoom", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const canvas = await openStudio(page);
  const front = await waitForStableFrame(canvas);

  await page.getByRole("button", { name: "side", exact: true }).click();
  await page.waitForTimeout(40);
  const side = await hash(canvas);
  await page.waitForTimeout(120);
  expect(await hash(canvas)).toBe(side);
  expect(side).not.toBe(front);

  await page.getByRole("button", { name: "Fit garment" }).click();
  await waitForChangedFrame(canvas, side);
  await page.getByRole("button", { name: "Zoom in" }).click();
  const zoomed = await waitForChangedFrame(canvas, front);
  expect(zoomed).not.toBe(front);

  await page.getByRole("button", { name: /05 Abaya / }).click();
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  const abayaAtPreservedZoom = await waitForStableFrame(canvas);
  await page.getByRole("button", { name: "Fit garment" }).click();
  const abayaFullFrame = await waitForChangedFrame(
    canvas,
    abayaAtPreservedZoom,
  );
  expect(abayaFullFrame).not.toBe(abayaAtPreservedZoom);

  await page.getByRole("button", { name: /01 Nimcha / }).click();
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Fit garment" }).click();
  expect(await waitForStableFrame(canvas)).toBe(front);
});
