import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  classifyWheelGesture,
  interpolateCameraPose,
  shortestAngleDelta,
} from "../src/integration/studio/scene/CameraMotion";

describe("camera motion", () => {
  it("takes the shortest horizontal route between preset azimuths", () => {
    expect(
      shortestAngleDelta(
        THREE.MathUtils.degToRad(170),
        THREE.MathUtils.degToRad(-170),
      ),
    ).toBeCloseTo(THREE.MathUtils.degToRad(20));
    const middle = interpolateCameraPose(
      {
        position: new THREE.Vector3(0, 1, 3),
        target: new THREE.Vector3(0, 1, 0),
      },
      {
        position: new THREE.Vector3(0, 1, -3),
        target: new THREE.Vector3(0, 1, 0),
      },
      0.5,
    );
    expect(middle.position.distanceTo(middle.target)).toBeCloseTo(3);
    expect(Math.abs(middle.position.x)).toBeCloseTo(3);
    expect(middle.position.y).toBeCloseTo(1);
  });

  it("classifies trackpad pan as orbit and pinch or coarse wheels as zoom", () => {
    expect(
      classifyWheelGesture({
        deltaX: 8,
        deltaY: 4,
        deltaMode: 0,
        ctrlKey: false,
      }),
    ).toEqual({
      kind: "orbit",
      x: 8,
      y: 4,
    });
    expect(
      classifyWheelGesture({
        deltaX: 0,
        deltaY: 120,
        deltaMode: 0,
        ctrlKey: false,
      }),
    ).toEqual({
      kind: "orbit",
      x: 0,
      y: 120,
    });
    expect(
      classifyWheelGesture({
        deltaX: 0,
        deltaY: -12,
        deltaMode: 0,
        ctrlKey: true,
      }),
    ).toEqual({
      kind: "zoom",
      amount: 0.14400000000000002,
    });
    expect(
      classifyWheelGesture({
        deltaX: 0,
        deltaY: 3,
        deltaMode: 1,
        ctrlKey: false,
      }),
    ).toEqual({
      kind: "zoom",
      amount: -0.36,
    });
  });
});
