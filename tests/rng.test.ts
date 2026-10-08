import { describe, it, expect } from "vitest";
import { mulberry32, combineSeed } from "../src/engine/rng";

/**
 * Phase 3.9 — RNG determinism.
 *
 * The engine's spawn timing relies on a seeded PRNG so replays are
 * deterministic. We pin the behavior of mulberry32 + the FNV-based
 * seed combiner.
 */

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("combineSeed", () => {
  it("is deterministic for the same inputs", () => {
    expect(combineSeed("a", 1, "b")).toBe(combineSeed("a", 1, "b"));
  });

  it("differs when the order of inputs changes", () => {
    expect(combineSeed("a", 1)).not.toBe(combineSeed(1, "a"));
  });

  it("returns a 32-bit unsigned integer", () => {
    const v = combineSeed("test", 42, 7);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffffff);
  });
});
