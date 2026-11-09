import {
  ApiFailureFactory,
  createApiClient,
  type ApiFailure,
} from "@wow-two-beta/fe/foundation/http";
import {
  ResultExtensions,
  type Result,
} from "@wow-two-beta/fe/foundation/results";

/** How long the About view waits for the API's status. */
export const BuildIdentityTimeoutMs = 5_000;

/**
 * @internal The shared SDK transport. The public status never carries a session or access ticket, and it bypasses
 * the HTTP cache so a deploy shows its own version at once.
 */
const client = createApiClient({
  credentials: "omit",
  retry: false,
  fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
});

/** @internal Reads the informational version from the status body. */
function decodeVersion(value: unknown): Result<string, ApiFailure> {
  return typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "string"
    ? ResultExtensions.ok(value.version)
    : ResultExtensions.fail(ApiFailureFactory.create("protocol"));
}

/** Provides the API's build identity. */
export const buildIdentityApi = {
  /** Reads GET /api/system/status with cancellation and a bounded request lifetime; resolves the API's version. */
  getVersion(signal: AbortSignal): Promise<Result<string, ApiFailure>> {
    return client.get("/api/system/status", {
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(BuildIdentityTimeoutMs),
      ]),
      unwrap: false,
      decode: decodeVersion,
    });
  },
};
