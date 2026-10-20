<script setup lang="ts">
import { RouterView } from "vue-router";
import { ColorModeProvider } from "@wow-two-beta/fe/foundation/primitives";
import { AppErrorBoundary, RouteAnnouncer } from "@wow-two-beta/fe/router";
import RouteMessage from "./RouteMessage.vue";
import { ThemeStorageKey } from "./theme";

/**
 * Composes the one colour mode, shared route recovery, initial loading and accessible route announcements around the
 * routed layouts: the Ocharo frame around the editor places, and the landing and missing pages on their own.
 */
defineOptions({ name: "AppRouter" });
</script>

<template>
  <ColorModeProvider :storage-key="ThemeStorageKey">
    <AppErrorBoundary>
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
        <main v-else class="route-message" aria-busy="true">
          <p role="status">Opening Ocharo Studio…</p>
        </main>
      </RouterView>
      <template #fallback><RouteMessage error /></template>
    </AppErrorBoundary>
    <RouteAnnouncer />
  </ColorModeProvider>
</template>
