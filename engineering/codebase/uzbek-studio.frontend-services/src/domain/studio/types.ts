export type GarmentId = "nimcha" | "baska" | "kostyum" | "korset" | "abaya";
export type PartId = "body" | "collar" | "sleeves" | "trim" | "belt";
export interface TexturePlacement {
  rotation: number;
  offsetX: number;
  offsetY: number;
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
  parts: readonly { id: PartId; name: string; defaultMaterialId: string }[];
  attachments: string;
}
export interface MaterialDefinition {
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
  schemaVersion: 1;
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
