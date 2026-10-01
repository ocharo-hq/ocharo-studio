<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, shallowRef } from "vue";
import {
  Check,
  ChevronDown,
  Layers3,
  MousePointer2,
  Redo2,
  Undo2,
} from "@lucide/vue";
import type { GarmentDefinition, PartId } from "../../domain/studio/types";
import IconButton from "./IconButton.vue";

/** Multi-part selection and document history controls above the stage. */
defineOptions({ name: "StudioEditToolbar" });

const props = defineProps<{
  garment: GarmentDefinition;
  partId: PartId;
  selectedPartIds: readonly PartId[];
  onPart: (id: PartId, additive?: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}>();
const open = shallowRef(false);
const trigger = shallowRef<HTMLButtonElement | null>(null);
const panel = shallowRef<HTMLDivElement | null>(null);
const selected = computed(() => new Set(props.selectedPartIds));
const label = computed(() =>
  props.selectedPartIds.length > 1
    ? `${props.selectedPartIds.length} parts`
    : (props.garment.parts.find((item) => item.id === props.partId)?.name ??
      "Choose parts"),
);

async function setOpen(next: boolean) {
  open.value = next;
  if (next) {
    await nextTick();
    panel.value?.querySelector<HTMLButtonElement>("[role=option]")?.focus();
  } else trigger.value?.focus();
}
function toggle(id: PartId) {
  if (selected.value.has(id) && props.selectedPartIds.length === 1) return;
  props.onPart(id, true);
}
function moveOption(event: KeyboardEvent) {
  const options = [
    ...(panel.value?.querySelectorAll<HTMLButtonElement>("[role=option]") ??
      []),
  ];
  const current = options.indexOf(event.currentTarget as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % options.length
          : event.key === "ArrowUp"
            ? (current - 1 + options.length) % options.length
            : -1;
  if (next < 0) return;
  event.preventDefault();
  options[next]?.focus();
}
function onDocumentPointer(event: PointerEvent) {
  const target = event.target as Node;
  if (
    !open.value ||
    trigger.value?.contains(target) ||
    panel.value?.contains(target)
  )
    return;
  open.value = false;
}
function onDocumentKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || !open.value) return;
  event.preventDefault();
  void setOpen(false);
}
onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointer, true);
  document.addEventListener("keydown", onDocumentKey);
});
onScopeDispose(() => {
  document.removeEventListener("pointerdown", onDocumentPointer, true);
  document.removeEventListener("keydown", onDocumentKey);
});
</script>

<template>
  <div
    class="context-toolbar island"
    aria-label="Editing tools"
    data-tour="part-picker"
  >
    <span class="tool-label"><MousePointer2 :size="17" />Edit parts</span
    ><span class="toolbar-divider" />
    <div class="part-multiselect">
      <button
        ref="trigger"
        type="button"
        class="part-multiselect-trigger"
        aria-haspopup="listbox"
        :aria-expanded="open"
        aria-controls="part-multiselect-options"
        @click="setOpen(!open)"
      >
        <Layers3 :size="15" /><span>{{ label }}</span
        ><ChevronDown :class="{ 'is-open': open }" :size="15" />
      </button>
      <div
        v-if="open"
        id="part-multiselect-options"
        ref="panel"
        class="part-multiselect-options"
        role="listbox"
        aria-label="Garment parts to edit"
        aria-multiselectable="true"
      >
        <button
          v-for="item in garment.parts"
          :key="item.id"
          type="button"
          role="option"
          :aria-selected="selected.has(item.id)"
          :class="{
            selected: selected.has(item.id),
            primary: item.id === partId,
          }"
          @click="toggle(item.id)"
          @keydown="moveOption"
        >
          <span class="part-option-check" aria-hidden="true"
            ><Check v-if="selected.has(item.id)" :size="13" /></span
          ><span>{{ item.name }}</span
          ><small v-if="item.id === partId">Primary</small>
        </button>
        <p>Select several parts to apply the next edit together.</p>
      </div>
    </div>
    <span class="toolbar-divider" />
    <IconButton
      :icon="Undo2"
      label="Undo"
      :on-click="onUndo"
      :disabled="!canUndo"
    />
    <IconButton
      :icon="Redo2"
      label="Redo"
      :on-click="onRedo"
      :disabled="!canRedo"
    />
  </div>
</template>
