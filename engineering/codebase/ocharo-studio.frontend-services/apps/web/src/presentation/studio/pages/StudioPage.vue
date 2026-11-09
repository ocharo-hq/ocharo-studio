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
import { useRefresh } from "@wow-two-beta/fe/query";
import { useNavigationBlocker } from "@wow-two-beta/fe/router";
import {
  TailwindBreakpoints,
  useBreakpoint,
} from "@wow-two-beta/fe/foundation/device";
import { downloadBlob, downloadText } from "@wow-two-beta/fe/foundation/files";
import {
  ColorMode,
  useColorMode,
} from "@wow-two-beta/fe/foundation/primitives";
import { useToastHost } from "@wow-two-beta/fe/presentation/feedback/toast-host";
import { FeedbackToastHost } from "@wow-two-beta/fe/presentation/feedback";
import {
  feedbackBus,
  feedbackSessionExpiry,
  SessionExpiredNotice,
} from "@wow-two-beta/fe/feedback";

import {
  readOnboarding,
  useStudioOnboarding,
  type OnboardingRecord,
} from "../../../application/studio/hooks/UseStudioOnboarding";
import { useCreativeReview } from "../../../application/studio/hooks/UseCreativeReview";
import { useSessionExpiry } from "../../../application/studio/hooks/UseSessionExpiry";
import { useStudio } from "../../../application/studio/hooks/UseStudio";
import { useStudioAccount } from "../../../application/studio/hooks/UseStudioAccount";
import type { StudioViewportApi } from "../../../application/studio/hooks/UseStudioViewport";
import {
  getAvailableMaterials,
  getGarment,
  getMaterial,
  isMaterialApplicable,
  MATERIALS,
  type TexturePlacement,
} from "../../../domain/studio";
import ReviewPackageDialog from "../ReviewPackageDialog.vue";
import ExportDialog from "../ExportDialog.vue";
import RenderDialog from "../RenderDialog.vue";
import OnboardingDialog from "../OnboardingDialog.vue";
import SettingsDialog from "../SettingsDialog.vue";
import StudioBarControls from "../StudioBarControls.vue";
import DesignerView, { type DesignerSheet } from "../DesignerView.vue";
import type { LibraryTab } from "../StudioLibrary.vue";
import GuidedTour, { type GuidedTourStep } from "../GuidedTour.vue";
import { studioGuideSteps } from "../StudioGuideSteps";
import "../StudioIteration.css";
import MaterialStudioPage from "../materials/MaterialStudioPage.vue";
import StudioConfirmationModal from "../StudioConfirmationModal.vue";
import { useStudioConfirmation } from "../UseStudioConfirmation";
import { seedColorMode } from "../../common/ColorModeSeed";
import { StudioFrameBarId, useStudioFrame } from "../../common/StudioFrame";

/**
 * Renders the Designer and Material Studio places inside the Ocharo frame: the places' presentation controls, the
 * persistence-aware user actions, and what the frame borrows — settings, notices and the unsaved-work hold.
 */
defineOptions({ name: "StudioPage" });

const account = useStudioAccount();
const connectionError = account.unavailable
  ? "The account session could not be checked. Refresh to reconnect."
  : account.signInFailed
    ? "Sign-in did not complete. Your designs stay in this browser."
    : undefined;
