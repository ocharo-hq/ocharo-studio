<script lang="ts">
export type PersistenceStatus =
  "loading" | "saving" | "synced" | "offline" | "conflict";
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowUpFromLine,
  Check,
  CloudOff,
  LoaderCircle,
  Palette,
  Save,
  Settings,
  SquarePlus,
} from "@lucide/vue";
import StudioBrand from "../common/StudioBrand.vue";
import IconButton from "./IconButton.vue";

/** Studio identity, document name, persistence state, and primary actions. */
defineOptions({ name: "StudioHeader" });

const props = defineProps<{
  name: string;
  garmentName: string;
  onNameChange: (name: string) => void;
  onNameFocus: () => void;
  onNameCommit: () => void;
  isDirty: boolean;
  persistenceStatus: PersistenceStatus;
  onSave: () => void;
  onExport: () => void;
  onSettings: () => void;
  onHome: () => void;
  onNew: () => void;
  onMaterials: () => void;
  materialPage?: boolean;
}>();
const nameFocused = ref(false);
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
function keyName(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === "Escape")
    (event.currentTarget as HTMLInputElement).blur();
}
function focusName() {
  nameFocused.value = true;
  props.onNameFocus();
}
function commitName() {
  nameFocused.value = false;
  props.onNameCommit();
}
</script>

<template>
  <header class="app-header">
    <div class="header-leading">
      <StudioBrand :on-navigate="onHome" />
      <button
        v-if="!materialPage"
        type="button"
        class="new-design-button"
        data-tour="new-design"
        aria-label="New design"
        @click="onNew"
      >
        <SquarePlus :size="17" />
        <span>New design</span>
      </button>
      <button
        type="button"
        class="new-design-button"
        aria-label="Material Studio"
        :aria-pressed="materialPage"
        @click="onMaterials"
      >
        <Palette :size="17" /><span>Materials</span>
      </button>
    </div>
    <div
      :class="['document-heading', { 'is-focused': nameFocused }]"
      data-tour="look-name"
    >
      <input
        aria-label="Look name"
        :value="name"
        maxlength="80"
        @input="onNameChange(($event.target as HTMLInputElement).value)"
        @focus="focusName"
        @blur="commitName"
        @keydown="keyName"
      />
      <small class="document-garment">{{ garmentName }}</small>
    </div>
    <div class="header-actions">
      <IconButton :icon="Settings" label="Settings" :on-click="onSettings" />
      <button
        v-if="!materialPage"
        class="save-status-button"
        data-tour="save-look"
        aria-label="Save look"
        aria-describedby="look-save-status"
        :disabled="persistenceStatus === 'loading'"
        @click="
          ['offline', 'conflict'].includes(persistenceStatus)
            ? onSettings()
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
        v-if="!materialPage"
        class="button export-button"
        data-tour="export-look"
        aria-label="Export"
        @click="onExport"
      >
        <span>Export</span><ArrowUpFromLine :size="17" />
      </button>
    </div>
  </header>
</template>
