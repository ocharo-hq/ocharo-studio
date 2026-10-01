<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Sparkles } from "@lucide/vue";
import StudioDialog from "./StudioDialog.vue";
import {
  RENDER_SIZES,
  useFinalRender,
  type RenderBackdrop,
  type RenderHolder,
  type RenderSize,
  type RenderView,
} from "../../application/studio/UseFinalRender";
import type { DesignDocument } from "../../domain/studio/types";

/** Renders the current look offscreen at print size on the silhouette or the model. */
defineOptions({ name: "RenderDialog" });
const props = defineProps<{
  document: DesignDocument;
  fileName: string;
  onClose: () => void;
}>();

const holders: readonly [RenderHolder, string][] = [
  ["silhouette", "Silhouette"],
  ["model", "Model"],
];
const views: readonly [RenderView, string][] = [
  ["front", "Front"],
  ["three-quarter", "Three-quarter"],
  ["side", "Side"],
  ["back", "Back"],
];
const backdrops: readonly [RenderBackdrop, string][] = [
  ["studio", "Studio"],
  ["linen", "Linen"],
  ["charcoal", "Charcoal"],
  ["transparent", "Transparent"],
];
const sizes: readonly [RenderSize, string][] = [
  ["standard", "1600 × 2000"],
  ["large", "2400 × 3000"],
];

const holder = ref<RenderHolder>("silhouette");
const view = ref<RenderView>("front");
const backdrop = ref<RenderBackdrop>("studio");
const size = ref<RenderSize>("standard");
const renderer = useFinalRender();
const rendering = computed(() => renderer.status.value === "rendering");

function start(): void {
  const [width, height] = RENDER_SIZES[size.value];
  void renderer.render(props.document, {
    holder: holder.value,
    view: view.value,
    backdrop: backdrop.value,
    width,
    height,
  });
}

function download(): void {
  renderer.download(`${props.fileName}-${holder.value}-${view.value}.png`);
}
</script>

<template>
  <StudioDialog title="Studio render" :on-close="onClose"
    ><p>A print-size image of this look, lit like a studio photograph.</p>
    <div class="render-options">
      <div class="render-group" role="group" aria-label="Render on">
        <span>On</span>
        <button
          v-for="[value, label] in holders"
          :key="value"
          :aria-pressed="holder === value"
          :disabled="rendering"
          @click="holder = value"
        >
          {{ label }}
        </button>
      </div>
      <div class="render-group" role="group" aria-label="Render view">
        <span>View</span>
        <button
          v-for="[value, label] in views"
          :key="value"
          :aria-pressed="view === value"
          :disabled="rendering"
          @click="view = value"
        >
          {{ label }}
        </button>
      </div>
      <div class="render-group" role="group" aria-label="Render backdrop">
        <span>Backdrop</span>
        <button
          v-for="[value, label] in backdrops"
          :key="value"
          :aria-pressed="backdrop === value"
          :disabled="rendering"
          @click="backdrop = value"
        >
          {{ label }}
        </button>
      </div>
      <div class="render-group" role="group" aria-label="Render size">
        <span>Size</span>
        <button
          v-for="[value, label] in sizes"
          :key="value"
          :aria-pressed="size === value"
          :disabled="rendering"
          @click="size = value"
        >
          {{ label }}
        </button>
      </div>
    </div>
    <figure
      v-if="renderer.imageUrl.value"
      class="render-preview"
      :data-backdrop="backdrop"
    >
      <img :src="renderer.imageUrl.value" alt="Studio render of this look" />
    </figure>
    <p v-if="renderer.error.value" class="render-error" role="alert">
      {{ renderer.error.value }}
    </p>
    <div class="render-actions">
      <button class="button secondary" :disabled="rendering" @click="start">
        <Sparkles :size="16" />{{
          rendering
            ? "Rendering…"
            : renderer.imageUrl.value
              ? "Render again"
              : "Render"
        }}
      </button>
      <button
        class="button primary"
        :disabled="rendering || !renderer.imageUrl.value"
        @click="download"
      >
        <Download :size="16" />Download PNG
      </button>
    </div>
    <small class="muted" aria-live="polite">{{
      rendering
        ? "Rendering on this device; large sizes take a little longer."
        : "The model is a stylised stand-in until the high-definition model arrives."
    }}</small></StudioDialog
  >
</template>
