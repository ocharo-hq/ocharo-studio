import {
  ColorMode,
  type ColorModeContextValue,
} from "@wow-two-beta/fe/foundation/primitives";
import { ThemeStorageKey } from "./theme";

/** The values the SDK colour-mode provider stores; anything else counts as no stored mode. */
const StoredModes = new Set<string>(["light", "dark", "system"]);

/**
 * Seeds the colour mode from a synced or recovered `settings.dark` once, when this browser stores no mode yet; returns
 * whether it did. Studio no longer writes `settings.dark`, and reads it only here: older saved states keep the field
 * unchanged, so an older open tab still finds its theme. Blocked storage counts as no stored mode, and the provider
 * keeps the seeded mode in memory.
 */
export function seedColorMode(
  dark: unknown,
  colorMode: Pick<ColorModeContextValue, "setMode">,
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): boolean {
  if (typeof dark !== "boolean") return false;
  let stored: string | null = null;
  try {
    stored = storage?.getItem(ThemeStorageKey) ?? null;
  } catch {
    /* Storage denial leaves the seed to the in-memory mode. */
  }
  if (stored !== null && StoredModes.has(stored)) return false;
  colorMode.setMode(dark ? ColorMode.Dark : ColorMode.Light);
  return true;
}
