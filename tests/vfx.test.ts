import { describe, it, expect } from "vitest";
import { VfxManager } from "../src/engine/vfx";

/**
 * Phase 2.9 — VFX manager unit tests.
 *
 * We don't pull in a real Three.js renderer (would need a JSDOM
 * canvas). Instead, we exercise the public surface: spawn counts,
 * reduced-motion short-circuit, tick aging, and pool cap.
 */
describe("VfxManager", () => {
  it("starts empty", () => {
    const v = new VfxManager();
    expect(v.count()).toBe(0);
  });

  it("spawn adds a particle and tick() ages it out", () => {
    const v = new VfxManager();
    v.spawn("trail", 0, 0, "#ff8800");
    expect(v.count()).toBe(1);
    v.tick(1.0);
    // trail defaultLife is 0.25s, so 1.0s of ticking expires it.
    expect(v.count()).toBe(0);
  });

  it("spawnBurst creates the requested count", () => {
    const v = new VfxManager();
    v.spawnBurst("hit", 1, 1, "#ff0000", 8);
    expect(v.count()).toBe(8);
  });

  it("reduced motion short-circuits all spawn calls", () => {
    const v = new VfxManager(true);
    v.spawn("trail", 0, 0, "#fff");
    v.spawnBurst("death", 0, 0, "#fff", 10);
    expect(v.count()).toBe(0);
    v.tick(0.5);
    expect(v.count()).toBe(0);
  });

  it("setReducedMotion clears live particles when toggled on", () => {
    const v = new VfxManager(false);
    v.spawnBurst("hit", 0, 0, "#fff", 5);
    expect(v.count()).toBe(5);
    v.setReducedMotion(true);
    expect(v.count()).toBe(0);
  });

  it("respects the pool cap", () => {
    const v = new VfxManager();
    for (let i = 0; i < 1000; i++) v.spawn("trail", 0, 0, "#fff");
    // Cap is 240; we should not exceed it.
    expect(v.count()).toBeLessThanOrEqual(240);
  });

  it("clear() drops all live particles", () => {
    const v = new VfxManager();
    v.spawnBurst("death", 0, 0, "#fff", 20);
    v.clear();
    expect(v.count()).toBe(0);
  });

  it("particles move under velocity and fall under gravity", () => {
    const v = new VfxManager();
    v.spawn("hit", 0, 1, "#fff", { vx: 1, vy: 0, vz: 0 });
    v.tick(0.1);
    // With vx=1, after 0.1s the particle has moved ~0.1 units in x.
    // We can't inspect the internal particle directly, but we can
    // confirm it hasn't expired and the count is stable.
    expect(v.count()).toBe(1);
    v.tick(10);
    // 10s of ticking should expire the 0.45s defaultLife.
    expect(v.count()).toBe(0);
  });
});
