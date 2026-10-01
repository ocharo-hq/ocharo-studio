import { expectNeutralShadows } from "./fixtures/imageReview";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

test.use({ ignoreHTTPSErrors: false });

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

test("browser-only designs survive reload without requesting private storage", async ({
  page,
}, testInfo) => {
  const storageRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/studio\/(state|session)/.test(request.url()))
      storageRequests.push(request.url());
  });
  await page.goto("/studio");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Browser recovery review");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Browser recovery review",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Designs stay in this browser", { exact: true }),
  ).toBeVisible();
  const connection = page.getByRole("region", {
    name: "Ocharo Desk connection",
  });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const labelBounds = await connection.locator("label").boundingBox();
    const inputBounds = await connection
      .getByLabel("Desk connection ticket")
      .boundingBox();
    const connectionBounds = await connection.boundingBox();
    expect(labelBounds).not.toBeNull();
    expect(inputBounds).not.toBeNull();
    expect(connectionBounds).not.toBeNull();
    expect(inputBounds!.y).toBeGreaterThanOrEqual(
      labelBounds!.y + labelBounds!.height,
    );
    expect(inputBounds!.width).toBeGreaterThan(180);
    expect(inputBounds!.x + inputBounds!.width).toBeLessThan(
      connectionBounds!.x + connectionBounds!.width,
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("connection-settings-phone.png"),
  });
  expect(storageRequests).toEqual([]);
});

test("ticket fragment is cleared and expired access preserves browser recovery", async ({
  page,
}) => {
  const workspaceId = "d0a8c678-c27f-478f-b4e8-c9928bf88c21";
  const organizationId = "f74556b7-caf8-41db-a25c-030d1f7d7987";
  const ticket = "browser-fixture-ticket";
  let revoked = false;
  let state: Record<string, unknown> = {
    revision: 0,
    draft: null,
    looks: [],
    settings: {},
    materials: {},
  };
  let writes = 0;
  await page.route("**/api/studio/session", (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${ticket}`);
    return route.fulfill({
      json: {
        workspaceId,
        organizationId,
        userId: "fixture-member",
        canEdit: true,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    });
  });
  await page.route("**/api/studio/state", async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${ticket}`);
    expect(route.request().headers()["x-studio-workspace"]).toBe(workspaceId);
    if (revoked) return route.fulfill({ status: 401, json: {} });
    if (route.request().method() === "PUT") {
      state = {
        ...route.request().postDataJSON(),
        revision: Number(state.revision) + 1,
      };
      writes += 1;
    }
    return route.fulfill({ json: state });
  });
  const fragment = new URLSearchParams({
    "ocharo-ticket": ticket,
    audience: "ocharo-studio",
    issuer: process.env.VITE_OCHARO_PLATFORM_ORIGIN ?? "https://localhost:8264",
  });
  await page.goto(`/studio#${fragment}`);
  await expect(page).toHaveURL(/\/studio$/);
  await expect.poll(() => writes).toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Connected design review");
  await expect
    .poll(() => (state.draft as { name?: string } | null)?.name)
    .toBe("Connected design review");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ocharo-studio:integration-ticket"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("ocharo-studio:integration-ticket"),
    ),
  ).toBe(ticket);
  revoked = true;
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Recover after expired access");
  await expect(page.locator(".save-status-button")).toContainText("Offline");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Look name" })).toHaveValue(
    "Recover after expired access",
  );
  expect((state.draft as { name: string }).name).toBe(
    "Connected design review",
  );
});

test("review files preserve the rendered PNG hash and immutable source release", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const externalWrites: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      externalWrites.push(request.url());
  });
  await page.goto("/studio");
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await page
    .getByRole("textbox", { name: "Look name" })
    .fill("Synthetic local review fixture");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /Submit for review/ }).click();
  const dialog = page.getByRole("dialog", { name: "Send a look for review" });
  const prepare = dialog.getByRole("button", { name: "Prepare review files" });
  await expect(prepare).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Notes for the reviewer" })
    .fill(
      "Synthetic local integration review; not business approval or product evidence.",
    );
  await dialog.getByRole("checkbox").check();
  await prepare.click();
  const imageReady = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download PNG", exact: true })
    .click();
  const image = await imageReady;
  const manifestReady = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download review manifest" })
    .click();
  const manifest = await manifestReady;
  const destination = process.env.STUDIO_REVIEW_OUTPUT
    ? join(process.env.STUDIO_REVIEW_OUTPUT, randomUUID())
    : testInfo.outputPath("creative-package");
  await mkdir(destination, { recursive: true });
  const imagePath = join(destination, image.suggestedFilename());
  const manifestPath = join(destination, manifest.suggestedFilename());
  await image.saveAs(imagePath);
  await manifest.saveAs(manifestPath);
  const bytes = await readFile(imagePath);
  const review = JSON.parse(await readFile(manifestPath, "utf8"));
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(review.derivative.sha256).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  await expectNeutralShadows(page, bytes);
  expect(review.derivative.bytes).toBe(bytes.length);
  expect(review.derivative.fileName).toBe(image.suggestedFilename());
  expect(review.derivative.classification).toBe("creative-visualization");
  expect(review.design.document.name).toBe("Synthetic local review fixture");
  expect(review.assetReleases).toEqual([
    {
      id: "ocharo-garments@2.0.0",
      sha256:
        "9672e9b74e70521154455487d53f0196db4ce2b3fde8e0a9f0d85b27f0bfbf2a",
    },
  ]);
  expect(review.sourceApproval.status).toBe("approved-for-review");
  expect(review.materials.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(externalWrites).toEqual([]);
  await page.screenshot({ path: join(destination, "review-dialog.png") });
  console.log(`Synthetic creative package: ${destination}`);
});
