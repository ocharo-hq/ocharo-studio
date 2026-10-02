<script setup lang="ts">
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useRefresh } from "@wow-two-beta/ui-vue/query";
import { useNavigationBlocker } from "@wow-two-beta/ui-vue/router";
import { usePersistentState } from "@wow-two-beta/ui-vue/foundation/storage";
import {
  downloadBlob,
  downloadText,
} from "@wow-two-beta/ui-vue/foundation/files";
import {
  ToastHost,
  useToastHost,
} from "@wow-two-beta/ui-vue/presentation/feedback/toast-host";
import { CircleHelp, MousePointer2 } from "@lucide/vue";

import {
  useStudioOnboarding,
  type OnboardingRecord,
} from "../application/onboarding/UseStudioOnboarding";
import { useStudio } from "../application/studio/UseStudio";
import type { StudioViewportApi } from "../application/studio/UseStudioViewport";
import {
  getAvailableMaterials,
  getGarment,
  getMaterial,
  isMaterialApplicable,
  MATERIALS,
} from "../domain/studio/catalog";
import type { TexturePlacement } from "../domain/studio/types";
import {
  acceptTicketFragment,
  getIntegrationTicket,
  setIntegrationTicket,
} from "../integration/studio/access";
import {
  createCreativeHandoff,
  type CreativeReviewPackage,
} from "../integration/studio/creativeHandoff";
import ReviewPackageDialog from "../presentation/studio/ReviewPackageDialog.vue";
import ExportDialog from "../presentation/studio/ExportDialog.vue";
import RenderDialog from "../presentation/studio/RenderDialog.vue";
import OnboardingDialog from "../presentation/studio/OnboardingDialog.vue";
import SettingsDialog from "../presentation/studio/SettingsDialog.vue";
import StudioHeader from "../presentation/studio/StudioHeader.vue";
import StudioInspector from "../presentation/studio/StudioInspector.vue";
import StudioLibrary, {
  type LibraryTab,
} from "../presentation/studio/StudioLibrary.vue";
import StudioCameraTools from "../presentation/studio/StudioCameraTools.vue";
import StudioEditToolbar from "../presentation/studio/StudioEditToolbar.vue";
import StudioViewport from "../presentation/studio/StudioViewport.vue";
import GuidedTour, {
  type GuidedTourStep,
} from "../presentation/studio/GuidedTour.vue";
import { studioGuideSteps } from "../presentation/studio/StudioGuideSteps";
import "../presentation/studio/StudioIteration.css";
import MaterialStudioPage from "../presentation/studio/materials/MaterialStudioPage.vue";
import StudioConfirmationDialog from "../presentation/studio/StudioConfirmationDialog.vue";
import { useStudioConfirmation } from "../presentation/studio/UseStudioConfirmation";

/** Composes the garment editor, presentation controls, and persistence-aware user actions. */
defineOptions({ name: "StudioApp" });

const connectionError = acceptTicketFragment();
const deskConnected = ref(Boolean(getIntegrationTicket()));
const studio = useStudio();
const { refresh: refreshLooks, refreshing: refreshingLooks } = useRefresh(
  studio.refreshLooks,
);
function connectDesk(ticket: string | null): void {
  try {
    setIntegrationTicket(ticket);
    deskConnected.value = Boolean(ticket);
    studio.reconnect();
    notify(
      ticket
        ? "Connecting to your Desk workspace…"
        : "Browser-only mode. Your local designs remain available.",
    );
  } catch (error) {
    notify(error instanceof Error ? error.message : "Connection failed.");
  }
}

const router = useRouter();
const route = useRoute();
const confirmation = useStudioConfirmation();
const materialDirty = ref(false);
const materialEditor = shallowRef<{ save: () => void } | null>(null);
const materialPage = computed(() => route.path === "/studio/materials");
const navigation = useNavigationBlocker(
  () => materialDirty.value || studio.persistenceStatus === "saving",
);
const legacyDark = usePersistentState("ocharo-studio.theme", false);
const onboarding = useStudioOnboarding(() => ({
  value: readOnboarding(studio.settings?.onboarding),
  enabled: studio.persistenceStatus !== "loading",
  onChange: (record: OnboardingRecord) =>
    studio.updateSettings({ onboarding: record }),
}));

