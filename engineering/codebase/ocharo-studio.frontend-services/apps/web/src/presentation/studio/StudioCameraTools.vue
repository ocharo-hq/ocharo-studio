<script setup lang="ts">
import { Maximize, Minus, Plus, Scan } from "lucide-vue-next";
import { Button } from "@wow-two-beta/fe/presentation/actions";

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
    <Button
      class="icon-button"
      variant="ghost"
      shape="square"
      aria-label="Zoom out"
      title="Zoom out"
      @click="scene?.zoom(-0.3)"
    >
      <Minus :size="18" />
    </Button>
    <Button
      class="icon-button"
      variant="ghost"
      shape="square"
      aria-label="Zoom in"
      title="Zoom in"
      @click="scene?.zoom(0.3)"
    >
      <Plus :size="18" />
    </Button>
    <Button
      class="icon-button"
      variant="ghost"
      shape="square"
      aria-label="Fit garment"
      title="Fit garment"
      @click="scene?.reset()"
    >
      <Maximize :size="18" />
    </Button>
    <Button
      class="icon-button"
      variant="ghost"
      shape="square"
      aria-label="Inspect fabric detail"
      title="Inspect fabric detail"
      @click="scene?.view('detail')"
    >
      <Scan :size="18" />
    </Button>
  </div>
</template>
