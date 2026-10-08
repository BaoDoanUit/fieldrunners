import { describe, it, expect } from "vitest";
import { pathPosition, pathLength, distance2D } from "../src/engine/path";

/**
 * Phase 3.9 — Path math.
 *
 * `pathPosition` interpolates along a polyline. We pin the
 * end-points, the mid-point, the clamp behavior, and `pathLength`.
 */

const path = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 }
];

describe("pathPosition", () => {
  it("returns the first vertex at progress 0", () => {
    const p = pathPosition(path, 0);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
    expect(p.segment).toBe(0);
    expect(p.local).toBe(0);
  });

  it("returns the last vertex at progress 1", () => {
    const p = pathPosition(path, 1);
    expect(p.x).toBe(10);
    expect(p.z).toBe(10);
    expect(p.segment).toBe(1);
    expect(p.local).toBe(1);
  });

  it("interpolates at the midpoint of a segment", () => {
    const p = pathPosition(path, 0.25);
    expect(p.x).toBe(5);
    expect(p.z).toBe(0);
  });

  it("interpolates across the polyline at progress 0.75", () => {
    const p = pathPosition(path, 0.75);
    expect(p.x).toBe(10);
    expect(p.z).toBe(5);
  });

  it("clamps progress to [0, 1]", () => {
    expect(pathPosition(path, -1).x).toBe(0);
    expect(pathPosition(path, 2).x).toBe(10);
    expect(pathPosition(path, 2).z).toBe(10);
  });

  it("handles a single-point path without throwing", () => {
    const p = pathPosition([{ x: 1, z: 2 }], 0.5);
    expect(p.x).toBe(1);
    expect(p.z).toBe(2);
  });
});

describe("pathLength", () => {
  it("returns 0 for a single-point path", () => {
    expect(pathLength([{ x: 1, z: 2 }])).toBe(0);
  });

  it("returns the Euclidean total for a polyline", () => {
    expect(pathLength(path)).toBeCloseTo(20, 5);
  });
});

describe("distance2D", () => {
  it("returns 0 for the same point", () => {
    expect(distance2D(1, 2, 1, 2)).toBe(0);
  });

  it("computes the Euclidean distance", () => {
    expect(distance2D(0, 0, 3, 4)).toBe(5);
  });
});
