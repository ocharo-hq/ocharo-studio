import type { Component } from "vue";
import {
  BookOpen,
  Globe,
  LayoutDashboard,
  Megaphone,
  Palette,
  PenLine,
  Shirt,
} from "@lucide/vue";

import type { OcharoAppKey } from "../../domain/common/OcharoApps";
import type { StudioSection } from "../../domain/common/StudioSections";

/** The icon beside each Studio section in the sidebar, the rail and the phone section menu. */
export const SectionIcons: Readonly<Record<StudioSection, Component>> = {
  designer: Shirt,
  materials: Palette,
};

/** The icon on each app tile in the app menu, as Desk draws it; public sites share one. */
export const AppIcons: Readonly<Record<OcharoAppKey, Component>> = {
  desk: LayoutDashboard,
  catalogue: BookOpen,
  studio: Shirt,
  marketing: Megaphone,
  editorial: PenLine,
  brand: Palette,
  atlas: Globe,
  wear: Globe,
  blog: Globe,
};
