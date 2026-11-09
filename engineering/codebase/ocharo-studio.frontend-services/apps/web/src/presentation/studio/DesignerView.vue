<script lang="ts">
/** The Designer panel a phone shows; tablets and up show all three at once. */
export type DesignerSheet = "canvas" | "library" | "inspector";
</script>

<script setup lang="ts">
import { CircleHelp, MousePointer2 } from "lucide-vue-next";
import type { StudioControls } from "../../application/studio/hooks/UseStudio";
import type { StudioViewportApi } from "../../application/studio/hooks/UseStudioViewport";
import type {
  GarmentDefinition,
  MaterialDefinition,
  PartId,
  TexturePlacement,
} from "../../domain/studio";
import StudioLookName from "./StudioLookName.vue";
import StudioInspector from "./StudioInspector.vue";
import StudioLibrary, { type LibraryTab } from "./StudioLibrary.vue";
import StudioCameraTools from "./StudioCameraTools.vue";
import StudioEditToolbar from "./StudioEditToolbar.vue";
import StudioViewport from "./StudioViewport.vue";

/**
 * Renders the Designer place: the canvas, the library, the part toolbar and inspector, the camera tools and the
 * phone panel switch, over the open design the page owns.
 */
defineOptions({ name: "DesignerView" });
defineProps<{
  studio: StudioControls;
  garment: GarmentDefinition;
  partId: PartId;
  material: MaterialDefinition;
  materials: readonly MaterialDefinition[];
  mixedMaterial: boolean;
  mixedPlacement: readonly (keyof TexturePlacement)[];
  hasPattern: boolean;
  placement: TexturePlacement;
  lookName: string;
  isPhone: boolean;
  dark: boolean;
  scene: StudioViewportApi | null;
  tab: LibraryTab;
  filter: string;
  sheet: DesignerSheet;
  placementMode: boolean;
  refreshingLooks: boolean;
  showGuideLauncher: boolean;
  onNameChange: (name: string) => void;
  onNameFocus: () => void;
  onNameCommit: () => void;
  onReady: (api: StudioViewportApi) => void;
  onTabChange: (tab: LibraryTab) => void;
  onFilterChange: (filter: string) => void;
  onSheetChange: (sheet: DesignerSheet) => void;
  onPlacementMode: (active: boolean) => void;
  onRefreshLooks: () => void;
  onDeleteLook: (id: string, name: string) => void;
  onExportRecovery: () => void;
  onSaveCopy: () => void;
  onImport: () => void;
  onChooseMaterial: () => void;
  onEditMaterial: () => void;
  onOpenGuide: () => void;
}>();
</script>

<template>
  <section
    class="workspace"
    :data-sheet-open="sheet"
    :data-name-row="isPhone || undefined"
    aria-labelledby="studio-designer-heading"
  >
    <h1 id="studio-designer-heading" class="sr-only">Ocharo design studio</h1>
    <StudioLookName
      v-if="isPhone"
      class="workspace-name island"
      :name="lookName"
      :garment-name="garment.name"
      :on-name-change="onNameChange"
      :on-name-focus="onNameFocus"
      :on-name-commit="onNameCommit"
    />
    <section class="scene-area" aria-label="Design canvas">
      <div class="viewport">
        <StudioViewport
          :document="studio.document"
          :initialization-ready="
            !['loading', 'saving'].includes(studio.persistenceStatus)
          "
          :selected-part-id="partId"
          :selected-part-ids="studio.selectedPartIds"
          :on-select-part="studio.setSelectedPartId"
          :on-ready="onReady"
          :dark="dark"
          :placement-mode="placementMode"
          :on-place-anchor="
            (garmentAnchorX, garmentAnchorY) =>
              studio.setPlacement({ garmentAnchorX, garmentAnchorY })
          "
          :on-placement-start="studio.beginPlacement"
          :on-placement-end="studio.endPlacement"
        />
      </div>
    </section>
    <StudioLibrary
      :tab="tab"
      :on-tab-change="onTabChange"
      :garment-id="garment.id"
      :materials="materials"
      :material-id="mixedMaterial ? '' : material.id"
      :filter="filter"
      :on-filter-change="onFilterChange"
      :on-garment="studio.chooseGarment"
      :on-material="studio.applyMaterial"
      :looks="studio.looks"
      :looks-status="studio.looksStatus"
      :reading-looks="studio.refreshingLooks"
      :refreshing-looks="refreshingLooks"
      :on-refresh="onRefreshLooks"
      :on-open="studio.openLook"
      :on-delete="onDeleteLook"
      :delete-unavailable-reason="studio.deleteLookUnavailableReason"
      :on-export-recovery="onExportRecovery"
      :on-save-copy="onSaveCopy"
      :on-import="onImport"
    />
    <StudioEditToolbar
      :garment="garment"
      :part-id="partId"
      :selected-part-ids="studio.selectedPartIds"
      :on-part="studio.setSelectedPartId"
      :can-undo="studio.canUndo"
      :can-redo="studio.canRedo"
      :on-undo="studio.undo"
      :on-redo="studio.redo"
    />
    <StudioInspector
      :garment="garment"
      :part-id="partId"
      :selected-part-ids="studio.selectedPartIds"
      :mixed-material="mixedMaterial"
      :mixed-placement="mixedPlacement"
      :has-pattern="hasPattern"
      :material="material"
      :placement="placement"
      :placement-mode="placementMode"
      :on-placement-mode="onPlacementMode"
      :on-part="studio.setSelectedPartId"
      :on-choose-material="onChooseMaterial"
      :on-edit-material="onEditMaterial"
      :on-placement="studio.setPlacement"
      :on-begin="studio.beginPlacement"
      :on-end="studio.endPlacement"
      :on-reset="studio.resetPlacement"
    />
    <StudioCameraTools :scene="scene" data-tour="camera" />
    <div class="orbit-hint">
      <MousePointer2 :size="13" /><span
        >Drag or two-finger scroll to orbit · Pinch to zoom · Shift-click to
        select together</span
      >
    </div>
    <div
      class="mobile-sheet-switch island"
      role="group"
      aria-label="Mobile editor panel"
    >
      <button
        :class="{ active: sheet === 'canvas' }"
        :aria-pressed="sheet === 'canvas'"
        @click="onSheetChange('canvas')"
      >
        Canvas
      </button>
      <button
        :class="{ active: sheet === 'library' }"
        :aria-pressed="sheet === 'library'"
        @click="onSheetChange('library')"
      >
        Library
      </button>
      <button
        :class="{ active: sheet === 'inspector' }"
        :aria-pressed="sheet === 'inspector'"
        @click="onSheetChange('inspector')"
      >
        Edit part
      </button>
    </div>
    <button
      v-if="showGuideLauncher"
      class="guide-launcher island"
      aria-label="Open studio guide"
      @click="onOpenGuide"
    >
      <CircleHelp :size="19" /><span>Guide</span>
    </button>
  </section>
</template>
