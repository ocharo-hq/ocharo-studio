import type { MaterialKind } from "../MaterialKind";

export type GarmentId = "nimcha" | "baska" | "kostyum" | "korset" | "abaya";
export type PartId = "body" | "collar" | "sleeves" | "trim" | "belt";
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
