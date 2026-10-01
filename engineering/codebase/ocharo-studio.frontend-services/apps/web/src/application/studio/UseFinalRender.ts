import { onScopeDispose, shallowRef, type ShallowRef } from "vue";
import { downloadBlob } from "@wow-two-beta/ui-vue/foundation/files";
import type { DesignDocument } from "../../domain/studio/types";
import type { FinalRenderOptions } from "../../integration/studio/render/RenderFraming";

export {
  RENDER_SIZES,
  type FinalRenderOptions,
  type RenderBackdrop,
  type RenderHolder,
  type RenderSize,
  type RenderView,
} from "../../integration/studio/render/RenderFraming";

export type FinalRenderStatus = "idle" | "rendering" | "ready" | "failed";

export interface FinalRenderControls {
  readonly status: ShallowRef<FinalRenderStatus>;
  readonly imageUrl: ShallowRef<string | null>;
  readonly error: ShallowRef<string | null>;
  render(design: DesignDocument, options: FinalRenderOptions): Promise<void>;
  download(fileName: string): void;
}

/** Runs one offscreen studio render at a time and keeps the latest image for preview and download. */
export function useFinalRender(): FinalRenderControls {
  const status = shallowRef<FinalRenderStatus>("idle");
  const imageUrl = shallowRef<string | null>(null);
  const error = shallowRef<string | null>(null);
  let image: Blob | null = null;
  let run = 0;

  function clear(): void {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = null;
    image = null;
  }

  async function render(
    design: DesignDocument,
    options: FinalRenderOptions,
  ): Promise<void> {
    const current = ++run;
    status.value = "rendering";
    error.value = null;
    try {
      const { renderFinalImage } =
        await import("../../integration/studio/render/FinalRender");
      const blob = await renderFinalImage(design, options);
      if (current !== run) return;
      clear();
      image = blob;
      imageUrl.value = URL.createObjectURL(blob);
      status.value = "ready";
    } catch (cause) {
      if (current !== run) return;
      status.value = "failed";
      error.value =
        cause instanceof Error
          ? cause.message
          : "The render could not be created.";
    }
  }

  function download(fileName: string): void {
    if (image) downloadBlob(image, fileName);
  }

  onScopeDispose(() => {
    run++;
    clear();
  });

  return { status, imageUrl, error, render, download };
}
