import {
  ApiFailureFactory,
  createApiClient,
  type ApiFailure,
} from "@wow-two-beta/fe/foundation/http";
import {
  ResultExtensions,
  type Result,
} from "@wow-two-beta/fe/foundation/results";

/** The public settings Studio serves for this environment, as raw text keyed by their config names. */
export type RuntimeConfigValues = Readonly<Record<string, string | undefined>>;

/** How long startup waits for the settings before continuing with the build-time values. */
export const RuntimeConfigTimeoutMs = 3_000;

/** @internal The shared SDK transport; this public endpoint never carries a session. */
const client = createApiClient({ credentials: "omit", retry: false });

/**
 * @internal Accepts a flat JSON object. A value that is not text keeps its JSON form, so the config seam rejects it
 * as malformed instead of skipping to a lower source; `null` counts as absent.
 */
function decodeRuntimeConfig(
  value: unknown,
): Result<RuntimeConfigValues, ApiFailure> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ResultExtensions.fail(ApiFailureFactory.create("protocol"));
  }
  const entries = Object.entries(value).map(
    ([key, raw]): [string, string | undefined] => [
      key,
      raw === null
        ? undefined
        : typeof raw === "string"
          ? raw
          : JSON.stringify(raw),
    ],
  );
  return ResultExtensions.ok(Object.freeze(Object.fromEntries(entries)));
}

/** Provides Studio's public runtime settings. */
export const runtimeConfigApi = {
  /** Reads GET /api/runtime-config with cancellation and a bounded request lifetime. */
  get(signal: AbortSignal): Promise<Result<RuntimeConfigValues, ApiFailure>> {
    return client.get("/api/runtime-config", {
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(RuntimeConfigTimeoutMs),
      ]),
      unwrap: false,
      decode: decodeRuntimeConfig,
    });
  },
};
