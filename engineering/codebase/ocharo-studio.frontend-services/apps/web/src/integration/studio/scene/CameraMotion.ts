import * as THREE from "three";

export interface CameraPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

export type WheelGesture =
  | { readonly kind: "orbit"; readonly x: number; readonly y: number }
  | { readonly kind: "zoom"; readonly amount: number };

export function shortestAngleDelta(from: number, to: number): number {
  return (
    THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
  );
}

export function interpolateCameraPose(
  from: CameraPose,
  to: CameraPose,
  progress: number,
): CameraPose {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const target = from.target.clone().lerp(to.target, t);
  const start = new THREE.Spherical().setFromVector3(
    from.position.clone().sub(from.target),
  );
  const end = new THREE.Spherical().setFromVector3(
    to.position.clone().sub(to.target),
  );
  const offset = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(
      THREE.MathUtils.lerp(start.radius, end.radius, t),
      THREE.MathUtils.lerp(start.phi, end.phi, t),
      start.theta + shortestAngleDelta(start.theta, end.theta) * t,
    ),
  );
  return { position: target.clone().add(offset), target };
}

/** Distinguishes high-resolution trackpad motion from coarse mouse-wheel zoom. */
export function classifyWheelGesture({
  deltaX,
  deltaY,
  deltaMode,
  ctrlKey,
}: Pick<
  WheelEvent,
  "deltaX" | "deltaY" | "deltaMode" | "ctrlKey"
>): WheelGesture {
  if (ctrlKey)
    return {
      kind: "zoom",
      amount: THREE.MathUtils.clamp(-deltaY * 0.012, -0.45, 0.45),
    };
  if (deltaMode === 0) return { kind: "orbit", x: deltaX, y: deltaY };
  const unit = deltaMode === 1 ? 0.12 : deltaMode === 2 ? 0.5 : 0.004;
  return {
    kind: "zoom",
    amount: THREE.MathUtils.clamp(-deltaY * unit, -0.5, 0.5),
  };
}
