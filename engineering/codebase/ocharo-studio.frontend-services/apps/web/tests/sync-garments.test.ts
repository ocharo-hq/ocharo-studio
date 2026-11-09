import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonical,
  syncFromFiles,
  syncFromLibrary,
} from "../scripts/sync-garments.mjs";

const FILES = "https://files.example.test/";
const MODELS = new URL("../public/assets/models/", import.meta.url);
const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const quiet = () => {};

type Shipped = {
  librarySource: string;
  bytes: number;
  sha256: string;
  parts: string[];
};

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

// Rebuilds the 2.0.0 library and its release from the models Studio ships, so both modes read the same bytes.
async function library() {
  const root = await mkdtemp(join(tmpdir(), "ocharo-studio-sync-"));
  roots.push(root);
  const glb = join(root, "garments", "glb");
  await mkdir(glb, { recursive: true });
  await mkdir(join(root, "releases"));
  const shipped: Record<string, Shipped> = JSON.parse(
    await readFile(new URL("asset-manifest.json", MODELS), "utf8"),
  ).assets;
  const blobs = new Map<string, Uint8Array>();
  const libraryAssets: Record<string, object> = {};
  const assets = [];
  for (const [id, asset] of Object.entries(shipped)) {
    const bytes = new Uint8Array(await readFile(new URL(`${id}.glb`, MODELS)));
    const source = asset.librarySource.replace(/\.glb$/, "");
    await writeFile(join(glb, asset.librarySource), bytes);
    blobs.set(asset.sha256, bytes);
    libraryAssets[source] = { file: asset.librarySource, sha256: asset.sha256 };
    assets.push({
      id: source,
      file: asset.librarySource,
      bytes: asset.bytes,
      sha256: asset.sha256,
      parts: [...asset.parts].sort(),
    });
  }
  assets.sort((a, b) => a.id.localeCompare(b.id));
  const payload = {
    schemaVersion: 1,
    id: "ocharo-garments@2.0.0",
    version: "2.0.0",
    coordinates: { units: "metres" },
    provenance: { classification: "authored-interpretation" },
    assets,
  };
  const release = { ...payload, sha256: sha256(canonical(payload)) };
  const manifest = `${JSON.stringify(release, null, 2)}\n`;
  await writeFile(
    join(root, "releases", "ocharo-garments-2.0.0.json"),
    manifest,
  );
  await writeFile(
    join(glb, "och-3d-manifest.json"),
    JSON.stringify({ assetVersion: "2.0.0", assets: libraryAssets }),
  );
  const manifestSha = sha256(manifest);
  blobs.set(manifestSha, new TextEncoder().encode(manifest));
  return { root, glb, blobs, release, manifestSha };
}

// Answers Files' public route `/t/ocharo/m/{sha256}` from a map of bytes, recording each request; plain `/m/{sha256}`
// is the shared host's default tenant, which holds none of them.
function publicFiles(blobs: Map<string, Uint8Array>) {
  const requested: string[] = [];
  const fetch = async (input: URL | string) => {
    const url = new URL(input);
    requested.push(url.href);
    const match = /^\/t\/ocharo\/m\/([0-9a-f]{64})$/.exec(url.pathname);
    const bytes =
      url.origin === new URL(FILES).origin && match && blobs.get(match[1]);
    return bytes ? new Response(bytes) : new Response(null, { status: 404 });
  };
  return { fetch, requested };
}

const listing = (dir: string) => readdir(dir).catch(() => [] as string[]);

