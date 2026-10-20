/** The places inside Studio's frame: the garment designer and the shared-material editor. */
export type StudioSection = "designer" | "materials";

/** One place in Studio's sidebar and phone section menu. */
export interface StudioSectionEntry {
  readonly id: StudioSection;
  /** The navigation label; the route metadata carries the same one. */
  readonly label: string;
  readonly path: string;
}

/** The sections in navigation order. */
export const StudioSections: readonly StudioSectionEntry[] = [
  { id: "designer", label: "Designer", path: "/studio" },
  { id: "materials", label: "Materials", path: "/studio/materials" },
];

/** Reads the section a place belongs to from its route metadata, or `null` outside every section. */
export function readStudioSection(
  meta: Record<string, unknown>,
): StudioSection | null {
  const section = meta.section;
  return StudioSections.some((entry) => entry.id === section)
    ? (section as StudioSection)
    : null;
}
