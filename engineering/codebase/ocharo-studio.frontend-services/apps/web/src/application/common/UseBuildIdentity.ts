import { onBeforeUnmount, ref } from "vue";
import { readBuildIdentity } from "../../integration/common/BuildIdentityApi";

/** Loads technical About data only on request and cancels when the view closes. */
export function useBuildIdentity() {
  const backendVersion = ref("Not checked");
  const controller = new AbortController();
  let generation = 0;
  onBeforeUnmount(() => controller.abort());
  async function refresh(): Promise<void> {
    const current = ++generation;
    backendVersion.value = "Checking…";
    const version = await readBuildIdentity(controller.signal);
    if (!controller.signal.aborted && current === generation)
      backendVersion.value = version;
  }
  return { backendVersion, refresh };
}
