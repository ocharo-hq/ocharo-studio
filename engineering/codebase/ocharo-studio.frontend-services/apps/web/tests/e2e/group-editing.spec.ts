import {
  waitForStudioReady,
  expect,
  test,
  type Page,
} from "./fixtures/studioFixture";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ocharo-studio:settings",
      JSON.stringify({
        onboarding: { invitations: 2, hiddenPermanently: true },
      }),
    );
  });
  await page.goto("/studio");
  await waitForStudioReady(page);
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: 20_000,
  });
});

function partChip(page: Page, name: string) {
  return page.locator(".part-chips").getByRole("button", {
    name,
    exact: true,
  });
}

async function addPart(page: Page, name: string): Promise<void> {
  await page.locator(".part-multiselect-trigger").click();
  await page
    .getByRole("listbox", { name: "Garment parts to edit" })
    .getByRole("option", { name: new RegExp(`^${name}`) })
    .click();
}

async function exportedId(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Editable design/ }).click();
  const path = await (await downloadPromise).path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, "utf8")).id as string;
}

test("group edits stay coherent and New preserves a meaningful draft", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Textiles" }).click();
  await page
    .getByRole("button", {
      name: "Indigo adras Generated textile",
      exact: true,
    })
    .click();
  await page.getByRole("slider", { name: "Rotation" }).fill("45");

  await addPart(page, "Lapel & collar");
  await expect(
    page.getByRole("button", { name: "2 parts", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rotation" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "On garment", exact: true }),
  ).toHaveCount(0);

  await page
    .getByRole("button", {
      name: "Indigo adras Generated textile",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("slider", { name: "Scale", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("slider", { name: "Horizontal" }).fill("0.25");
  await expect(page.getByRole("slider", { name: "Horizontal" })).toHaveValue(
    "0.25",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Horizontal" })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Horizontal" })).toHaveValue(
    "0.25",
  );
  await page.getByRole("button", { name: "Reset pattern placement" }).click();

  await page.getByRole("button", { name: "2 parts", exact: true }).click();
  await page
    .getByRole("listbox", { name: "Garment parts to edit" })
    .getByRole("option", { name: /^Lapel & collar/ })
    .click();
  await expect(page.getByRole("slider", { name: "Rotation" })).toHaveValue(
    "45",
  );
  await expect(page.getByRole("slider", { name: "Horizontal" })).toHaveValue(
    "0",
  );

  await partChip(page, "Lapel & collar").click();
  await expect(page.getByRole("slider", { name: "Horizontal" })).toHaveValue(
    "0",
  );
  await expect(page.getByRole("slider", { name: "Rotation" })).toHaveValue("0");
  await expect(page.locator(".current-material strong")).toHaveText(
    "Indigo adras",
  );

  await page.getByRole("textbox", { name: "Look name" }).fill("Grouped draft");
  const previousId = await exportedId(page);
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await expect(page.locator(".studio-toasts")).toContainText(
    "Previous draft kept in My looks",
  );
  const newId = await exportedId(page);
  expect(newId).not.toBe(previousId);

  await page.getByRole("tab", { name: "My looks" }).click();
  await expect(
    page.getByRole("button", { name: "Open Grouped draft", exact: true }),
  ).toBeVisible();
});
