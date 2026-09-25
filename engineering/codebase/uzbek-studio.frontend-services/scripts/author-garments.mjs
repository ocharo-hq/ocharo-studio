import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const OUTPUT = fileURLToPath(
  new URL("../public/assets/models/", import.meta.url),
);
const TAU = Math.PI * 2;
const EXPECTED_PARTS = {
  nimcha: ["body", "collar", "trim", "belt"],
  baska: ["body", "trim", "belt"],
  kostyum: ["body", "collar", "sleeves", "trim"],
  korset: ["body", "trim"],
  abaya: ["body", "collar", "sleeves", "belt"],
};
const TORSO = [
  [0.72, 0.145, 0.092],
  [0.8, 0.189, 0.112],
  [0.89, 0.207, 0.125],
  [0.98, 0.179, 0.111],
  [1.055, 0.156, 0.099],
  [1.14, 0.171, 0.11],
  [1.245, 0.203, 0.121],
  [1.32, 0.214, 0.12],
  [1.415, 0.218, 0.098],
  [1.475, 0.239, 0.078],
  [1.51, 0.208, 0.074],
  [1.56, 0.078, 0.065],
  [1.68, 0.067, 0.058],
];
const MATERIALS = {
  body: cloth("Ivory cloth", "#e3d5bc"),
  collar: cloth("Contrast collar", "#294c4b"),
  sleeves: cloth("Sleeve cloth", "#e3d5bc"),
  trim: cloth("Bound seam", "#b59155"),
  belt: cloth("Woven sash", "#294c4b"),
  mannequin: cloth("Warm linen dress form", "#c9bfae"),
  brass: new THREE.MeshStandardMaterial({
    color: "#99764a",
    metalness: 0.72,
    roughness: 0.31,
  }),
};

// GLTFExporter uses FileReader to package buffers even when no image canvas is involved.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.({ target: this });
    });
  }
};

