import {
  computed,
  onScopeDispose,
  shallowRef,
  watch,
  type ShallowRef,
} from "vue";
import { createStudioState, type StudioState } from "./state";
import { createDesignDocument } from "../../domain/studio/document";
import { createLocalJsonStorage } from "../../integration/studio/storage";
import {
  studioCacheKey,
  type StudioRepository,
  type StudioRecovery,
} from "../../integration/studio/repository";
import {
  createServerRepository,
  StudioSyncQueue,
  type PersistenceStatus,
  type StudioSnapshot,
} from "../../integration/studio/serverRepository";

const CACHE_META = studioCacheKey("ocharo-studio:sync");
const SETTINGS_KEY = studioCacheKey("ocharo-studio:settings");
const storage = createLocalJsonStorage();
export type StudioLibraryStatus = "loading" | "ready" | "unavailable";

interface SyncMetadata {
  revision: number;
  pending: boolean;
}

/** Keeps an immediate recovery cache and promotes server state only after an acknowledged revision. */
export function useStudioPersistence(
  state: ShallowRef<StudioState>,
  repository: StudioRepository,
  recovery?: StudioRecovery,
  recoveryError?: string,
) {
  const persistenceStatus = shallowRef<PersistenceStatus>("loading");
  const settings = shallowRef<Record<string, unknown>>(
    recovery?.settings ??
      storage.read(SETTINGS_KEY) ??
      storage.read("ocharo-studio:settings") ??
      {},
  );
  // Desired browser drafts remain recoverable; the library contains acknowledged reads only.
  const confirmedLooks = shallowRef(recovery?.pending ? [] : state.value.looks);
  const looksStatus = shallowRef<StudioLibraryStatus>("loading");
  const refreshingLooks = shallowRef(false);
  let readLooks: (() => Promise<void>) | undefined;
  let projectionRead = 0;
  const ready = shallowRef(false);
  const attempt = shallowRef(0);
  let queue: StudioSyncQueue | null = null;
  const legacyMetadata = storage.read<SyncMetadata>(CACHE_META);
  let boundWorkspace = recovery?.workspaceId;
  let incomingWorkspace: string | undefined;
  let workspaceChanged = false;
  let revision = recovery?.revision ?? legacyMetadata?.revision ?? 0;
  let pending = recovery?.pending ?? legacyMetadata?.pending ?? false;
  let hydrated: StudioSnapshot | null = null;
  let remote: StudioSnapshot | null = null;
  let cacheError = false;
  let applyingServer = false;
  let cacheBlocked = Boolean(recoveryError);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Separate projections keep selection, history and notices out of persistence dependencies.
  const document = computed(() => state.value.document);
  const looks = computed(() => state.value.looks);
  const materials = computed(() => state.value.materials);
  const snapshot = computed<StudioSnapshot>(() => ({
    revision,
    draft: document.value,
    looks: looks.value,
    materials: materials.value,
    settings: settings.value,
  }));
  let initial = snapshot.value;

  // Recovery writes happen before the next UI tick, including every valid rename keystroke.
  watch(
    snapshot,
    (current, previous) => {
      // Loading edits must survive disposal before the server read or debounce can finish.
      if (previous && !applyingServer) pending = true;
      writeCache(current, pending);
    },
    { immediate: true, flush: "sync" },
  );

  watch(
    attempt,
    (_attempt, _previous, onCleanup) => {
      let active = true;
      const abort = new AbortController();
      const server = createServerRepository();
      const metadata = { revision, pending };
      updateStatus("loading");
      ready.value = false;
      looksStatus.value = "loading";
      let readAbort: AbortController | undefined;
      readLooks = () => refreshLibrary();
      queue?.stop();
      queue = null;
      onCleanup(() => {
        active = false;
        abort.abort();
        projectionRead += 1;
        refreshingLooks.value = false;
        readLooks = undefined;
        queue?.stop();
      });
      async function refreshLibrary(minimumRevision = revision): Promise<void> {
        const request = ++projectionRead;
        readAbort?.abort();
        readAbort = new AbortController();
        refreshingLooks.value = true;
        if (looksStatus.value !== "ready") looksStatus.value = "loading";
        try {
          const current = await server.read(
            AbortSignal.any([
              abort.signal,
              readAbort.signal,
              AbortSignal.timeout(15000),
            ]),
          );
          if (!active || request !== projectionRead) return;
          if (boundWorkspace && server.workspaceId !== boundWorkspace)
            throw new Error("The saved library belongs to another workspace.");
          if (current.revision < Math.max(minimumRevision, revision))
            throw new Error("The saved library is not current.");
          confirmedLooks.value = current.looks;
          looksStatus.value = "ready";
          if (state.value.notice === "Saving look…")
            state.value = {
              ...state.value,
              notice: "Look saved to the studio.",
            };
        } catch {
          if (!active || request !== projectionRead) return;
          if (looksStatus.value !== "ready") looksStatus.value = "unavailable";
          state.value = {
            ...state.value,
            notice:
              "The saved look library could not refresh. Your browser recovery is preserved; refresh My looks when ready.",
          };
        } finally {
          if (active && request === projectionRead)
            refreshingLooks.value = false;
        }
      }

      void server
        .read(AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]))
        .then((result) => {
          if (!active) return;
          remote = result;
          incomingWorkspace = server.workspaceId;
          workspaceChanged = Boolean(
            boundWorkspace &&
            incomingWorkspace &&
            boundWorkspace !== incomingWorkspace,
          );
          cacheBlocked = false;
          if (workspaceChanged) {
            looksStatus.value = "unavailable";
            updateStatus("conflict");
            state.value = {
              ...state.value,
              notice:
                "This recovery belongs to another Desk workspace. Download it before loading this workspace's saved designs.",
            };
            return;
          }
          boundWorkspace = incomingWorkspace ?? boundWorkspace;
          confirmedLooks.value = result.looks;
          looksStatus.value = "ready";
          const editedDuringLoad = snapshot.value !== initial;
          const hasPending = metadata?.pending === true || editedDuringLoad;
          if (
            result.revision > 0 &&
            hasPending &&
            metadata?.revision !== result.revision
          ) {
            updateStatus("conflict");
            state.value = {
              ...state.value,
              notice:
                "Another tab has newer saved work. Export your recovery copy or load the server version in Settings.",
            };
            return;
          }
          revision = result.revision;
          const useLocal = result.revision === 0 || hasPending;
          const selected = useLocal
            ? { ...snapshot.value, revision: result.revision }
            : result;
          if (!useLocal) {
            hydrated = selected;
            applyingServer = true;
            try {
              state.value = createStudioState(
                selected.draft ?? state.value.document,
                selected.looks,
                selected.materials ?? {},
              );
              settings.value = selected.settings;
              hydrated = snapshot.value;
            } finally {
              applyingServer = false;
            }
          }
          queue = new StudioSyncQueue(
            server,
            result.revision,
            (status, error, acknowledged, payload) => {
              if (!active) return;
              const caughtUp =
                !payload ||
                JSON.stringify({ ...payload, revision: 0 }) ===
                  JSON.stringify({ ...snapshot.value, revision: 0 });
              updateStatus(
                status === "synced" && !caughtUp ? "saving" : status,
              );
              if (acknowledged !== undefined) {
                revision = acknowledged;
                writeCache(snapshot.value, !caughtUp);
              }
              if (status === "conflict")
                storage.write(
                  studioCacheKey("ocharo-studio:conflict-recovery"),
                  snapshot.value,
                );
              if (error)
                state.value = {
                  ...state.value,
                  notice:
                    "Studio changes could not sync. Your browser recovery is preserved; retry from Settings." +
                    (cacheError
                      ? " Browser recovery storage also failed; export your design now."
                      : ""),
                };
              if (
                status === "synced" &&
                caughtUp &&
                acknowledged !== undefined
              ) {
                void refreshLibrary(acknowledged);
              }
            },
          );
          ready.value = true;
          if (useLocal) {
            writeCache(snapshot.value, true);
            queue.push(selected);
          } else {
            writeCache(snapshot.value, false);
            updateStatus("synced");
          }
        })
        .catch(() => {
          if (!active) return;
          updateStatus("offline");
          looksStatus.value = "unavailable";
          state.value = {
            ...state.value,
            notice:
              (recoveryError ? `${recoveryError} ` : "") +
              "Studio storage is offline. Changes remain in this browser; retry from Settings." +
              (cacheError
                ? " Browser recovery storage failed; export your design now."
                : ""),
          };
          writeCache(snapshot.value, true);
        });
    },
    { immediate: true },
  );

  watch([ready, snapshot], ([isReady, current], _previous, onCleanup) => {
    if (!isReady) return;
    // Hydration is already acknowledged: reading must not schedule a redundant write.
    if (
      hydrated &&
      JSON.stringify({ ...hydrated, revision: 0 }) ===
        JSON.stringify({ ...current, revision: 0 })
    ) {
      hydrated = null;
      return;
    }
    writeCache(current, true);
    if (
      persistenceStatus.value !== "conflict" &&
      persistenceStatus.value !== "offline"
    )
      updateStatus("saving");
    debounceTimer = setTimeout(() => queue?.push(current), 350);
    onCleanup(() => clearTimeout(debounceTimer));
  });

  onScopeDispose(() => {
    clearTimeout(debounceTimer);
    queue?.stop();
  });

  function updateStatus(status: PersistenceStatus): void {
    persistenceStatus.value = status;
  }

  function writeCache(current: StudioSnapshot, isPending: boolean): void {
    pending = isPending;
    // One storage entry commits library, projected documents and sync metadata together.
    // Legacy keys remain readable for migration, but cannot form a partially updated recovery.
    cacheError =
      cacheBlocked ||
      !repository.writeRecovery({
        ...current,
        ...(boundWorkspace ? { workspaceId: boundWorkspace } : {}),
        materials: current.materials ?? {},
        revision,
        pending,
      });
    if (!cacheError) storage.write(CACHE_META, { revision, pending });
  }

  function retrySync(): void {
    if (persistenceStatus.value === "conflict") return;
    if (queue) {
      queue.push(snapshot.value);
      queue.retry();
    } else {
      initial = snapshot.value;
      attempt.value += 1;
    }
  }

  function resolveConflict(): void {
    // A failed recovery write must not discard the local version.
    if (
      !storage.write(
        studioCacheKey("ocharo-studio:conflict-recovery"),
        snapshot.value,
      )
    ) {
      state.value = {
        ...state.value,
        notice:
          "Recovery could not be stored. Export your design before reloading the page.",
      };
      return;
    }
    revision = remote?.revision ?? revision;
    if (workspaceChanged && remote) {
      boundWorkspace = incomingWorkspace;
      applyingServer = true;
      try {
        state.value = createStudioState(
          remote.draft ?? createDesignDocument(),
          remote.looks,
          remote.materials ?? {},
        );
        settings.value = remote.settings;
      } finally {
        applyingServer = false;
      }
      workspaceChanged = false;
    }
    writeCache(snapshot.value, false);
    initial = snapshot.value;
    attempt.value += 1;
  }

  function updateSettings(update: Record<string, unknown>): void {
    settings.value = { ...settings.value, ...update };
  }

  function reconnect(): void {
    queue?.stop();
    queue = null;
    initial = snapshot.value;
    attempt.value += 1;
  }

  return {
    reconnect,
    refreshLooks: () => readLooks?.() ?? Promise.resolve(),
    exportRecovery: () =>
      JSON.stringify(
        {
          schemaVersion: 1,
          ...snapshot.value,
          ...(boundWorkspace ? { workspaceId: boundWorkspace } : {}),
          materials: snapshot.value.materials ?? {},
          revision,
          pending,
        },
        null,
        2,
      ),
    get looksStatus() {
      return looksStatus.value;
    },
    get looks() {
      return confirmedLooks.value;
    },
    get refreshingLooks() {
      return refreshingLooks.value;
    },
    get revision() {
      return revision;
    },
    get persistenceStatus() {
      return persistenceStatus.value;
    },
    get settings() {
      return settings.value;
    },
    updateSettings,
    retrySync,
    resolveConflict,
  };
}
