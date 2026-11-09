import type { GarmentId, PartId } from "./GarmentDefinition";
import type { TexturePlacement } from "./TexturePlacement";

export interface PartAssignment {
  materialId: string;
  placement: TexturePlacement;
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
