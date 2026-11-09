<script setup lang="ts">
import { X } from "lucide-vue-next";
import { Button } from "@wow-two-beta/fe/presentation/actions";
import {
  Modal,
  ModalContent,
  ModalTitle,
} from "@wow-two-beta/fe/presentation/overlays";
import GarmentGlyph from "./GarmentGlyph.vue";

/** Introduces the interactive studio walkthrough. */
defineOptions({ name: "OnboardingDialog" });
defineProps<{
  onStart: () => void;
  onSkip: () => void;
  onClose: () => void;
}>();
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
        <ModalTitle>Welcome to Ocharo Studio.</ModalTitle>
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
      <div class="welcome-story">
        <div class="welcome-art" aria-hidden="true">
          <GarmentGlyph id="nimcha" /><span class="welcome-swatch" /><span
            class="welcome-orb"
          />
        </div>
        <div class="welcome-copy">
          <span class="eyebrow">YOUR STORY BEGINS HERE</span>
          <p>
            Choose a silhouette, find the heart of a textile, and save a look
            that feels like yours.
          </p>
          <div class="story-chapters">
            <span><b>01</b> Choose</span><span><b>02</b> Place</span
            ><span><b>03</b> Keep</span>
          </div>
          <div class="onboarding-actions">
            <button class="button primary" @click="onStart">Start</button
            ><button class="button secondary" @click="onSkip">Skip</button>
          </div>
        </div>
      </div>
    </ModalContent>
  </Modal>
</template>
