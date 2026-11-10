<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
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
 * Studio's sidebar: Designer and Materials. As an icon rail the labels stay for assistive technology and show as
 * tooltips. The frame owns the collapse control; the way back to the Studio introduction stands at its foot.
 */
defineOptions({ name: "StudioNav" });
const props = defineProps<{
  current: StudioSection | null;
  collapsed: boolean;
}>();
const labelClass = computed(() =>
  props.collapsed ? "sr-only" : "min-w-0 flex-1 truncate text-start",
);
</script>

<template>
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
</template>
