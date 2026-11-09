<script setup lang="ts">
import type { Component } from "vue";
import { SliderInput } from "@wow-two-beta/fe/presentation/forms";

/**
 * The SDK slider with Studio's label row and one gesture per drag or key run, so a sweep is one undo step. Kept only
 * for what the SDK `SliderInput` lacks: gesture start/end events (as `PointControl` has) and a value readout.
 */
defineOptions({ name: "RangeControl" });

const props = defineProps<{
  label: string;
  icon: Component;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  mixed?: boolean;
  onChange: (value: number) => void;
  onBegin: () => void;
  onEnd: () => void;
}>();

function beginFromKeyboard(event: KeyboardEvent) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    props.onBegin();
}
</script>

<template>
  <label class="range-control">
    <span>
      <component :is="icon" :size="15" />
      {{ label }}
      <output>{{
        mixed ? "Mixed" : `${step < 1 ? value.toFixed(2) : value}${suffix}`
      }}</output>
    </span>
    <SliderInput
      :model-value="value"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="label"
      :aria-valuetext="
        mixed
          ? 'Mixed values; adjusting applies to all selected parts'
          : undefined
      "
      @pointerdown="onBegin"
      @pointerup="onEnd"
      @pointercancel="onEnd"
      @blur="onEnd"
      @keydown="beginFromKeyboard"
      @keyup="onEnd"
      @update:model-value="(next) => onChange(Number(next))"
    />
  </label>
</template>
