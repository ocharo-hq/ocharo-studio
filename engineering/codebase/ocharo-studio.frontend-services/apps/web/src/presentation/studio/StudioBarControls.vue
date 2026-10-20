<script lang="ts">
export type PersistenceStatus =
  "loading" | "saving" | "synced" | "offline" | "conflict";
</script>

<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowUpFromLine,
  Check,
  CloudOff,
  LoaderCircle,
  Save,
  SquarePlus,
} from "@lucide/vue";
import StudioLookName from "./StudioLookName.vue";

/**
 * The Designer's controls in the frame's top bar: New design, the look name (in the bar from tablets up; phones keep
 * it above the canvas), the save status and Export.
 */
defineOptions({ name: "StudioBarControls" });

const props = defineProps<{
  name: string;
  garmentName: string;
  showName: boolean;
  onNameChange: (name: string) => void;
  onNameFocus: () => void;
  onNameCommit: () => void;
  isDirty: boolean;
  persistenceStatus: PersistenceStatus;
  onSave: () => void;
  onExport: () => void;
  onRecover: () => void;
  onNew: () => void;
}>();
const synced = computed(
  () => props.persistenceStatus === "synced" && !props.isDirty,
);
const busy = computed(() =>
  ["loading", "saving"].includes(props.persistenceStatus),
);
const statusIcon = computed(() =>
  synced.value
    ? Check
    : ["offline", "conflict"].includes(props.persistenceStatus)
      ? CloudOff
      : busy.value
        ? LoaderCircle
        : Save,
);
const status = computed(() =>
  synced.value
    ? "Saved"
    : props.persistenceStatus === "conflict"
      ? "Resolve"
      : props.persistenceStatus === "offline"
        ? "Offline"
        : busy.value
          ? "Saving"
          : "Save",
);
</script>

<template>
  <div class="studio-bar">
    <button
      type="button"
      class="new-design-button"
      data-tour="new-design"
      aria-label="New design"
      @click="onNew"
    >
      <SquarePlus :size="17" />
      <span>New design</span>
    </button>
    <StudioLookName
      v-if="showName"
      class="studio-bar-name"
      :name="name"
      :garment-name="garmentName"
      :on-name-change="onNameChange"
      :on-name-focus="onNameFocus"
      :on-name-commit="onNameCommit"
    />
    <span v-else class="studio-bar-spacer" aria-hidden="true" />
    <button
      class="save-status-button"
      data-tour="save-look"
      aria-label="Save look"
      aria-describedby="look-save-status"
      :disabled="persistenceStatus === 'loading'"
      @click="
        ['offline', 'conflict'].includes(persistenceStatus)
          ? onRecover()
          : onSave()
      "
    >
      <component :is="statusIcon" :class="{ spin: busy }" :size="16" />
      <span class="save-divider" aria-hidden="true" />
      <span
        id="look-save-status"
        class="save-status-label"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        >{{ status }}</span
      >
    </button>
    <button
      class="button export-button"
      data-tour="export-look"
      aria-label="Export"
      @click="onExport"
    >
      <span>Export</span><ArrowUpFromLine :size="17" />
    </button>
  </div>
</template>
