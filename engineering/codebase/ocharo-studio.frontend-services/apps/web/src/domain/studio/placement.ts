import type { TexturePlacement } from "./types";

export interface Point2 {
  x: number;
  y: number;
}
export interface AffinePlacement {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/** Inverse sampling: the chosen textile point lands on the garment anchor plus garment-space shift. */
export function materialTransform(
  placement: TexturePlacement,
  repeat: readonly [number, number] = [1, 1],
): AffinePlacement {
  const radians = (placement.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians),
    sine = Math.sin(radians);
  const rx = repeat[0] / placement.scale,
    ry = repeat[1] / placement.scale;
  const a = cosine * rx,
    b = sine * ry,
    c = -sine * rx,
    d = cosine * ry;
  const x = placement.garmentAnchorX + placement.offsetX;
  const y = placement.garmentAnchorY - placement.offsetY;
  return {
    a,
    b,
    c,
    d,
    tx: placement.materialAnchorX - a * x - b * y,
    ty: placement.materialAnchorY - c * x - d * y,
  };
}

export function sampleMaterial(
  transform: AffinePlacement,
  point: Point2,
): Point2 {
  return {
    x: transform.a * point.x + transform.b * point.y + transform.tx,
    y: transform.c * point.x + transform.d * point.y + transform.ty,
  };
}
