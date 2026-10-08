import { describe, it, expect, vi } from "vitest";
import { Engine } from "../src/engine/Engine";
import { gameConfig, getEnemyConfig, getTowerConfig } from "../src/shared/gameConfig";

/**
 * Phase 3.9 — Engine unit tests.
 *
 * The engine is the canonical source of gameplay truth in Phase 2.
 * These tests pin down placement, upgrades, sells, range, the
 * round-start / round-clear flow, and the on()/emit() event hook.
 */

describe("Engine — tower placement & inspection", () => {
  it("placeTower adds a tower to the towers list and returns it", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    expect(eng.towers).toHaveLength(1);
    expect(t).toMatchObject({ kind: "cannon", x: 0, z: 0, level: 1 });
    expect(t.id).toMatch(/^tower-/);
  });

  it("hasTowerNear returns true within 0.65 world units and false beyond", () => {
    const eng = new Engine("test");
    eng.placeTower("cannon", 2, 2);
    expect(eng.hasTowerNear(2, 2)).toBe(true);
    expect(eng.hasTowerNear(2.5, 2)).toBe(true);
    expect(eng.hasTowerNear(3, 2)).toBe(false);
  });

  it("findTowerAt returns the closest tower within 0.65", () => {
    const eng = new Engine("test");
    const t1 = eng.placeTower("cannon", -4, -1);
    eng.placeTower("rapid", 5, 0);
    expect(eng.findTowerAt(-4, -1)?.id).toBe(t1.id);
    expect(eng.findTowerAt(-3.6, -1)?.id).toBe(t1.id);
    expect(eng.findTowerAt(0, 0)).toBeNull();
  });

  it("towerRange returns the upgrade range for the current level", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    const cfg = getTowerConfig("cannon");
    expect(eng.towerRange(t.id)).toBe(cfg.upgrades[0].range);
  });

  it("towerVariant returns the level as 1/2/3", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    expect(eng.towerVariant(t.id)).toBe(1);
    eng.upgradeTower(t.id);
    expect(eng.towerVariant(t.id)).toBe(2);
    eng.upgradeTower(t.id);
    expect(eng.towerVariant(t.id)).toBe(3);
  });
});

describe("Engine — upgrades and sells", () => {
  it("upgradeTower bumps the level and reports the cost", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    const cfg = getTowerConfig("cannon");
    // upgrades[level] is the cost to upgrade FROM `level` to `level+1`.
    // So a L1 tower pays upgrades[1].cost (the L2 cost) to reach L2.
    const r1 = eng.upgradeTower(t.id);
    expect(r1).toEqual({ ok: true, cost: cfg.upgrades[1].cost });
    expect(t.level).toBe(2);
  });

  it("upgradeTower refuses past level 3", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    eng.upgradeTower(t.id);
    eng.upgradeTower(t.id);
    const r3 = eng.upgradeTower(t.id);
    expect(r3.ok).toBe(false);
    expect(r3.reason).toMatch(/max level/);
  });

  it("sellTower returns 0.7x of (cost + prior upgrade costs) and removes the tower", () => {
    const eng = new Engine("test");
    const t = eng.placeTower("cannon", 0, 0);
    const cfg = getTowerConfig("cannon");
    eng.upgradeTower(t.id); // spent cfg.upgrades[1].cost
    const expected = Math.round((cfg.cost + cfg.upgrades[1].cost) * cfg.sellMultiplier);
    const r = eng.sellTower(t.id);
    expect(r).toEqual({ ok: true, value: expected });
    expect(eng.towers).toHaveLength(0);
  });

  it("sellTower on an unknown id returns ok:false", () => {
    const eng = new Engine("test");
    expect(eng.sellTower("nope")).toEqual({ ok: false, value: 0 });
  });
});

