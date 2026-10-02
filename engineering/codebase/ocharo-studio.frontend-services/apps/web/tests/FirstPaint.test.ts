import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
const root = resolve(process.cwd(), ".");
const paths = ["."];
it.each(paths)(
  "boots external first-paint assets before the app for %s",
  (path) => {
    const html = readFileSync(resolve(root, path, "index.html"), "utf8");
    expect(html.indexOf("theme.js")).toBeLessThan(html.indexOf('src="/src/'));
    expect(html).toContain("%BASE_URL%boot-splash.css");
    const css = readFileSync(
      resolve(root, path, "public/boot-splash.css"),
      "utf8",
    );
    expect(css).toMatch(/html/);
    expect(css).toMatch(/body/);
    expect(css).toContain("background");
    const style: { colorScheme?: string } = {};
    runInNewContext(
      readFileSync(resolve(root, path, "public/theme.js"), "utf8"),
      {
        document: {
          documentElement: { classList: { toggle: vi.fn() }, style },
        },
        localStorage: { getItem: () => null },
        sessionStorage: { getItem: () => null },
        location: { pathname: "/" },
      },
    );
    expect(style.colorScheme).toBe("light");
  },
);

function boot(values: Record<string, string>, pathname = "/") {
  const toggle = vi.fn();
  const style: { colorScheme?: string } = {};
  const storage = { getItem: (key: string) => values[key] ?? null };
  runInNewContext(readFileSync(resolve(root, "public/theme.js"), "utf8"), {
    document: { documentElement: { classList: { toggle }, style } },
    localStorage: storage,
    sessionStorage: storage,
    location: { pathname },
  });
  return { style, toggle };
}
it("honours legacy and tab-scoped dark preferences before mount", () => {
  expect(boot({ "ocharo-studio.theme": "true" }).style.colorScheme).toBe(
    "dark",
  );
  const scoped = {
    "ocharo-studio.theme": "false",
    "ocharo-studio:tab": "my-tab",
    "ocharo-studio:studio:recovery:my-tab": JSON.stringify({
      schemaVersion: 1,
      settings: { dark: true },
    }),
  };
  const actual = boot(scoped, "/studio");
  expect(actual.style.colorScheme).toBe("dark");
  expect(actual.toggle).toHaveBeenCalledWith("dark", true);
});
it("handles blocked storage without preventing first paint", () => {
  const style: { colorScheme?: string } = {};
  runInNewContext(readFileSync(resolve(root, "public/theme.js"), "utf8"), {
    document: { documentElement: { classList: { toggle: vi.fn() }, style } },
    localStorage: {
      getItem: () => {
        throw Error("blocked");
      },
    },
    sessionStorage: { getItem: () => null },
    location: { pathname: "/studio" },
  });
  expect(style.colorScheme).toBe("light");
});
