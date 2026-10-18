<script lang="ts">
export type LibraryTab = "garments" | "materials" | "looks";
</script>

<script setup lang="ts">
import { computed, nextTick } from "vue";
import {
  Check,
  Download,
  FolderHeart,
  Palette,
  Plus,
  RefreshCw,
  Shirt,
  Trash2,
} from "@lucide/vue";
import { Button } from "@wow-two-beta/fe/presentation/actions";
import {
  SkeletonState,
  SkeletonStateGroup,
  SkeletonStateSlot,
} from "@wow-two-beta/fe/presentation/feedback";
import type { StudioLibraryStatus } from "../../application/studio/UseStudioPersistence";
import { GARMENTS, getGarment } from "../../domain/studio/catalog";
import type {
  GarmentId,
  MaterialDefinition,
  SavedLook,
} from "../../domain/studio/types";
import GarmentGlyph from "./GarmentGlyph.vue";
import IconButton from "./IconButton.vue";

/** Keyboard-operable garment, textile, and saved-look library. */
defineOptions({ name: "StudioLibrary" });

const tabs: LibraryTab[] = ["garments", "materials", "looks"];
const tabItems = [
  { value: "garments", label: "Garments", icon: Shirt },
  { value: "materials", label: "Textiles", icon: Palette },
  { value: "looks", label: "My looks", icon: FolderHeart },
] as const;
const props = defineProps<{
  tab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
  garmentId: GarmentId;
  materials: ReadonlyArray<MaterialDefinition>;
  materialId: string;
  filter: string;
  onFilterChange: (filter: string) => void;
  onGarment: (id: GarmentId) => void;
  onMaterial: (id: string) => void;
  looks: ReadonlyArray<SavedLook>;
  looksStatus: StudioLibraryStatus;
  readingLooks: boolean;
  refreshingLooks: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  deleteUnavailableReason: (id: string) => string | undefined;
  onExportRecovery: () => void;
  onSaveCopy: () => void;
  onImport: () => void;
}>();
const families = computed(() => [
  "All",
  ...new Set(props.materials.map((item) => item.family)),
]);
const filteredMaterials = computed(() =>
  props.materials.filter(
    (item) => props.filter === "All" || item.family === props.filter,
  ),
);
const heading = computed(() =>
  props.tab === "garments"
    ? "Garments"
    : props.tab === "materials"
      ? "Textiles"
      : "My looks",
);
const initialLoading = computed(
  () =>
    props.looksStatus === "loading" ||
    (props.looksStatus !== "ready" && props.refreshingLooks),
);
const count = computed(() => {
  if (props.tab === "looks" && props.looksStatus !== "ready") return "—";
  return String(
    props.tab === "garments"
      ? GARMENTS.length
      : props.tab === "materials"
        ? props.materials.length
        : props.looks.length,
  ).padStart(2, "0");
});
async function moveTab(key: string) {
  const direction = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (!direction) return;
  const next =
    tabs[(tabs.indexOf(props.tab) + direction + tabs.length) % tabs.length]!;
  props.onTabChange(next);
  await nextTick();
  document.getElementById(`tab-${next}`)?.focus();
}
</script>