function cloth(name, color) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function mix(a, b, t) {
  return a + (b - a) * t;
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function bell(x, width) {
  return Math.exp(-((x / width) ** 2));
}
function angle(theta) {
  return Math.atan2(Math.sin(theta), Math.cos(theta));
}

function profile(y) {
  if (y <= TORSO[0][0]) return TORSO[0].slice(1);
  for (let i = 1; i < TORSO.length; i++) {
    if (y <= TORSO[i][0]) {
      const a = TORSO[i - 1];
      const b = TORSO[i];
      const t = smooth((y - a[0]) / (b[0] - a[0]));
      return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
    }
  }
  return TORSO.at(-1).slice(1);
}

function bodyPoint(theta, y, ease = 0, flare = 0, folds = 0) {
  const [rx, rz] = profile(Math.max(0.89, y));
  const a = angle(theta);
  const bust =
    0.023 *
    bell(y - 1.285, 0.067) *
    (bell(a - 0.48, 0.29) + bell(a + 0.48, 0.29));
  const ripple =
    folds * (0.65 * Math.cos(theta * 12) + 0.35 * Math.cos(theta * 18));
  return new THREE.Vector3(
    Math.sin(theta) * (rx + ease + flare + ripple),
    y,
    Math.cos(theta) * (rz + ease + flare * 0.63 + ripple) + bust,
  );
}

function frontPoint(x, y, offset = 0.03) {
  const [rx] = profile(y);
  const theta = Math.asin(THREE.MathUtils.clamp(x / (rx + 0.025), -0.99, 0.99));
  const p = bodyPoint(theta, y, 0.025);
  p.x = x;
  p.z += offset;
  return p;
}

function group(name) {
  const root = new THREE.Group();
  root.name = name;
  root.userData = {
    assetId: name,
    assetVersion: "1.0.0",
    units: "metres",
    upAxis: "Y",
    frontAxis: "+Z",
    provenance: "authored-3d-interpretation",
    fit: "one fixed atelier mannequin; visual design reference, not production fit",
  };
  return root;
}

function addMesh(
  root,
  name,
  partId,
  geometry,
  material = MATERIALS[partId],
  fixed = false,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = partId ? `${partId}.${name}` : name;
  mesh.userData = partId ? { partId } : { fixedMaterial: true };
  if (fixed) mesh.userData.fixedMaterial = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function surface(root, name, partId, columns, rows, sample, material) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const v = row / rows;
      const sampled = sample(u, v);
      const p = sampled.point ?? sampled;
      positions.push(p.x, p.y, p.z);
      uvs.push(...(sampled.uv ?? [u, v]));
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        indices.push(
          a,
          a + 1,
          a + columns + 1,
          a + 1,
          a + columns + 2,
          a + columns + 1,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(root, name, partId, geometry, material);
}

function shell(root, name, partId, options) {
  const {
    bottom,
    top,
    ease = 0.02,
    flare = () => 0,
    folds = () => 0,
    opening = () => 0,
  } = options;
  const sample = (u, v) => {
    const theta = mix(opening(v), TAU - opening(v), u);
    const y = mix(bottom(theta), top(theta), v);
    return {
      point: bodyPoint(theta, y, ease, flare(y, v), folds(y, v)),
      uv: [theta / TAU, y / 0.8],
    };
  };
  surface(root, name, partId, 64, 32, sample);
  return sample;
}

function seam(root, name, partId, points, radius = 0.0023, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return addMesh(
    root,
    name,
    partId,
    new THREE.TubeGeometry(
      curve,
      Math.max(18, points.length * 2),
      radius,
      5,
      false,
    ),
    material,
  );
}

function edge(root, name, partId, sample, v, radius = 0.0025) {
  const points = Array.from({ length: 49 }, (_, i) => sample(i / 48, v).point);
  seam(root, name, partId, points, radius);
}

function polygon(root, name, partId, outline, lift = 0.02) {
  const vertices = outline.map(([x, y]) => new THREE.Vector2(x, y));
  const triangles = THREE.ShapeUtils.triangulateShape(vertices, []);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const triangle of triangles) {
    const [a, b, c] = triangle.map((i) => vertices[i]);
    const divisions = 8;
    const rowStarts = [];
    for (let i = 0; i <= divisions; i++) {
      rowStarts.push(positions.length / 3);
      for (let j = 0; j <= divisions - i; j++) {
        const x =
          a.x + ((b.x - a.x) * i) / divisions + ((c.x - a.x) * j) / divisions;
        const y =
          a.y + ((b.y - a.y) * i) / divisions + ((c.y - a.y) * j) / divisions;
        const p = frontPoint(x, y, lift);
        positions.push(p.x, p.y, p.z);
        uvs.push(x / 0.48 + 0.5, y / 0.8);
      }
    }
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions - i; j++) {
        const p = rowStarts[i] + j;
        const q = rowStarts[i + 1] + j;
        indices.push(p, q, p + 1);
        if (j < divisions - i - 1) indices.push(p + 1, q, q + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(root, name, partId, geometry);
}

function shoulder(root, side, ease = 0.025) {
  const mesh = surface(root, `shoulder-${side}`, "body", 10, 12, (u, v) => {
    const x = side * mix(0.12, 0.237 + ease * 0.15, u);
    const z = mix(0.095, -0.087, v);
    const y = 1.525 - 0.045 * u + 0.014 * Math.sin(v * Math.PI);
    return { point: new THREE.Vector3(x, y, z), uv: [0.5 + x / 0.9, 1.9 + z] };
  });
  if (side < 0) reverseWinding(mesh.geometry);
}

function reverseWinding(geometry) {
  const indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  geometry.computeVertexNormals();
}

function ribbon(root, name, partId, path, width) {
  const curve = new THREE.CatmullRomCurve3(
    path.map((p) => new THREE.Vector3(...p)),
  );
  surface(root, name, partId, 3, 28, (u, v) => {
    const p = curve.getPoint(v);
    const tangent = curve.getTangent(v);
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    p.addScaledVector(side, (u - 0.5) * width);
    p.z += 0.002 * Math.sin(u * Math.PI);
    return { point: p, uv: [u * 0.15, v * 0.6] };
  });
}

function bow(root, x, y, z, scale = 1) {
  const point = (a, b, c = 0) => [x + a * scale, y + b * scale, z + c * scale];
  ribbon(
    root,
    "tie-left-loop",
    "belt",
    [
      point(0, 0),
      point(-0.06, 0.028, 0.009),
      point(-0.065, -0.004, 0.012),
      point(0, -0.006, 0.003),
    ],
    0.022 * scale,
  );
  ribbon(
    root,
    "tie-right-loop",
    "belt",
    [
      point(0, 0),
      point(0.061, 0.026, 0.013),
      point(0.063, -0.01, 0.014),
      point(0, -0.006, 0.005),
    ],
    0.022 * scale,
  );
  ribbon(
    root,
    "tie-tail-left",
    "belt",
    [
      point(-0.006, 0),
      point(-0.03, -0.048, 0.01),
      point(-0.043, -0.13, 0.003),
      point(-0.057, -0.19, 0.017),
    ],
    0.025 * scale,
  );
  ribbon(
    root,
    "tie-tail-right",
    "belt",
    [
      point(0.008, 0),
      point(0.031, -0.05, 0.017),
      point(0.032, -0.11, 0.019),
      point(0.055, -0.165, 0.01),
    ],
    0.024 * scale,
  );
  const knot = addMesh(
    root,
    "tie-knot",
    "belt",
    new THREE.SphereGeometry(0.019 * scale, 12, 8),
  );
  knot.position.set(x, y, z + 0.008);
  knot.scale.set(1, 0.68, 0.65);
}

function band(root, name, partId, center, height, ease = 0.035) {
  return shell(root, name, partId, {
    bottom: () => center - height / 2,
    top: () => center + height / 2,
    ease,
  });
}

function lapels(root, long = false) {
  const low = long ? 1.065 : 1.225;
  for (const side of [-1, 1]) {
    polygon(
      root,
      `lapel-${side}`,
      "collar",
      [
        [side * 0.104, 1.528],
        [side * 0.209, 1.456],
        [side * 0.082, low],
        [side * 0.017, low + 0.071],
        [side * 0.087, 1.414],
      ],
      0.025,
    );
  }
  surface(root, "back-neck-band", "collar", 26, 3, (u, v) => {
    const theta = mix(Math.PI / 2, Math.PI * 1.5, u);
    const p = bodyPoint(theta, mix(1.54, 1.578, v), 0.018);
    return { point: p, uv: [u, v * 0.2] };
  });
}

function armCurve(side) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.236, 1.465, 0),
    new THREE.Vector3(side * 0.319, 1.315, -0.006),
    new THREE.Vector3(side * 0.387, 1.13, 0.006),
    new THREE.Vector3(side * 0.428, 0.981, 0.027),
  ]);
}

