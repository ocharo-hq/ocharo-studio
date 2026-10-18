<script lang="ts">
import type { LibraryTab } from "./StudioLibrary.vue";
import type {
  Placement,
  TourPopoverStep,
} from "@wow-two-beta/fe/presentation/overlays/tour-popover";

export interface GuidedTourStep extends TourPopoverStep {
  readonly id: string;
  readonly panel?: "canvas" | "library" | "inspector";
  readonly tab?: LibraryTab;
  readonly placement?: Placement;
}
</script>

<script setup lang="ts">
import { watch } from "vue";
import { TourPopover } from "@wow-two-beta/fe/presentation/overlays/tour-popover";

/** Product tour content adapter over the reusable SDK spotlight behavior. */
defineOptions({ name: "GuidedTour" });
const props = defineProps<{
  open: boolean;
  steps: readonly GuidedTourStep[];
  currentStep: number;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: GuidedTourStep, index: number) => void;
  onReveal: (panel: GuidedTourStep["panel"], tab?: LibraryTab) => void;
  onTaskComplete?: (step: GuidedTourStep, index: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}>();

watch(
  [() => props.open, () => props.currentStep],
  ([open, index]) => {
    const step = props.steps[index];
    if (!open || !step) return;
    props.onReveal(step.panel, step.tab);
    props.onStepChange(step, index);
  },
  { immediate: true },
);
function changeStep(index: number) {
  const step = props.steps[index];
  if (step) props.onStepChange(step, index);
}
function completeTask(index: number) {
  const step = props.steps[index];
  if (step) props.onTaskComplete?.(step, index);
}
</script>

<template>
  <TourPopover
    :open="open"
    :steps="steps"
    :current-step="currentStep"
    @update:open="onOpenChange"
    @update:current-step="changeStep"
    @task-complete="completeTask"
    @complete="onComplete"
    @skip="onSkip"
  />
</template>