const signedIn = computed(() => account.session.value.authenticated);
useSessionExpiry(
  feedbackSessionExpiry(feedbackBus, {
    ...SessionExpiredNotice,
    description:
      "Your designs stay in this browser. Sign in again to sync them.",
  }),
);
const studio = useStudio();
const { refresh: refreshLooks, refreshing: refreshingLooks } = useRefresh(
  studio.refreshLooks,
);
/** Leaves for the Ocharo sign-in unless unsaved or in-flight work must finish first. */
function signIn(): void {
  if (materialDirty.value || studio.persistenceStatus === "saving")
    return notify("Finish saving your work before signing in.");
  account.signIn();
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
const colorMode = useColorMode();
const breakpoint = useBreakpoint(TailwindBreakpoints);
/** Phones keep the look name above the canvas; the frame's top bar holds it from tablets up. */
const isPhone = computed(() => ["sm", null].includes(breakpoint.value));
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
const mobileSheet = ref<DesignerSheet>("library");
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
const dark = computed(() => colorMode.mode === ColorMode.Dark);
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
// The colour mode is the provider's; a design's synced or recovered `dark` only seeds a browser that stores none.
watch(
  () => studio.settings.dark,
  (value) => seedColorMode(value, colorMode),
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
useStudioFrame({
  openSettings: () => {
    dialog.value = "settings";
  },
  holdSession: (change) =>
    materialDirty.value || studio.persistenceStatus === "saving"
      ? change === "reconnect"
        ? "Finish saving your work before reconnecting."
        : "Finish saving your work before signing out."
      : null,
  notify: (message) => notify(message),
});
onMounted(() => window.addEventListener("keydown", onKeyboard));
onScopeDispose(() => window.removeEventListener("keydown", onKeyboard));

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

const {
  busy: reviewBusy,
  error: reviewError,
  reviewPackage,
  reset: resetReview,
  prepare: prepareReview,
  downloadImage: downloadReviewImage,
  downloadManifest: downloadReviewManifest,
} = useCreativeReview({
  exportLook: () => studio.exportLook(),
  get revision() {
    return studio.revision;
  },
  capture,
});
function openReview(): void {
  resetReview();
  dialog.value = "review";
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

/** A saved look's 240×180 thumbnail, filled from the centre of the viewport, so a wide or short viewport (a narrow
 * window, an open sheet) still frames the garment instead of leaving a thin strip. */
function makeThumbnail(data: string): string {
  const source = document.querySelector<HTMLCanvasElement>(".viewport canvas");
  if (!source || !source.width || !source.height) return data;
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 180;
  const scale = Math.max(
    canvas.width / source.width,
    canvas.height / source.height,
  );
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  canvas
    .getContext("2d")
    ?.drawImage(
      source,
      (source.width - width) / 2,
      (source.height - height) / 2,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  return canvas.toDataURL("image/webp", 0.7);
}
</script>

<template>
  <div :class="['studio-app', { 'material-page-active': materialPage }]">
    <Teleport defer :to="`#${StudioFrameBarId}`">
      <StudioBarControls
        v-if="!materialPage"
        :name="lookName"
        :garment-name="garment.name"
        :show-name="!isPhone"
        :on-name-change="changeName"
        :on-name-focus="focusName"
        :on-name-commit="commitName"
        :is-dirty="studio.isDirty"
        :persistence-status="studio.persistenceStatus"
        :on-save="save"
        :on-export="() => (dialog = 'export')"
        :on-recover="() => (dialog = 'settings')"
        :on-new="startNewDesign"
      />
    </Teleport>
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
      :on-dirty-change="(value) => (materialDirty = value)"
      :confirm-discard="confirmMaterialDiscard"
    />
    <DesignerView
      v-show="!materialPage"
      :studio="studio"
      :garment="garment"
      :part-id="part.id"
      :material="material"
      :materials="materials"
      :mixed-material="mixedMaterial"
      :mixed-placement="mixedPlacement"
      :has-pattern="hasPattern"
      :placement="placement"
      :look-name="lookName"
      :is-phone="isPhone"
      :dark="dark"
      :scene="scene"
      :tab="tab"
      :filter="filter"
      :sheet="mobileSheet"
      :placement-mode="placementMode"
      :refreshing-looks="refreshingLooks"
      :show-guide-launcher="onboarding.showLauncher"
      :on-name-change="changeName"
      :on-name-focus="focusName"
      :on-name-commit="commitName"
      :on-ready="onReady"
      :on-tab-change="(value) => (tab = value)"
      :on-filter-change="(value) => (filter = value)"
      :on-sheet-change="(value) => (mobileSheet = value)"
      :on-placement-mode="(value) => (placementMode = value)"
      :on-refresh-looks="refreshLooks"
      :on-delete-look="deleteLook"
      :on-export-recovery="
        () =>
          downloadText(studio.exportRecovery(), 'ocharo-studio-recovery.json')
      "
      :on-save-copy="saveCopy"
      :on-import="() => fileInput?.click()"
      :on-choose-material="chooseMaterial"
      :on-edit-material="() => openMaterials()"
      :on-open-guide="onboarding.openGuide"
    />
    <input
      ref="fileInput"
      type="file"
      accept=".json,.ocharo.json,application/json"
      class="sr-only"
      aria-label="Import design file"
      @change="importFile"
    />
    <FeedbackToastHost
      class="studio-toasts"
      :default-duration="4500"
      timer="bar"
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
      :signed-in="signedIn"
      :auth-unavailable="account.unavailable"
      :connection-error="connectionError"
      :on-sign-in="signIn"
      :persistence-status="studio.persistenceStatus"
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
    <StudioConfirmationModal :confirmation="confirmation" />
  </div>
</template>
