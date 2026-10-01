import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadVerifiedModel } from "../src/integration/studio/modelAssets";
describe("pinned geometry", () => {
  it("parses only exact released bytes", async () => {
    const original = await readFile(
      new URL("../public/assets/models/nimcha.glb", import.meta.url),
    );
    const loader = new GLTFLoader();
    const parse = vi
      .spyOn(loader, "parseAsync")
      .mockResolvedValue({ scene: {} } as never);
    await loadVerifiedModel(
      loader,
      "/assets/models/nimcha.glb",
      async () => new Response(new Uint8Array(original).buffer),
    );
    expect(parse).toHaveBeenCalledTimes(1);
    original[original.length - 1] ^= 1;
    await expect(
      loadVerifiedModel(
        loader,
        "/assets/models/nimcha.glb",
        async () => new Response(new Uint8Array(original).buffer),
      ),
    ).rejects.toThrow(/differs/);
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("rejects paths outside the pinned model set before fetching", async () => {
    const fetcher = vi.fn();
    await expect(
      loadVerifiedModel(
        new GLTFLoader(),
        "https://other.test/asset.glb",
        fetcher,
      ),
    ).rejects.toThrow(/outside/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
