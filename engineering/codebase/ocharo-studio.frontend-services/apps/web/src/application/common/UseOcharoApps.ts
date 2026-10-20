import { inject, type InjectionKey, type Plugin } from "vue";
import {
  ConfigError,
  defineConfig,
  importMetaEnvSource,
  staticSource,
  url,
  type ConfigSchema,
  type ConfigSource,
  type InferConfig,
} from "@wow-two-beta/fe/foundation/config";

import {
  ocharoApps,
  type OcharoApp,
  type OcharoAppAddresses,
  type OcharoAppKey,
} from "../../domain/common/OcharoApps";
import {
  runtimeConfigApi,
  type RuntimeConfigValues,
} from "../../integration/common/RuntimeConfigApi";

/** The build reads every key under this prefix: `OCHARO_DESK_URL` is `VITE_OCHARO_DESK_URL` there. */
export const BuildTimePrefix = "VITE_";

/**
 * Every address Studio's app menu reads, keyed as `/api/runtime-config` serves it; each default is the local-run
 * address. The keys are the suite's, shared with Desk and Catalogue.
 */
export const OcharoAppsConfigSchema = {
  OCHARO_DESK_URL: url({ default: "https://localhost:8264/" }),
  OCHARO_CATALOGUE_URL: url({ default: "https://localhost:8282/catalogues" }),
  OCHARO_STUDIO_URL: url({ default: "https://localhost:8262/studio" }),
  OCHARO_MARKETING_URL: url({ default: "https://localhost:8358/" }),
  OCHARO_EDITORIAL_URL: url({ default: "https://localhost:8284/studio/" }),
  OCHARO_BRAND_URL: url({ default: "https://localhost:8288/" }),
  OCHARO_ATLAS_URL: url({ default: "https://localhost:8284/atlas/" }),
  OCHARO_WEAR_URL: url({ default: "https://localhost:8284/wear/" }),
  OCHARO_BLOG_URL: url({ default: "https://localhost:8284/" }),
} satisfies ConfigSchema;

/** The resolved addresses, one per schema key. */
export type OcharoAppsConfig = InferConfig<typeof OcharoAppsConfigSchema>;

/** @internal The menu destination each key addresses. */
const AppKeys: Readonly<Record<keyof OcharoAppsConfig, OcharoAppKey>> = {
  OCHARO_DESK_URL: "desk",
  OCHARO_CATALOGUE_URL: "catalogue",
  OCHARO_STUDIO_URL: "studio",
  OCHARO_MARKETING_URL: "marketing",
  OCHARO_EDITORIAL_URL: "editorial",
  OCHARO_BRAND_URL: "brand",
  OCHARO_ATLAS_URL: "atlas",
  OCHARO_WEAR_URL: "wear",
  OCHARO_BLOG_URL: "blog",
};

/** What the operator's console is told when startup could not use every source or value. */
export const OcharoAppsProblem = {
  Unavailable:
    "Ocharo app links could not be loaded, so the app menu uses the built-in addresses.",
  Rejected:
    "Some Ocharo app links are misconfigured, so the app menu leaves them out.",
} as const;

export type OcharoAppsProblem =
  (typeof OcharoAppsProblem)[keyof typeof OcharoAppsProblem];

/** What startup resolved, and each problem owed to the operator. */
export interface OcharoAppsStartup {
  /** The app menu's destinations. */
  readonly addresses: OcharoAppAddresses;
  /** The message and the technical detail behind it; empty when every source and value was usable. */
  readonly problems: readonly {
    readonly message: OcharoAppsProblem;
    readonly detail: string;
  }[];
}

/** The runtime source: the served settings under the build prefix, so one lookup key reads every source. */
export function runtimeConfigSource(values: RuntimeConfigValues): ConfigSource {
  return staticSource(
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        `${BuildTimePrefix}${key}`,
        value,
      ]),
    ),
  );
}

/** The build-time source: the `VITE_` values Vite inlines into Studio's own modules. */
export function buildTimeConfigSource(): ConfigSource {
  return importMetaEnvSource(import.meta.env);
}

/** Resolves every address, earlier sources first; throws one `ConfigError` naming each malformed value. */
export function resolveOcharoAppsConfig(
  sources: readonly ConfigSource[],
): OcharoAppsConfig {
  return defineConfig(OcharoAppsConfigSchema, {
    sources,
    prefix: BuildTimePrefix,
  });
}

/** @internal Maps resolved keys onto menu destinations. */
function toAddresses(
  config: Readonly<Record<string, unknown>>,
): OcharoAppAddresses {
  const addresses: Partial<Record<OcharoAppKey, string>> = {};
  for (const [key, app] of Object.entries(AppKeys)) {
    const value = config[key];
    if (typeof value === "string") addresses[app] = value;
  }
  return addresses;
}

/** @internal Resolves the addresses; a malformed value leaves its key out instead of yielding to a lower source. */
function resolveAddresses(sources: readonly ConfigSource[]): {
  addresses: OcharoAppAddresses;
  error: ConfigError | null;
} {
  try {
    return {
      addresses: toAddresses(resolveOcharoAppsConfig(sources)),
      error: null,
    };
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const rejected = new Set(error.issues.map((issue) => issue.key));
    const usable = Object.fromEntries(
      Object.entries(OcharoAppsConfigSchema).filter(
        ([key]) => !rejected.has(key),
      ),
    );
    return {
      addresses: toAddresses(
        defineConfig(usable, { sources, prefix: BuildTimePrefix }),
      ),
      error,
    };
  }
}

/** Reads the served settings once, then resolves every address over the build-time values and local defaults. */
export async function loadOcharoApps(
  signal: AbortSignal = new AbortController().signal,
): Promise<OcharoAppsStartup> {
  const runtime = await runtimeConfigApi.get(signal);
  const sources = runtime.ok
    ? [runtimeConfigSource(runtime.value), buildTimeConfigSource()]
    : [buildTimeConfigSource()];
  const { addresses, error } = resolveAddresses(sources);
  return {
    addresses,
    problems: [
      ...(runtime.ok
        ? []
        : [
            {
              message: OcharoAppsProblem.Unavailable,
              detail: `GET /api/runtime-config failed: ${runtime.failure.code}.`,
            },
          ]),
      ...(error
        ? [{ message: OcharoAppsProblem.Rejected, detail: error.message }]
        : []),
    ],
  };
}

/**
 * Reports each startup problem once on the console. Studio keeps working with the addresses it has, and the menu is
 * the only thing affected, so no notice interrupts the editor.
 */
export function reportOcharoAppsStartup(startup: OcharoAppsStartup): void {
  for (const problem of startup.problems)
    console.warn(`Ocharo apps: ${problem.message} ${problem.detail}`);
}

/** @internal Carries the startup resolution to every component. */
const OcharoAppsKey: InjectionKey<OcharoAppAddresses> = Symbol("OcharoApps");

/** Provides the addresses resolved at startup to the whole app. */
export function ocharoAppsPlugin(startup: OcharoAppsStartup): Plugin {
  return {
    install(app) {
      app.provide(OcharoAppsKey, startup.addresses);
    },
  };
}

/** The app menu's destinations: the startup resolution, or the build-time values and defaults where none is provided. */
export function useOcharoApps(): OcharoApp[] {
  return ocharoApps(
    inject(
      OcharoAppsKey,
      () => resolveAddresses([buildTimeConfigSource()]).addresses,
      true,
    ),
  );
}
