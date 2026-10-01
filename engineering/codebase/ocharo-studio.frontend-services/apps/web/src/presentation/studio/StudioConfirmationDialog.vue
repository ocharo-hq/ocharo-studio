<script setup lang="ts">
import {
  AlertModal,
  AlertModalAction,
  AlertModalCancel,
  AlertModalContent,
  ModalDescription,
  ModalFooter,
  ModalTitle,
} from "@wow-two-beta/ui-vue";

import type { StudioConfirmationRequest } from "./UseStudioConfirmation";

/** Renders a blurred, focus-trapped confirmation through the shared Vue SDK. */
defineOptions({ name: "StudioConfirmationDialog" });
defineProps<{
  request: StudioConfirmationRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}>();
</script>

<template>
  <AlertModal
    :open="request !== null"
    :dismiss-on-escape="true"
    @update:open="(open) => !open && onCancel()"
  >
    <AlertModalContent
      v-if="request"
      class="studio-confirmation-modal"
      :is-blurred="true"
      radius="lg"
      padding="xl"
      :elevation="4"
    >
      <ModalTitle class="studio-confirmation-title">
        {{ request.title }}
      </ModalTitle>
      <ModalDescription class="studio-confirmation-description">
        {{ request.description }}
      </ModalDescription>
      <ModalFooter class="studio-confirmation-actions">
        <AlertModalCancel class="button secondary" @click="onCancel">
          {{ request.cancelLabel ?? "Cancel" }}
        </AlertModalCancel>
        <AlertModalAction
          class="button confirmation-danger"
          @action="onConfirm"
        >
          {{ request.confirmLabel }}
        </AlertModalAction>
      </ModalFooter>
    </AlertModalContent>
  </AlertModal>
</template>
