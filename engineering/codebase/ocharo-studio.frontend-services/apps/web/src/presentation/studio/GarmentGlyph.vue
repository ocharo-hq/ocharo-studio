<script setup lang="ts">
import { computed } from "vue";
import type { GarmentId } from "../../domain/studio/types";

/** Lightweight catalogue silhouette used when a rendered preview is unavailable. */
defineOptions({ name: "GarmentGlyph" });

const paths: Record<GarmentId, string> = {
  nimcha: "M24 14 37 9 45 22 53 9 66 14 64 33 66 69 46 76 26 69 28 33Z",
  baska:
    "M28 28Q45 31 62 28L64 39Q67 52 75 62L51 80 47 39 43 39 39 80 15 62Q23 52 26 39Z",
  kostyum:
    "M22 15 36 9 45 20 54 9 68 15 83 47 68 53 61 37 63 66 47 68 45 28 43 68 27 66 29 37 22 53 7 47Z",
  korset: "M24 23Q34 13 45 24Q56 13 66 23L59 46 70 69 46 74 20 69 31 46Z",
  abaya:
    "M26 9 38 7 45 19 52 7 64 9 79 49 66 54 61 35 70 82 47 85 45 29 43 85 20 82 29 35 24 54 11 49Z",
};
const props = withDefaults(
  defineProps<{ id: GarmentId; className?: string }>(),
  { className: "" },
);
const seam = computed(() =>
  props.id === "korset"
    ? "M32 27 36 65M45 27V68M58 27 54 65"
    : props.id === "baska"
      ? "M27 37Q45 41 63 37M32 40Q27 51 24 60M58 40Q63 51 66 60"
      : "M37 10 32 30 45 43 57 30 53 10M45 43V68",
);
const tied = computed(() => ["nimcha", "abaya"].includes(props.id));
</script>

<template>
  <svg :class="className" viewBox="0 0 90 94" fill="none" aria-hidden="true">
    <path
      :d="paths[id]"
      fill="currentColor"
      fill-opacity=".13"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linejoin="round"
    />
    <path
      :d="seam"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-opacity=".65"
    />
    <path
      v-if="tied"
      d="M28 47Q47 52 62 45L67 59M62 45 71 51"
      stroke="currentColor"
      stroke-width="2"
    />
  </svg>
</template>
