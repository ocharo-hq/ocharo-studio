import {
  ApiFailureFactory,
  createApiClient,
  type ApiFailure,
} from "@wow-two-beta/fe/foundation/http";
import {
  ResultExtensions,
  type Result,
} from "@wow-two-beta/fe/foundation/results";

/** The membership `/api/studio/session` binds the signed-in person to. */
export interface StudioSessionDto {
  workspaceId: string;
  userId: string;
  organizationId: string;
  canEdit: boolean;
}

/**
 * The `/api/studio/state` body before Studio migrates its documents. The backend's JSON contract drops null
 * properties, so an absent `draft` or `materials` reads as `null`; the repository rejects any other incompatible field.
 */
export interface StudioStateDto {
  readonly revision?: unknown;
  /** The open design; absent or `null` when the workspace has none. */
  readonly draft?: unknown;
  readonly looks?: unknown;
  /** The shared material scales; absent on a workspace that saved none. */
  readonly materials?: unknown;
  readonly settings?: unknown;
}

/** The scope and credentials of one `/api/studio/state` request. */
export interface StudioStateRequest {
  /** The workspace the session bound, sent as `X-Studio-Workspace`. */
  readonly workspaceId: string;
  /** The Identity session's CSRF token, sent as `X-Csrf-Token` on writes. */
  readonly csrfToken?: string;
  readonly signal: AbortSignal;
}

/** @internal A UUID in any version, as the backend issues workspace and organization ids. */
const Uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @internal Accepts only a complete Studio membership. */
function decodeSession(value: unknown): Result<StudioSessionDto, ApiFailure> {
  const session = record(value);
  return session &&
    typeof session.workspaceId === "string" &&
    Uuid.test(session.workspaceId) &&
    typeof session.organizationId === "string" &&
    Uuid.test(session.organizationId) &&
    typeof session.userId === "string" &&
    session.userId &&
    typeof session.canEdit === "boolean"
    ? ResultExtensions.ok({
        workspaceId: session.workspaceId,
        userId: session.userId,
        organizationId: session.organizationId,
        canEdit: session.canEdit,
      })
    : ResultExtensions.fail(ApiFailureFactory.create("protocol"));
}

/** @internal Accepts a JSON object; the repository migrates its documents and rejects an incompatible one. */
function decodeState(value: unknown): Result<StudioStateDto, ApiFailure> {
  const state = record(value);
  return state
    ? ResultExtensions.ok(state)
    : ResultExtensions.fail(ApiFailureFactory.create("protocol"));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Studio's own endpoints over the SDK client; the session cookie rides same-origin, never a bearer. */
export function createStudioApi(fetcher: typeof fetch = fetch) {
  const client = createApiClient({
    credentials: "same-origin",
    retry: false,
    fetch: (input, init) => fetcher(input, init),
  });
  return {
    /** Reads GET /api/studio/session: the signed-in person's Ocharo membership. */
    readSession(
      signal?: AbortSignal,
    ): Promise<Result<StudioSessionDto, ApiFailure>> {
      return client.get("/api/studio/session", {
        signal,
        unwrap: false,
        decode: decodeSession,
      });
    },
    /** Reads GET /api/studio/state: the workspace's stored draft, looks, settings and material scales. */
    readState(
      request: StudioStateRequest,
    ): Promise<Result<StudioStateDto, ApiFailure>> {
      return client.get("/api/studio/state", {
        signal: request.signal,
        headers: { "X-Studio-Workspace": request.workspaceId },
        unwrap: false,
        decode: decodeState,
      });
    },
    /** Writes PUT /api/studio/state at the snapshot's revision; a newer stored revision answers 409. */
    writeState(
      snapshot: unknown,
      request: StudioStateRequest,
    ): Promise<Result<StudioStateDto, ApiFailure>> {
      return client.put("/api/studio/state", {
        body: snapshot,
        signal: request.signal,
        headers: {
          "X-Studio-Workspace": request.workspaceId,
          ...(request.csrfToken ? { "X-Csrf-Token": request.csrfToken } : {}),
        },
        unwrap: false,
        decode: decodeState,
      });
    },
  };
}

/** The Studio endpoints one repository uses. */
export type StudioApi = ReturnType<typeof createStudioApi>;

/**
 * Rejects a cancelled or timed-out request with its signal's reason, as a raw `fetch` did, so callers that adapt a
 * `Result` back into a rejection keep treating an abort as an abort; any other failure returns.
 */
export function throwIfInterrupted(
  failure: ApiFailure,
  signal?: AbortSignal,
): void {
  if (failure.code !== "cancelled" && failure.code !== "timeout") return;
  signal?.throwIfAborted();
  throw new DOMException(
    "The request was interrupted.",
    failure.code === "timeout" ? "TimeoutError" : "AbortError",
  );
}