const lookName = ref(studio.document.name);
const editingName = ref(false);
const tab = ref<LibraryTab>("garments");
const filter = ref("All");
const dialog = ref<"export" | "render" | "settings" | "review" | null>(null);
const ready = ref(false);
const placementMode = ref(false);
const mobileSheet = ref<"canvas" | "library" | "inspector">("library");
const scene = shallowRef<StudioViewportApi | null>(null);
const fileInput = shallowRef<HTMLInputElement | null>(null);
const guideStep = ref(0);

const garment = computed(() => getGarment(studio.document.garmentId));
const part = computed(
  () =>
    garment.value.parts.find((item) => item.id === studio.selectedPartId) ??
    garment.value.parts[0],
);
const assignment = computed(() => studio.document.parts[part.value.id]!);
const material = computed(() => getMaterial(assignment.value.materialId));
const editingMaterialId = computed(() =>
  MATERIALS.some((item) => item.id === route.query.material)
    ? (route.query.material as string)
    : material.value.id,
);
const placement = computed(() => assignment.value.placement);
const dark = computed(() =>
  typeof studio.settings.dark === "boolean"
    ? studio.settings.dark
    : legacyDark.value.value,
);
const materials = computed(() =>
  getAvailableMaterials(garment.value.id, part.value.id).filter((item) =>
    studio.selectedPartIds.every((id) =>
      isMaterialApplicable(garment.value.id, id, item.id),
    ),
  ),
);
const assignments = computed(() =>
  studio.selectedPartIds.map((id) => studio.document.parts[id]!),
);
const multiple = computed(() => studio.selectedPartIds.length > 1);
const mixedMaterial = computed(() =>
  assignments.value.some(
    (item) => item.materialId !== assignment.value.materialId,
  ),
);
const hasPattern = computed(() =>
  assignments.value.some((item) =>
    Boolean(getMaterial(item.materialId).textureUrl),
  ),
);
const mixedPlacement = computed(() =>
  (["offsetX", "offsetY"] as (keyof TexturePlacement)[]).filter((key) =>
    assignments.value.some(
      (item) => item.placement[key] !== placement.value[key],
    ),
  ),
);
const guideSteps = computed(() =>
  studioGuideSteps(hasPattern.value, multiple.value),
);

watch(
  () => onboarding.isGuide,
  (active) => {
    if (active) guideStep.value = 0;
  },
);

watch(multiple, (value) => {
  if (value) placementMode.value = false;
});

watch(
  () => studio.document.name,
  (name) => {
    if (!editingName.value) lookName.value = name;
  },
);
let resolvingNavigation = false;
watch(
  [() => navigation.state, () => studio.persistenceStatus],
  async ([state, status]) => {
    if (state !== "blocked" || resolvingNavigation) return;
    if (materialDirty.value) {
      resolvingNavigation = true;
      const accepted = await confirmMaterialDiscard();
      resolvingNavigation = false;
      if (!accepted) {
        navigation.reset();
        return;
      }
      materialDirty.value = false;
    }
    if (status === "saving") studio.retrySync();
    else navigation.proceed();
  },
);
watch(
  dark,
  (value) => document.documentElement.classList.toggle("dark", value),
  { immediate: true },
);
watch(
  () => studio.document.garmentId,
  () => {
    ready.value = false;
  },
);
const toasts = useToastHost();
/** Messages that need the user to act read as warnings and stay a little longer. */
const WARNING_MESSAGE =
  /could not|failed|offline|newer saved work|unavailable|invalid|use a name|has 100 looks|choose a design|export your design/i;
/** One studio message at a time: a newer message replaces the visible toast in place. */
function notify(message: string, fromNotice = false): void {
  const warning = WARNING_MESSAGE.test(message);
  toasts.toast({
    key: "studio-message",
    title: message,
    severity: warning ? "warning" : "neutral",
    duration: warning ? 7000 : undefined,
    onDismiss: fromNotice
      ? () => {
          if (studio.notice === message) studio.clearNotice();
        }
      : undefined,
  });
}
watch(
  () => studio.notice,
  (notice) => {
    if (notice) notify(notice, true);
  },
  { immediate: true },
);
onMounted(() => window.addEventListener("keydown", onKeyboard));
onScopeDispose(() => window.removeEventListener("keydown", onKeyboard));

function updateDark(next: boolean): void {
  legacyDark.setValue(next);
  studio.updateSettings({ dark: next });
}

