<script setup lang="ts">
import GarmentGlyph from "./GarmentGlyph.vue";
import StudioDialog from "./StudioDialog.vue";

/** Introduces the interactive studio walkthrough. */
defineOptions({ name: "OnboardingDialog" });
defineProps<{
  onStart: () => void;
  onSkip: () => void;
  onClose: () => void;
}>();
</script>
<template>
  <StudioDialog title="Welcome to Ocharo Studio." :on-close="onClose">
    <div class="welcome-story">
      <div class="welcome-art" aria-hidden="true">
        <GarmentGlyph id="nimcha" /><span class="welcome-swatch" /><span
          class="welcome-orb"
        />
      </div>
      <div class="welcome-copy">
        <span class="eyebrow">YOUR STORY BEGINS HERE</span>
        <p>
          Choose a silhouette, find the heart of a textile, and save a look that
          feels like yours.
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
    </div></StudioDialog
  >
</template>
