<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { ChevronDown, House } from "@lucide/vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "@wow-two-beta/fe/presentation/nav";

import {
  StudioSections,
  type StudioSection,
} from "../../domain/common/StudioSections";
import { SectionIcons } from "./ShellIcons";

/**
 * The phone's place switch in the top bar, where the sidebar is hidden: Designer and Materials as a radio group
 * marking the open one, then the way back to the Studio introduction. Moves go through the router, so the editor's
 * unsaved-work guard still holds them.
 */
defineOptions({ name: "StudioSectionMenu" });
const props = defineProps<{ current: StudioSection | null }>();
const router = useRouter();
const open = ref(false);
const entry = computed(
  () =>
    StudioSections.find((section) => section.id === props.current) ??
    StudioSections[0]!,
);
function choose(id: string | null): void {
  const section = StudioSections.find((item) => item.id === id);
  if (section && section.id !== props.current) void router.push(section.path);
}
</script>

<template>
  <DropdownMenu v-model:open="open" placement="bottom-start">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="group/sections inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-transparent px-1.5 text-foreground transition-colors hover:border-primary/15 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary/15 data-[state=open]:bg-primary-soft"
        :aria-label="`Studio sections — ${entry.label}`"
      >
        <component :is="SectionIcons[entry.id]" :size="18" aria-hidden="true" />
        <ChevronDown
          :size="14"
          class="text-muted-foreground transition-transform duration-200 group-data-[state=open]/sections:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      aria-label="Studio sections"
      variant="glass-menu"
      class="w-56"
    >
      <MenuRadioGroup
        label="Studio sections"
        :model-value="props.current"
        @update:model-value="choose"
      >
        <MenuRadioItem
          v-for="section in StudioSections"
          :key="section.id"
          :value="section.id"
        >
          <component
            :is="SectionIcons[section.id]"
            :size="16"
            class="shrink-0"
            aria-hidden="true"
          />{{ section.label }}
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuItem @select="router.push('/')"
        ><House :size="16" class="shrink-0" aria-hidden="true" />Studio
        home</MenuItem
      >
    </DropdownMenuContent>
  </DropdownMenu>
</template>
