/** What holds the garment in a studio render. */
export type RenderHolder = "silhouette" | "model";
export type RenderView = "front" | "three-quarter" | "side" | "back";
export type RenderBackdrop = "studio" | "linen" | "charcoal" | "transparent";
export type RenderSize = "standard" | "large";

export interface FinalRenderOptions {
  readonly holder: RenderHolder;
  readonly view: RenderView;
  readonly backdrop: RenderBackdrop;
  readonly width: number;
  readonly height: number;
}

/** Portrait output sizes in pixels, 4:5 like the catalogue pages. */
export const RENDER_SIZES: Readonly<
  Record<RenderSize, readonly [number, number]>
> = {
  standard: [1600, 2000],
  large: [2400, 3000],
};

export const HOLDER_MODELS: Readonly<Record<RenderHolder, string>> = {
  silhouette: "/assets/models/mannequin.glb",
  model: "/assets/models/model.glb",
};

/** Solid backdrops; `null` keeps the background transparent. */
export const BACKDROPS: Readonly<Record<RenderBackdrop, string | null>> = {
  studio: "#f1efe9",
  linen: "#e6dccb",
  charcoal: "#2b302d",
  transparent: null,
};

const VIEW_DEGREES: Readonly<Record<RenderView, number>> = {
  front: 0,
  "three-quarter": 35,
  side: 90,
  back: 180,
};

export interface Bounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface ViewFrame {
  readonly position: [number, number, number];
  readonly target: [number, number, number];
}

/**
 * Places the camera so the figure fits floor to crown with an even margin, whatever the view.
 * Distances are measured to the nearest face of the figure, so the hem never leaves the frame.
 */
export function frameView(
  bounds: Bounds,
  view: RenderView,
  aspect: number,
  verticalFovDegrees: number,
  margin = 0.06,
): ViewFrame {
  const bottom = Math.min(0, bounds.min[1]);
  const top = bounds.max[1];
  const reach = Math.max(
    Math.abs(bounds.min[0]),
    Math.abs(bounds.max[0]),
    Math.abs(bounds.min[2]),
    Math.abs(bounds.max[2]),
  );
  const tanHalf = Math.tan((verticalFovDegrees * Math.PI) / 360);
  const halfHeight = ((top - bottom) / 2) * (1 + 2 * margin);
  const halfWidth = reach * (1 + 2 * margin);
  const distance =
    Math.max(halfHeight / tanHalf, halfWidth / (tanHalf * aspect)) + reach;
  const centre = bottom + (top - bottom) / 2;
  const angle = (VIEW_DEGREES[view] * Math.PI) / 180;
  // A slight downward look, as from a camera at chest height.
  const lift = distance * 0.03;
  return {
    position: [
      Math.sin(angle) * distance,
      centre + lift,
      Math.cos(angle) * distance,
    ],
    target: [0, centre, 0],
  };
}
