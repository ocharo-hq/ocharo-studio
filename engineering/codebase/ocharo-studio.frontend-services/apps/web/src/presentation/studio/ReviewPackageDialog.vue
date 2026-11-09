<script setup lang="ts">
import { ref } from "vue";
import { Download, PackageCheck, X } from "lucide-vue-next";
import { Button } from "@wow-two-beta/fe/presentation/actions";
import {
  Modal,
  ModalContent,
  ModalTitle,
} from "@wow-two-beta/fe/presentation/overlays";

defineOptions({ name: "ReviewPackageDialog" });
defineProps<{
  busy: boolean;
  prepared: boolean;
  error: string;
  onPrepare: (note: string, approved: boolean) => void;
  onImage: () => void;
  onManifest: () => void;
  onClose: () => void;
}>();
const approved = ref(false);
const note = ref("");
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
        <ModalTitle>Send a look for review</ModalTitle>
        <Button
          class="icon-button"
          variant="ghost"
          shape="square"
          aria-label="Close dialog"
          title="Close dialog"
          @click="onClose"
        >
          <X :size="18" />
        </Button>
      </div>
      <p>
        This is a creative visualization, not a photograph of a finished
        product.
      </p>
      <p>
        Ocharo Desk reviews product use. Marketing reviews editorial use.
        Neither download publishes anything.
      </p>
      <label for="review-note">Notes for the reviewer</label>
      <textarea
        class="review-package-note"
        id="review-note"
        v-model="note"
        maxlength="1000"
        rows="3"
        :disabled="busy || prepared"
        placeholder="Describe the idea and what should be reviewed."
      />
      <label class="review-approval">
        <input
          v-model="approved"
          type="checkbox"
          :disabled="busy || prepared"
        />
        I have reviewed this design and want to submit it for review.
      </label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button
        v-if="!prepared"
        class="button primary review-file-action"
        :disabled="!approved || busy"
        @click="onPrepare(note, approved)"
      >
        <PackageCheck :size="18" />
        {{ busy ? "Preparing…" : "Prepare review files" }}
      </button>
      <template v-else>
        <p role="status">
          Ready. Import both matching files in Ocharo Desk or Marketing.
        </p>
        <button class="button primary review-file-action" @click="onImage">
          <Download :size="18" /> Download PNG
        </button>
        <button class="button secondary review-file-action" @click="onManifest">
          <Download :size="18" /> Download review manifest
        </button>
      </template>
    </ModalContent>
  </Modal>
</template>