function limb(root, name, partId, side, radius, material, length = 1) {
  const curve = armCurve(side);
  const sample = (u, v) => {
    const theta = u * TAU;
    const center = curve.getPoint(v * length);
    const tangent = curve.getTangent(v * length);
    const across = new THREE.Vector3(0, 0, 1).cross(tangent).normalize();
    const depth = tangent.clone().cross(across).normalize();
    const r = radius(v);
    const p = center
      .addScaledVector(across, Math.sin(theta) * r)
      .addScaledVector(depth, Math.cos(theta) * r * 0.93);
    return { point: p, uv: [u, v * 0.8] };
  };
  const mesh = surface(root, name, partId, 32, 25, sample, material);
  reverseWinding(mesh.geometry);
  return sample;
}

function button(root, x, y, z) {
  const mesh = addMesh(
    root,
    "fixed.gold-button",
    null,
    new THREE.SphereGeometry(0.009, 16, 10),
    MATERIALS.brass,
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(1, 1, 0.38);
}

function mannequin() {
  const root = group("mannequin");
  root.userData.provenance = "authored-neutral-atelier-dress-form";
  surface(
    root,
    "linen-torso",
    null,
    56,
    56,
    (u, v) => {
      const theta = u * TAU;
      const y = mix(0.72, 1.68, v);
      const [rx, rz] = profile(y);
      const p = bodyPoint(theta, y);
      p.x = Math.sin(theta) * rx;
      if (y < 0.89) p.z = Math.cos(theta) * rz;
      return { point: p, uv: [u, v * 2] };
    },
    MATERIALS.mannequin,
  );
  for (const side of [-1, 1]) {
    limb(
      root,
      `linen-arm-${side}`,
      null,
      side,
      (v) => mix(0.064, 0.035, v),
      MATERIALS.mannequin,
    );
    const joint = addMesh(
      root,
      `shoulder-joint-${side}`,
      null,
      new THREE.SphereGeometry(1, 18, 12),
      MATERIALS.mannequin,
    );
    joint.position.set(side * 0.228, 1.457, 0);
    joint.scale.set(0.071, 0.047, 0.058);
    const cap = addMesh(
      root,
      `wrist-cap-${side}`,
      null,
      new THREE.SphereGeometry(0.034, 16, 10),
      MATERIALS.mannequin,
    );
    cap.position.copy(armCurve(side).getPoint(1));
    cap.scale.set(1, 1.3, 0.95);
  }
  const neckCap = addMesh(
    root,
    "neck-cap",
    null,
    new THREE.SphereGeometry(1, 32, 12),
    MATERIALS.brass,
  );
  neckCap.position.set(0, 1.682, 0);
  neckCap.scale.set(0.067, 0.007, 0.058);
  const neckFinial = addMesh(
    root,
    "neck-finial",
    null,
    new THREE.SphereGeometry(0.022, 16, 12),
    MATERIALS.brass,
  );
  neckFinial.position.y = 1.705;
  const rod = addMesh(
    root,
    "atelier-stand",
    null,
    new THREE.CylinderGeometry(0.015, 0.017, 0.72, 24),
    MATERIALS.brass,
  );
  rod.position.y = 0.39;
  const base = addMesh(
    root,
    "atelier-base",
    null,
    new THREE.CylinderGeometry(0.225, 0.235, 0.035, 64),
    MATERIALS.brass,
  );
  base.position.y = 0.0175;
  return root;
}

function nimcha() {
  const root = group("nimcha");
  const top = (theta) => {
    const a = Math.abs(angle(theta));
    return (
      1.518 -
      0.243 * bell(a, 0.43) -
      0.218 * bell(a - Math.PI / 2, 0.29) +
      0.025 * bell(a - Math.PI, 0.5)
    );
  };
  const bottom = (theta) =>
    0.975 -
    0.125 * bell(angle(theta) - 0.23, 0.49) -
    0.051 * bell(angle(theta) + 0.63, 0.37);
  const sample = shell(root, "wrap-panels", "body", {
    bottom,
    top,
    ease: 0.027,
    opening: (v) => mix(0.006, 0.05, v),
  });
  shoulder(root, -1);
  shoulder(root, 1);
  edge(root, "bound-hem", "trim", sample, 0);
  edge(root, "bound-armholes", "trim", sample, 1, 0.0021);
  polygon(
    root,
    "overlapping-lapel",
    "collar",
    [
      [0.12, 1.528],
      [0.216, 1.447],
      [-0.086, 1.088],
      [-0.138, 1.166],
      [0.075, 1.435],
    ],
    0.036,
  );
  polygon(
    root,
    "under-lapel",
    "collar",
    [
      [-0.116, 1.525],
      [-0.216, 1.445],
      [-0.073, 1.273],
      [-0.015, 1.329],
      [-0.079, 1.439],
    ],
    0.032,
  );
  surface(root, "back-collar", "collar", 24, 3, (u, v) => {
    const theta = mix(1.8, TAU - 1.8, u);
    const p = bodyPoint(theta, 1.54 + v * 0.038, 0.019);
    return { point: p, uv: [u, v * 0.2] };
  });
  ribbon(
    root,
    "side-tie-band",
    "belt",
    [
      [-0.19, 1.086, 0.1],
      [-0.182, 1.066, 0.131],
      [-0.177, 1.047, 0.148],
    ],
    0.028,
  );
  bow(root, -0.184, 1.066, 0.151, 0.7);
  return root;
}

function baska() {
  const root = group("baska");
  const sample = shell(root, "tailored-peplum", "body", {
    bottom: (theta) =>
      0.807 - 0.03 * Math.cos(theta * 2) - 0.013 * Math.cos(theta * 6),
    top: () => 1.139,
    ease: 0.021,
    flare: (y) => 0.083 * Math.max(0, (1.042 - y) / 0.28) ** 1.1,
    folds: (y) => 0.007 * Math.max(0, (1.04 - y) / 0.28),
    opening: (v) => 0.015 + 0.045 * (1 - v),
  });
  edge(root, "sculpted-hem", "trim", sample, 0, 0.003);
  edge(root, "top-binding", "trim", sample, 1);
  band(root, "waist-sash", "belt", 1.088, 0.067, 0.032);
  bow(root, 0.03, 1.083, 0.154, 0.88);
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 18 }, (_, i) => {
      const y = mix(0.807, 1.047, i / 17);
      return bodyPoint(
        side * 0.63,
        y,
        0.024,
        0.083 * Math.max(0, (1.042 - y) / 0.28) ** 1.1,
      );
    });
    seam(root, `panel-seam-${side}`, "trim", points, 0.0012);
  }
  return root;
}

