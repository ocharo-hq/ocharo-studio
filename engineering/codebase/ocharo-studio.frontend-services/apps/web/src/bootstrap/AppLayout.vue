<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import { ExternalLink, RefreshCw, Settings } from "@lucide/vue";
import {
  TailwindBreakpoints,
  useBreakpoint,
} from "@wow-two-beta/fe/foundation/device";
import {
  localStorageStorageBroker,
  usePersistentState,
} from "@wow-two-beta/fe/foundation/storage";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from "@wow-two-beta/fe/presentation/layout";
import {
  AccountMenu,
  AppSwitcherKind,
  AppSwitcherMenu,
  MenuItem,
  type AccountMenuVersion,
  type AppSwitcherItem,
} from "@wow-two-beta/fe/presentation/nav";

import { useBuildIdentity } from "../application/common/UseBuildIdentity";
import { useOcharoApps } from "../application/common/UseOcharoApps";
import { useStudioAccount } from "../application/studio/UseStudioAccount";
import { OcharoAppKind } from "../domain/common/OcharoApps";
import { readStudioSection } from "../domain/common/StudioSections";
import { AppIcons } from "../presentation/frame/ShellIcons";
import StudioNav from "../presentation/frame/StudioNav.vue";
import StudioSectionMenu from "../presentation/frame/StudioSectionMenu.vue";
import {
  provideStudioFrame,
  StudioFrameBarId,
  type StudioSessionChange,
} from "./StudioFrame";

/** The sidebar's widths: full, and the icon rail. @internal */
const SidebarWidth = { Full: "244px", Rail: "68px" } as const;
/** Where this browser remembers the sidebar's rail choice; the rail is the default. @internal */
const SidebarCollapsedKey = "ocharo-studio.sidebar-collapsed";

/**
 * The Ocharo frame, as Studio wears it, around the Designer and Materials places. One glass top bar carries the suite's
 * app button with the app version, the open place's own controls and the account menu. The sidebar is Studio's two
 * places as an icon rail by default, expandable on desktops; phones hide it and switch places from the top bar, with no
 * bottom bar. Only the main region scrolls.
 */
defineOptions({ name: "AppLayout" });
const route = useRoute();
const place = provideStudioFrame();
const account = useStudioAccount();
const { backendVersion, refresh: refreshBackendVersion } = useBuildIdentity();
const apps = useOcharoApps();
const appVersion = __APP_VERSION__;
// The stored choice seeds the first render too, so an expanded sidebar never animates out of the rail.
const collapsed = usePersistentState(
  SidebarCollapsedKey,
  localStorageStorageBroker.read<boolean>(SidebarCollapsedKey) !== false,
);
const breakpoint = useBreakpoint(TailwindBreakpoints);

const isDesktop = computed(() =>
  ["lg", "xl", "2xl"].includes(breakpoint.value ?? ""),
);
const isPhone = computed(() => ["sm", null].includes(breakpoint.value));
const isRail = computed(() => !isDesktop.value || collapsed.value.value);
const sidebarWidth = computed(() =>
  isRail.value ? SidebarWidth.Rail : SidebarWidth.Full,
);
const section = computed(() => readStudioSection(route.meta));
const items = computed<AppSwitcherItem[]>(() =>
  apps.map((app) => ({
    key: app.key,
    label: app.label,
    description: app.summary,
    href: app.url,
    icon: AppIcons[app.key],
    kind:
      app.kind === OcharoAppKind.Workspace
        ? AppSwitcherKind.App
        : AppSwitcherKind.Site,
  })),
);

/** Who is signed in, the account rows and sign-out exist only with an Ocharo session; a local run has none. */
const ssoEnabled = computed(() => account.session.value.enabled);
const signedIn = computed(
  () =>
    account.session.value.enabled &&
    account.session.value.authenticated &&
    Boolean(account.session.value.csrfToken),
);
const accountOpen = ref(false);
/** The operator's Desk name and email head the menu; without an email it says where they signed in. */
const accountIdentity = computed(() => {
  if (!signedIn.value) return {};
  const { name, email } = account.session.value;
  return {
    ...(name ? { name } : {}),
    description: email ?? "Signed in through Ocharo Desk",
    onSignOut: signOut,
  };
});
/** The app's own version, then the API's from its status, with the commit the build carries split off. */
const versions = computed<AccountMenuVersion[]>(() => {
  const [api = "", commit] = backendVersion.value.split("+");
  return [
    { label: "Studio", version: appVersion },
    { label: "API", version: api, ...(commit ? { commit } : {}) },
  ];
});
watch(accountOpen, (open) => {
  if (open) void refreshBackendVersion();
});

