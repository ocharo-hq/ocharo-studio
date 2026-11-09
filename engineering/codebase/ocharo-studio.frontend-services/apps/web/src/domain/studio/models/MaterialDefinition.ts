import type { MaterialKind } from "../MaterialKind";
import type { GarmentId } from "./GarmentDefinition";

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