function kostyum() {
  const root = group("kostyum");
  const sample = shell(root, "cropped-jacket", "body", {
    bottom: (theta) => 0.968 - 0.028 * Math.cos(theta),
    top: (theta) =>
      1.502 -
      0.205 * bell(angle(theta), 0.45) +
      0.038 * bell(Math.abs(angle(theta)) - Math.PI, 0.6),
    ease: 0.042,
    opening: () => 0.055,
    flare: (y) => 0.012 * bell(y - 0.96, 0.15),
  });
  shoulder(root, -1, 0.04);
  shoulder(root, 1, 0.04);
  lapels(root);
  edge(root, "cropped-binding", "trim", sample, 0, 0.003);
  for (const side of [-1, 1]) {
    const sleeve = limb(
      root,
      `cape-sleeve-${side}`,
      "sleeves",
      side,
      (v) => 0.087 + 0.061 * v + 0.006 * Math.sin(v * Math.PI),
      MATERIALS.sleeves,
      0.95,
    );
    edge(root, `cuff-${side}`, "trim", sleeve, 1, 0.008);
  }
  button(root, 0.028, 1.15, 0.178);
  return root;
}

function korset() {
  const root = group("korset");
  const sample = shell(root, "sweetheart-bodice", "body", {
    bottom: (theta) => 0.825 - 0.024 * Math.cos(theta * 2),
    top: (theta) => {
      const a = angle(theta);
      return 1.255 + 0.079 * (bell(a - 0.48, 0.44) + bell(a + 0.48, 0.44));
    },
    ease: 0.021,
    flare: (y) => 0.038 * Math.max(0, (1.01 - y) / 0.21),
  });
  edge(root, "sweetheart-binding", "trim", sample, 1, 0.0032);
  edge(root, "lower-binding", "trim", sample, 0, 0.0028);
  for (const theta of [-2.45, -1.35, -0.48, 0.48, 1.35, 2.45]) {
    const u = ((theta + TAU) % TAU) / TAU;
    const points = Array.from(
      { length: 22 },
      (_, i) => sample(u, i / 21).point,
    );
    seam(root, `princess-seam-${theta}`, "trim", points, 0.0012);
  }
  for (const y of [1.235, 1.145, 1.055])
    button(root, 0, y, bodyPoint(0, y, 0.025).z);
  return root;
}

