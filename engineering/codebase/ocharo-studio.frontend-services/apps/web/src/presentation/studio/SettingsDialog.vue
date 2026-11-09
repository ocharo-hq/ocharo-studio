<script setup lang="ts">
import {
  BookOpen,
  CloudOff,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import { Button } from "@wow-two-beta/fe/presentation/actions";
import {
  Modal,
  ModalContent,
  ModalTitle,
} from "@wow-two-beta/fe/presentation/overlays";

/**
 * The Ocharo sign-in, sync recovery and the guide. Appearance, the Ocharo account, reconnect and sign-out live in
 * the frame's account menu.
 */
defineOptions({ name: "SettingsDialog" });
defineProps<{
  signedIn?: boolean;
  authUnavailable?: boolean;
  connectionError?: string;
  onSignIn?: () => void;
  persistenceStatus: "loading" | "saving" | "synced" | "offline" | "conflict";
  onRetrySync: () => void;
  onResolveConflict: () => void;
  onExportRecovery: () => void;
  onGuide: () => void;
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
        <ModalTitle>Studio settings</ModalTitle>
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
      <div class="settings-list">
        <section
          class="sync-recovery desk-connection"
          aria-label="Ocharo sign-in"
        >
          <div>
            <strong>{{
              signedIn
                ? "Signed in with your Ocharo account"
                : "Designs stay in this browser"
            }}</strong>
            <p v-if="signedIn">
              Your Ocharo account connects this workspace. The account menu
              holds reconnect and sign out.
            </p>
            <p v-if="connectionError" role="alert">{{ connectionError }}</p>
            <template v-if="!signedIn && !authUnavailable">
              <p>Sign in to save your designs to your workspace.</p>
              <button class="button secondary" @click="onSignIn?.()">
                Sign in
              </button>
            </template>
          </div>
        </section>
        <div
          v-if="persistenceStatus === 'offline'"
          class="sync-recovery"
          role="status"
        >
          <CloudOff :size="20" /><span
            ><strong>Changes are stored on this device.</strong
            ><small>Reconnect, then retry server sync.</small></span
          ><button class="button secondary" @click="onRetrySync">
            <RefreshCw :size="15" /> Retry
          </button>
        </div>
        <div
          v-if="persistenceStatus === 'conflict'"
          class="sync-recovery"
          role="alert"
        >
          <TriangleAlert :size="20" /><span
            ><strong>The server has another version.</strong
            ><small>Download your current work before loading it.</small></span
          >
          <div class="sync-recovery-actions">
            <button class="button secondary" @click="onExportRecovery">
              Download recovery</button
            ><button class="button primary" @click="onResolveConflict">
              Load server version
            </button>
          </div>
        </div>
        <button class="settings-row" @click="onGuide">
          <BookOpen :size="20" /><span
            ><strong>Open studio guide</strong
            ><small>Replay the getting-started walkthrough.</small></span
          >
        </button>
      </div>
    </ModalContent>
  </Modal>
</template>