function onKeyboard(event: KeyboardEvent): void {
  if (dialog.value || confirmation.request.value) return;
  if ((event.target as HTMLElement)?.matches("input,textarea,select")) return;
  if (materialPage.value) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      materialEditor.value?.save();
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? studio.redo() : studio.undo();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
  }
}

function capture(): string {
  if (!scene.value) throw new Error("The preview is still loading.");
  return scene.value.capture();
}

function save(): void {
  if (studio.persistenceStatus === "conflict") {
    dialog.value = "settings";
    return;
  }
  if (studio.persistenceStatus === "offline") studio.retrySync();
  try {
    studio.saveLook(makeThumbnail(capture()));
  } catch {
    studio.saveLook();
  }
}

function saveCopy(): void {
  try {
    studio.saveLookAsCopy(makeThumbnail(capture()));
  } catch {
    studio.saveLookAsCopy();
  }
}

function startNewDesign(): void {
  commitName();
  const previousId = studio.document.id;
  studio.newDesign();
  if (previousId === studio.document.id) return;
  lookName.value = studio.document.name;
  tab.value = "garments";
  mobileSheet.value = "library";
  placementMode.value = false;
  scene.value?.reset();
}

async function exportPreview(): Promise<void> {
  studio.clearNotice();
  try {
    const response = await fetch(capture());
    downloadBlob(
      await response.blob(),
      `${safeName(studio.document.name)}.png`,
    );
    notify("Preview exported.");
    dialog.value = null;
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Preview could not be exported.",
    );
  }
}

const reviewBusy = ref(false);
const reviewError = ref("");
const reviewPackage = shallowRef<CreativeReviewPackage | null>(null);
let reviewImage: Blob | null = null;
function openReview(): void {
  reviewPackage.value = null;
  reviewImage = null;
  reviewError.value = "";
  dialog.value = "review";
}
async function prepareReview(note: string, approved: boolean): Promise<void> {
  if (reviewBusy.value) return;
  reviewBusy.value = true;
  reviewError.value = "";
  try {
    const design = JSON.parse(studio.exportLook());
    const revision = studio.revision;
    const response = await fetch(capture());
    const image = await response.blob();
    reviewPackage.value = await createCreativeHandoff(
      design,
      revision,
      image,
      approved,
      note,
    );
    reviewImage = image;
  } catch (error) {
    reviewError.value =
      error instanceof Error
        ? error.message
        : "The review files could not be prepared.";
  } finally {
    reviewBusy.value = false;
  }
}
function downloadReviewImage(): void {
  if (reviewImage && reviewPackage.value)
    downloadBlob(reviewImage, reviewPackage.value.derivative.fileName);
}
function downloadReviewManifest(): void {
  if (reviewPackage.value)
    downloadText(
      JSON.stringify(reviewPackage.value, null, 2),
      reviewPackage.value.derivative.fileName.replace(
        /\.png$/,
        ".ocharo-review.json",
      ),
      "application/json;charset=utf-8",
    );
}

function exportDocument(): void {
  studio.clearNotice();
  downloadText(
    studio.exportLook(),
    `${safeName(studio.document.name)}.ocharo.json`,
    "application/json;charset=utf-8",
  );
  dialog.value = null;
  notify("Editable design exported.");
}

function changeName(name: string): void {
  lookName.value = name;
  if (name.trim()) studio.rename(name);
}

function focusName(): void {
  editingName.value = true;
  studio.beginRename();
}

function commitName(): void {
  editingName.value = false;
  studio.endRename();
  lookName.value = studio.document.name;
}

function goHome(): void {
  commitName();
  void router.push("/");
}

function onReady(api: StudioViewportApi): void {
  scene.value = api;
  ready.value = true;
}

async function deleteLook(id: string, name: string): Promise<void> {
  const accepted = await confirmation.confirm({
    title: "Delete this look?",
    description: `“${name}” will be removed from My looks. This cannot be undone.`,
    confirmLabel: "Delete look",
  });
  if (accepted) studio.deleteLook(id);
}

function openMaterials(id = material.value.id): void {
  commitName();
  void router.push({ path: "/studio/materials", query: { material: id } });
}

function selectEditingMaterial(id: string): void {
  materialDirty.value = false;
  void router.replace({ path: "/studio/materials", query: { material: id } });
}

function confirmMaterialDiscard(): Promise<boolean> {
  return confirmation.confirm({
    title: "Discard material changes?",
    description:
      "Your preview has not been saved. Keep editing or discard these scale changes.",
    confirmLabel: "Discard changes",
    cancelLabel: "Keep editing",
  });
}

