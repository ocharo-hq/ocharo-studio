<script setup lang="ts">
import { Maximize, Minus, Plus, Scan } from "@lucide/vue";
import IconButton from "./IconButton.vue";

/** Fixed camera views, zoom, framing, and detail inspection actions. */
defineOptions({ name: "StudioCameraTools" });
type SceneApi = {
  view: (view: "front" | "back" | "side" | "detail") => void;
  zoom: (amount: number) => void;
  reset: () => void;
};
defineProps<{ scene: SceneApi | null }>();
</script>

<template>
  <div class="camera-tools island" aria-label="Camera controls">
    <div class="camera-presets">
      <button
        v-for="view in ['front', 'back', 'side'] as const"
        :key="view"
        @click="scene?.view(view)"
      >
        {{ view }}
      </button>
    </div>
    <span class="toolbar-divider" />
    <IconButton
      :icon="Minus"
      label="Zoom out"
      :on-click="() => scene?.zoom(-0.3)"
    />
    <IconButton
      :icon="Plus"
      label="Zoom in"
      :on-click="() => scene?.zoom(0.3)"
    />
    <IconButton
      :icon="Maximize"
      label="Fit garment"
      :on-click="() => scene?.reset()"
    />
    <IconButton
      :icon="Scan"
      label="Inspect fabric detail"
      :on-click="() => scene?.view('detail')"
    />
  </div>
</template>
