<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import { RefreshCw, Settings } from "lucide-vue-next";
import { useRunningVersion } from "@wow-two-beta/fe/foundation/net";
import {
  AppFrame,
  type AppFrameAccount,
  type AppFrameSwitcher,
} from "@wow-two-beta/fe/presentation/layout";
import {
  AppSwitcherKind,
  MenuItem,
  type AccountMenuVersion,
  type AppSwitcherItem,
} from "@wow-two-beta/fe/presentation/nav";

import { useBuildIdentity } from "../application/common/UseBuildIdentity";
import { useOcharoApps } from "../application/common/UseOcharoApps";
import { useStudioAccount } from "../application/studio/hooks/UseStudioAccount";
import { OcharoAppKind } from "../domain/common/OcharoApps";
import { readStudioSection } from "../domain/common/StudioSections";
import { AppIcons } from "../presentation/frame/ShellIcons";
import StudioHomeLink from "../presentation/frame/StudioHomeLink.vue";
import StudioNav from "../presentation/frame/StudioNav.vue";
import {
  provideStudioFrame,
  StudioFrameBarId,
  type StudioSessionChange,
} from "../presentation/common/StudioFrame";

/** Where this browser remembers the sidebar's rail choice; the key predates the shared frame. @internal */
const SidebarCollapsedKey = "ocharo-studio.sidebar-collapsed";

/**
 * Studio inside the frame every Ocharo app shares (the fe sdk's `AppFrame`), around the Designer and Materials places.
 * The bar, the sidebar and the main region are the suite's, at one size in every app; Studio passes what is its own:
 * the app list, its two places as an icon rail by default, the open place's controls in the bar, and the account.
 * Phones open the places from the frame's drawer, with no bottom bar. The page runs edge to edge and only the main
 * region scrolls.
 */
defineOptions({ name: "AppLayout" });
const route = useRoute();
const place = provideStudioFrame();
const account = useStudioAccount();
const {
  backendVersion,
  refresh: refreshBackendVersion,
  readRunningVersion,
} = useBuildIdentity();
const apps = useOcharoApps();
const appVersion = __APP_VERSION__;
// The badge beside the app button follows the release the API serves; a local build has no release to compare.
const { version: runningVersion } = useRunningVersion(() =>
  appVersion === "dev" ? null : readRunningVersion(),
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
/** The app menu's own phrases. */
const switcher: AppFrameSwitcher = {
  title: "Ocharo apps",
  sitesLabel: "Public sites",
  closeLabel: "Close",
  newTabLabel: "(opens in a new tab)",
  triggerLabel: "Ocharo apps — Studio",
};

/** Who is signed in; the account rows and sign-out exist only with an Ocharo session, and anonymous visitors see Sign in. */
const signedIn = computed(
  () =>
    account.session.value.authenticated &&
    Boolean(account.session.value.csrfToken),
);
const accountOpen = ref(false);
/** The person's picture, name and email head the menu; without an email it says where they signed in. */
const accountIdentity = computed(() => {
  if (!signedIn.value) return {};
  const { name, email, picture } = account.session.value;
  return {
    ...(name ? { name } : {}),
    // The avatar shows the person's initials until the picture loads, or when there is none.
    avatarSrc: picture ?? null,
    description: email ?? "Signed in with your Ocharo account",
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
/** The account menu: who is signed in, the versions, and sign-out while it runs. */
const accountMenu = computed<AppFrameAccount>(() => ({
  ...accountIdentity.value,
  versions: versions.value,
  isBusy: account.signingOut.value,
}));
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
  <AppFrame
    v-model:account-open="accountOpen"
    class="studio-frame"
    :version="appVersion"
    :running-version="runningVersion"
    :apps="items"
    current-app="studio"
    app-label="Studio"
    app-subtitle="Ocharo"
    :app-switcher="switcher"
    :account="accountMenu"
    :collapse-storage-key="SidebarCollapsedKey"
    is-collapsed-by-default
    content-width="full"
    bar-class="max-sm:[&_[data-account-menu-chevron]]:hidden"
    main-class="studio-main [scrollbar-gutter:auto]"
  >
    <template #brand><span class="oc-mark">O</span></template>
    <template #nav="{ isRail }"
      ><StudioNav :current="section" :collapsed="isRail"
    /></template>
    <template #nav-footer="{ isRail }"
      ><StudioHomeLink :collapsed="isRail"
    /></template>
    <!-- The open place teleports its own controls here; the target mounts with the frame, before the page. -->
    <template #trail
      ><div
        :id="StudioFrameBarId"
        class="flex min-w-0 flex-1 items-center gap-1 sm:gap-2"
    /></template>
    <template #account-items>
      <MenuItem v-if="place" @select="place.openSettings()"
        ><Settings :size="15" class="shrink-0" aria-hidden="true" />Studio
        settings</MenuItem
      >
      <MenuItem @select="reconnect"
        ><RefreshCw :size="15" class="shrink-0" aria-hidden="true" />{{
          signedIn ? "Reconnect with Ocharo" : "Sign in"
        }}</MenuItem
      >
    </template>
    <RouterView v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
      <p v-else class="frame-loading" role="status" aria-busy="true">
        Opening Ocharo Studio…
      </p>
    </RouterView>
  </AppFrame>
</template>
