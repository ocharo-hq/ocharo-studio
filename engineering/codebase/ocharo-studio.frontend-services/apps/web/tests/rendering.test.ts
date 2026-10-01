import { describe, expect, it } from "vitest";
import { MaterialKind } from "../src/domain/studio/types";
import { MATERIALS } from "../src/domain/studio/catalog";
import {
  fabricFinish,
  WEAVE_CELLS,
  weaveHeight,
  weaveNormalMap,
  type Weave,
} from "../src/integration/studio/scene/FabricShading";
import {
  frameView,
  RENDER_SIZES,
} from "../src/integration/studio/render/RenderFraming";

describe("fabric shading", () => {
  it("gives every material kind a physical finish", () => {
    for (const kind of Object.values(MaterialKind)) {
      const finish = fabricFinish(kind);
      expect(finish.pitch).toBeGreaterThan(0.0002);
      expect(finish.pitch).toBeLessThan(0.003);
      expect(finish.sheen).toBeGreaterThanOrEqual(0);
      expect(finish.sheen).toBeLessThanOrEqual(1);
      expect(finish.anisotropy).toBeGreaterThanOrEqual(0);
    }
    for (const material of MATERIALS)
      expect(fabricFinish(material.kind)).toBeDefined();
  });

  it("repeats each weave exactly within its tile, so the relief has no seams", () => {
    const weaves = Object.keys(WEAVE_CELLS) as Weave[];
    for (const weave of weaves) {
      const cells = WEAVE_CELLS[weave];
      for (const [x, y] of [
        [0.13, 0.4],
        [1.7, 2.25],
        [3.05, 0.91],
      ] as const) {
        expect(weaveHeight(weave, x + cells, y)).toBeCloseTo(
          weaveHeight(weave, x, y),
          6,
        );
        expect(weaveHeight(weave, x, y + cells)).toBeCloseTo(
          weaveHeight(weave, x, y),
          6,
        );
      }
    }
  });

  it("encodes the weave as an unsigned tangent-space normal map", () => {
    const texture = weaveNormalMap("plain");
    const { data, width, height } = texture.image as {
      data: Uint8Array;
      width: number;
      height: number;
    };
    expect(width).toBe(WEAVE_CELLS.plain * 16);
    expect(height).toBe(width);
    let upward = 0;
    for (let offset = 0; offset < data.length; offset += 4)
      if (data[offset + 2]! > 200) upward++;
    // Most of the surface faces outward; the relief only tilts it.
    expect(upward / (width * height)).toBeGreaterThan(0.6);
    expect(weaveNormalMap("plain")).toBe(texture);
  });
});

describe("studio render framing", () => {
  const model = {
    min: [-0.34, 0.003, -0.33] as const,
    max: [0.33, 1.72, 0.31] as const,
  };

  it("keeps the whole figure, floor to crown, inside the frame for every view", () => {
    const [width, height] = RENDER_SIZES.standard;
    const aspect = width / height;
    const fov = 26;
    for (const view of ["front", "three-quarter", "side", "back"] as const) {
      const frame = frameView(model, view, aspect, fov);
      const [px, py, pz] = frame.position;
      const distance = Math.hypot(px, pz) - 0.34;
      const halfHeight = Math.tan((fov * Math.PI) / 360) * distance;
      expect(frame.target[1] - halfHeight).toBeLessThan(0);
      expect(frame.target[1] + halfHeight).toBeGreaterThan(1.72);
      expect(py).toBeGreaterThan(frame.target[1]);
    }
  });

  it("turns the camera around the figure by view", () => {
    const front = frameView(model, "front", 0.8, 26).position;
    const side = frameView(model, "side", 0.8, 26).position;
    const back = frameView(model, "back", 0.8, 26).position;
    expect(front[2]).toBeGreaterThan(0);
    expect(Math.abs(front[0])).toBeLessThan(1e-9);
    expect(side[0]).toBeGreaterThan(0);
    expect(back[2]).toBeLessThan(0);
  });
});
