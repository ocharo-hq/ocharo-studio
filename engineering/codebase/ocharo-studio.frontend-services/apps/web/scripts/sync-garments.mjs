import { format } from "prettier";
// Imports the Ocharo 3D library (authored in Blender, kept in the Ocharo workspace) into the studio.
// Usage: node scripts/sync-garments.mjs --from <library>/glb   (or OCHARO_3D_LIBRARY=<library>)
// From WoW2 Files: node scripts/sync-garments.mjs --files <Files root>   (or OCHARO_FILES_URL=<Files root>)
//   fetches the release manifest pinned in garments-release.lock.json (or --manifest <sha256>) from
//   {Files root}t/{tenant}/m/{sha256}, the tenant from the lock (or --tenant <name>),
//   then every listed GLB by its SHA-256, and writes what the library mode writes.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const SHA256 = /^[0-9a-f]{64}$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function verifyRelease(release, assetVersion) {
  const { sha256: releaseHash, ...releasePayload } = release;
  if (
    release.schemaVersion !== 1 ||
    release.id !== `ocharo-garments@${assetVersion}` ||
    sha256(canonical(releasePayload)) !== releaseHash
  )
    throw new Error("The immutable asset release is invalid.");
}

// Checks every model against the release, then writes the models, the manifest and the pin.
async function importRelease({
  release,
  assetVersion,
  libraryAssets,
  readModel,
  output,
  pinPath,
  log,
}) {
  const manifest = {
    release: {
      id: release.id,
      version: release.version,
      sha256: release.sha256,
    },
    assetVersion,
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
    const released = release.assets.find((asset) => asset.id === source);
    const bytes = await readModel(source, released);
    const sha = sha256(bytes);
    if (
      !released ||
      released.sha256 !== sha ||
      released.bytes !== bytes.byteLength ||
      released.file !== `${source}.glb`
    )
      throw new Error(
        `${source}: content does not match the immutable release`,
      );
    if (libraryAssets && libraryAssets[source]?.sha256 !== sha)
      throw new Error(`${source}: hash differs from the library manifest`);
    if (bytes.byteLength > LIMITS.bytes)
      throw new Error(`${source}: ${bytes.byteLength} bytes exceed the limit`);
    const details = inspect(parseGlb(bytes, source), id, parts);
    imports.push({ bytes, id });
    manifest.assets[id] = {
      file: `${id}.glb`,
      librarySource: `${source}.glb`,
      bytes: bytes.byteLength,
      sha256: sha,
      ...details,
    };
    log(
      `${id}.glb ← ${source}.glb (${details.triangles} triangles, ${bytes.byteLength} bytes)`,
    );
  }
  // No destination changes until every model, semantic part map and release hash passes.
  await mkdir(output, { recursive: true });
  for (const { bytes, id } of imports)
    await writeFile(join(output, `${id}.glb`), bytes);
  const pin = {
    release: manifest.release,
    assets: Object.fromEntries(
      Object.entries(manifest.assets).map(([id, asset]) => [
        id,
        { file: asset.file, bytes: asset.bytes, sha256: asset.sha256 },
      ]),
    ),
  };
  await writeFile(
    pinPath,
    await format(
      `// Generated by scripts/sync-garments.mjs from the immutable Ocharo Assets release.\nexport const MODEL_RELEASE = ${JSON.stringify(pin, null, 2)} as const;\n`,
      { parser: "typescript" },
    ),
  );
  await writeFile(
    join(output, "asset-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

/** Imports from a local library checkout: `<library>/glb` beside its committed release. */
export async function syncFromLibrary({
  library,
  release: releasePath,
  output,
  pinPath,
  log = console.log,
}) {
  const libraryManifest = JSON.parse(
    await readFile(join(library, "och-3d-manifest.json"), "utf8"),
  );
  const release = JSON.parse(
    await readFile(
      releasePath ??
        join(
          library,
          `../../releases/ocharo-garments-${libraryManifest.assetVersion}.json`,
        ),
      "utf8",
    ),
  );
  verifyRelease(release, libraryManifest.assetVersion);
  return importRelease({
    release,
    assetVersion: libraryManifest.assetVersion,
    libraryAssets: libraryManifest.assets,
    readModel: async (source) =>
      new Uint8Array(await readFile(join(library, `${source}.glb`))),
    output,
    pinPath,
    log,
  });
}

/** Normalises the Files root to end in a slash, so `m/{sha256}` resolves below it. */
function filesRoot(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url.href;
}

// Reads one public Files file by content hash and checks its bytes before anything uses them.
async function fetchPublic(fetch, root, sha, bytes, what) {
  const response = await fetch(new URL(`m/${sha}`, root));
  if (!response.ok)
    throw new Error(`${what}: Files answered ${response.status} for /m/${sha}`);
  const body = new Uint8Array(await response.arrayBuffer());
  if (bytes !== undefined && body.byteLength !== bytes)
    throw new Error(`${what}: ${body.byteLength} bytes, expected ${bytes}`);
  if (sha256(body) !== sha)
    throw new Error(`${what}: content differs from its SHA-256 ${sha}`);
  return body;
}

/** Imports from WoW2 Files: the release manifest by its SHA-256, then every listed GLB by its own. */
export async function syncFromFiles({
  files,
  tenant,
  manifest: manifestSha,
  release: releaseId,
  output,
  pinPath,
  fetch = globalThis.fetch,
  log = console.log,
}) {
  if (!SHA256.test(manifestSha ?? ""))
    throw new Error("The release manifest SHA-256 must be 64 lowercase hex.");
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tenant ?? ""))
    throw new Error(
      "Name the Files tenant the release serves from (--tenant or the lock's tenant).",
    );
  // A shared Files host serves plain /m/{sha256} for its default tenant only, so public files are read below theirs.
  const root = new URL(`t/${tenant}/`, filesRoot(files)).href;
  const release = JSON.parse(
    new TextDecoder().decode(
      await fetchPublic(
        fetch,
        root,
        manifestSha,
        undefined,
        "release manifest",
      ),
    ),
  );
  if (releaseId !== undefined && release.id !== releaseId)
    throw new Error(`The release manifest is ${release.id}, not ${releaseId}.`);
  verifyRelease(release, release.version);
  log(`${release.id} ← ${root}m/${manifestSha}`);
  return importRelease({
    release,
    assetVersion: release.version,
    readModel: async (source, released) => {
      if (!released || !SHA256.test(released.sha256))
        throw new Error(
          `${source}: content does not match the immutable release`,
        );
      if (released.bytes > LIMITS.bytes)
        throw new Error(`${source}: ${released.bytes} bytes exceed the limit`);
      return fetchPublic(fetch, root, released.sha256, released.bytes, source);
    },
    output,
    pinPath,
    log,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const output =
    argument("--output") ??
    fileURLToPath(new URL("../public/assets/models/", import.meta.url));
  const pinPath =
    argument("--pin") ??
    (argument("--output")
      ? join(output, "assetRelease.ts")
      : fileURLToPath(
          new URL("../src/domain/studio/assetRelease.ts", import.meta.url),
        ));
  const libraryRoot = argument("--from") ?? process.env.OCHARO_3D_LIBRARY;
  const files =
    argument("--files") ??
    (libraryRoot ? undefined : process.env.OCHARO_FILES_URL);
  if (files) {
    const pinned = JSON.parse(
      await readFile(
        new URL("./garments-release.lock.json", import.meta.url),
        "utf8",
      ),
    );
    const lock = argument("--manifest")
      ? { manifestSha256: argument("--manifest") }
      : pinned;
    await syncFromFiles({
      files,
      tenant: argument("--tenant") ?? pinned.tenant,
      manifest: lock.manifestSha256,
      release: lock.release,
      output,
      pinPath,
    });
  } else {
    if (!libraryRoot)
      throw new Error(
        "Pass --from <library>/glb or set OCHARO_3D_LIBRARY, or pass --files <Files root>.",
      );
    await syncFromLibrary({
      library: libraryRoot.endsWith("glb")
        ? libraryRoot
        : join(libraryRoot, "glb"),
      release: argument("--release"),
      output,
      pinPath,
    });
  }
}
