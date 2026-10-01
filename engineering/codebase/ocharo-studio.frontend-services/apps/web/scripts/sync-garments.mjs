import { format } from "prettier";
// Imports the Ocharo 3D library (authored in Blender, kept in the Ocharo workspace) into the studio.
// Usage: node scripts/sync-garments.mjs --from <library>/glb   (or OCHARO_3D_LIBRARY=<library>)
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const OUTPUT =
  argument("--output") ??
  fileURLToPath(new URL("../public/assets/models/", import.meta.url));
const ASSETS = {
  mannequin: { source: "och-silhouette", parts: [] },
  // The catalogue model holds garments in studio renders only.
  model: { source: "och-model", parts: [] },
  nimcha: { source: "och-nimcha", parts: ["belt", "body", "collar", "trim"] },
  baska: { source: "och-baska", parts: ["belt", "body", "trim"] },
  kostyum: {
    source: "och-kostyum",
    parts: ["body", "collar", "sleeves", "trim"],
  },
  korset: { source: "och-korset", parts: ["body", "trim"] },
  abaya: { source: "och-abaya", parts: ["belt", "body", "collar", "sleeves"] },
};
const LIMITS = { triangles: 60000, bytes: 3_000_000, top: 1.8 };
// Mannequin nodes may appear only with a garment part, such as soft arms under sleeves.
const PART_IDS = ["belt", "body", "collar", "sleeves", "trim"];
// Holders carry fixed materials only; garments carry parts and fixed attachments.
const HOLDERS = ["mannequin", "model"];

function libraryDir() {
  const flag = process.argv.indexOf("--from");
  const root =
    flag > 0 ? process.argv[flag + 1] : process.env.OCHARO_3D_LIBRARY;
  if (!root)
    throw new Error("Pass --from <library>/glb or set OCHARO_3D_LIBRARY.");
  return root.endsWith("glb") ? root : join(root, "glb");
}

function parseGlb(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2)
    throw new Error(`${name}: not a glTF 2 binary`);
  if (view.getUint32(8, true) !== bytes.byteLength)
    throw new Error(`${name}: header length mismatch`);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)),
  );
  const binStart = 20 + jsonLength + 8;
  const binLength = view.getUint32(20 + jsonLength, true);
  return { json, bin: bytes.subarray(binStart, binStart + binLength) };
}

function readAccessor({ json, bin }, index) {
  const accessor = json.accessors[index];
  const bufferView = json.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const offset =
    bin.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const Type = {
    5126: Float32Array,
    5125: Uint32Array,
    5123: Uint16Array,
    5121: Uint8Array,
  }[accessor.componentType];
  return new Type(
    bin.buffer.slice(
      offset,
      offset + accessor.count * width * Type.BYTES_PER_ELEMENT,
    ),
  );
}

function inspect(glb, id, expectedParts) {
  const parts = new Set();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const showWith = {};
  let meshes = 0;
  let triangles = 0;
  for (const node of glb.json.nodes) {
    if (node.mesh === undefined) continue;
    meshes++;
    const extras = node.extras ?? {};
    if (extras.showWith !== undefined) {
      if (!HOLDERS.includes(id) || !PART_IDS.includes(extras.showWith))
        throw new Error(`${id}: ${node.name} shows with ${extras.showWith}`);
      showWith[node.name] = extras.showWith;
    }
    if (extras.partId) parts.add(extras.partId);
    else if (!HOLDERS.includes(id) && extras.fixedMaterial !== true)
      throw new Error(`${id}: ${node.name} is neither a part nor fixed`);
    for (const primitive of glb.json.meshes[node.mesh].primitives) {
      for (const key of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
        if (primitive.attributes[key] === undefined)
          throw new Error(`${id}: ${node.name} lacks ${key}`);
        if (
          !readAccessor(glb, primitive.attributes[key]).every(Number.isFinite)
        )
          throw new Error(`${id}: ${node.name} ${key} is not finite`);
      }
      const positions = readAccessor(glb, primitive.attributes.POSITION);
      for (let i = 0; i < positions.length; i += 3)
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], positions[i + axis]);
          max[axis] = Math.max(max[axis], positions[i + axis]);
        }
      const indices = readAccessor(glb, primitive.indices);
      if (indices.some((value) => value >= positions.length / 3))
        throw new Error(`${id}: ${node.name} index out of range`);
      triangles += indices.length / 3;
    }
  }
  const found = [...parts].sort();
  if (found.join() !== [...expectedParts].sort().join())
    throw new Error(`${id}: parts ${found} expected ${expectedParts}`);
  if (triangles > LIMITS.triangles)
    throw new Error(`${id}: ${triangles} triangles exceed the limit`);
  if (min[1] < -0.001 || max[1] > LIMITS.top)
    throw new Error(`${id}: vertical bounds ${min[1]}..${max[1]}`);
  const round = (value) => Math.round(value * 1e5) / 1e5;
  return {
    meshes,
    triangles,
    parts: found,
    ...(Object.keys(showWith).length ? { showWith } : {}),
    bounds: { min: min.map(round), max: max.map(round) },
  };
}

