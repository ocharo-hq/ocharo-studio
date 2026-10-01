import * as THREE from "three";
import type { PartId } from "../../../domain/studio/types";

const PART_IDS = new Set<PartId>(["body", "collar", "sleeves", "trim", "belt"]);

export function isPartId(value: unknown): value is PartId {
  return typeof value === "string" && PART_IDS.has(value as PartId);
}

export function meshPartId(mesh: THREE.Mesh): PartId | null {
  const extraPart = mesh.userData.partId;
  if (isPartId(extraPart)) return extraPart;
  const namePart = mesh.name.split(".")[0];
  return isPartId(namePart) ? namePart : null;
}

/** Removes mannequin nodes that belong to a part this garment lacks, such as soft arms without sleeves. */
export function fitMannequin(
  mannequin: THREE.Object3D,
  partIds: readonly PartId[],
): void {
  const unused: THREE.Object3D[] = [];
  mannequin.traverse((child) => {
    const showWith = child.userData.showWith;
    if (
      showWith !== undefined &&
      !(isPartId(showWith) && partIds.includes(showWith))
    )
      unused.push(child);
  });
  for (const child of unused) {
    child.removeFromParent();
    disposeObject(child);
  }
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshBasicMaterial
      )
        material.map?.dispose();
      if (material instanceof THREE.MeshStandardMaterial)
        material.normalMap?.dispose();
      material.dispose();
    }
  });
}
