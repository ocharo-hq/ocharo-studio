import {
  useStudioViewport,
  type StudioViewportApi,
} from "../../application/studio/UseStudioViewport";
import type { DesignDocument, PartId } from "../../domain/studio/types";

export type { StudioViewportApi } from "../../application/studio/UseStudioViewport";

interface StudioViewportProps {
  document: DesignDocument;
  selectedPartId: PartId;
  onSelectPart: (id: PartId) => void;
  onReady?: (api: StudioViewportApi) => void;
  dark: boolean;
}

/** Renders the interactive garment scene and its loading or recovery state. */
export function StudioViewport({
  document,
  selectedPartId,
  onSelectPart,
  onReady,
  dark,
}: StudioViewportProps) {
  const viewport = useStudioViewport({
    document,
    selectedPartId,
    onSelectPart,
    onReady,
    dark,
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
      }}
    >
      <canvas
        ref={viewport.canvasRef}
        role="img"
        aria-label="Interactive 3D garment preview"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "grab",
          touchAction: "none",
        }}
      />
      {viewport.loading && !viewport.error ? (
        <div role="status" style={overlayStyle}>
          Preparing the studio…
        </div>
      ) : null}
      {viewport.error ? (
        <div role="alert" style={overlayStyle}>
          <span>{viewport.error}</span>
          <button type="button" onClick={viewport.retry}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  gap: "0.75rem",
  textAlign: "center",
  background: "color-mix(in srgb, var(--canvas, #f4efe8) 82%, transparent)",
  color: "inherit",
  padding: "2rem",
} as const;
