<script setup lang="ts">
import type { Component } from "vue";

/** Labelled range input with coherent pointer and keyboard gesture callbacks. */
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
    <input
      type="range"
      :aria-label="label"
      :aria-valuetext="
        mixed
          ? 'Mixed values; adjusting applies to all selected parts'
          : undefined
      "
      :value="value"
      :min="min"
      :max="max"
      :step="step"
      @pointerdown="onBegin"
      @pointerup="onEnd"
      @pointercancel="onEnd"
      @blur="onEnd"
      @keydown="beginFromKeyboard"
      @keyup="onEnd"
      @input="onChange(Number(($event.target as HTMLInputElement).value))"
    />
  </label>
</template>
