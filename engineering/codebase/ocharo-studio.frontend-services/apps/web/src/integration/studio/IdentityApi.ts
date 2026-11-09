import {
  ApiFailureFactory,
  createApiClient,
  type ApiFailure,
} from "@wow-two-beta/fe/foundation/http";
import {
  ResultExtensions,
  type Result,
} from "@wow-two-beta/fe/foundation/results";

/** How long an Identity BFF request may run before it counts as unreachable. */
export const IdentityRequestTimeoutMs = 15_000;

/** The `/api/identity/session` payload as the BFF sends it; `IdentityAccess` keeps only display-safe fields. */
export interface IdentitySessionDto {
  readonly isAuthenticated: boolean;
  readonly csrfToken?: unknown;
  readonly person?: Readonly<Record<string, unknown>>;
}

/** @internal Accepts any session whose authentication flag is a boolean; the caller validates the rest. */
function decodeSession(value: unknown): Result<IdentitySessionDto, ApiFailure> {
  const session = record(value);
  if (!session || typeof session.isAuthenticated !== "boolean")
    return ResultExtensions.fail(ApiFailureFactory.create("protocol"));
  return ResultExtensions.ok({
    isAuthenticated: session.isAuthenticated,
    csrfToken: session.csrfToken,
    person: record(session.person),
  });
}

/** @internal Reads the end-session address when the BFF names one; any other body still ends the session. */
function decodeSignOut(value: unknown): Result<unknown, ApiFailure> {
  return ResultExtensions.ok(record(value)?.endSessionUrl);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * The app backend's Identity BFF routes over the SDK client. The session cookie rides same-origin and every answer
 * bypasses the HTTP cache, because a cached session or sign-out would describe another moment.
 */
export function createIdentityApi(fetcher: typeof fetch = fetch) {
  const client = createApiClient({
    credentials: "same-origin",
    retry: false,
    fetch: (input, init) => fetcher(input, { ...init, cache: "no-store" }),
  });
  return {
    /** Reads GET /api/identity/session: whether someone is signed in, their CSRF token and display identity. */
    readSession(): Promise<Result<IdentitySessionDto, ApiFailure>> {
      return client.get("/api/identity/session", {
        signal: AbortSignal.timeout(IdentityRequestTimeoutMs),
        decode: decodeSession,
      });
    },
    /** Sends POST /api/identity/sign-out with the session's CSRF token; resolves Identity's end-session address. */
    signOut(csrfToken: string): Promise<Result<unknown, ApiFailure>> {
      return client.post("/api/identity/sign-out", {
        signal: AbortSignal.timeout(IdentityRequestTimeoutMs),
        headers: { "X-Csrf-Token": csrfToken },
        decode: decodeSignOut,
      });
    },
  };
}