const library = libraryDir();
const libraryManifest = JSON.parse(
  await readFile(join(library, "och-3d-manifest.json"), "utf8"),
);
const release = JSON.parse(
  await readFile(
    argument("--release") ??
      join(
        library,
        `../../releases/ocharo-garments-${libraryManifest.assetVersion}.json`,
      ),
    "utf8",
  ),
);
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const { sha256: releaseHash, ...releasePayload } = release;
if (
  release.schemaVersion !== 1 ||
  release.id !== `ocharo-garments@${libraryManifest.assetVersion}` ||
  createHash("sha256").update(canonical(releasePayload)).digest("hex") !==
    releaseHash
)
  throw new Error("The immutable asset release is invalid.");
const manifest = {
  release: { id: release.id, version: release.version, sha256: releaseHash },
  assetVersion: libraryManifest.assetVersion,
  source:
    "ocharo-ws/workbench/ocharo-assets/engineering/codebase/ocharo-assets.library/garments (Blender build: source/build.py)",
  importer: "scripts/sync-garments.mjs",
  provenance:
    "authored 3D interpretation of the Ocharo brand silhouette and garment references; not a scan or sewing pattern",
  coordinates: {
    units: "metres",
    up: "+Y",
    front: "+Z",
    origin: "floor centre",
    waistY: 1.12,
  },
  assets: {},
};
const imports = [];
for (const [id, { source, parts }] of Object.entries(ASSETS)) {
  const file = join(library, `${source}.glb`);
  const bytes = new Uint8Array(await readFile(file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const expected = libraryManifest.assets[source];
  const released = release.assets.find((asset) => asset.id === source);
  if (
    !released ||
    released.sha256 !== sha256 ||
    released.bytes !== bytes.byteLength ||
    released.file !== `${source}.glb`
  )
    throw new Error(`${source}: content does not match the immutable release`);
  if (!expected || expected.sha256 !== sha256)
    throw new Error(`${source}: hash differs from the library manifest`);
  if (bytes.byteLength > LIMITS.bytes)
    throw new Error(`${source}: ${bytes.byteLength} bytes exceed the limit`);
  const details = inspect(parseGlb(bytes, source), id, parts);
  imports.push({ file, id });
  manifest.assets[id] = {
    file: `${id}.glb`,
    librarySource: `${source}.glb`,
    bytes: bytes.byteLength,
    sha256,
    ...details,
  };
  console.log(
    `${id}.glb ← ${source}.glb (${details.triangles} triangles, ${bytes.byteLength} bytes)`,
  );
}
// No destination changes until every model, semantic part map and release hash passes.
await mkdir(OUTPUT, { recursive: true });
for (const { file, id } of imports)
  await copyFile(file, join(OUTPUT, `${id}.glb`));
const pin = {
  release: manifest.release,
  assets: Object.fromEntries(
    Object.entries(manifest.assets).map(([id, asset]) => [
      id,
      { file: asset.file, bytes: asset.bytes, sha256: asset.sha256 },
    ]),
  ),
};
const pinPath =
  argument("--pin") ??
  (argument("--output")
    ? join(OUTPUT, "assetRelease.ts")
    : fileURLToPath(
        new URL("../src/domain/studio/assetRelease.ts", import.meta.url),
      ));
await writeFile(
  pinPath,
  await format(
    `// Generated by scripts/sync-garments.mjs from the immutable Ocharo Assets release.\nexport const MODEL_RELEASE = ${JSON.stringify(pin, null, 2)} as const;\n`,
    { parser: "typescript" },
  ),
);
await writeFile(
  join(OUTPUT, "asset-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
