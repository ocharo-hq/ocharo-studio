<script setup lang="ts">
import { RouterLink } from "vue-router";
import { House } from "lucide-vue-next";

/** The way back to the Studio introduction, at the foot of the sidebar and the navigation drawer. */
defineOptions({ name: "StudioHomeLink" });
const props = defineProps<{ collapsed: boolean }>();
const linkClass =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
</script>

<template>
  <div class="px-2 pb-2">
    <RouterLink
      to="/"
      :class="[linkClass, { 'justify-center': props.collapsed }]"
      aria-label="Ocharo Studio home"
      :title="props.collapsed ? 'Studio home' : undefined"
    >
      <House :size="17" aria-hidden="true" />
      <span v-if="!props.collapsed">Studio home</span>
    </RouterLink>
  </div>
</template>
