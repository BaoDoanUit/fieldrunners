import { describe, it, expect } from "vitest";
import { acquireTarget } from "../src/engine/targeting";
import { getTowerConfig } from "../src/shared/gameConfig";
import type { EnemyInstance, TowerInstance } from "../src/shared/gameTypes";

/**
 * Phase 3.9 — Targeting strategy tests.
 *
 * The engine picks a target per tower per frame based on a strategy.
 * We verify each strategy returns the right enemy from a small set.
 */

function mkTower(x: number, z: number): TowerInstance {
  const cfg = getTowerConfig("cannon"); // cannon uses "strongest"
  return {
    id: "t1",
    kind: "cannon",
    x,
    z,
    level: 1,
    cooldown: 0,
    config: cfg
  } as unknown as TowerInstance;
}

function mkEnemy(
  id: string,
  x: number,
  z: number,
  opts: Partial<EnemyInstance> = {}
): EnemyInstance {
  return {
    id,
    kind: "basic",
    hp: 100,
    maxHp: 100,
    speed: 1,
    progress: 0,
    slowMultiplier: 1,
    x,
    z,
    radius: 0.34,
    reward: 12,
    score: 80,
    alive: true,
    ...opts
  };
}

describe("acquireTarget — base cases", () => {
  it("returns null for an empty enemy list", () => {
    expect(acquireTarget(mkTower(0, 0), [], "first")).toBeNull();
  });

  it("returns null when no enemy is in range", () => {
    const tower = mkTower(0, 0);
    const enemies = [mkEnemy("a", 100, 100)];
    expect(acquireTarget(tower, enemies, "first")).toBeNull();
  });

  it("ignores dead enemies", () => {
    const tower = mkTower(0, 0);
    const alive = mkEnemy("alive", 1, 0);
    const dead = mkEnemy("dead", 1, 0, { alive: false });
    const got = acquireTarget(tower, [dead, alive], "first");
    expect(got?.id).toBe("alive");
  });
});

describe("acquireTarget — strategies", () => {
  const tower = mkTower(0, 0); // range 3.3
  const a = mkEnemy("a", 1, 0, { progress: 0.1, hp: 50 });
  const b = mkEnemy("b", 0, 1, { progress: 0.5, hp: 200 });
  const c = mkEnemy("c", 0.5, 0.5, { progress: 0.9, hp: 80 });
  const all = [a, b, c];

  it("'first' picks the enemy furthest along the path", () => {
    expect(acquireTarget(tower, all, "first")?.id).toBe("c");
  });

  it("'last' picks the enemy closest to the start", () => {
    expect(acquireTarget(tower, all, "last")?.id).toBe("a");
  });

  it("'strongest' picks the highest-HP enemy", () => {
    expect(acquireTarget(tower, all, "strongest")?.id).toBe("b");
  });

  it("'weakest' picks the lowest-HP enemy", () => {
    expect(acquireTarget(tower, all, "weakest")?.id).toBe("a");
  });
});