function abaya() {
  const root = group("abaya");
  const sample = shell(root, "open-robe", "body", {
    bottom: (theta) => 0.235 + 0.011 * Math.cos(theta * 4),
    top: (theta) =>
      1.505 -
      0.075 * bell(angle(theta), 0.5) +
      0.035 * bell(Math.abs(angle(theta)) - Math.PI, 0.6),
    ease: 0.033,
    opening: (v) => mix(0.18, 0.255, v),
    flare: (y) => 0.126 * Math.max(0, (1.055 - y) / 0.83),
    folds: (y) => 0.006 * Math.max(0, (1.055 - y) / 0.83),
  });
  shoulder(root, -1, 0.035);
  shoulder(root, 1, 0.035);
  lapels(root, true);
  for (const side of [-1, 1]) {
    limb(
      root,
      `robe-sleeve-${side}`,
      "sleeves",
      side,
      (v) => 0.091 - 0.008 * v + 0.003 * Math.sin(v * Math.PI),
      MATERIALS.sleeves,
      0.98,
    );
    // The broad lapels own the upper opening; binding meets their lower ends at the waist.
    const points = Array.from(
      { length: 29 },
      (_, i) => sample(side < 0 ? 0 : 1, (i / 28) * 0.69).point,
    );
    seam(root, `front-facing-${side}`, "collar", points, 0.008);
  }
  band(root, "wrap-belt", "belt", 1.066, 0.043, 0.045);
  bow(root, 0.016, 1.062, 0.163, 1.1);
  return root;
}