/** True when the open place's unsaved or in-flight work must finish first; the place shows why. */
function held(change: StudioSessionChange): boolean {
  const reason = place.value?.holdSession(change) ?? null;
  if (reason) place.value?.notify(reason);
  return reason !== null;
}
function reconnect(): void {
  if (!held("reconnect")) account.signIn();
}
async function signOut(): Promise<void> {
  if (held("sign-out")) return;
  const ended = await account.signOut();
  place.value?.notify(
    ended
      ? "Signed out of Studio. Your designs stay in this browser."
      : "Could not sign out. Try again.",
  );
}
</script>

<template>
  <AppShell
    class="studio-frame surface-ambient transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none"
    sidebar-breakpoint="md"
    :sidebar-width="sidebarWidth"
  >
    <AppShellHeader
      height="auto"
      variant="glass"
      class="p-0 pt-[env(safe-area-inset-top)]"
    >
      <div
        class="studio-frame-bar flex min-h-(--frame-bar-height) w-full min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-4"
      >
        <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AppSwitcherMenu
            :items="items"
            current="studio"
            label="Studio"
            subtitle="Ocharo"
            title="Ocharo apps"
            sites-label="Public sites"
            close-label="Close"
            new-tab-label="(opens in a new tab)"
            trigger-label="Ocharo apps — Studio"
            variant="glass-menu"
            class="max-sm:gap-1.5 max-sm:[&>span:not([data-app-switcher-mark])]:sr-only [&[data-state=open]_[data-app-switcher-chevron]]:text-primary-soft-foreground"
          >
            <template #mark><span class="oc-mark">O</span></template>
          </AppSwitcherMenu>
          <span
            class="font-mono text-[11px] text-muted-foreground max-[359px]:hidden"
            title="App version"
            >{{ appVersion }}</span
          >
          <StudioSectionMenu v-if="isPhone" :current="section" />
        </div>
        <div
          :id="StudioFrameBarId"
          class="flex min-w-0 flex-1 items-center gap-1 sm:gap-2 md:border-s md:border-border md:ps-3"
        />
        <AccountMenu
          v-model:open="accountOpen"
          v-bind="accountIdentity"
          :versions="versions"
          :is-busy="account.signingOut.value"
          variant="glass-menu"
          class="max-sm:[&_[data-account-menu-chevron]]:hidden"
        >
          <template #items>
            <MenuItem v-if="place" @select="place.openSettings()"
              ><Settings :size="15" class="shrink-0" aria-hidden="true" />Studio
              settings</MenuItem
            >
            <!-- Desk's account page opens in another tab, so unsaved edits here stay. -->
            <MenuItem
              v-if="ssoEnabled && account.session.value.accountUrl"
              :href="account.session.value.accountUrl"
              target="_blank"
              ><ExternalLink
                :size="15"
                class="shrink-0"
                aria-hidden="true"
              />Ocharo account</MenuItem
            >
            <MenuItem v-if="ssoEnabled" @select="reconnect"
              ><RefreshCw
                :size="15"
                class="shrink-0"
                aria-hidden="true"
              />Reconnect with Ocharo</MenuItem
            >
          </template>
        </AccountMenu>
      </div>
    </AppShellHeader>
    <AppShellSidebar variant="glass">
      <StudioNav
        :current="section"
        :collapsed="isRail"
        :can-toggle="isDesktop"
        @toggle="collapsed.setValue((previous) => !previous)"
      />
    </AppShellSidebar>
    <AppShellMain class="studio-main min-w-0 [scrollbar-gutter:auto]">
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
        <p v-else class="frame-loading" role="status" aria-busy="true">
          Opening Ocharo Studio…
        </p>
      </RouterView>
    </AppShellMain>
  </AppShell>
</template>