describe("garment sync from WoW2 Files", () => {
  it("writes exactly what the local library mode writes", async () => {
    const { root, glb, blobs, release, manifestSha } = await library();
    const local = join(root, "local");
    const remote = join(root, "remote");
    await syncFromLibrary({
      library: glb,
      output: local,
      pinPath: join(local, "assetRelease.ts"),
      log: quiet,
    });
    const files = publicFiles(blobs);
    await syncFromFiles({
      files: FILES.slice(0, -1),
      tenant: "ocharo",
      manifest: manifestSha,
      release: release.id,
      output: remote,
      pinPath: join(remote, "assetRelease.ts"),
      fetch: files.fetch,
      log: quiet,
    });

    expect(files.requested).toEqual([
      `${FILES}t/ocharo/m/${manifestSha}`,
      ...[
        "och-silhouette",
        "och-model",
        "och-nimcha",
        "och-baska",
        "och-kostyum",
        "och-korset",
        "och-abaya",
      ].map(
        (id) =>
          `${FILES}t/ocharo/m/${release.assets.find((asset) => asset.id === id)!.sha256}`,
      ),
    ]);
    const written = (await readdir(local)).sort();
    expect((await readdir(remote)).sort()).toEqual(written);
    expect(written).toHaveLength(9);
    for (const name of written)
      expect(await readFile(join(remote, name))).toEqual(
        await readFile(join(local, name)),
      );
  });

  it("refuses a manifest whose bytes differ from its pinned SHA-256", async () => {
    const { root, blobs, manifestSha } = await library();
    const tampered = new Uint8Array(blobs.get(manifestSha)!);
    tampered[tampered.length - 2] ^= 1;
    blobs.set(manifestSha, tampered);
    const output = join(root, "out");
    await expect(
      syncFromFiles({
        files: FILES,
        tenant: "ocharo",
        manifest: manifestSha,
        output,
        pinPath: join(output, "assetRelease.ts"),
        fetch: publicFiles(blobs).fetch,
        log: quiet,
      }),
    ).rejects.toThrow(/release manifest: content differs/);
    expect(await listing(output)).toEqual([]);
  });

  it("writes nothing when one model's bytes or size differ", async () => {
    const { root, blobs, release, manifestSha } = await library();
    const sha = (id: string) =>
      release.assets.find((asset) => asset.id === id)!.sha256;
    const output = join(root, "out");
    const sync = (served: Map<string, Uint8Array>) =>
      syncFromFiles({
        files: FILES,
        tenant: "ocharo",
        manifest: manifestSha,
        output,
        pinPath: join(output, "assetRelease.ts"),
        fetch: publicFiles(served).fetch,
        log: quiet,
      });

    const resized = new Map(blobs);
    resized.set(sha("och-nimcha"), blobs.get(sha("och-abaya"))!);
    await expect(sync(resized)).rejects.toThrow(
      /och-nimcha: \d+ bytes, expected/,
    );

    const flipped = new Uint8Array(blobs.get(sha("och-abaya"))!);
    flipped[flipped.length - 1] ^= 1;
    await expect(
      sync(new Map(blobs).set(sha("och-abaya"), flipped)),
    ).rejects.toThrow(/och-abaya: content differs/);
    expect(await listing(output)).toEqual([]);
  });

  it("refuses a manifest of another release than the lock names", async () => {
    const { root, blobs, manifestSha } = await library();
    const output = join(root, "out");
    await expect(
      syncFromFiles({
        files: FILES,
        tenant: "ocharo",
        manifest: manifestSha,
        release: "ocharo-garments@3.0.0",
        output,
        pinPath: join(output, "assetRelease.ts"),
        fetch: publicFiles(blobs).fetch,
        log: quiet,
      }),
    ).rejects.toThrow(/not ocharo-garments@3\.0\.0/);
  });

  it("checks the manifest SHA-256 before fetching, and reports a missing file", async () => {
    const { root, blobs } = await library();
    const files = publicFiles(blobs);
    const output = join(root, "out");
    const options = {
      files: FILES,
      tenant: "ocharo",
      output,
      pinPath: join(output, "assetRelease.ts"),
      fetch: files.fetch,
      log: quiet,
    };
    await expect(
      syncFromFiles({ ...options, manifest: "not-a-hash" }),
    ).rejects.toThrow(/64 lowercase hex/);
    expect(files.requested).toEqual([]);
    await expect(
      syncFromFiles({ ...options, manifest: "0".repeat(64) }),
    ).rejects.toThrow(/Files answered 404/);
  });

  it("pins the committed release manifest in the lock", async () => {
    const lock = JSON.parse(
      await readFile(
        new URL("../scripts/garments-release.lock.json", import.meta.url),
        "utf8",
      ),
    );
    const shipped = JSON.parse(
      await readFile(new URL("asset-manifest.json", MODELS), "utf8"),
    );
    expect(lock.release).toBe(shipped.release.id);
    expect(lock.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
