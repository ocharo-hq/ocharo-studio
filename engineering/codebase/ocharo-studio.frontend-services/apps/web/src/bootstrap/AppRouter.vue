<script setup lang="ts">
import { RouterView } from "vue-router";
import { AppErrorBoundary, RouteAnnouncer } from "@wow-two-beta/fe/router";
import RouteMessage from "./RouteMessage.vue";

/** Composes shared route recovery, initial loading, and accessible route announcements. */
defineOptions({ name: "AppRouter" });
</script>

<template>
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
</template>
