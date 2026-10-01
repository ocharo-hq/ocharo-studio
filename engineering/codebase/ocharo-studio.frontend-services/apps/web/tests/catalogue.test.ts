import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GARMENTS,
  MATERIALS,
  isMaterialApplicable,
} from "../src/domain/studio/catalog";
import { CATALOGUE_MATERIALS } from "../src/domain/studio/catalogueMaterialDefinitions";
import type {
  GarmentId,
  MaterialDefinition,
  MaterialKind,
} from "../src/domain/studio/types";

interface CatalogueManifest {
  materials: MaterialDefinition[];
  products: {
    id: string;
    garment: GarmentId;
    kinds: MaterialKind[];
    canonicalJson: string;
    sourcePhotos: string[];
    sourceVideos: string[];
    generatedReferences: string[];
    materialIds: string[];
  }[];
  textures: {
    id: string;
    runtimeUrl: string;
    runtimeBytes: number;
    runtimeSha256: string;
    sourceProductIds: string[];
  }[];
}

const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../public/assets/textures/catalogue-materials.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as CatalogueManifest;

describe("catalogue material coverage", () => {
  it("maps every classified source product to materials of its declared kinds", () => {
    const expectedIds = Object.entries({
      nimcha: 16,
      baska: 6,
      kostyum: 4,
      korset: 2,
      abaya: 1,
    }).flatMap(([garment, count]) =>
      Array.from(
        { length: count },
        (_, index) => `${garment}-v${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(manifest.products.map((product) => product.id).sort()).toEqual(
      expectedIds.sort(),
    );
    expect(
      manifest.products.flatMap((product) => product.sourcePhotos),
    ).toHaveLength(49);
    expect(
      manifest.products.flatMap((product) => product.sourceVideos),
    ).toHaveLength(11);
    expect(
      manifest.products.flatMap((product) => product.generatedReferences),
    ).toHaveLength(58);
    for (const product of manifest.products) {
      expect(product.canonicalJson).toContain(
        `/products/${product.id}/och-${product.id}.json`,
      );
      expect(product.materialIds.length, product.id).toBeGreaterThan(0);
      const coveredKinds = new Set<MaterialKind>();
      for (const id of product.materialIds) {
        const material = CATALOGUE_MATERIALS.find((entry) => entry.id === id);
        expect(material, `${product.id}: ${id}`).toBeDefined();
        if (!material) continue;
        expect(material.sourceProductIds, id).toContain(product.id);
        expect(product.kinds, id).toContain(material.kind);
        coveredKinds.add(material.kind);
        expect(
          GARMENTS.find(
            (garment) => garment.id === product.garment,
          )?.parts.some((part) =>
            isMaterialApplicable(product.garment, part.id, id),
          ),
          id,
        ).toBe(true);
      }
      expect([...coveredKinds].sort(), product.id).toEqual(
        [...product.kinds].sort(),
      );
    }
  });

  it("ships every unique texture as a bounded WebP with matching provenance hashes", () => {
    const urls = manifest.textures.map((texture) => texture.runtimeUrl);
    expect(manifest.textures).toHaveLength(21);
    expect(new Set(manifest.textures.map((texture) => texture.id)).size).toBe(
      21,
    );
    expect(new Set(urls).size).toBe(21);
    const usedUrls = new Set(
      CATALOGUE_MATERIALS.flatMap((material) =>
        material.textureUrl ? [material.textureUrl] : [],
      ),
    );
    expect([...usedUrls].sort()).toEqual([...urls].sort());
    for (const texture of manifest.textures) {
      expect(texture.runtimeUrl).toMatch(
        /^\/assets\/textures\/catalogue\/[a-z0-9-]+\.webp$/,
      );
      const file = fileURLToPath(
        new URL(`../public${texture.runtimeUrl}`, import.meta.url),
      );
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      expect(statSync(file).size).toBe(texture.runtimeBytes);
      expect(bytes.length).toBeLessThanOrEqual(400_000);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        texture.runtimeSha256,
      );
      expect(texture.sourceProductIds.length).toBeGreaterThan(0);
    }
  });

  it("keeps provenance definitions synchronized and every material reachable", () => {
    expect(CATALOGUE_MATERIALS).toEqual(manifest.materials);
    expect(new Set(MATERIALS.map((material) => material.id)).size).toBe(
      MATERIALS.length,
    );
    for (const material of CATALOGUE_MATERIALS) {
      expect(material.sourceProductIds?.length, material.id).toBeGreaterThan(0);
      expect(material.garmentIds?.length, material.id).toBeGreaterThan(0);
      expect(
        GARMENTS.some((garment) =>
          garment.parts.some((part) =>
            isMaterialApplicable(garment.id, part.id, material.id),
          ),
        ),
        material.id,
      ).toBe(true);
    }
    for (const garment of GARMENTS) {
      for (const part of garment.parts) {
        expect(
          MATERIALS.some((material) => material.id === part.defaultMaterialId),
        ).toBe(true);
        expect(
          isMaterialApplicable(garment.id, part.id, part.defaultMaterialId),
          `${garment.id}.${part.id}`,
        ).toBe(true);
      }
    }
  });
});
