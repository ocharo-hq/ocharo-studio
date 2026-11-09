<script setup lang="ts">
import {
  AlertModal,
  AlertModalAction,
  AlertModalCancel,
  AlertModalContent,
  ModalDescription,
  ModalFooter,
  ModalTitle,
} from "@wow-two-beta/fe/presentation/overlays";
import type { StudioConfirmation } from "./UseStudioConfirmation";

/** Renders the one Studio confirmation a `useStudioConfirmation` host asks, and settles it on accept or cancel. */
defineOptions({ name: "StudioConfirmationModal" });
defineProps<{ confirmation: StudioConfirmation }>();
</script>

<template>
  <AlertModal
    :open="confirmation.request.value !== null"
    :can-dismiss-on-escape="true"
    @update:open="(open) => !open && confirmation.cancel()"
  >
    <AlertModalContent
      v-if="confirmation.request.value"
      class="studio-confirmation-modal"
      :is-blurred="true"
      radius="lg"
      padding="xl"
      :elevation="4"
      phone-layout="card"
    >
      <ModalTitle class="studio-confirmation-title">
        {{ confirmation.request.value.title }}
      </ModalTitle>
      <ModalDescription class="studio-confirmation-description">
        {{ confirmation.request.value.description }}
      </ModalDescription>
      <ModalFooter class="studio-confirmation-actions">
        <AlertModalCancel class="button secondary" @click="confirmation.cancel">
          {{ confirmation.request.value.cancelLabel ?? "Cancel" }}
        </AlertModalCancel>
        <AlertModalAction
          class="button confirmation-danger"
          @action="confirmation.accept"
        >
          {{ confirmation.request.value.confirmLabel }}
        </AlertModalAction>
      </ModalFooter>
    </AlertModalContent>
  </AlertModal>
</template>
