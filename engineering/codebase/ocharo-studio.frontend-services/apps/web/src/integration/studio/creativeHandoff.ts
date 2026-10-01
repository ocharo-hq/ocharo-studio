import { getMaterial } from "../../domain/studio/catalog";
import { MODEL_RELEASE } from "../../domain/studio/assetRelease";
import { migrateDocument } from "../../domain/studio/document";
import type { DesignDocument } from "../../domain/studio/types";
import { getConnectedSession } from "./access";
import { getWorkspaceId } from "./serverRepository";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function contentHash(bytes: ArrayBuffer): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
const hashJson = (value: unknown) =>
  contentHash(
    new TextEncoder().encode(canonicalJson(value)).buffer as ArrayBuffer,
  );

export interface CreativeReviewPackage {
  schemaVersion: 1;
  exportId: string;
  createdAt: string;
  source: {
    application: "ocharo-studio";
    workspaceId: string;
    lookId: string;
    revision: number;
  };
  design: { document: DesignDocument; sha256: string };
  assetReleases: readonly { id: string; sha256: string }[];
  materials: readonly {
    slot: string;
    materialId: string;
    source: string;
    sha256: string;
    hashKind: "texture" | "material-definition";
  }[];
  derivative: {
    fileName: string;
    sha256: string;
    mediaType: "image/png";
    bytes: number;
    classification: "creative-visualization";
  };
  sourceApproval: { status: "approved-for-review"; note: string };
}

/** Packages an explicitly submitted visualization; receiving products still own review and publication. */
export async function createCreativeHandoff(
  document: DesignDocument,
  revision: number,
  image: Blob,
  approvedForReview: boolean,
  note: string,
  fetcher: typeof fetch = fetch,
): Promise<CreativeReviewPackage> {
  const design = migrateDocument(document);
  if (!design || !Number.isSafeInteger(revision) || revision < 0)
    throw new Error("The design cannot be exported safely.");
  if (!approvedForReview)
    throw new Error("Confirm this visualization is ready for review.");
  if (note.length > 1000)
    throw new Error("Keep the review note under 1,000 characters.");
  if (
    image.type !== "image/png" ||
    image.size > 5 * 1024 * 1024 ||
    image.size < 8
  )
    throw new Error("Choose a PNG preview smaller than 5 MiB.");
  const bytes = await image.arrayBuffer();
  if (
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => new Uint8Array(bytes)[index] === byte,
    )
  )
    throw new Error("The preview is not a valid PNG.");
  const materials = [];
  const hashes = new Map<string, string>();
  for (const [slot, assignment] of Object.entries(design.parts)) {
    if (!assignment) continue;
    const material = getMaterial(assignment.materialId);
    if (!hashes.has(material.id)) {
      if (material.textureUrl) {
        if (
          !material.textureUrl.startsWith("/assets/textures/") ||
          material.textureUrl.includes("..")
        )
          throw new Error("The material texture is outside the local library.");
        const response = await fetcher(material.textureUrl);
        if (!response.ok)
          throw new Error(
            `Material source unavailable: ${material.name}. Your design is preserved.`,
          );
        hashes.set(
          material.id,
          await contentHash(await response.arrayBuffer()),
        );
      } else hashes.set(material.id, await hashJson(material));
    }
    materials.push({
      slot,
      materialId: material.id,
      source: material.provenance,
      sha256: hashes.get(material.id)!,
      hashKind: material.textureUrl
        ? ("texture" as const)
        : ("material-definition" as const),
    });
  }
  const exportId = crypto.randomUUID();
  const name =
    design.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "ocharo-look";
  return {
    schemaVersion: 1,
    exportId,
    createdAt: new Date().toISOString(),
    source: {
      application: "ocharo-studio",
      workspaceId: getConnectedSession()?.workspaceId ?? getWorkspaceId(),
      lookId: design.id,
      revision,
    },
    design: { document: design, sha256: await hashJson(design) },
    assetReleases: [
      { id: MODEL_RELEASE.release.id, sha256: MODEL_RELEASE.release.sha256 },
    ],
    materials,
    derivative: {
      fileName: `${name}-${exportId.slice(0, 8)}.png`,
      sha256: await contentHash(bytes),
      mediaType: "image/png",
      bytes: image.size,
      classification: "creative-visualization",
    },
    sourceApproval: { status: "approved-for-review", note: note.trim() },
  };
}
