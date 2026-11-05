import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

export { expect };
export type { Page, Locator } from "@playwright/test";

/** Exercises real client persistence with a deterministic signed-in Identity session and revisioned transport. */
export const test = base.extend<{ authenticatedStudio: void }>({
  authenticatedStudio: [
    async ({ context }, use) => {
      const workspaceId = randomUUID();
      const organizationId = randomUUID();
      const csrfToken = `synthetic-csrf-${randomUUID()}`;
      let state: Record<string, unknown> = {
        revision: 0,
        draft: null,
        looks: [],
        settings: {},
        materials: {},
      };
      await context.route("**/api/identity/session", (route) =>
        route.fulfill({
          headers: { "Cache-Control": "no-store" },
          json: {
            data: {
              isAuthenticated: true,
              person: {
                sub: "synthetic-browser-review-member",
              },
              organization: {
                id: organizationId,
                name: "Ocharo",
                slug: "ocharo",
                role: "owner",
              },
              permissions: ["studio:edit"],
              csrfToken,
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            },
          },
        }),
      );
      await context.route("**/api/studio/{session,state}", async (route) => {
        const request = route.request();
        const headers = request.headers();
        if (new URL(request.url()).pathname.endsWith("/session")) {
          await route.fulfill({
            headers: { "Cache-Control": "no-store" },
            json: {
              workspaceId,
              organizationId,
              userId: "synthetic-browser-review-member",
              canEdit: true,
            },
          });
          return;
        }
        if (
          request.method() === "PUT" &&
          headers["x-csrf-token"] !== csrfToken
        ) {
          await route.fulfill({ status: 400, json: {} });
          return;
        }
        if (headers["x-studio-workspace"] !== workspaceId) {
          await route.fulfill({ status: 403, json: {} });
          return;
        }
        if (request.method() === "PUT") {
          const proposed = request.postDataJSON();
          if (proposed.revision !== state.revision) {
            await route.fulfill({
              status: 409,
              json: { title: "Revision conflict" },
            });
            return;
          }
          state = { ...proposed, revision: Number(state.revision) + 1 };
        }
        await route.fulfill({
          headers: { "Cache-Control": "no-store" },
          json: state,
        });
      });
      await use();
    },
    { auto: true },
  ],
});
test.use({ ignoreHTTPSErrors: false });

/** The signed-in Identity session's CSRF token, read through the same routing the editor uses. */
async function csrfTokenOf(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/identity/session", {
      credentials: "same-origin",
    });
    return (await response.json()).data.csrfToken as string;
  });
}

/** Reads through browser routing so the request uses the same auth boundary as the editor. */
export async function readRemote(page: Page) {
  return page.evaluate(async () => {
    const session = await fetch("/api/studio/session", {
      credentials: "same-origin",
    });
    if (!session.ok)
      throw new Error(`Review session rejected: ${session.status}`);
    const identity = await session.json();
    const response = await fetch("/api/studio/state", {
      headers: { "X-Studio-Workspace": identity.workspaceId },
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new Error(`Review state rejected: ${response.status}`);
    return response.json();
  });
}

export async function writeRemote(page: Page, state: Record<string, unknown>) {
  const csrfToken = await csrfTokenOf(page);
  return page.evaluate(
    async ({ value, csrfToken }) => {
      const session = await fetch("/api/studio/session", {
        credentials: "same-origin",
      });
      const identity = await session.json();
      const response = await fetch("/api/studio/state", {
        method: "PUT",
        credentials: "same-origin",
        body: JSON.stringify(value),
        headers: {
          "Content-Type": "application/json",
          "X-Csrf-Token": csrfToken,
          "X-Studio-Workspace": identity.workspaceId,
        },
      });
      if (!response.ok)
        throw new Error(`Review state rejected: ${response.status}`);
      return response.json();
    },
    { value: state, csrfToken },
  );
}

/** A cold Vite entry or reload must mount the lazy editor before absence means ready. */
export async function waitForStudioReady(page: Page): Promise<void> {
  if (
    ["/materials", "/studio/materials"].includes(new URL(page.url()).pathname)
  ) {
    await expect(
      page.getByRole("heading", { name: "Material Studio", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".material-model-preview canvas")).toBeVisible({
      timeout: 20_000,
    });
    return;
  }
  await expect(page.locator(".viewport canvas")).toBeVisible({
    timeout: 20_000,
  });
  // Cold model/shader preparation is slower on the CI software GPU.
  await expect(page.getByText("Preparing the studio…")).toHaveCount(0, {
    timeout: process.env.CI ? 45_000 : 20_000,
  });
}

/** Wait for initial storage only; later edits use the default assertion budget. */
export async function waitForStudioStorage(page: Page): Promise<void> {
  await expect(page.locator(".save-status-button")).not.toContainText(
    "Saving",
    { timeout: 20_000 },
  );
}

/** Observe startup responses immediately; start the acknowledgment budget after the action is ready. */
export async function expectStudioResponse(
  page: Page,
  method: "GET" | "PUT",
  action: () => Promise<void>,
  matches: (response: Response) => boolean = () => true,
): Promise<void> {
  let acknowledged = false;
  const transport: string[] = [];
  const onResponse = (response: Response) => {
    const pathname = new URL(response.url()).pathname;
    if (["/api/studio/session", "/api/studio/state"].includes(pathname))
      transport.push(
        `${response.request().method()} ${pathname}: ${response.status()}`,
      );
    if (
      pathname === "/api/studio/state" &&
      response.request().method() === method &&
      response.ok() &&
      matches(response)
    )
      acknowledged = true;
  };
  const onRequestFailed = (request: Request) => {
    const pathname = new URL(request.url()).pathname;
    if (["/api/studio/session", "/api/studio/state"].includes(pathname))
      transport.push(
        `${request.method()} ${pathname}: ${request.failure()?.errorText ?? "failed"}`,
      );
  };
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  try {
    await action();
    await expect
      .poll(() => acknowledged, {
        timeout: 20_000,
        message: `Expected a successful matching ${method} /api/studio/state response.`,
      })
      .toBe(true);
  } catch (error) {
    if (error instanceof Error)
      error.message += `\nStudio transport: ${transport.join("; ") || "no session/state responses"}`;
    throw error;
  } finally {
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
    await test.info().attach("studio-transport", {
      body: JSON.stringify(transport, null, 2),
      contentType: "application/json",
    });
  }
}

/** Opens Studio settings from the frame's account menu, where the settings entry lives at every width. */
export async function openStudioSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Studio settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Studio settings" }),
  ).toBeVisible();
}

/** Picks the colour mode from the account menu's Appearance rows; the pick closes the menu. */
export async function setColorMode(
  page: Page,
  mode: "System" | "Light" | "Dark",
): Promise<void> {
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
}