describe("Engine — round lifecycle", () => {
  it("startRound then endRound clears the active round", () => {
    const eng = new Engine("test");
    const round = gameConfig.rounds[0];
    eng.startRound(round);
    eng.endRound();
    // No internal way to read this, but tick should be a no-op:
    expect(eng.tick(0.1)).toBeUndefined();
    expect(eng.roundComplete()).toBeNull();
  });

  it("completes round 1 with all 6 basic enemies either killed or leaked", () => {
    const eng = new Engine("test");
    const cleared: number[] = [];
    eng.on((e) => e.type === "roundClear" && cleared.push(e.round));

    // Round 1: 6 basic enemies spaced 0.85s, no other kinds.
    eng.startRound(gameConfig.rounds[0]);
    // Place a cannon at the start of the path so the first basic is
    // in range immediately and gets a few shots before walking away.
    eng.placeTower("cannon", gameConfig.path[0].x, gameConfig.path[0].z + 1.5);

    for (let i = 0; i < 6000; i++) {
      eng.tick(0.05);
      if (eng.roundComplete()) break;
    }
    const rc = eng.roundComplete();
    expect(rc).not.toBeNull();
    // Either the cannon kills them or they leak — both add up to 6.
    expect(rc!.defeated + rc!.escaped).toBe(6);
    expect(cleared).toEqual([1]);
  });

  it("emits at least one 'kill' for a max-level rapid at a path corner", () => {
    const eng = new Engine("test");
    const kills: string[] = [];
    eng.on((e) => e.type === "kill" && kills.push(e.enemyKind));
    // Upgrade the tower to L3 so it can kill a basic in the ~2.7s it
    // spends in range at a path corner. L3 rapid: 12 dmg, 3.1 fire
    // rate, 3.8 range → 5 shots in 1.6s.
    const t = eng.placeTower("rapid", 1.5, -2.5);
    eng.upgradeTower(t.id);
    eng.upgradeTower(t.id);
    expect(t.level).toBe(3);
    eng.startRound(gameConfig.rounds[0]);
    for (let i = 0; i < 6000; i++) {
      eng.tick(0.05);
      if (eng.roundComplete()) break;
    }
    expect(kills.length).toBeGreaterThan(0);
    expect(kills.every((k) => k === "basic")).toBe(true);
  });

  it("emits 'leak' when an enemy reaches the end without dying", () => {
    const eng = new Engine("test");
    const leaks: string[] = [];
    eng.on((e) => e.type === "leak" && leaks.push(e.enemyKind));
    // Round 1 but no towers — all 6 should leak.
    eng.startRound(gameConfig.rounds[0]);
    for (let i = 0; i < 6000; i++) {
      eng.tick(0.05);
      if (eng.roundComplete()) break;
    }
    expect(leaks.length).toBeGreaterThanOrEqual(6);
    expect(leaks.every((k) => k === "basic")).toBe(true);
  });
});

describe("Engine — event subscription", () => {
  it("on() returns an unsubscribe function", () => {
    const eng = new Engine("test");
    const spy = vi.fn();
    const off = eng.on(spy);
    eng.placeTower("cannon", 0, 0);
    off();
    // No new event should reach spy after unsubscribe.
    eng.placeTower("rapid", 1, 0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a throwing listener does not block other listeners", () => {
    const eng = new Engine("test");
    const a = vi.fn(() => {
      throw new Error("boom");
    });
    const b = vi.fn();
    eng.on(a);
    eng.on(b);
    // startRound emits nothing; tickEnemies only emits "leak" on a
    // crossed endpoint, and tickTowers only emits "fire" when a
    // tower fires. Use a startRound + tick with a placed tower in
    // range to drive a "fire" event.
    eng.placeTower("cannon", gameConfig.path[0].x, gameConfig.path[0].z + 1.5);
    eng.startRound(gameConfig.rounds[0]);
    eng.tick(0.6); // first basic spawns at 0.4s, gets shot
    expect(b).toHaveBeenCalled();
  });
});

describe("Engine — spawn debug", () => {
  it("spawnDebugEnemy adds a basic enemy at the path start", () => {
    const eng = new Engine("test");
    eng.spawnDebugEnemy("basic");
    expect(eng.enemies).toHaveLength(1);
    const e = eng.enemies[0];
    expect(e.kind).toBe("basic");
    expect(e.hp).toBe(getEnemyConfig("basic").hp);
    expect(e.x).toBe(gameConfig.path[0].x);
    expect(e.z).toBe(gameConfig.path[0].z);
  });
});
