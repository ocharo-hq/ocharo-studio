import * as THREE from "three";

export const SURFACE_TOP = 2;
export const SURFACE_HEIGHT = 1.66;

/** Shared cylindrical UV space: front centre is (0.5,0.5) at y=1.17 metres. */
export function surfacePoint(point: THREE.Vector3): THREE.Vector2 {
  return new THREE.Vector2(
    Math.atan2(point.x, point.z) / (2 * Math.PI) + 0.5,
    (SURFACE_TOP - point.y) / SURFACE_HEIGHT,
  );
}

/** Unwrap each triangle at the rear seam; no interpolated texture streak through the front. */
export function mapSurfaceCoordinates(mesh: THREE.Mesh): void {
  mesh.updateWorldMatrix(true, false);
  const old = mesh.geometry;
  const geometry = old.index ? old.toNonIndexed() : old.clone();
  const positions = geometry.getAttribute("position");
  const uvs = new Float32Array(positions.count * 2);
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    const triangle: THREE.Vector2[] = [];
    for (let j = 0; j < 3; j++)
      triangle.push(
        surfacePoint(
          point
            .fromBufferAttribute(positions, i + j)
            .applyMatrix4(mesh.matrixWorld),
        ),
      );
    const crossesSeam =
      Math.max(...triangle.map((p) => p.x)) -
        Math.min(...triangle.map((p) => p.x)) >
      0.5;
    triangle.forEach((uv, j) => {
      uvs[(i + j) * 2] = crossesSeam && uv.x < 0.5 ? uv.x + 1 : uv.x;
      uvs[(i + j) * 2 + 1] = uv.y;
    });
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  mesh.geometry = geometry;
  old.dispose();
}

/** Finds an anchor on the selected surface, including disconnected panels and the rear UV seam. */
export function findSurfaceAnchor(
  meshes: readonly THREE.Mesh[],
  x: number,
  y: number,
): THREE.Vector3 | null {
  const p = new THREE.Vector3(x, y, 0),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    bary = new THREE.Vector3();
  const va = new THREE.Vector3(),
    vb = new THREE.Vector3(),
    vc = new THREE.Vector3();
  let nearest: THREE.Vector3 | null = null,
    distance = Infinity;
  for (const mesh of meshes) {
    const uv = mesh.geometry.getAttribute("uv"),
      pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      a.set(uv.getX(i), uv.getY(i), 0);
      b.set(uv.getX(i + 1), uv.getY(i + 1), 0);
      c.set(uv.getX(i + 2), uv.getY(i + 2), 0);
      for (const wrap of [0, 1, -1]) {
        p.x = x + wrap;
        THREE.Triangle.getBarycoord(p, a, b, c, bary);
        if (bary.x >= 0 && bary.y >= 0 && bary.z >= 0) {
          return va
            .fromBufferAttribute(pos, i)
            .multiplyScalar(bary.x)
            .addScaledVector(vb.fromBufferAttribute(pos, i + 1), bary.y)
            .addScaledVector(vc.fromBufferAttribute(pos, i + 2), bary.z)
            .applyMatrix4(mesh.matrixWorld)
            .clone();
        }
      }
      for (let j = 0; j < 3; j++) {
        const dx = Math.min(
          Math.abs(uv.getX(i + j) - x),
          Math.abs(uv.getX(i + j) - x - 1),
          Math.abs(uv.getX(i + j) - x + 1),
        );
        const d = dx * dx + (uv.getY(i + j) - y) ** 2;
        if (d < distance) {
          distance = d;
          nearest = va
            .fromBufferAttribute(pos, i + j)
            .applyMatrix4(mesh.matrixWorld)
            .clone();
        }
      }
    }
  }
  return nearest;
}
