import {
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import type { DesignDocument, PartId } from "../../domain/studio/types";
import type { StudioScene } from "../../integration/studio/scene/StudioScene";

export interface StudioViewportApi {
  capture(): string;
  reset(): void;
  view(preset: "front" | "back" | "side" | "detail"): void;
  zoom(delta: number): void;
}

interface StudioViewportOptions {
  document: DesignDocument;
  selectedPartId: PartId;
  selectedPartIds?: readonly PartId[];
  onSelectPart(id: PartId, additive?: boolean): void;
  onReady?(api: StudioViewportApi): void;
  dark: boolean;
  initializationReady?: boolean;
  placementMode?: boolean;
  onPlaceAnchor?(x: number, y: number): void;
  onPlacementStart?(): void;
  onPlacementEnd?(): void;
}

export interface StudioViewportControls {
  canvasRef: ShallowRef<HTMLCanvasElement | null>;
  loading: boolean;
  error: string | null;
  retry(): void;
}

/** Owns the interactive studio scene lifecycle and synchronizes it with editor state. */
export function useStudioViewport(
  options: MaybeRefOrGetter<StudioViewportOptions>,
): StudioViewportControls {
  const canvasRef = shallowRef<HTMLCanvasElement | null>(null);
  const loading = shallowRef(true);
  const error = shallowRef<string | null>(null);
  const retryKey = shallowRef(0);
  const mounted = shallowRef(false);
  const initializationReady = shallowRef(false);
  let scene: StudioScene | null = null;
  let disposeScene = () => {};

  onMounted(() => {
    mounted.value = true;
  });
  onBeforeUnmount(() => disposeScene());
  onScopeDispose(() => disposeScene());

  // Cold shader preparation must not starve the initial storage acknowledgment.
  // Readiness stays latched so later saves keep the existing scene alive.
  watch(
    () => toValue(options).initializationReady ?? true,
    (isReady) => {
      if (isReady) initializationReady.value = true;
    },
    { immediate: true },
  );

  watch(
    [mounted, canvasRef, retryKey, initializationReady],
    ([isMounted, canvas, _retryKey, canInitialize], _previous, onCleanup) => {
      if (!isMounted || canvas === null || !canInitialize) return;
      let active = true;
      let instance: StudioScene | null = null;
      disposeScene = () => {
        if (!active) return;
        active = false;
        if (scene === instance) scene = null;
        instance?.dispose();
      };
      onCleanup(disposeScene);
      void import("../../integration/studio/scene/StudioScene")
        .then(async ({ StudioScene }) => {
          if (!active) return;
          instance = new StudioScene(canvas, {
            onLoading: (value) => {
              if (active) loading.value = value;
            },
            onError: (value) => {
              if (active) error.value = value;
            },
            onSelectPart: (id, additive) =>
              toValue(options).onSelectPart(id, additive),
            onPlaceAnchor: (x, y) => toValue(options).onPlaceAnchor?.(x, y),
            onPlacementStart: () => toValue(options).onPlacementStart?.(),
            onPlacementEnd: () => toValue(options).onPlacementEnd?.(),
          });
          scene = instance;
          const current = toValue(options);
          instance.setSelectedParts(
            current.selectedPartIds ?? [current.selectedPartId],
          );
          instance.setDark(current.dark);
          instance.setPlacementMode(current.placementMode ?? false);
          await instance.updateDocument(current.document);
          if (active && instance.ready) toValue(options).onReady?.(instance);
        })
        .catch(() => {
          if (!active) return;
          loading.value = false;
          error.value = "The garment preview is unavailable. Retry when ready.";
        });
    },
    { flush: "post" },
  );

  watch(
    () => toValue(options).document,
    (document, _previous, onCleanup) => {
      const currentScene = scene;
      if (currentScene === null) return;
      let current = true;
      onCleanup(() => {
        current = false;
      });
      void currentScene
        .updateDocument(document)
        .then(() => {
          if (current && scene === currentScene && currentScene.ready)
            toValue(options).onReady?.(currentScene);
        })
        .catch(() => {
          if (!current || scene !== currentScene) return;
          loading.value = false;
          error.value =
            "The garment preview could not update. Your design is preserved; try again.";
        });
    },
  );

  watch(
    () => toValue(options).selectedPartIds ?? [toValue(options).selectedPartId],
    (partIds) => scene?.setSelectedParts(partIds),
  );
  watch(
    () => toValue(options).dark,
    (dark) => scene?.setDark(dark),
  );
  watch(
    () => toValue(options).placementMode ?? false,
    (enabled) => scene?.setPlacementMode(enabled),
  );

  function retry(): void {
    error.value = null;
    loading.value = true;
    retryKey.value += 1;
  }

  return {
    canvasRef,
    get loading() {
      return loading.value;
    },
    get error() {
      return error.value;
    },
    retry,
  };
}
