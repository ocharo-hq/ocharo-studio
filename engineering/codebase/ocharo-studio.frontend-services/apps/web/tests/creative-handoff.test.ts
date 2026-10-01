import { describe, expect, it, vi } from "vitest";
vi.mock("../src/integration/studio/serverRepository", () => ({
  getWorkspaceId: () => "d0a8c678-c27f-478f-b4e8-c9928bf88c21",
}));
import {
  canonicalJson,
  contentHash,
  createCreativeHandoff,
} from "../src/integration/studio/creativeHandoff";
import { createDesignDocument } from "../src/domain/studio/document";
const png = () =>
  new Blob(
    [
      Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
    ],
    { type: "image/png" },
  );
const textures = vi.fn(async () => new Response("texture evidence"));
describe("creative review package", () => {
  it("pins exact design, image, materials and released geometry without publishing", async () => {
    const document = createDesignDocument();
    const image = png();
    const result = await createCreativeHandoff(
      document,
      7,
      image,
      true,
      "For the editorial draft",
      textures,
    );
    expect(result.source).toMatchObject({
      application: "ocharo-studio",
      lookId: document.id,
      revision: 7,
    });
    expect(result.derivative.sha256).toBe(
      await contentHash(await image.arrayBuffer()),
    );
    expect(result.derivative.classification).toBe("creative-visualization");
    expect(result.assetReleases[0].id).toBe("ocharo-garments@2.0.0");
    expect(result.materials).toHaveLength(Object.keys(document.parts).length);
    expect(
      result.materials.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)),
    ).toBe(true);
    expect(result.sourceApproval.status).toBe("approved-for-review");
    expect(result).not.toHaveProperty("publishedAt");
    document.name = "Changed afterward";
    expect(result.design.document.name).not.toBe(document.name);
    expect(result.design.sha256).toBe(
      await contentHash(
        new TextEncoder().encode(canonicalJson(result.design.document)).buffer,
      ),
    );
  });
  it("requires explicit review acknowledgement and a matching supported image", async () => {
    const document = createDesignDocument();
    await expect(
      createCreativeHandoff(document, 0, png(), false, "", textures),
    ).rejects.toThrow(/Confirm/);
    await expect(
      createCreativeHandoff(
        document,
        0,
        new Blob(["not png"], { type: "image/png" }),
        true,
        "",
        textures,
      ),
    ).rejects.toThrow(/PNG/);
    await expect(
      createCreativeHandoff(document, -1, png(), true, "", textures),
    ).rejects.toThrow(/safely/);
  });
  it("does not export unverifiable texture provenance", async () => {
    await expect(
      createCreativeHandoff(
        createDesignDocument(),
        0,
        png(),
        true,
        "",
        async () => new Response("", { status: 404 }),
      ),
    ).rejects.toThrow(/Material source unavailable/);
  });
});
