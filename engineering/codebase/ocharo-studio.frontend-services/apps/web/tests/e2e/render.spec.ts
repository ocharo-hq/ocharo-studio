import { readFile } from "node:fs/promises";
import { expectNeutralShadows } from "./fixtures/imageReview";
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

test("studio render produces a print-size image on the model and downloads it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /Studio render/ }).click();

  const dialog = page.getByRole("dialog", { name: "Studio render" });
  const holder = dialog
    .getByRole("group", { name: "Render on" })
    .getByRole("button", { name: "Model", exact: true });
  await holder.click();
  await expect(holder).toHaveAttribute("aria-pressed", "true");
  await dialog
    .getByRole("group", { name: "Render backdrop" })
    .getByRole("button", { name: "Transparent", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Download PNG" }),
  ).toBeDisabled();

  await dialog.getByRole("button", { name: "Render", exact: true }).click();
  const image = dialog.getByRole("img", { name: "Studio render of this look" });
  await expect(image).toBeVisible({ timeout: 90_000 });
  expect(
    await image.evaluate((node: HTMLImageElement) => [
      node.naturalWidth,
      node.naturalHeight,
    ]),
  ).toEqual([1600, 2000]);

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download PNG" }).click();
  const rendered = await download;
  expect(rendered.suggestedFilename()).toMatch(/-model-front\.png$/);
  const path = testInfo.outputPath("model-render.png");
  await rendered.saveAs(path);
  await expectNeutralShadows(page, await readFile(path));
  expect(errors).toEqual([]);
});
