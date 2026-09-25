import { useEffect, useRef, useState } from "react";

import type { DesignDocument, PartId } from "../../domain/studio/types";
import { StudioScene } from "../../integration/studio/scene/StudioScene";

export interface StudioViewportApi {
  capture(): string;
  reset(): void;
  view(preset: "front" | "back" | "side" | "detail"): void;
  zoom(delta: number): void;
}

interface StudioViewportOptions {
  document: DesignDocument;
  selectedPartId: PartId;
  onSelectPart(id: PartId): void;
  onReady?(api: StudioViewportApi): void;
  dark: boolean;
}

export interface StudioViewportControls {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  loading: boolean;
  error: string | null;
  retry(): void;
}

/** Owns the interactive studio scene lifecycle and synchronizes it with editor state. */
export function useStudioViewport({
  document,
  selectedPartId,
  onSelectPart,
  onReady,
  dark,
}: StudioViewportOptions): StudioViewportControls {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StudioScene | null>(null);
  const onSelectPartRef = useRef(onSelectPart);
  const onReadyRef = useRef(onReady);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  onSelectPartRef.current = onSelectPart;
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    let scene: StudioScene;
    try {
      scene = new StudioScene(canvas, {
        onLoading: setLoading,
        onError: setError,
        onSelectPart: (partId) => onSelectPartRef.current(partId),
      });
    } catch (cause) {
      setLoading(false);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(`The 3D studio could not start: ${detail}`);
      return;
    }

    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [retryKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene === null) {
      return;
    }

    let current = true;
    void scene.updateDocument(document).then(() => {
      if (current && scene.ready) {
        onReadyRef.current?.(scene);
      }
    });

    return () => {
      current = false;
    };
  }, [document, retryKey]);

  useEffect(() => {
    sceneRef.current?.setSelectedPart(selectedPartId);
  }, [selectedPartId, retryKey]);

  useEffect(() => {
    sceneRef.current?.setDark(dark);
  }, [dark, retryKey]);

  function retry(): void {
    setError(null);
    setLoading(true);
    setRetryKey((value) => value + 1);
  }

  return {
    canvasRef,
    loading,
    error,
    retry,
  };
}
