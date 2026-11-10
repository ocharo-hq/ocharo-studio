import { onBeforeUnmount, ref } from "vue";
import { buildIdentityApi } from "../../integration/common/BuildIdentityApi";

/**
 * Loads technical About data only on request and cancels when the view closes. `readRunningVersion` is the same read
 * for the frame's version badge, which keeps its own schedule.
 */
export function useBuildIdentity() {
  const backendVersion = ref("Not checked");
  const controller = new AbortController();
  let generation = 0;
  onBeforeUnmount(() => controller.abort());
  async function refresh(): Promise<void> {
    const current = ++generation;
    backendVersion.value = "Checking…";
    const version = await buildIdentityApi.getVersion(controller.signal);
    if (!controller.signal.aborted && current === generation)
      backendVersion.value = version.ok ? version.value : "Unavailable";
  }
  /** The API's version for the frame's badge; a failed read answers nothing, so the badge keeps its last answer. */
  async function readRunningVersion(): Promise<string | null> {
    const version = await buildIdentityApi.getVersion(controller.signal);
    return version.ok ? version.value : null;
  }
  return { backendVersion, refresh, readRunningVersion };
}