function inspect(root) {
  const parts = new Set();
  let triangles = 0;
  let meshes = 0;
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    meshes++;
    const { geometry } = mesh;
    for (const attributeName of ["position", "normal", "uv"]) {
      const attribute = geometry.getAttribute(attributeName);
      if (
        !attribute ||
        [...attribute.array].some((value) => !Number.isFinite(value))
      ) {
        throw new Error(
          `${root.name}/${mesh.name}: missing or nonfinite ${attributeName}`,
        );
      }
    }
    const indices = geometry.index;
    triangles += indices
      ? indices.count / 3
      : geometry.attributes.position.count / 3;
    if (
      indices &&
      [...indices.array].some(
        (index) => index >= geometry.attributes.position.count,
      )
    ) {
      throw new Error(
        `${root.name}/${mesh.name}: out-of-bounds triangle index`,
      );
    }
    if (mesh.userData.partId) {
      if (!mesh.name.startsWith(`${mesh.userData.partId}.`))
        throw new Error("Part naming mismatch");
      parts.add(mesh.userData.partId);
    } else if (!mesh.userData.fixedMaterial)
      throw new Error(`Unclassified mesh: ${mesh.name}`);
  });
  const expected = EXPECTED_PARTS[root.name] ?? [];
  if (
    expected.length !== parts.size ||
    expected.some((part) => !parts.has(part))
  ) {
    throw new Error(
      `${root.name}: wrong editable part coverage: ${[...parts]}`,
    );
  }
  if (triangles > 35000)
    throw new Error(`${root.name}: triangle budget exceeded: ${triangles}`);
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.min.y < -0.001 || bounds.max.y > 1.76)
    throw new Error(`${root.name}: invalid vertical bounds`);
  return {
    meshes,
    triangles,
    parts: [...parts].sort(),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  };
}

await mkdir(OUTPUT, { recursive: true });
const manifest = {
  assetVersion: "1.0.0",
  authoredOn: "2026-09-25",
  generator: "scripts/author-garments.mjs",
  provenance:
    "deterministic authored geometry inspired by Ocharo references; not a scan or sewing pattern",
  coordinates: {
    units: "metres",
    up: "+Y",
    front: "+Z",
    origin: "base centre",
    waistY: 1.055,
  },
  assets: {},
};
for (const author of [mannequin, nimcha, baska, kostyum, korset, abaya]) {
  const root = author();
  const report = inspect(root);
  const data = await new GLTFExporter().parseAsync(root, {
    binary: true,
    onlyVisible: true,
  });
  const bytes = Buffer.from(data);
  if (bytes.length > 1_000_000)
    throw new Error(`${root.name}: GLB exceeds 1 MB: ${bytes.length}`);
  await writeFile(`${OUTPUT}/${root.name}.glb`, bytes);
  manifest.assets[root.name] = {
    file: `${root.name}.glb`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...report,
  };
  process.stdout.write(
    `${root.name}: ${report.triangles} triangles, ${bytes.length} bytes, parts=${report.parts.join(",")}\n`,
  );
}
await writeFile(
  `${OUTPUT}/asset-manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
