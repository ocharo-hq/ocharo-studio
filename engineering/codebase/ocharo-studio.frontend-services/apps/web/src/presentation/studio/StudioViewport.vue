<script lang="ts">
import type { DesignDocument, PartId } from "../../domain/studio/types";
import type { StudioViewportApi } from "../../application/studio/UseStudioViewport";

export type { StudioViewportApi } from "../../application/studio/UseStudioViewport";

export interface StudioViewportProps {
  readonly document: DesignDocument;
  readonly selectedPartId: PartId;
  readonly selectedPartIds?: readonly PartId[];
  readonly onSelectPart: (id: PartId, additive?: boolean) => void;
  readonly onReady?: (api: StudioViewportApi) => void;
  readonly dark: boolean;
  readonly placementMode?: boolean;
  readonly onPlaceAnchor?: (x: number, y: number) => void;
  readonly onPlacementStart?: () => void;
  readonly onPlacementEnd?: () => void;
}

/** @internal The loading and recovery overlay styles. */
const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  gap: "0.75rem",
  textAlign: "center",
  background: "color-mix(in srgb, var(--canvas, #f4efe8) 82%, transparent)",
  color: "inherit",
  padding: "2rem",
} as const;
</script>

<script setup lang="ts">
import { useStudioViewport } from "../../application/studio/UseStudioViewport";

/** Renders the interactive garment scene and its loading or recovery state. */
defineOptions({ name: "StudioViewport" });
const props = defineProps<StudioViewportProps>();
const viewport = useStudioViewport(() => props);
const canvasRef = viewport.canvasRef;
</script>

<template>
  <div style="position: relative; width: 100%; height: 100%; min-height: 0">
    <canvas
      ref="canvasRef"
      role="img"
      aria-label="Interactive 3D garment preview"
      style="
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
      "
    />
    <div
      v-if="viewport.loading && !viewport.error"
      role="status"
      :style="overlayStyle"
    >
      Preparing the studio…
    </div>
    <div v-if="viewport.error" role="alert" :style="overlayStyle">
      <span>{{ viewport.error }}</span>
      <button type="button" @click="viewport.retry">Retry</button>
    </div>
  </div>
</template>
