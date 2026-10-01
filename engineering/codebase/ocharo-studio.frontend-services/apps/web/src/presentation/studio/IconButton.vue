<script setup lang="ts">
import type { Component } from "vue";

/** Accessible icon-only studio action. */
defineOptions({ name: "IconButton" });

withDefaults(
  defineProps<{
    icon: Component;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    pressed?: boolean;
  }>(),
  { disabled: false, pressed: undefined },
);
</script>

<template>
  <button
    type="button"
    class="icon-button"
    :title="label"
    :aria-label="label"
    :aria-pressed="pressed"
    :disabled="disabled"
    @click="onClick"
  >
    <component :is="icon" :size="18" :stroke-width="1.7" />
  </button>
</template>
