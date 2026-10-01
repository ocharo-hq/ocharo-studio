<script setup lang="ts">
import { useBuildIdentity } from "../../application/common/UseBuildIdentity";
import "./BuildIdentity.css";

/** Displays the compiled app and independently reported backend build. */
defineOptions({ name: "BuildIdentity" });
const appVersion = __APP_VERSION__;
const { backendVersion, refresh } = useBuildIdentity();
function open(event: Event): void {
  if ((event.target as HTMLDetailsElement).open) void refresh();
}
</script>

<template>
  <details class="build-identity" @toggle="open">
    <summary :aria-label="`About this app: ${appVersion}`">
      {{ appVersion }}
    </summary>
    <dl>
      <dt>App</dt>
      <dd>{{ appVersion }}</dd>
      <dt>Backend</dt>
      <dd>{{ backendVersion }}</dd>
    </dl>
  </details>
</template>
