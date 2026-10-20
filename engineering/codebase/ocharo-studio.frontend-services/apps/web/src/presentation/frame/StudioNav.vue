<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { House, PanelLeftClose, PanelLeftOpen } from "@lucide/vue";
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@wow-two-beta/fe/presentation/nav";

import {
  StudioSections,
  type StudioSection,
} from "../../domain/common/StudioSections";
import { SectionIcons } from "./ShellIcons";

/**
 * Studio's sidebar: Designer and Materials, then the way back to the Studio introduction and the collapse control.
 * As an icon rail the labels stay for assistive technology and show as tooltips.
 */
defineOptions({ name: "StudioNav" });
const props = withDefaults(
  defineProps<{
    current: StudioSection | null;
    collapsed: boolean;
    canToggle?: boolean;
  }>(),
  { canToggle: true },
);
const emit = defineEmits<{ toggle: [] }>();
const labelClass = computed(() =>
  props.collapsed ? "sr-only" : "min-w-0 flex-1 truncate text-start",
);
const toggleLabel = computed(() =>
  props.collapsed ? "Expand sidebar" : "Collapse sidebar",
);
const footerClass =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <SidebarMenu
      v-bind="{ 'aria-label': 'Studio sections' }"
      :is-collapsed="props.collapsed"
      class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:thin]"
    >
      <SidebarMenuItem
        v-for="section in StudioSections"
        :key="section.id"
        as-child
        :is-active="props.current === section.id"
      >
        <template #icon
          ><component :is="SectionIcons[section.id]" :size="17"
        /></template>
        <RouterLink
          :to="section.path"
          :title="props.collapsed ? section.label : undefined"
          ><span :class="labelClass">{{ section.label }}</span></RouterLink
        >
      </SidebarMenuItem>
    </SidebarMenu>
    <div class="flex flex-col gap-1 border-t border-(--oc-glass-edge) p-2">
      <RouterLink
        to="/"
        :class="[footerClass, { 'justify-center': props.collapsed }]"
        aria-label="Ocharo Studio home"
        :title="props.collapsed ? 'Studio home' : undefined"
      >
        <House :size="17" aria-hidden="true" />
        <span v-if="!props.collapsed">Studio home</span>
      </RouterLink>
      <button
        v-if="props.canToggle"
        type="button"
        :class="[footerClass, { 'justify-center': props.collapsed }]"
        :aria-label="toggleLabel"
        :aria-expanded="!props.collapsed"
        :title="props.collapsed ? toggleLabel : undefined"
        @click="emit('toggle')"
      >
        <component
          :is="props.collapsed ? PanelLeftOpen : PanelLeftClose"
          :size="17"
          aria-hidden="true"
        />
        <span v-if="!props.collapsed">{{ toggleLabel }}</span>
      </button>
    </div>
  </div>
</template>
