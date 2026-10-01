import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MODEL_RELEASE } from "../../domain/studio/assetRelease";

/** Verifies shipped geometry against the compiled release pin before Three.js parses it. */
export async function loadVerifiedModel(
  loader: GLTFLoader,
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<GLTF> {
  const expected = Object.values(MODEL_RELEASE.assets).find(
    (asset) => `/assets/models/${asset.file}` === url,
  );
  if (!expected)
    throw new Error("The requested model is outside the pinned asset release.");
  const response = await fetcher(url);
  if (!response.ok)
    throw new Error(`The model could not be loaded (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (bytes.byteLength !== expected.bytes || hash !== expected.sha256)
    throw new Error(
      "The model differs from its approved asset release. Restore the shipped assets before continuing.",
    );
  return loader.parseAsync(bytes, "/assets/models/");
}
