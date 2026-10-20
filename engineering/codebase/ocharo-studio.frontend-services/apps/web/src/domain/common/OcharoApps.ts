/** The Ocharo apps a signed-in operator moves between, and the public sites they publish to. */
export const OcharoAppKind = {
  Workspace: "workspace",
  PublicSite: "public-site",
} as const;

export type OcharoAppKind = (typeof OcharoAppKind)[keyof typeof OcharoAppKind];

/** Names one destination in the app menu. */
export type OcharoAppKey =
  | "desk"
  | "catalogue"
  | "studio"
  | "marketing"
  | "editorial"
  | "brand"
  | "atlas"
  | "wear"
  | "blog";

/** One destination in the app menu. */
export interface OcharoApp {
  readonly key: OcharoAppKey;
  readonly label: string;
  /** One line under the label naming what the app is for. */
  readonly summary: string;
  readonly kind: OcharoAppKind;
  readonly url: string;
}

/** Each destination's configured address; an app without one is left out of the menu. */
export type OcharoAppAddresses = Readonly<
  Partial<Record<OcharoAppKey, string>>
>;

/** @internal The menu in display order, before configuration supplies the addresses; the same list Desk shows. */
const OcharoAppEntries: readonly Omit<OcharoApp, "url">[] = [
  {
    key: "desk",
    label: "Desk",
    summary: "Events, sourcing and products",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "catalogue",
    label: "Catalogue",
    summary: "Products, prices and editions",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "studio",
    label: "Studio",
    summary: "Garments and fabric",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "marketing",
    label: "Marketing",
    summary: "Posts and leads",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "editorial",
    label: "Editorial",
    summary: "Blog stories",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "brand",
    label: "Brand",
    summary: "Logo and brand guide",
    kind: OcharoAppKind.Workspace,
  },
  {
    key: "atlas",
    label: "Atlas",
    summary: "Public site",
    kind: OcharoAppKind.PublicSite,
  },
  {
    key: "wear",
    label: "Wear",
    summary: "Public site",
    kind: OcharoAppKind.PublicSite,
  },
  {
    key: "blog",
    label: "Blog",
    summary: "Public site",
    kind: OcharoAppKind.PublicSite,
  },
];

/** Accepts only plain HTTPS links: no credentials, query or fragment that could carry a token. */
export function resolveOcharoAppUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Builds the menu from configured addresses, dropping any that are absent or not plain HTTPS links. */
export function ocharoApps(addresses: OcharoAppAddresses): OcharoApp[] {
  return OcharoAppEntries.flatMap((app) => {
    const url = resolveOcharoAppUrl(addresses[app.key]);
    return url ? [{ ...app, url }] : [];
  });
}
