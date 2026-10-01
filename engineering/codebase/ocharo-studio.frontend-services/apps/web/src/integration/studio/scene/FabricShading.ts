import * as THREE from "three";
import type { AffinePlacement } from "../../../domain/studio/placement";
import type {
  MaterialDefinition,
  MaterialKind,
} from "../../../domain/studio/types";

/** Thread interlacing drawn as a tileable relief under the printed pattern. */
export type Weave = "plain" | "twill" | "satin" | "rib" | "pile";

/** How a cloth kind catches light: weave relief, sheen and stretched satin highlights. */
export interface FabricFinish {
  readonly weave: Weave;
  /** Thread pitch in metres. */
  readonly pitch: number;
  /** Normal-map strength of the weave relief. */
  readonly relief: number;
  readonly sheen: number;
  readonly sheenRoughness: number;
  /** Highlights stretched along the grain, as on satin; 0 for matte cloth. */
  readonly anisotropy: number;
}

const FINISHES: Readonly<Record<MaterialKind, FabricFinish>> = {
  atlas: finish("satin", 0.5, 0.25, 0.45, 0.35, 0.35),
  adras: finish("rib", 1.1, 0.55, 0.5, 0.5, 0.15),
  beqasam: finish("rib", 1, 0.5, 0.45, 0.5, 0.1),
  shoyi: finish("satin", 0.45, 0.2, 0.4, 0.3, 0.25),
  barbi: finish("satin", 0.5, 0.25, 0.5, 0.4, 0.2),
  "synthetic-poplin": finish("plain", 0.6, 0.35, 0.3, 0.55, 0),
  "synthetic-fabric": finish("twill", 0.7, 0.35, 0.35, 0.5, 0),
  "indian-scarf": finish("plain", 0.5, 0.3, 0.35, 0.45, 0),
  gobelen: finish("twill", 1.6, 0.8, 0.3, 0.7, 0),
  velvet: finish("pile", 0.5, 0.25, 1, 0.3, 0),
  cotton: finish("plain", 0.9, 0.45, 0.3, 0.7, 0),
  linen: finish("plain", 1.4, 0.7, 0.3, 0.8, 0),
  metallic: finish("plain", 0.6, 0.3, 0.2, 0.4, 0),
};

function finish(
  weave: Weave,
  pitchMillimetres: number,
  relief: number,
  sheen: number,
  sheenRoughness: number,
  anisotropy: number,
): FabricFinish {
  return {
    weave,
    pitch: pitchMillimetres / 1000,
    relief,
    sheen,
    sheenRoughness,
    anisotropy,
  };
}

export function fabricFinish(kind: MaterialKind): FabricFinish {
  return FINISHES[kind];
}

/** Thread crossings per weave tile; each weave repeats exactly within its tile. */
export const WEAVE_CELLS: Readonly<Record<Weave, number>> = {
  plain: 8,
  twill: 6,
  satin: 5,
  rib: 8,
  pile: 8,
};
const PIXELS_PER_CELL = 16;
/** Metres of cloth per unit of the garments' cylindrical surface UV, around then down. */
const SURFACE_METRES: readonly [number, number] = [0.8, 1.66];
/** Holder meshes keep their authored metric UVs. */
const METRIC_UV: readonly [number, number] = [1, 1];

const wrap = (value: number, period: number): number =>
  ((value % period) + period) % period;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const crown = (offset: number, half: number): number => {
  const t = Math.abs(offset) / half;
  return t >= 1 ? 0 : Math.sqrt(1 - t * t);
};

/** Whether the lengthwise (warp) thread lies on top at crossing (i, j). */
function warpOver(weave: Weave, i: number, j: number): boolean {
  const cells = WEAVE_CELLS[weave];
  const x = wrap(i, cells),
    y = wrap(j, cells);
  if (weave === "twill") return (x + y) % 3 !== 0;
  if (weave === "satin") return (2 * x + y) % 5 !== 0;
  return (x + y) % 2 === 0;
}

