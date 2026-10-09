<script setup lang="ts">
import { ref } from "vue";
import {
  BookOpen,
  CloudOff,
  Moon,
  RefreshCw,
  Sun,
  TriangleAlert,
} from "@lucide/vue";
import StudioDialog from "./StudioDialog.vue";

/** Theme, guide, and persistence recovery settings. */
defineOptions({ name: "SettingsDialog" });
defineProps<{
  dark: boolean;
  deskConnected?: boolean;
  ssoEnabled?: boolean;
  accountUrl?: string;
  authUnavailable?: boolean;
  onSignIn?: () => void;
  connectionError?: string;
  onConnect?: (ticket: string | null) => void;
  persistenceStatus: "loading" | "saving" | "synced" | "offline" | "conflict";
  onDarkChange: (dark: boolean) => void;
  onRetrySync: () => void;
  onResolveConflict: () => void;
  onExportRecovery: () => void;
  onGuide: () => void;
  onClose: () => void;
}>();
const ticket = ref("");
</script>
<template>
  <StudioDialog title="Studio settings" :on-close="onClose"
    ><div class="settings-list">
      <section
        class="sync-recovery desk-connection"
        aria-label="Ocharo Desk connection"
      >
        <div>
          <strong>{{
            deskConnected
              ? "Connected through Ocharo Desk"
              : "Designs stay in this browser"
          }}</strong>
          <p v-if="ssoEnabled">
            Your Ocharo account connects this workspace. Manage your account and
            sign out in Ocharo Desk.
          </p>
          <a
            v-if="ssoEnabled && accountUrl"
            :href="accountUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="button secondary"
            >Ocharo account</a
          >
          <button v-if="ssoEnabled" class="button secondary" @click="onSignIn">
            Reconnect with Ocharo
          </button>
          <p v-if="connectionError" role="alert">{{ connectionError }}</p>
          <template v-if="!ssoEnabled && !authUnavailable">
            <p>
              Open Studio from your Desk workspace to save securely. A
              connection expires after five minutes.
            </p>
            <label for="desk-ticket">Desk connection ticket</label>
            <input
              id="desk-ticket"
              v-model="ticket"
              type="password"
              autocomplete="off"
              placeholder="Paste a short-lived ticket"
            />
            <button
              class="button secondary"
              :disabled="!ticket.trim()"
              @click="
                () => {
                  onConnect?.(ticket);
                  ticket = '';
                }
              "
            >
              Connect and sync this design
            </button>
            <button
              v-if="deskConnected"
              class="button secondary"
              @click="onConnect?.(null)"
            >
              Use browser only
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
      <button class="settings-row" @click="onDarkChange(!dark)">
        <component :is="dark ? Sun : Moon" :size="20" /><span
          ><strong>{{ dark ? "Use light theme" : "Use dark theme" }}</strong
          ><small>Change the studio appearance.</small></span
        ></button
      ><button class="settings-row" @click="onGuide">
        <BookOpen :size="20" /><span
          ><strong>Open studio guide</strong
          ><small>Replay the getting-started walkthrough.</small></span
        >
      </button>
    </div></StudioDialog
  >
</template>