function saveMaterial(id: string, scale: number): boolean {
  const saved = studio.saveMaterialScale(id, scale);
  if (saved) materialDirty.value = false;
  return saved;
}

function chooseMaterial(): void {
  tab.value = "materials";
  mobileSheet.value = "library";
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  try {
    if (file) {
      if (file.size > 1024 * 1024)
        notify("Choose a design JSON smaller than 1 MB.");
      else studio.importLook(await file.text());
    }
  } catch {
    notify("The design file could not be read. Try importing it again.");
  } finally {
    input.value = "";
  }
}

function openGuide(): void {
  dialog.value = null;
  onboarding.openGuide();
}

function revealGuide(
  panel: GuidedTourStep["panel"],
  nextTab?: LibraryTab,
): void {
  if (panel) mobileSheet.value = panel;
  if (nextTab) tab.value = nextTab;
}

function safeName(name: string): string {
  return (
    name
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .slice(0, 70) || "ocharo-look"
  );
}

function makeThumbnail(data: string): string {
  const source = document.querySelector<HTMLCanvasElement>(".viewport canvas");
  if (!source) return data;
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = Math.round((240 * source.height) / source.width);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.7);
}

function readOnboarding(value: unknown): OnboardingRecord | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<OnboardingRecord>;
  if (
    !Number.isInteger(candidate.invitations) ||
    candidate.invitations! < 0 ||
    candidate.invitations! > 2
  )
    return undefined;
  if (typeof candidate.hiddenPermanently !== "boolean") return undefined;
  if (
    candidate.lastInvitationAt !== undefined &&
    typeof candidate.lastInvitationAt !== "string"
  )
    return undefined;
  if (
    candidate.completedAt !== undefined &&
    typeof candidate.completedAt !== "string"
  )
    return undefined;
  return candidate as OnboardingRecord;
}
</script>

