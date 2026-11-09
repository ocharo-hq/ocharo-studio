import { getIdentitySession, identityUnavailable } from "./IdentityAccess";
import {
  handleUnauthorized,
  loadStudioSession,
  type StudioSession,
} from "./StudioAuth";
import { LatestRevisionQueue } from "@wow-two-beta/fe/foundation/sync";
import {
  type DesignDocument,
  type MaterialScaleLibrary,
  migrateDocument,
  migrateMaterialScales,
  type SavedLook,
} from "../../../domain/studio";
import { migrateLooks } from "./StudioRepository";
import { createLocalJsonStorage } from "./JsonStorage";
import { createStudioApi, throwIfInterrupted } from "../endpoints/StudioApi";

export interface StudioSnapshot {
  revision: number;
  draft: DesignDocument | null;
  looks: readonly SavedLook[];
  settings: Record<string, unknown>;
  materials?: MaterialScaleLibrary;
}
export type PersistenceStatus =
  "loading" | "saving" | "synced" | "offline" | "conflict";
export class StudioConflict extends Error {
  constructor() {
    super(
      "Another tab saved a newer version. Your local changes are preserved.",
    );
  }
}
export interface ServerRepository {
  readonly workspaceId?: string;
  read(signal?: AbortSignal): Promise<StudioSnapshot>;
  write(
    snapshot: StudioSnapshot,
    signal?: AbortSignal,
  ): Promise<StudioSnapshot>;
}

const storage = createLocalJsonStorage();
let sessionWorkspace: string | undefined;
export function getWorkspaceId(): string {
  const stored = storage.read<string>("ocharo-studio:workspace");
  if (
    typeof stored === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      stored,
    )
  )
    return stored;
  sessionWorkspace ??= crypto.randomUUID();
  storage.write("ocharo-studio:workspace", sessionWorkspace);
  return sessionWorkspace;
}

export function createServerRepository(
  fetcher: typeof fetch = fetch,
): ServerRepository {
  let session: StudioSession | undefined;
  const api = createStudioApi(fetcher);
  async function request(
    method: "GET" | "PUT",
    snapshot?: StudioSnapshot,
    signal?: AbortSignal,
  ): Promise<StudioSnapshot> {
    if (snapshot && !migrateMaterialScales(snapshot.materials))
      throw new Error("Invalid material scale library.");
    const identity = getIdentitySession();
    if (identityUnavailable())
      throw new Error(
        "The account session could not be checked. Refresh to reconnect.",
      );
    if (!identity.authenticated)
      throw new Error("Browser-only mode. Sign in to save to your workspace.");
    session ??= await loadStudioSession(fetcher, signal);
    signal?.throwIfAborted();
    if (method === "PUT" && !session.canEdit)
      throw new Error(
        "Your Ocharo membership allows viewing only. Local edits remain in this browser.",
      );
    const scope = {
      workspaceId: session.workspaceId,
      signal: signal ?? AbortSignal.timeout(15000),
    };
    const result =
      method === "PUT"
        ? await api.writeState(snapshot, {
            ...scope,
            csrfToken: identity.csrfToken,
          })
        : await api.readState(scope);
    if (!result.ok) {
      const { failure } = result;
      throwIfInterrupted(failure, scope.signal);
      if (failure.status === 401) {
        session = undefined;
        throw handleUnauthorized();
      }
      if (failure.status === 403) {
        session = undefined;
        throw new Error(
          "Your Ocharo access changed. Sign in again; your browser recovery is preserved.",
        );
      }
      if (failure.status === 409) throw new StudioConflict();
      if (failure.status === 400 || failure.status === 422)
        throw new Error(
          "Review your design settings. Your browser keeps a recovery copy.",
        );
      if (failure.code === "protocol")
        throw new Error("Invalid studio storage response.");
      throw new Error(
        "Studio storage is unavailable. Your browser keeps a recovery copy.",
      );
    }
    const raw = result.value;
    // The backend drops null properties, so a workspace with no open design omits `draft`.
    const draft = raw.draft == null ? null : migrateDocument(raw.draft);
    const looks = migrateLooks(raw.looks);
    const materials = migrateMaterialScales(raw.materials);
    if (
      !Number.isSafeInteger(raw.revision) ||
      (raw.revision as number) < 0 ||
      draft === undefined ||
      !looks ||
      !materials ||
      !raw.settings ||
      typeof raw.settings !== "object" ||
      Array.isArray(raw.settings)
    )
      throw new Error(
        "Incompatible studio storage response. Your local designs remain available.",
      );
    return {
      revision: raw.revision as number,
      draft,
      looks,
      materials,
      settings: raw.settings as Record<string, unknown>,
    };
  }
  return {
    get workspaceId() {
      return session?.workspaceId;
    },
    read: (signal) => request("GET", undefined, signal),
    write: (snapshot, signal) => request("PUT", snapshot, signal),
  };
}

/** Binds the SDK's reusable revision queue to the studio API conflict type. */
export class StudioSyncQueue extends LatestRevisionQueue<StudioSnapshot> {
  constructor(
    repository: ServerRepository,
    revision: number,
    status: (
      status: PersistenceStatus,
      error?: Error,
      revision?: number,
      acknowledged?: StudioSnapshot,
    ) => void,
  ) {
    super({
      initialRevision: revision,
      write: (snapshot, signal) => repository.write(snapshot, signal),
      isConflict: (cause) => cause instanceof StudioConflict,
      onStatus: (value, detail) =>
        status(value, detail?.error, detail?.revision, detail?.acknowledged),
    });
  }
}
