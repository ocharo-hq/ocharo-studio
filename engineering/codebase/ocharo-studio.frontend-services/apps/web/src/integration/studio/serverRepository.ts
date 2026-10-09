import { getSsoSession, ssoUnavailable } from "./SsoAccess";
import {
  getIntegrationTicket,
  loadStudioSession,
  type StudioSession,
} from "./access";
import { LatestRevisionQueue } from "@wow-two-beta/ui-vue/foundation/sync";
import { migrateDocument } from "../../domain/studio/document";
import { migrateMaterialScales } from "../../domain/studio/materials";
import type {
  DesignDocument,
  MaterialScaleLibrary,
  SavedLook,
} from "../../domain/studio/types";
import { migrateLooks } from "./repository";
import { createLocalJsonStorage } from "./storage";

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
  readTicket: () => string | null = getIntegrationTicket,
): ServerRepository {
  let session: StudioSession | undefined;
  let connectedTicket: string | undefined;
  async function request(
    method: "GET" | "PUT",
    snapshot?: StudioSnapshot,
    signal?: AbortSignal,
  ): Promise<StudioSnapshot> {
    if (snapshot && !migrateMaterialScales(snapshot.materials))
      throw new Error("Invalid material scale library.");
    const sso = getSsoSession();
    if (ssoUnavailable())
      throw new Error(
        "The account session could not be checked. Refresh to reconnect.",
      );
    const ticket = sso.enabled ? null : readTicket();
    if (sso.enabled && !sso.authenticated)
      throw new Error("Sign in through Ocharo Desk to sync this workspace.");
    if (!sso.enabled && !ticket)
      throw new Error(
        "Browser-only mode. Connect from Ocharo Desk to save to your workspace.",
      );
    const connectionKey = sso.enabled ? "cookie" : ticket!;
    if (!session || connectedTicket !== connectionKey) {
      session = await loadStudioSession(fetcher, ticket, signal);
      connectedTicket = connectionKey;
    }
    signal?.throwIfAborted();
    if (method === "PUT" && !session.canEdit)
      throw new Error(
        "Your Desk membership allows viewing only. Local edits remain in this browser.",
      );
    const response = await fetcher("/api/studio/state", {
      method,
      credentials: sso.enabled ? "same-origin" : "omit",
      headers: {
        "Content-Type": "application/json",
        "X-Studio-Workspace": session.workspaceId,
        ...(sso.enabled
          ? method === "PUT"
            ? { "X-CSRF-Token": sso.csrfToken! }
            : {}
          : { Authorization: `Bearer ${ticket}` }),
      },
      ...(snapshot ? { body: JSON.stringify(snapshot) } : {}),
      signal: signal ?? AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) {
      session = undefined;
      throw new Error(
        "Your Desk connection expired or access changed. Reconnect; your browser recovery is preserved.",
      );
    }
    if (response.status === 409) throw new StudioConflict();
    if (response.status === 400 || response.status === 422)
      throw new Error(
        "Review your design settings. Your browser keeps a recovery copy.",
      );
    if (!response.ok)
      throw new Error(
        "Studio storage is unavailable. Your browser keeps a recovery copy.",
      );
    const value: unknown = await response.json();
    if (!value || typeof value !== "object")
      throw new Error("Invalid studio storage response.");
    const raw = value as Record<string, unknown>;
    const draft = raw.draft === null ? null : migrateDocument(raw.draft);
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