<template>
  <div :class="['studio-app', { 'material-page-active': materialPage }]">
    <StudioHeader
      :name="lookName"
      :garment-name="garment.name"
      :on-name-change="changeName"
      :on-name-focus="focusName"
      :on-name-commit="commitName"
      :is-dirty="studio.isDirty"
      :persistence-status="studio.persistenceStatus"
      :on-save="save"
      :on-export="() => (dialog = 'export')"
      :on-settings="() => (dialog = 'settings')"
      :on-home="goHome"
      :on-new="startNewDesign"
      :on-materials="() => openMaterials()"
      :material-page="materialPage"
    />
    <MaterialStudioPage
      v-if="materialPage"
      ref="materialEditor"
      :selected-id="editingMaterialId"
      :document="studio.document"
      :looks="studio.looks"
      :library="studio.materials"
      :persistence-status="studio.persistenceStatus"
      :dark="dark"
      :disabled="['loading', 'conflict'].includes(studio.persistenceStatus)"
      :on-select="selectEditingMaterial"
      :on-save="saveMaterial"
      :on-back="() => router.push('/studio')"
      :on-dirty-change="(value) => (materialDirty = value)"
      :confirm-discard="confirmMaterialDiscard"
    />
    <main
      v-show="!materialPage"
      class="workspace"
      :data-sheet-open="mobileSheet"
      aria-label="Ocharo design studio"
    >
      <h1 class="sr-only">Ocharo design studio</h1>
      <section class="scene-area" aria-label="Design canvas">
        <div class="viewport">
          <StudioViewport
            :document="studio.document"
            :initialization-ready="
              !['loading', 'saving'].includes(studio.persistenceStatus)
            "
            :selected-part-id="part.id"
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
        :on-tab-change="(value) => (tab = value)"
        :garment-id="garment.id"
        :materials="materials"
        :material-id="mixedMaterial ? '' : material.id"
        :filter="filter"
        :on-filter-change="(value) => (filter = value)"
        :on-garment="studio.chooseGarment"
        :on-material="studio.applyMaterial"
        :looks="studio.looks"
        :looks-status="studio.looksStatus"
        :reading-looks="studio.refreshingLooks"
        :refreshing-looks="refreshingLooks"
        :on-refresh="refreshLooks"
        :on-open="studio.openLook"
        :on-delete="deleteLook"
        :delete-unavailable-reason="studio.deleteLookUnavailableReason"
        :on-export-recovery="
          () =>
            downloadText(studio.exportRecovery(), 'ocharo-studio-recovery.json')
        "
        :on-save-copy="saveCopy"
        :on-import="() => fileInput?.click()"
      />
      <StudioEditToolbar
        :garment="garment"
        :part-id="part.id"
        :selected-part-ids="studio.selectedPartIds"
        :on-part="studio.setSelectedPartId"
        :can-undo="studio.canUndo"
        :can-redo="studio.canRedo"
        :on-undo="studio.undo"
        :on-redo="studio.redo"
      />
      <StudioInspector
        :garment="garment"
        :part-id="part.id"
        :selected-part-ids="studio.selectedPartIds"
        :mixed-material="mixedMaterial"
        :mixed-placement="mixedPlacement"
        :has-pattern="hasPattern"
        :material="material"
        :placement="placement"
        :placement-mode="placementMode"
        :on-placement-mode="(value) => (placementMode = value)"
        :on-part="studio.setSelectedPartId"
        :on-choose-material="chooseMaterial"
        :on-edit-material="() => openMaterials()"
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
          :class="{ active: mobileSheet === 'canvas' }"
          :aria-pressed="mobileSheet === 'canvas'"
          @click="mobileSheet = 'canvas'"
        >
          Canvas
        </button>
        <button
          :class="{ active: mobileSheet === 'library' }"
          :aria-pressed="mobileSheet === 'library'"
          @click="mobileSheet = 'library'"
        >
          Library
        </button>
        <button
          :class="{ active: mobileSheet === 'inspector' }"
          :aria-pressed="mobileSheet === 'inspector'"
          @click="mobileSheet = 'inspector'"
        >
          Edit part
        </button>
      </div>
      <button
        v-if="onboarding.showLauncher"
        class="guide-launcher island"
        aria-label="Open studio guide"
        @click="onboarding.openGuide"
      >
        <CircleHelp :size="19" /><span>Guide</span>
      </button>
    </main>
    <input
      ref="fileInput"
      type="file"
      accept=".json,.ocharo.json,application/json"
      class="sr-only"
      aria-label="Import design file"
      @change="importFile"
    />
    <ToastHost
      class="studio-toasts"
      position="top-right"
      :default-duration="4500"
      show-progress
    />
    <ExportDialog
      v-if="dialog === 'export'"
      :ready="ready"
      :on-preview="exportPreview"
      :on-render="() => (dialog = 'render')"
      :on-document="exportDocument"
      :on-review="openReview"
      :on-close="() => (dialog = null)"
    />
    <ReviewPackageDialog
      v-if="dialog === 'review'"
      :busy="reviewBusy"
      :prepared="Boolean(reviewPackage)"
      :error="reviewError"
      :on-prepare="prepareReview"
      :on-image="downloadReviewImage"
      :on-manifest="downloadReviewManifest"
      :on-close="() => (dialog = null)"
    />
    <RenderDialog
      v-if="dialog === 'render'"
      :document="studio.document"
      :file-name="safeName(studio.document.name)"
      :on-close="() => (dialog = null)"
    />
    <SettingsDialog
      v-if="dialog === 'settings'"
      :dark="dark"
      :desk-connected="deskConnected"
      :connection-error="connectionError"
      :on-connect="connectDesk"
      :persistence-status="studio.persistenceStatus"
      :on-dark-change="updateDark"
      :on-retry-sync="studio.retrySync"
      :on-resolve-conflict="studio.resolveConflict"
      :on-export-recovery="exportDocument"
      :on-guide="openGuide"
      :on-close="() => (dialog = null)"
    />
    <OnboardingDialog
      v-if="!materialPage && onboarding.isOpen && !onboarding.isGuide"
      :on-start="onboarding.start"
      :on-skip="onboarding.skip"
      :on-close="onboarding.skip"
    />
    <GuidedTour
      v-if="!materialPage && onboarding.isOpen && onboarding.isGuide"
      :open="true"
      :steps="guideSteps"
      :current-step="guideStep"
      :on-open-change="
        (open) => {
          if (!open) onboarding.close();
        }
      "
      :on-step-change="(_step, index) => (guideStep = index)"
      :on-reveal="revealGuide"
      :on-complete="onboarding.complete"
      :on-skip="onboarding.skip"
    />
    <StudioConfirmationDialog
      :request="confirmation.request.value"
      :on-confirm="confirmation.accept"
      :on-cancel="confirmation.cancel"
    />
  </div>
</template>
