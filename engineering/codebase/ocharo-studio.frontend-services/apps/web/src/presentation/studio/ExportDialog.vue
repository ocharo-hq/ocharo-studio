<script setup lang="ts">
import { ArrowUpFromLine, Image, Layers3, Sparkles } from "@lucide/vue";
import StudioDialog from "./StudioDialog.vue";

/** Preview-image and portable-document export choices. */
defineOptions({ name: "ExportDialog" });
defineProps<{
  ready: boolean;
  onPreview: () => void;
  onRender: () => void;
  onDocument: () => void;
  onReview?: () => void;
  onClose: () => void;
}>();
</script>
<template>
  <StudioDialog title="Take your idea with you." :on-close="onClose"
    ><p>Keep a picture, or keep every design decision.</p>
    <button class="export-choice" :disabled="!ready" @click="onPreview">
      <Image :size="25" /><span
        ><strong>Preview image</strong
        ><small>A clean PNG of your current view</small></span
      ><ArrowUpFromLine :size="18" /></button
    ><button class="export-choice" :disabled="!ready" @click="onRender">
      <Sparkles :size="25" /><span
        ><strong>Studio render</strong
        ><small>A print-size image on the silhouette or the model</small></span
      ><ArrowUpFromLine :size="18" /></button
    ><button class="export-choice" @click="onDocument">
      <Layers3 :size="25" /><span
        ><strong>Editable design</strong
        ><small>A portable JSON file to reopen here</small></span
      ><ArrowUpFromLine :size="18" /></button
    ><button
      v-if="onReview"
      class="export-choice"
      :disabled="!ready"
      @click="onReview"
    >
      <Layers3 :size="25" /><span
        ><strong>Submit for review</strong
        ><small>PNG and provenance for Ocharo Desk or Marketing</small></span
      ><ArrowUpFromLine :size="18" /></button
    ><small class="muted"
      >Export a design for backup or sharing.</small
    ></StudioDialog
  >
</template>
