import { ref, shallowRef } from "vue";
import { downloadBlob, downloadText } from "@wow-two-beta/fe/foundation/files";
import {
  createCreativeHandoff,
  type CreativeReviewPackage,
} from "../../../integration/studio/clients/CreativeHandoff";

/** What a creative review is prepared from: the open design, its synced revision and the current preview. */
export interface CreativeReviewSource {
  /** The open design, exported as JSON. */
  exportLook(): string;
  /** The synced revision the export belongs to. */
  readonly revision: number;
  /** The preview as an image URL; throws while the preview is still loading. */
  capture(): string;
}

/**
 * Prepares the creative review package for the open design — its manifest and preview image — and downloads either
 * once prepared. A second prepare while one runs does nothing.
 */
export function useCreativeReview(source: CreativeReviewSource) {
  const busy = ref(false);
  const error = ref("");
  const reviewPackage = shallowRef<CreativeReviewPackage | null>(null);
  let image: Blob | null = null;

  /** Forgets a prepared package and its error, for a fresh review. */
  function reset(): void {
    reviewPackage.value = null;
    image = null;
    error.value = "";
  }

  async function prepare(note: string, approved: boolean): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      const design = JSON.parse(source.exportLook());
      const revision = source.revision;
      const response = await fetch(source.capture());
      const preview = await response.blob();
      reviewPackage.value = await createCreativeHandoff(
        design,
        revision,
        preview,
        approved,
        note,
      );
      image = preview;
    } catch (failure) {
      error.value =
        failure instanceof Error
          ? failure.message
          : "The review files could not be prepared.";
    } finally {
      busy.value = false;
    }
  }

  function downloadImage(): void {
    if (image && reviewPackage.value)
      downloadBlob(image, reviewPackage.value.derivative.fileName);
  }

  function downloadManifest(): void {
    if (reviewPackage.value)
      downloadText(
        JSON.stringify(reviewPackage.value, null, 2),
        reviewPackage.value.derivative.fileName.replace(
          /\.png$/,
          ".ocharo-review.json",
        ),
        "application/json;charset=utf-8",
      );
  }

  return {
    busy,
    error,
    reviewPackage,
    reset,
    prepare,
    downloadImage,
    downloadManifest,
  };
}
