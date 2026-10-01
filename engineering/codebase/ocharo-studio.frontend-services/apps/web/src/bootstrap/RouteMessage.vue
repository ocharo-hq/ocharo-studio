<script setup lang="ts">
/** Renders route recovery and missing-page navigation in the studio palette. */
defineOptions({ name: "RouteMessage" });
withDefaults(defineProps<{ error?: boolean }>(), { error: false });

function retry(): void {
  window.location.reload();
}
</script>

<template>
  <main class="route-message">
    <span class="eyebrow">OCHARO STUDIO</span>
    <h1>
      {{
        error ? "The page could not open." : "This page is not in the atelier."
      }}
    </h1>
    <p>
      {{
        error
          ? "Refresh to try again. Your saved designs remain available."
          : "Return to the introduction or open your design workspace."
      }}
    </p>
    <div>
      <button v-if="error" class="button primary" @click="retry">
        Try again
      </button>
      <a class="button secondary" href="/">Home</a>
      <a class="button primary" href="/studio">Open studio</a>
    </div>
  </main>
</template>
