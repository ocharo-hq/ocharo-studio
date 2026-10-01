import {
  waitForStudioReady,
  waitForStudioStorage,
  test,
  expect,
} from "./fixtures/studioFixture";
import AxeBuilder from "@axe-core/playwright";

async function suppressOnboarding(
  page: import("./fixtures/studioFixture").Page,
) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    ),
  );
}

test("landing introduces the studio without starting editor resources", async ({
  page,
}) => {
  const editorRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/studio|\.glb(?:$|\?)/.test(request.url()))
      editorRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tradition,reimagined.",
  );
  await expect(page).toHaveTitle("Tradition, reimagined · Ocharo Studio");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(editorRequests).toEqual([]);
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await expect(page).toHaveURL(/\/studio$/, { timeout: 20_000 });
  await expect(
    page.getByRole("dialog", { name: "Welcome to Ocharo Studio." }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await waitForStudioReady(page);
  await expect(page.locator(".scene-title")).toHaveCount(0);
  await expect(page.getByText("Tradition, reimagined.")).toHaveCount(0);
});

test("landing and studio navigation preserve the latest draft and support history", async ({
  page,
}) => {
  // This roundtrip remounts the lazy editor several times on the software-rendered runner.
  test.setTimeout(120_000);
  await suppressOnboarding(page);
  // A fresh workspace writes its initial draft after the lazy editor mounts.
  const initialSave = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/studio/state" &&
      response.request().method() === "PUT" &&
      response.ok(),
    { timeout: 20_000 },
  );
  await page.goto("/studio");
  await waitForStudioReady(page);
  await initialSave;
  await waitForStudioStorage(page);
  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("65");
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("A new beginning");
  await page.getByRole("link", { name: "Ocharo Studio home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tradition",
  );
  await page.goBack();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "A new beginning",
  );
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("65");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tradition",
  );
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await waitForStudioReady(page);
  await page.reload();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "A new beginning",
  );
  await expect(page.locator(".save-status-button")).not.toContainText(
    "Resolve",
  );
});

test("focused look names survive browser history and reload", async ({
  page,
}) => {
  await suppressOnboarding(page);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await waitForStudioReady(page);

  const name = page.getByRole("textbox", { name: "Look name" });
  await name.fill("Focused history draft");
  await expect(name).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(name).toHaveValue("Focused history draft");

  await name.fill("Focused reload draft");
  await expect(name).toBeFocused();
  await page.reload();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Focused reload draft",
  );
});

test("studio waits for an in-flight save before navigating home", async ({
  page,
}) => {
  await suppressOnboarding(page);
  // A fresh workspace writes its initial draft after the lazy editor mounts.
  const initialSave = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/studio/state" &&
      response.request().method() === "PUT" &&
      response.ok(),
    { timeout: 20_000 },
  );
  await page.goto("/studio");
  await waitForStudioReady(page);
  await initialSave;
  await waitForStudioStorage(page);

  let releaseWrite: (() => void) | undefined;
  const release = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  let observeWrite: (() => void) | undefined;
  const writeObserved = new Promise<void>((resolve) => {
    observeWrite = resolve;
  });
  await page.route("**/api/studio/state", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.fallback();
      return;
    }
    observeWrite?.();
    await release;
    await route.fallback();
  });

  await page.getByRole("slider", { name: "Rotation", exact: true }).fill("72");
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Wait for this save");
  await writeObserved;
  await page.getByRole("link", { name: "Ocharo Studio home" }).click();
  await expect(page).toHaveURL(/\/studio$/);

  releaseWrite?.();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Wait for this save",
  );
  await expect(
    page.getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("72");
});

test("landing is responsive and accessible in light and dark themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".landing-material-grid").scrollIntoViewIfNeeded();
  await expect(page.locator(".landing-material-grid img")).toHaveCount(6);
  await expect
    .poll(() =>
      page
        .locator(".landing-material-grid img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBeTruthy();
  await page
    .locator(".landing-material-grid img")
    .evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("link", { name: "Open studio", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/landing-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const dark of [false, true]) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle("dark", value),
      dark,
    );
    await page.evaluate(() =>
      Promise.allSettled(
        document.getAnimations().map((animation) => animation.finished),
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
  await page.screenshot({
    path: "test-results/landing-dark.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#landing-main$/);
  await expect(page.locator("#landing-main")).toBeFocused();
  const mobileResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    mobileResult.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});

test("direct editor routes, legacy URLs and missing pages remain distinct", async ({
  page,
}) => {
  await page.goto("/editor");
  await waitForStudioReady(page);
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await page.goto("/not-a-studio-page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This page is not in the atelier.",
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page).toHaveTitle("Page not found · Ocharo Studio");
});

test("edits made during initial storage loading survive leaving and reopening", async ({
  page,
}) => {
  // This roundtrip remounts the lazy editor several times on the software-rendered runner.
  test.setTimeout(120_000);
  await suppressOnboarding(page);
  // A fresh workspace writes its initial draft after the lazy editor mounts.
  const initialSave = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/studio/state" &&
      response.request().method() === "PUT" &&
      response.ok(),
    { timeout: 20_000 },
  );
  await page.goto("/studio");
  await waitForStudioReady(page);
  await initialSave;
  await waitForStudioStorage(page);
  await page.getByRole("link", { name: "Ocharo Studio home" }).click();

  let releaseRead!: () => void;
  const release = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  let observeRead!: () => void;
  const observed = new Promise<void>((resolve) => {
    observeRead = resolve;
  });
  let held = false;
  await page.route("**/api/studio/state", async (route) => {
    if (route.request().method() === "GET" && !held) {
      held = true;
      observeRead();
      await release;
    }
    await route.fallback().catch(() => {});
  });
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await observed;
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Named while loading");
  await page.getByRole("link", { name: "Ocharo Studio home" }).click();
  await expect(page).toHaveURL(/\/$/);
  releaseRead();
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.locator(".save-status-button")).not.toContainText(
    "Resolve",
  );
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Named while loading",
  );
  await page.reload();
  await waitForStudioReady(page);
  await waitForStudioStorage(page);
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Named while loading",
  );
});

test("failed lazy editor imports expose a recoverable route error", async ({
  page,
}) => {
  await suppressOnboarding(page);
  const editorModule =
    /\/(?:src\/bootstrap\/App\.vue|assets\/App-[^/]+\.js)(?:\?.*)?$/;
  await page.route(editorModule, (route) => route.abort());
  await page.goto("/");
  await page
    .getByRole("link", { name: "Open the studio", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The page could not open.",
  );
  await page.unroute(editorModule);
  await page.getByRole("link", { name: "Open studio", exact: true }).click();
  await waitForStudioReady(page);
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator(".viewport canvas")).toBeVisible();
});
