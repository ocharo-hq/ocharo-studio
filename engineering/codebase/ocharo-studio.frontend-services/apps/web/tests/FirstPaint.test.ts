import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { colorModeScript } from "@wow-two-beta/fe/foundation/primitives";
import { ThemeMigrationScript, ThemeStorageKey } from "../src/bootstrap/theme";
import { seedColorMode } from "../src/bootstrap/ColorModeSeed";

const root = resolve(process.cwd(), ".");
/** The `/theme.js` the build emits: Studio's legacy-choice prelude, then the SDK pre-paint script. */
const script =
  ThemeMigrationScript + colorModeScript({ storageKey: ThemeStorageKey });
const html = readFileSync(resolve(root, "index.html"), "utf8");
const stylesheet = readFileSync(
  resolve(root, "public/boot-splash.css"),
  "utf8",
);

/** Runs the generated pre-paint script against browser storage and the device's colour preference. */
function paint(
  values: Record<string, string>,
  systemDark = false,
  session: Record<string, string> = {},
) {
  const classes = new Set<string>();
  const style: { colorScheme?: string } = {};
  const stored = { ...values };
  runInNewContext(script, {
    localStorage: {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
    },
    sessionStorage: { getItem: (key: string) => session[key] ?? null },
    matchMedia: () => ({ matches: systemDark }),
    document: {
      documentElement: {
        style,
        classList: {
          toggle: (name: string, enabled: boolean) =>
            enabled ? classes.add(name) : classes.delete(name),
        },
      },
    },
  });
  return {
    classes: [...classes],
    colorScheme: style.colorScheme,
    stored: stored[ThemeStorageKey] ?? null,
  };
}

describe("Studio first paint", () => {
  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    ["system", true, "dark"],
    ["system", false, "light"],
    [null, true, "dark"],
    [null, false, "light"],
    ["invalid", false, "light"],
  ])(
    "honours the stored %s with system dark %s before the app module",
    (saved, systemDark, expected) => {
      const result = paint(
        saved === null ? {} : { [ThemeStorageKey]: saved },
        systemDark,
      );
      expect(result.classes).toEqual(expected === "dark" ? ["dark"] : []);
      expect(result.colorScheme).toBe(expected);
    },
  );

  it("turns the boolean earlier builds stored under the same key into a mode", () => {
    expect(ThemeStorageKey).toBe("ocharo-studio.theme");
    expect(paint({ [ThemeStorageKey]: "true" }, false)).toMatchObject({
      classes: ["dark"],
      stored: "dark",
    });
    expect(paint({ [ThemeStorageKey]: "false" }, true)).toMatchObject({
      classes: [],
      colorScheme: "light",
      stored: "light",
    });
  });

  it("seeds a missing mode once from the tab's recovered settings, else the untabbed settings", () => {
    const recovered = paint(
      {
        "ocharo-studio:studio:recovery:my-tab": JSON.stringify({
          schemaVersion: 1,
          settings: { dark: true },
        }),
      },
      false,
      { "ocharo-studio:tab": "my-tab" },
    );
    expect(recovered).toMatchObject({ classes: ["dark"], stored: "dark" });
    const untabbed = paint(
      { "ocharo-studio:settings": JSON.stringify({ dark: false }) },
      true,
    );
    expect(untabbed).toMatchObject({ classes: [], stored: "light" });
    // A stored mode wins over any design setting.
    expect(
      paint(
        {
          [ThemeStorageKey]: "system",
          "ocharo-studio:settings": JSON.stringify({ dark: true }),
        },
        false,
      ),
    ).toMatchObject({ classes: [], stored: "system" });
  });

  it("follows the device when storage is blocked", () => {
    const style: { colorScheme?: string } = {};
    runInNewContext(script, {
      localStorage: {
        getItem: () => {
          throw Error("blocked");
        },
      },
      sessionStorage: { getItem: () => null },
      matchMedia: () => ({ matches: false }),
      document: {
        documentElement: { classList: { toggle: () => true }, style },
      },
    });
    expect(style.colorScheme).toBeUndefined();
  });

  it("loads the SDK theme, the pre-paint script and the splash colours before the application, with no inline code", () => {
    const application = html.indexOf('type="module"');
    expect(html).toMatch(/<html[^>]*class="theme-ocharo"/);
    expect(html.indexOf('src="%BASE_URL%theme.js"')).toBeGreaterThan(-1);
    expect(html.indexOf('src="%BASE_URL%theme.js"')).toBeLessThan(application);
    expect(html.indexOf('href="%BASE_URL%boot-splash.css"')).toBeLessThan(
      application,
    );
    expect(html).not.toMatch(/<style|<script(?![^>]*src=)/);
    expect(html).toContain('content="#f5f6fa"');
    expect(html).toContain('content="#141416"');
    expect(stylesheet).toContain("background: #f5f6fa");
    expect(stylesheet).toContain("background: #141416");
  });
});

describe("Studio colour seed", () => {
  function provider() {
    const modes: string[] = [];
    return { modes, setMode: (mode: string) => modes.push(mode) };
  }

  it("seeds the mode from a synced design setting only while no mode is stored", () => {
    const empty = provider();
    expect(seedColorMode(true, empty, { getItem: () => null })).toBe(true);
    expect(empty.modes).toEqual(["dark"]);
    const legacy = provider();
    expect(seedColorMode(false, legacy, { getItem: () => "true" })).toBe(true);
    expect(legacy.modes).toEqual(["light"]);
    for (const stored of ["light", "dark", "system"]) {
      const chosen = provider();
      expect(seedColorMode(true, chosen, { getItem: () => stored })).toBe(
        false,
      );
      expect(chosen.modes).toEqual([]);
    }
  });

  it("ignores designs without a boolean setting and keeps blocked storage in memory", () => {
    const none = provider();
    expect(seedColorMode(undefined, none, { getItem: () => null })).toBe(false);
    expect(seedColorMode("dark", none, { getItem: () => null })).toBe(false);
    expect(none.modes).toEqual([]);
    const blocked = provider();
    expect(
      seedColorMode(true, blocked, {
        getItem: () => {
          throw Error("blocked");
        },
      }),
    ).toBe(true);
    expect(blocked.modes).toEqual(["dark"]);
  });
});
