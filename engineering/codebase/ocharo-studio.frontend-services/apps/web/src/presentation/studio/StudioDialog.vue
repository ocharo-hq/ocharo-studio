<script setup lang="ts">
import { Modal, ModalContent, ModalTitle } from "@wow-two-beta/fe";
import { X } from "@lucide/vue";
import IconButton from "./IconButton.vue";

/** SDK modal shell shared by studio dialogs. */
defineOptions({ name: "StudioDialog" });
defineProps<{ title: string; onClose: () => void }>();
</script>

<template>
  <Modal
    :open="true"
    :can-dismiss-on-outside-click="true"
    :can-dismiss-on-escape="true"
    @update:open="(open) => !open && onClose()"
  >
    <ModalContent class="studio-dialog" :is-blurred="true" phone-layout="card">
      <div class="dialog-title">
        <ModalTitle>{{ title }}</ModalTitle>
        <IconButton :icon="X" label="Close dialog" :on-click="onClose" />
      </div>
      <slot />
    </ModalContent>
  </Modal>
</template>
