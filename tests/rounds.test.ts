import { describe, it, expect } from "vitest";
import { gameConfig } from "../src/shared/gameConfig";
import { TELEMETRY_EVENT_NAMES, TELEMETRY_VERSION } from "../src/shared/gameTypes";

/**
 * Phase 3.9 — Round configuration sanity checks.
 *
 * Locks the canonical 20-round layout, the milestone overrides
 * (1, 5, 10, 15, 20), the tuning block, and the telemetry contract.
 */

describe("gameConfig — round count and shape", () => {
  it("has exactly 20 rounds", () => {
    expect(gameConfig.rounds).toHaveLength(20);
  });

  it("every round has a non-empty briefing string", () => {
    for (const r of gameConfig.rounds) {
      expect(typeof r.briefing).toBe("string");
      expect(r.briefing.length).toBeGreaterThan(0);
    }
  });

  it("every round has at least one spawn group", () => {
    for (const r of gameConfig.rounds) {
      expect(r.spawns.length).toBeGreaterThan(0);
    }
  });

  it("round numbers are sequential 1..20", () => {
    for (let i = 0; i < 20; i++) {
      expect(gameConfig.rounds[i].round).toBe(i + 1);
    }
  });
});

describe("gameConfig — milestone overrides", () => {
  it("round 1 is a basic-only intro wave", () => {
    const r1 = gameConfig.rounds[0];
    expect(r1.spawns).toHaveLength(1);
    expect(r1.spawns[0].enemy).toBe("basic");
    expect(r1.spawns[0].count).toBe(6);
  });

  it("round 5 mixes basic + fast + heavy", () => {
    const r5 = gameConfig.rounds[4];
    const kinds = new Set(r5.spawns.map((s) => s.enemy));
    expect(kinds).toEqual(new Set(["basic", "fast", "heavy"]));
  });

  it("round 10 includes a boss and grants +2 lives on clear", () => {
    const r10 = gameConfig.rounds[9];
    expect(r10.boss).toBe(true);
    expect(r10.livesBonus).toBe(2);
    expect(r10.spawns.some((s) => s.enemy === "boss")).toBe(true);
  });

  it("round 15 mixes all four base kinds but no boss", () => {
    const r15 = gameConfig.rounds[14];
    const kinds = new Set(r15.spawns.map((s) => s.enemy));
    expect(kinds).toEqual(new Set(["basic", "fast", "heavy", "swarm"]));
    expect(r15.boss).toBeUndefined();
  });

  it("round 20 is the final stand — boss + heavy mixed + lives bonus 3", () => {
    const r20 = gameConfig.rounds[19];
    expect(r20.boss).toBe(true);
    expect(r20.livesBonus).toBe(3);
    const boss = r20.spawns.find((s) => s.enemy === "boss")!;
    expect(boss.bonusHp).toBe(450);
  });
});

describe("gameConfig — tuning block", () => {
  it("startingLives is 20, startingCurrency is 120", () => {
    expect(gameConfig.tuning.startingLives).toBe(20);
    expect(gameConfig.tuning.startingCurrency).toBe(120);
  });

  it("maxLives is at least startingLives + livesBonus", () => {
    const { maxLives, startingLives } = gameConfig.tuning;
    expect(maxLives).toBeGreaterThanOrEqual(startingLives + 3);
  });

  it("score cap is a positive integer", () => {
    expect(gameConfig.tuning.scoreCap).toBeGreaterThan(0);
    expect(Number.isInteger(gameConfig.tuning.scoreCap)).toBe(true);
  });
});

describe("Telemetry strict contract", () => {
  it("TELEMETRY_EVENT_NAMES has 20 entries", () => {
    expect(TELEMETRY_EVENT_NAMES).toHaveLength(20);
  });

  it("TELEMETRY_EVENT_NAMES has no duplicates", () => {
    const set = new Set(TELEMETRY_EVENT_NAMES);
    expect(set.size).toBe(TELEMETRY_EVENT_NAMES.length);
  });

  it("every name is lowercase snake_case", () => {
    for (const n of TELEMETRY_EVENT_NAMES) {
      expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("TELEMETRY_VERSION is 1", () => {
    expect(TELEMETRY_VERSION).toBe(1);
  });
});
