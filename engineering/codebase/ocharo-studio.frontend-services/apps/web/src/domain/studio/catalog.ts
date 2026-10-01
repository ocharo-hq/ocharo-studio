import { CATALOGUE_MATERIALS } from "./catalogueMaterialDefinitions";
import type {
  GarmentDefinition,
  GarmentId,
  MaterialDefinition,
  MaterialKind,
  PartId,
} from "./types";

export const MATERIALS: readonly MaterialDefinition[] = [
  ...CATALOGUE_MATERIALS,
  {
    id: "atlas-rose",
    kind: "atlas",
    name: "Pomegranate atlas",
    family: "Ikat",
    color: "#ddad9a",
    textureUrl: "/assets/textures/atlas-rose.webp",
    roughness: 0.58,
    metalness: 0,
    repeat: [1, 1],
    provenance: "AI-generated atlas-inspired textile study",
  },
  {
    id: "adras-indigo",
    kind: "adras",
    name: "Indigo adras",
    family: "Ikat",
    color: "#647ca9",
    textureUrl: "/assets/textures/adras-indigo.webp",
    roughness: 0.8,
    metalness: 0,
    repeat: [1, 1],
    provenance: "AI-generated adras-inspired textile study",
  },
  {
    id: "bekasam-gold",
    kind: "beqasam",
    name: "Golden bekasam",
    family: "Stripe",
    color: "#c59c4b",
    textureUrl: "/assets/textures/bekasam-gold.webp",
    roughness: 0.56,
    metalness: 0,
    repeat: [1, 1],
    provenance: "AI-generated bekasam-inspired textile study",
  },
  {
    id: "ikat-garden",
    kind: "atlas",
    name: "Garden ikat",
    family: "Ikat",
    color: "#5d8365",
    textureUrl: "/assets/textures/ikat-garden.webp",
    roughness: 0.7,
    metalness: 0,
    repeat: [1, 1],
    provenance: "AI-generated ikat-inspired textile study",
  },
  {
    id: "ivory",
    kind: "shoyi",
    name: "Ivory silk",
    family: "Solid",
    color: "#eee9db",
    roughness: 0.6,
    metalness: 0,
    repeat: [1, 1],
    provenance: "Authored material",
  },
  {
    id: "sand",
    kind: "linen",
    name: "Warm linen",
    family: "Solid",
    color: "#c2a78b",
    roughness: 0.95,
    metalness: 0,
    repeat: [1, 1],
    provenance: "Authored material",
  },
  {
    id: "ink",
    kind: "velvet",
    name: "Midnight velvet",
    family: "Solid",
    color: "#26383f",
    roughness: 0.98,
    metalness: 0,
    repeat: [1, 1],
    provenance: "Authored material",
  },
  {
    id: "pomegranate",
    kind: "shoyi",
    name: "Pomegranate silk",
    family: "Solid",
    color: "#773b44",
    roughness: 0.55,
    metalness: 0,
    repeat: [1, 1],
    provenance: "Authored material",
  },
  {
    id: "sage",
    kind: "cotton",
    name: "Sage cotton",
    family: "Solid",
    color: "#839080",
    roughness: 0.92,
    metalness: 0,
    repeat: [1, 1],
    provenance: "Authored material",
  },
  {
    id: "gold",
    kind: "metallic",
    name: "Antique gold",
    family: "Solid",
    color: "#b49656",
    roughness: 0.58,
    metalness: 0.35,
    repeat: [1, 1],
    provenance: "Authored material",
  },
];
const CLOTH_KINDS: readonly MaterialKind[] = [
  "atlas",
  "adras",
  "beqasam",
  "shoyi",
  "barbi",
  "synthetic-poplin",
  "synthetic-fabric",
  "indian-scarf",
  "gobelen",
  "velvet",
  "cotton",
  "linen",
];
const ALL_KINDS: readonly MaterialKind[] = [...CLOTH_KINDS, "metallic"];
const GARMENT_KINDS: Record<GarmentId, readonly MaterialKind[]> = {
  nimcha: ["barbi", "atlas", "indian-scarf", "synthetic-fabric", "gobelen"],
  baska: ["barbi", "atlas", "shoyi", "synthetic-fabric"],
  kostyum: ["atlas", "beqasam", "shoyi"],
  korset: ["atlas", "shoyi"],
  abaya: ["synthetic-poplin"],
};
const STUDY_KINDS: readonly MaterialKind[] = [
  "atlas",
  "adras",
  "beqasam",
  "shoyi",
  "velvet",
  "cotton",
  "linen",
  "metallic",
];
const part = (
  id: GarmentDefinition["parts"][number]["id"],
  name: string,
  defaultMaterialId: string,
) => ({
  id,
  name,
  defaultMaterialId,
  allowedMaterialKinds: ALL_KINDS,
});
export const GARMENTS: readonly GarmentDefinition[] = [
  {
    id: "nimcha",
    name: "Nimcha",
    subtitle: "The wrap vest",
    description: "A sculpted vest with generous lapels and a side-tied waist.",
    assetVersion: 1,
    allowedMaterialKinds: [
      ...new Set([...GARMENT_KINDS.nimcha, ...STUDY_KINDS]),
    ],
    modelUrl: "/assets/models/nimcha.glb",
    parts: [
      part("body", "Main panels", "atlas-rose"),
      part("collar", "Lapel & collar", "pomegranate"),
      part("trim", "Edge binding", "pomegranate"),
      part("belt", "Side tie", "pomegranate"),
    ],
    attachments: "Side tie · included",
  },
  {
    id: "baska",
    name: "Baska",
    subtitle: "The waist peplum",
    description:
      "A fitted waistband with pointed hip panels and an open front.",
    assetVersion: 1,
    allowedMaterialKinds: [
      ...new Set([...GARMENT_KINDS.baska, ...STUDY_KINDS]),
    ],
    modelUrl: "/assets/models/baska.glb",
    parts: [
      part("body", "Peplum panels", "ikat-garden"),
      part("trim", "Border", "sage"),
      part("belt", "Waist sash", "sage"),
    ],
    attachments: "Waist sash · included",
  },
  {
    id: "kostyum",
    name: "Kostyum",
    subtitle: "The cape jacket",
    description: "A cropped, open jacket with airy sleeves and framed cuffs.",
    assetVersion: 1,
    allowedMaterialKinds: [
      ...new Set([...GARMENT_KINDS.kostyum, ...STUDY_KINDS]),
    ],
    modelUrl: "/assets/models/kostyum.glb",
    parts: [
      part("body", "Jacket panels", "adras-indigo"),
      part("collar", "Collar", "ink"),
      part("sleeves", "Sleeves", "adras-indigo"),
      part("trim", "Cuffs & edges", "ink"),
    ],
    attachments: "Gold clasp · included",
  },
  {
    id: "korset",
    name: "Korset",
    subtitle: "The shaped bodice",
    description: "A strapless bodice with a defined waist and flared hem.",
    assetVersion: 1,
    allowedMaterialKinds: [
      ...new Set([...GARMENT_KINDS.korset, ...STUDY_KINDS]),
    ],
    modelUrl: "/assets/models/korset.glb",
    parts: [
      part("body", "Bodice", "bekasam-gold"),
      part("trim", "Binding", "pomegranate"),
    ],
    attachments: "Front fastenings · included",
  },
  {
    id: "abaya",
    name: "Abaya",
    subtitle: "The long robe",
    description: "A flowing open robe, shaped by an integrated waist belt.",
    assetVersion: 1,
    allowedMaterialKinds: [
      ...new Set([...GARMENT_KINDS.abaya, ...STUDY_KINDS]),
    ],
    modelUrl: "/assets/models/abaya.glb",
    parts: [
      part("body", "Robe panels", "adras-indigo"),
      part("collar", "Front facing", "ink"),
      part("sleeves", "Sleeves", "adras-indigo"),
      part("belt", "Belt", "ink"),
    ],
    attachments: "Belt & knot · included",
  },
];
export function getGarment(id: GarmentId): GarmentDefinition {
  const garment = GARMENTS.find((item) => item.id === id);
  if (!garment) throw new Error(`Unknown garment: ${id}`);
  return garment;
}
export function getMaterial(id: string): MaterialDefinition {
  const material = MATERIALS.find((item) => item.id === id);
  if (!material) throw new Error(`Unknown material: ${id}`);
  return material;
}

export function getAvailableMaterials(
  garmentId: GarmentId,
  partId: PartId,
): readonly MaterialDefinition[] {
  const garment = getGarment(garmentId);
  const part = garment.parts.find((item) => item.id === partId);
  if (!part) return [];
  return MATERIALS.filter(
    (material) =>
      garment.allowedMaterialKinds.includes(material.kind) &&
      part.allowedMaterialKinds.includes(material.kind) &&
      (!material.sourceProductIds?.length ||
        GARMENT_KINDS[garmentId].includes(material.kind)),
  );
}
export function isMaterialApplicable(
  garmentId: GarmentId,
  partId: PartId,
  materialId: string,
): boolean {
  return getAvailableMaterials(garmentId, partId).some(
    (material) => material.id === materialId,
  );
}