<template>
  <aside class="library island studio-sheet" aria-label="Design library">
    <div
      class="library-tabs"
      role="tablist"
      aria-label="Library"
      data-tour="library-tabs"
    >
      <button
        v-for="item in tabItems"
        :id="`tab-${item.value}`"
        :key="item.value"
        role="tab"
        :aria-selected="tab === item.value"
        aria-controls="library-panel"
        :tabindex="tab === item.value ? 0 : -1"
        :class="{ active: tab === item.value }"
        :data-tour="`${item.value}-tab`"
        @click="onTabChange(item.value)"
        @keydown.left.prevent="moveTab('ArrowLeft')"
        @keydown.right.prevent="moveTab('ArrowRight')"
      >
        <component :is="item.icon" :size="20" /><span>{{ item.label }}</span>
      </button>
    </div>
    <div
      id="library-panel"
      class="library-content"
      :class="{ 'library-content--looks': tab === 'looks' }"
      role="tabpanel"
      :aria-labelledby="`tab-${tab}`"
    >
      <div class="section-heading">
        <div>
          <h2>{{ heading }}</h2>
        </div>
        <div class="library-heading-actions">
          <Button
            v-if="tab === 'looks'"
            class="library-refresh"
            variant="ghost"
            size="sm"
            :is-loading="initialLoading || refreshingLooks || readingLooks"
            @click="onRefresh"
          >
            <template #leading><RefreshCw :size="15" /></template>
            Refresh
          </Button>
          <SkeletonStateSlot
            :is-loading="
              tab === 'looks' &&
              (initialLoading || (refreshingLooks && looks.length > 0))
            "
          >
            <span class="count-badge">{{ count }}</span>
          </SkeletonStateSlot>
        </div>
      </div>
      <div v-if="tab === 'garments'" class="garment-list">
        <button
          v-for="(item, index) in GARMENTS"
          :key="item.id"
          :class="['garment-card', { selected: garmentId === item.id }]"
          :aria-pressed="garmentId === item.id"
          :data-tour="index === 0 ? 'choose-garment' : undefined"
          @click="onGarment(item.id)"
        >
          <span :class="['garment-art', `art-${item.id}`]"
            ><GarmentGlyph :id="item.id" /></span
          ><span class="garment-copy"
            ><span class="item-number">0{{ index + 1 }}</span
            ><strong>{{ item.name }}</strong
            ><small>{{ item.subtitle }}</small></span
          ><span class="selection-dot"
            ><Check v-if="garmentId === item.id" :size="12"
          /></span>
        </button>
      </div>
      <template v-else-if="tab === 'materials'">
        <div class="filter-row">
          <button
            v-for="value in families"
            :key="value"
            :class="{ active: filter === value }"
            :aria-pressed="filter === value"
            @click="onFilterChange(value)"
          >
            {{ value }}
          </button>
        </div>
        <div class="material-grid" data-tour="material-library">
          <button
            v-for="item in filteredMaterials"
            :key="item.id"
            :class="['material-card', { selected: item.id === materialId }]"
            :aria-pressed="item.id === materialId"
            :data-tour="item.id === materialId ? 'choose-material' : undefined"
            @click="onMaterial(item.id)"
          >
            <span
              class="material-swatch"
              :style="{
                backgroundColor: item.color,
                backgroundImage: item.textureUrl
                  ? `url(${item.textureUrl})`
                  : undefined,
              }"
              ><span v-if="item.id === materialId" class="swatch-check"
                ><Check :size="13" /></span></span
            ><strong>{{ item.name }}</strong
            ><small>{{
              item.family === "Solid" ? "Solid fabric" : "Generated textile"
            }}</small>
          </button>
        </div>
      </template>
      <template v-else>
        <button class="button import-button" @click="onImport">
          <Download :size="16" />Import a design
        </button>
        <button class="button copy-button secondary" @click="onSaveCopy">
          <Plus :size="16" />Save as a new look
        </button>
        <SkeletonStateGroup
          class="library-looks-region"
          :is-loading="initialLoading || (refreshingLooks && looks.length > 0)"
          label="Loading saved looks"
        >
          <Transition name="library-result" mode="out-in">
            <div v-if="initialLoading" key="loading" class="saved-list">
              <div
                v-for="card in 3"
                :key="card"
                class="saved-card saved-card-skeleton"
                aria-hidden="true"
              >
                <SkeletonState class="saved-preview" shape="rect" />
                <SkeletonState class="saved-name-skeleton" />
                <SkeletonState class="saved-garment-skeleton" />
              </div>
            </div>
            <p
              v-else-if="looksStatus === 'unavailable'"
              key="unavailable"
              class="library-result-label"
            >
              Saved looks unavailable
            </p>
            <p
              v-else-if="looks.length === 0"
              key="empty"
              class="library-result-label"
            >
              No saved looks
            </p>
            <div v-else key="looks" class="saved-list">
              <div
                v-for="look in looks"
                :key="look.document.id"
                class="saved-card"
                :class="{
                  'saved-card--restricted': deleteUnavailableReason(
                    look.document.id,
                  ),
                }"
              >
                <button
                  :aria-label="`Open ${look.document.name}`"
                  @click="onOpen(look.document.id)"
                >
                  <SkeletonStateSlot is-block shape="rect">
                    <span class="saved-preview"
                      ><img
                        v-if="look.thumbnail"
                        :src="look.thumbnail"
                        alt="" /><GarmentGlyph
                        v-else
                        :id="look.document.garmentId"
                    /></span>
                  </SkeletonStateSlot>
                  <strong>{{ look.document.name }}</strong>
                  <small>{{ getGarment(look.document.garmentId).name }}</small>
                </button>
                <IconButton
                  :icon="Trash2"
                  :label="`Delete ${look.document.name}`"
                  :disabled="Boolean(deleteUnavailableReason(look.document.id))"
                  :aria-describedby="
                    deleteUnavailableReason(look.document.id)
                      ? `look-delete-${look.document.id}`
                      : undefined
                  "
                  :on-click="
                    () => onDelete(look.document.id, look.document.name)
                  "
                />
                <div
                  v-if="deleteUnavailableReason(look.document.id)"
                  class="saved-delete-recovery"
                >
                  <p :id="`look-delete-${look.document.id}`">
                    {{ deleteUnavailableReason(look.document.id) }}
                  </p>
                  <Button variant="ghost" size="sm" @click="onExportRecovery">
                    <template #leading><Download :size="14" /></template>
                    Download recovery
                  </Button>
                </div>
              </div>
            </div>
          </Transition>
        </SkeletonStateGroup>
      </template>
    </div>
  </aside>
</template>