function lattice(i: number, j: number, cells: number): number {
  const x = wrap(i, cells),
    y = wrap(j, cells);
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise(x: number, y: number, cells: number): number {
  const i = Math.floor(x),
    j = Math.floor(y);
  const s = smooth(x - i),
    t = smooth(y - j);
  const a = lattice(i, j, cells),
    b = lattice(i + 1, j, cells),
    c = lattice(i, j + 1, cells),
    d = lattice(i + 1, j + 1, cells);
  return (a * (1 - s) + b * s) * (1 - t) + (c * (1 - s) + d * s) * t;
}

/**
 * Relief height (0..1, one unit per thread radius) at a point measured in thread cells;
 * `x` crosses the lengthwise threads and `y` runs along them. Periodic over the weave's cells.
 */
export function weaveHeight(weave: Weave, x: number, y: number): number {
  const cells = WEAVE_CELLS[weave];
  if (weave === "pile")
    return (
      0.65 * valueNoise(x * 2, y * 2, cells * 2) +
      0.35 * valueNoise(x * 4, y * 4, cells * 4)
    );
  const i = Math.floor(x),
    j = Math.floor(y);
  const across = x - i - 0.5,
    along = y - j - 0.5;
  if (weave === "rib") {
    const rib = crown(along, 0.5);
    return Math.max(rib, 0.25 * crown(across, 0.35) * (1 - rib));
  }
  // Each thread rises where it floats over and dips where it passes under, continuously across cells.
  const lift = (a: number, b: number) => (warpOver(weave, a, b) ? 1 : 0.25);
  const row = y - 0.5,
    j0 = Math.floor(row),
    t = smooth(row - j0);
  const warpLift = lift(i, j0) * (1 - t) + lift(i, j0 + 1) * t;
  const column = x - 0.5,
    i0 = Math.floor(column),
    s = smooth(column - i0);
  const weftLift =
    (1.25 - lift(i0, j)) * (1 - s) + (1.25 - lift(i0 + 1, j)) * s;
  return Math.max(
    crown(across, 0.44) * warpLift,
    crown(along, 0.44) * weftLift,
  );
}

const weaveTextures = new Map<Weave, THREE.DataTexture>();

/** A shared tangent-space normal map of one weave tile; callers clone it to give each part its own transform. */
export function weaveNormalMap(weave: Weave): THREE.DataTexture {
  const cached = weaveTextures.get(weave);
  if (cached) return cached;
  const cells = WEAVE_CELLS[weave];
  const size = cells * PIXELS_PER_CELL;
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      heights[y * size + x] = weaveHeight(
        weave,
        (x + 0.5) / PIXELS_PER_CELL,
        (y + 0.5) / PIXELS_PER_CELL,
      );
  // A unit of height equals a thread radius, about 0.44 of a cell.
  const depth = 0.44 * PIXELS_PER_CELL;
  const at = (x: number, y: number) =>
    heights[wrap(y, size) * size + wrap(x, size)]!;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = ((at(x + 1, y) - at(x - 1, y)) / 2) * depth;
      const dy = ((at(x, y + 1) - at(x, y - 1)) / 2) * depth;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round((-dx / length) * 127.5 + 127.5);
      data[offset + 1] = Math.round((-dy / length) * 127.5 + 127.5);
      data[offset + 2] = Math.round((1 / length) * 127.5 + 127.5);
      data[offset + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  weaveTextures.set(weave, texture);
  return texture;
}

/** A textile surface: printed pattern or solid colour over its kind's weave, sheen and satin highlights. */
export function createFabricMaterial(
  definition: MaterialDefinition,
  map: THREE.Texture | null,
  textureAnisotropy: number,
): THREE.MeshPhysicalMaterial {
  const look = fabricFinish(definition.kind);
  const normalMap = weaveNormalMap(look.weave).clone();
  normalMap.anisotropy = textureAnisotropy;
  normalMap.matrixAutoUpdate = false;
  const silky = look.weave === "satin" || look.weave === "rib";
  const color = new THREE.Color(map ? "#ffffff" : definition.color);
  return new THREE.MeshPhysicalMaterial({
    color,
    map,
    roughness: definition.roughness,
    metalness: definition.metalness,
    side: THREE.DoubleSide,
    normalMap,
    normalScale: new THREE.Vector2(look.relief, look.relief),
    sheen: look.sheen,
    sheenRoughness: look.sheenRoughness,
    // Silk sheen stays pale; matte cloth takes its sheen from the dye.
    sheenColor: silky
      ? new THREE.Color("#ffffff")
      : map
        ? new THREE.Color("#ffffff")
        : color.clone().lerp(new THREE.Color("#ffffff"), 0.45),
    sheenColorMap: silky ? null : map,
    anisotropy: look.anisotropy,
    anisotropyRotation: Math.PI / 2,
  });
}

/** Positions the printed pattern and turns the weave with it; thread size stays physical at any motif scale. */
export function placeFabric(
  material: THREE.MeshPhysicalMaterial,
  kind: MaterialKind,
  transform: AffinePlacement,
  rotationDegrees: number,
): void {
  const map = material.map;
  if (map) {
    map.matrixAutoUpdate = false;
    map.matrix.set(
      transform.a,
      transform.b,
      transform.tx,
      transform.c,
      transform.d,
      transform.ty,
      0,
      0,
      1,
    );
  }
  orientWeave(material, kind, rotationDegrees, SURFACE_METRES);
}

function orientWeave(
  material: THREE.MeshPhysicalMaterial,
  kind: MaterialKind,
  rotationDegrees: number,
  metresPerUv: readonly [number, number],
): void {
  const normalMap = material.normalMap;
  if (!normalMap) return;
  const look = fabricFinish(kind);
  const tile = look.pitch * WEAVE_CELLS[look.weave];
  const ku = metresPerUv[0] / tile,
    kv = metresPerUv[1] / tile;
  const radians = (rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians),
    sine = Math.sin(radians);
  normalMap.matrix.set(
    cosine * ku,
    sine * kv,
    0,
    -sine * ku,
    cosine * kv,
    0,
    0,
    0,
    1,
  );
}

const HOLDER_CLOTH: readonly [RegExp, MaterialKind][] = [
  [/linen|form/i, "linen"],
  [/crepe|skirt|dress/i, "cotton"],
];

/** Gives the silhouette's or model's cloth the same weave and sheen as garments; skin, hair and trims stay as authored. */
export function dressHolderCloth(
  mesh: THREE.Mesh,
  textureAnisotropy: number,
): void {
  const source = mesh.material;
  if (!(source instanceof THREE.MeshStandardMaterial) || source.metalness > 0)
    return;
  const kind = HOLDER_CLOTH.find(([pattern]) => pattern.test(source.name))?.[1];
  if (!kind) return;
  const look = fabricFinish(kind);
  const normalMap = weaveNormalMap(look.weave).clone();
  normalMap.anisotropy = textureAnisotropy;
  normalMap.matrixAutoUpdate = false;
  const material = new THREE.MeshPhysicalMaterial({
    name: source.name,
    color: source.color,
    roughness: Math.max(source.roughness, 0.75),
    metalness: 0,
    side: source.side,
    normalMap,
    normalScale: new THREE.Vector2(look.relief * 0.8, look.relief * 0.8),
    sheen: look.sheen,
    sheenRoughness: look.sheenRoughness,
    sheenColor: source.color.clone().lerp(new THREE.Color("#ffffff"), 0.4),
  });
  orientWeave(material, kind, 0, METRIC_UV);
  mesh.material = material;
  source.dispose();
}
