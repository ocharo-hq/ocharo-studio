<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowLeftRight,
  Check,
  Layers3,
  LocateFixed,
  MoveHorizontal,
  MoveVertical,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
} from "@lucide/vue";
import { PointControl } from "@wow-two-beta/ui-vue/presentation/forms/point-control";
import type {
  GarmentDefinition,
  MaterialDefinition,
  PartId,
  TexturePlacement,
} from "../../domain/studio/types";
import IconButton from "./IconButton.vue";
import RangeControl from "./RangeControl.vue";

/** Per-part material and pattern placement controls. */
defineOptions({ name: "StudioInspector" });

const props = defineProps<{
  garment: GarmentDefinition;
  partId: PartId;
  selectedPartIds: readonly PartId[];
  mixedMaterial?: boolean;
  mixedPlacement?: readonly (keyof TexturePlacement)[];
  hasPattern?: boolean;
  material: MaterialDefinition;
  placement: TexturePlacement;
  placementMode: boolean;
  onPlacementMode: (active: boolean) => void;
  onPart: (part: PartId, additive?: boolean) => void;
  onChooseMaterial: () => void;
  onEditMaterial: () => void;
  onPlacement: (update: Partial<TexturePlacement>) => void;
  onBegin: () => void;
  onEnd: () => void;
  onReset: () => void;
}>();
const part = computed(
  () =>
    props.garment.parts.find((item) => item.id === props.partId) ??
    props.garment.parts[0]!,
);
const materialAnchor = computed(() => ({
  x: props.placement.materialAnchorX,
  y: props.placement.materialAnchorY,
}));
const multiple = computed(() => props.selectedPartIds.length > 1);
function numberValue(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
function placeMaterialAnchor(point: { x: number; y: number }) {
  props.onPlacement({ materialAnchorX: point.x, materialAnchorY: point.y });
}
</script>

<template>
  <aside
    class="inspector island studio-sheet"
    aria-label="Part and textile settings"
  >
    <header class="inspector-header">
      <div class="inspector-heading">
        <Layers3 :size="18" aria-hidden="true" />
      </div>
      <h2>
        {{ multiple ? `${selectedPartIds.length} parts selected` : part.name }}
      </h2>
    </header>
    <div class="inspector-content">
      <div class="part-chips">
        <button
          v-for="item in garment.parts"
          :key="item.id"
          :class="{ active: selectedPartIds.includes(item.id) }"
          :aria-pressed="selectedPartIds.includes(item.id)"
          @click="
            onPart(item.id, $event.shiftKey || $event.metaKey || $event.ctrlKey)
          "
        >
          {{ item.name }}
        </button>
      </div>
      <div class="panel-divider" />
      <div class="label-row">
        <h3>Material</h3>
        <button
          class="text-button"
          data-tour="change-material"
          @click="onChooseMaterial"
        >
          Change <ArrowLeftRight :size="12" />
        </button>
      </div>
      <button class="current-material" @click="onChooseMaterial">
        <span
          :style="{
            backgroundColor: material.color,
            backgroundImage: material.textureUrl
              ? `url(${material.textureUrl})`
              : undefined,
          }"
        />
        <div>
          <strong>{{
            mixedMaterial ? "Mixed materials" : material.name
          }}</strong
          ><small>{{
            multiple
              ? "Applies to all selected parts"
              : material.textureUrl
                ? "Patterned textile"
                : "Solid fabric"
          }}</small>
        </div>
      </button>
      <button
        class="material-studio-entry"
        data-tour="scale"
        :disabled="mixedMaterial"
        @click="onEditMaterial"
      >
        <SlidersHorizontal :size="15" />{{
          mixedMaterial ? "Select one material to edit" : "Edit material"
        }}
      </button>
      <div class="panel-divider" />
      <div class="label-row">
        <h3>Pattern placement</h3>
        <IconButton
          :icon="RotateCcw"
          label="Reset pattern placement"
          :on-click="onReset"
          :disabled="!hasPattern"
        />
      </div>
      <template v-if="hasPattern">
        <p v-if="multiple" class="selection-hint">
          Movement applies to every selected part. Select one part to rotate or
          place anchors.
        </p>
        <div
          v-if="!multiple"
          class="placement-toggle"
          role="group"
          aria-label="Placement point"
          data-tour="anchors"
        >
          <button
            :class="{ active: !placementMode }"
            :aria-pressed="!placementMode"
            @click="onPlacementMode(false)"
          >
            On textile</button
          ><button
            :class="{ active: placementMode }"
            :aria-pressed="placementMode"
            @click="onPlacementMode(true)"
          >
            On garment
          </button>
        </div>
        <PointControl
          v-if="!multiple"
          :ariaLabel="'Textile pattern anchor'"
          class="anchor-pad"
          :background-image="material.textureUrl"
          :model-value="materialAnchor"
          @interaction-start="onBegin"
          @interaction-end="onEnd"
          @update:model-value="placeMaterialAnchor"
        />
        <div v-if="placementMode && !multiple" class="garment-anchor-message">
          <LocateFixed :size="18" /><span
            >Click or drag the orb on the garment to choose where the pattern
            lands.</span
          >
          <div class="garment-anchor-fields">
            <label
              >X<input
                aria-label="Garment anchor horizontal"
                type="number"
                min="0"
                max="1"
                step="0.01"
                :value="placement.garmentAnchorX"
                @input="
                  onPlacement({ garmentAnchorX: numberValue($event) })
                " /></label
            ><label
              >Y<input
                aria-label="Garment anchor vertical"
                type="number"
                min="0"
                max="1"
                step="0.01"
                :value="placement.garmentAnchorY"
                @input="onPlacement({ garmentAnchorY: numberValue($event) })"
            /></label>
          </div>
        </div>
        <RangeControl
          v-if="!multiple"
          label="Rotation"
          :icon="RotateCw"
          :value="placement.rotation"
          :min="-180"
          :max="180"
          :step="1"
          suffix="°"
          :on-begin="onBegin"
          :on-end="onEnd"
          :on-change="(rotation) => onPlacement({ rotation })"
        />
        <RangeControl
          label="Horizontal"
          :icon="MoveHorizontal"
          :value="placement.offsetX"
          :min="-1"
          :max="1"
          :step="0.01"
          suffix=""
          :mixed="mixedPlacement?.includes('offsetX')"
          :on-begin="onBegin"
          :on-end="onEnd"
          :on-change="(offsetX) => onPlacement({ offsetX })"
        />
        <RangeControl
          label="Vertical"
          :icon="MoveVertical"
          :value="placement.offsetY"
          :min="-1"
          :max="1"
          :step="0.01"
          suffix=""
          :mixed="mixedPlacement?.includes('offsetY')"
          :on-begin="onBegin"
          :on-end="onEnd"
          :on-change="(offsetY) => onPlacement({ offsetY })"
        />
        <div v-if="!multiple" class="rotation-presets">
          <button
            v-for="rotation in [-90, 0, 90]"
            :key="rotation"
            @click="onPlacement({ rotation })"
          >
            {{ rotation }}°
          </button>
        </div>
      </template>
      <p v-else class="solid-hint">
        Choose a patterned textile to place its design.
      </p>
      <div class="attachment-note">
        <span><Check :size="14" /></span>
        <div>
          <strong>{{ garment.attachments }}</strong
          ><small>Details belong to this silhouette.</small>
        </div>
      </div>
    </div>
  </aside>
</template>
