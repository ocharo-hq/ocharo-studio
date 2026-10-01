<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import {
  ArrowLeft,
  Check,
  Grid2X2,
  RotateCcw,
  Scaling,
  Search,
} from "@lucide/vue";
import { MATERIALS, getGarment } from "../../../domain/studio/catalog";
import type {
  DesignDocument,
  MaterialScaleLibrary,
  SavedLook,
} from "../../../domain/studio/types";
import type { StudioViewportApi } from "../../../application/studio/UseStudioViewport";
import { useMaterialEditor } from "../../../application/studio/UseMaterialEditor";
import StudioViewport from "../StudioViewport.vue";
import RangeControl from "../RangeControl.vue";
import "./MaterialStudioPage.css";

/** Edits one fabric's shared motif scale without publishing slider previews. */
defineOptions({ name: "MaterialStudioPage" });
const props = defineProps<{
  selectedId: string;
  document: DesignDocument;
  looks: readonly SavedLook[];
  library: MaterialScaleLibrary;
  dark: boolean;
  disabled: boolean;
  persistenceStatus: "loading" | "saving" | "synced" | "offline" | "conflict";
  onSelect: (id: string) => void;
  onSave: (id: string, scale: number) => boolean;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  confirmDiscard: () => Promise<boolean>;
}>();
const editor = useMaterialEditor(() => props);
const search = ref("");
const grid = ref(true);
const scene = shallowRef<StudioViewportApi | null>(null);
const heading = shallowRef<HTMLElement | null>(null);
const filtered = computed(() =>
  MATERIALS.filter((item) =>
    `${item.name} ${item.family}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  ),
);
const selected = editor.material;
const preview = editor.previewDocument;
const scale = editor.scale;
const changed = editor.changed;
const uses = editor.uses;
const varied = editor.varied;
const outdated = editor.outdated;
const storageLabel = computed(
  () =>
    ({
      loading: "Loading saved materials…",
      saving: "Saving changes…",
      synced: "Studio storage connected",
      offline: "Offline · Changes stay in this browser",
      conflict: "Sync conflict · Resolve in Settings",
    })[props.persistenceStatus],
);
const previewGarment = computed(() => getGarment(preview.value.garmentId));
const swatchStyle = computed(() => ({
  backgroundColor: selected.value.color,
  backgroundImage: selected.value.textureUrl
    ? `url(${selected.value.textureUrl})`
    : undefined,
  backgroundSize: `${200 * scale.value}px ${200 * scale.value}px`,
}));
watch(changed, props.onDirtyChange, { immediate: true });
onMounted(() => heading.value?.focus());
async function select(id: string) {
  if (id === props.selectedId) return;
  if (changed.value && !(await props.confirmDiscard())) return;
  editor.reset();
  props.onSelect(id);
}
function save() {
  if (outdated.value || props.disabled) return;
  if (props.onSave(props.selectedId, scale.value)) editor.reset();
}
defineExpose({ save });
</script>

<template>
  <main class="material-studio" aria-label="Material Studio">
    <header class="material-studio-heading">
      <div>
        <button class="text-button material-back" @click="onBack">
          <ArrowLeft :size="16" /> Garment studio
        </button>
        <h1 ref="heading" tabindex="-1">Material Studio</h1>
        <p>One material. The same scale across your pieces.</p>
        <p class="material-storage-status" role="status">{{ storageLabel }}</p>
      </div>
      <div class="material-editor-actions">
        <button
          class="button secondary"
          :disabled="!changed && !outdated"
          @click="editor.reset"
        >
          <RotateCcw :size="15" /> Cancel changes
        </button>
        <button
          class="button primary"
          :disabled="
            disabled ||
            outdated ||
            !selected.textureUrl ||
            (!changed && !varied && !!library[selectedId])
          "
          @click="save"
        >
          <Check :size="16" /> Save material
        </button>
      </div>
    </header>
    <div class="material-studio-layout">
      <aside class="material-browser island" aria-label="Material library">
        <label class="material-search"
          ><Search :size="16" /><input
            v-model="search"
            type="search"
            aria-label="Find material"
            placeholder="Find a material"
        /></label>
        <div class="material-browser-list">
          <button
            v-for="item in filtered"
            :key="item.id"
            :class="[
              'material-browser-item',
              { selected: item.id === selectedId },
            ]"
            :aria-pressed="item.id === selectedId"
            @click="select(item.id)"
          >
            <span
              class="material-browser-swatch"
              :style="{
                backgroundColor: item.color,
                backgroundImage: item.textureUrl
                  ? `url(${item.textureUrl})`
                  : undefined,
              }"
            />
            <span
              ><strong>{{ item.name }}</strong
              ><small>{{ item.family }}</small></span
            >
            <Check v-if="item.id === selectedId" :size="14" />
          </button>
          <p v-if="!filtered.length" class="material-empty">
            No materials match your search.
          </p>
        </div>
      </aside>
      <section
        class="material-tile-section island"
        aria-label="Textile repeat preview"
      >
        <div class="material-tile-heading">
          <div>
            <small>{{ selected.family }}</small>
            <h2>{{ selected.name }}</h2>
          </div>
          <button
            class="icon-button"
            aria-label="Show repeat grid"
            :aria-pressed="grid"
            @click="grid = !grid"
          >
            <Grid2X2 :size="20" />
          </button>
        </div>
        <div
          class="material-repeat-preview"
          :style="swatchStyle"
          role="img"
          :aria-label="`${selected.name} repeated at ${scale.toFixed(2)} times scale`"
        >
          <div
            v-if="grid && selected.textureUrl"
            class="material-repeat-grid"
            :style="{ backgroundSize: `${200 * scale}px ${200 * scale}px` }"
          />
        </div>
        <p class="material-preview-hint">
          {{
            selected.textureUrl
              ? "Relative motif scale · Grid marks each image repeat"
              : "Solid fabric · No pattern scale"
          }}
        </p>
      </section>
      <aside
        class="material-properties island"
        aria-label="Material scale settings"
      >
        <div class="material-model-heading">
          <h2>On {{ previewGarment.name }}</h2>
          <span>Preview</span>
        </div>
        <div class="material-model-preview">
          <StudioViewport
            :document="preview"
            :selected-part-id="previewGarment.parts[0]!.id"
            :selected-part-ids="[]"
            :on-select-part="() => {}"
            :on-ready="(api) => (scene = api)"
            :dark="dark"
          />
        </div>
        <div
          class="material-preview-views"
          role="group"
          aria-label="Material preview view"
        >
          <button
            v-for="view in ['front', 'back', 'side'] as const"
            :key="view"
            @click="scene?.view(view)"
          >
            {{ view }}
          </button>
        </div>
        <div class="material-scale-fields">
          <RangeControl
            v-if="selected.textureUrl"
            label="Material scale"
            :icon="Scaling"
            :value="scale"
            :min="0.25"
            :max="4"
            :step="0.05"
            suffix="×"
            :on-change="editor.setScale"
            :on-begin="() => {}"
            :on-end="() => {}"
          />
          <p v-else class="material-preview-hint">
            This material is a solid colour. Choose a patterned textile to edit
            its scale.
          </p>
          <p v-if="outdated" class="material-edit-warning" role="status">
            This material changed while you were editing. Cancel changes to load
            its latest scale.
          </p>
          <p v-if="varied" class="material-edit-warning">
            Existing pieces use different scales. Saving replaces them with this
            shared scale.
          </p>
          <p class="material-save-impact">
            Save updates every use, including saved looks. Rotation and
            placement stay unchanged.
          </p>
          <h3>
            Affected pieces <span>{{ uses.length }}</span>
          </h3>
          <ul v-if="uses.length" class="material-use-list">
            <li
              v-for="(use, index) in uses"
              :key="`${use.document.id}-${index}`"
            >
              <span>{{ use.label }}</span
              ><small
                >{{ use.parts.length }}
                {{ use.parts.length === 1 ? "part" : "parts" }}</small
              >
            </li>
          </ul>
          <p v-else class="material-preview-hint">
            No existing pieces use this material. New assignments will use its
            saved scale.
          </p>
        </div>
      </aside>
    </div>
  </main>
</template>
