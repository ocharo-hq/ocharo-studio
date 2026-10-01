export const MaterialKind = {
  Atlas: "atlas",
  Adras: "adras",
  Beqasam: "beqasam",
  Shoyi: "shoyi",
  Barbi: "barbi",
  SyntheticPoplin: "synthetic-poplin",
  SyntheticFabric: "synthetic-fabric",
  IndianScarf: "indian-scarf",
  Gobelen: "gobelen",
  Velvet: "velvet",
  Cotton: "cotton",
  Linen: "linen",
  Metallic: "metallic",
} as const;
export type MaterialKind = (typeof MaterialKind)[keyof typeof MaterialKind];
export type GarmentId = "nimcha" | "baska" | "kostyum" | "korset" | "abaya";
export type PartId = "body" | "collar" | "sleeves" | "trim" | "belt";
export interface MaterialScaleEntry {
  readonly scale: number;
  readonly revision: number;
  readonly updatedAt: string;
}
export type MaterialScaleLibrary = Readonly<Record<string, MaterialScaleEntry>>;
export interface TexturePlacement {
  rotation: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  materialAnchorX: number;
  materialAnchorY: number;
  garmentAnchorX: number;
  garmentAnchorY: number;
}
export interface PartAssignment {
  materialId: string;
  placement: TexturePlacement;
}
export interface GarmentDefinition {
  id: GarmentId;
  name: string;
  subtitle: string;
  description: string;
  assetVersion: 1;
  modelUrl: string;
  allowedMaterialKinds: readonly MaterialKind[];
  parts: readonly {
    id: PartId;
    name: string;
    defaultMaterialId: string;
    allowedMaterialKinds: readonly MaterialKind[];
  }[];
  attachments: string;
}
export interface MaterialDefinition {
  kind: MaterialKind;
  garmentIds?: readonly GarmentId[];
  sourceProductIds?: readonly string[];
  id: string;
  name: string;
  family: string;
  color: string;
  textureUrl?: string;
  roughness: number;
  metalness: number;
  repeat: [number, number];
  provenance: string;
}
export interface DesignDocument {
  schemaVersion: 2;
  assetVersion: 1;
  id: string;
  name: string;
  garmentId: GarmentId;
  parts: Partial<Record<PartId, PartAssignment>>;
  createdAt: string;
  updatedAt: string;
}
export interface SavedLook {
  document: DesignDocument;
  thumbnail?: string;
}
