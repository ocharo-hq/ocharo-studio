<script setup lang="ts">
import { ref } from "vue";

/** The editable look name with its garment underneath; one focused edit is one undo step. */
defineOptions({ name: "StudioLookName" });
const props = defineProps<{
  name: string;
  garmentName: string;
  onNameChange: (name: string) => void;
  onNameFocus: () => void;
  onNameCommit: () => void;
}>();
const focused = ref(false);
function keyName(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === "Escape")
    (event.currentTarget as HTMLInputElement).blur();
}
function focus() {
  focused.value = true;
  props.onNameFocus();
}
function commit() {
  focused.value = false;
  props.onNameCommit();
}
</script>

<template>
  <div
    :class="['document-heading', { 'is-focused': focused }]"
    data-tour="look-name"
  >
    <input
      aria-label="Look name"
      :value="name"
      maxlength="80"
      @input="onNameChange(($event.target as HTMLInputElement).value)"
      @focus="focus"
      @blur="commit"
      @keydown="keyName"
    />
    <small class="document-garment">{{ garmentName }}</small>
  </div>
</template>
