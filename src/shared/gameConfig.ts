export type TowerKind = "cannon" | "rapid" | "splash" | "slow";
export type EnemyKind = "basic" | "fast" | "heavy" | "swarm" | "boss";

export interface TowerUpgradeLevel {
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
  slowFactor?: number;
  splashRadius?: number;
  value: number;
}

export interface TowerConfig {
  kind: TowerKind;
  name: string;
  cost: number;
  sellMultiplier: number;
  color: string;
  description: string;
  upgrades: TowerUpgradeLevel[];
}

export interface EnemyConfig {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  radius: number;
  score: number;
}

export interface RoundSpawn {
  enemy: EnemyKind;
  count: number;
  spacing: number;
  bonusHp?: number;
  bonusSpeed?: number;
}

export interface RoundConfig {
  round: number;
  reward: number;
  /** Short field-manual line shown when the round begins. */
  briefing: string;
  livesBonus?: number;
  boss?: boolean;
  spawns: RoundSpawn[];
}

/**
 * Top-level tunables. Mirrored on the client and the server.
 * Adjusting these is the single canonical way to change game-wide
 * pacing without hunting magic numbers in App.tsx.
 */
export interface TuningConfig {
  startingLives: number;
  startingCurrency: number;
  /** Cap on how many enemies can leak before the run is lost. */
  maxLives: number;
  maxUpgradeLevel: number;
  /** Multiplier applied to the boss's base HP (round-20 boss uses 1.5). */
  bossHpMultiplier: number;
  /** Currency awarded per confirmed kill is enemy.reward * this. */
  killRewardMultiplier: number;
  /** Hard cap on the running score that a single run can post. */
  scoreCap: number;
}

export interface GameConfig {
  path: { x: number; z: number }[];
  buildZones: { x: number; z: number }[];
  towers: TowerConfig[];
  enemies: EnemyConfig[];
  rounds: RoundConfig[];
  tuning: TuningConfig;
}

/** Hand-tuned milestone rounds. The other 15 still use the auto-generator. */
const MILESTONE_OVERRIDES: Record<number, Omit<RoundConfig, "round">> = {
  1: {
    reward: 50,
    briefing: "Opening move. A handful of recruits — establish the perimeter and learn the towers.",
    spawns: [
      { enemy: "basic", count: 6, spacing: 0.85 }
    ]
  },
  5: {
    reward: 78,
    briefing: "Order 05 — first checkpoint. Mixed infantry and armor press the eastern bend.",
    spawns: [
      { enemy: "basic", count: 11, spacing: 0.7 },
      { enemy: "fast", count: 4, spacing: 0.55 },
      { enemy: "heavy", count: 2, spacing: 1.1, bonusHp: 25 }
    ]
  },
  10: {
    reward: 140,
    livesBonus: 2,
    boss: true,
    briefing: "Order 10 — a commander enters the field. Heavy armor escorts the boss; soften the pack first.",
    spawns: [
      { enemy: "basic", count: 14, spacing: 0.65 },
      { enemy: "fast", count: 5, spacing: 0.5, bonusSpeed: 0.05 },
      { enemy: "heavy", count: 3, spacing: 0.9, bonusHp: 35 },
      { enemy: "boss", count: 1, spacing: 0, bonusHp: 0, bonusSpeed: 0 }
    ]
  },
  15: {
    reward: 180,
    briefing: "Order 15 — a second front. Mixed swarms and heavies arrive together; area damage pays.",
    spawns: [
      { enemy: "basic", count: 18, spacing: 0.55 },
      { enemy: "fast", count: 9, spacing: 0.42, bonusSpeed: 0.08 },
      { enemy: "heavy", count: 5, spacing: 0.85, bonusHp: 45 },
      { enemy: "swarm", count: 12, spacing: 0.28 }
    ]
  },
  20: {
    reward: 260,
    livesBonus: 3,
    boss: true,
    briefing: "Order 20 — final stand. The general leads the horde. Hold to the last zone.",
    spawns: [
      { enemy: "basic", count: 22, spacing: 0.5 },
      { enemy: "fast", count: 12, spacing: 0.38, bonusSpeed: 0.12 },
      { enemy: "heavy", count: 8, spacing: 0.8, bonusHp: 80 },
      { enemy: "swarm", count: 18, spacing: 0.24 },
      { enemy: "boss", count: 1, spacing: 0, bonusHp: 450, bonusSpeed: 0.15 }
    ]
  }
};

/** Auto-generated fallback for non-milestone rounds. */
function autoRound(index: number): Omit<RoundConfig, "round"> {
  const round = index + 1;
  const reward = 40 + round * 4;
  const spawns: RoundSpawn[] = [];
  if (round % 10 === 0 && round !== 10 && round !== 20) {
    spawns.push({ enemy: "boss", count: 1, spacing: 0, bonusHp: round * 25, bonusSpeed: 0.05 });
  }
  spawns.push({ enemy: "basic", count: 6 + round, spacing: 0.7 });
  if (round >= 3) spawns.push({ enemy: "fast", count: 2 + Math.floor(round / 2), spacing: 0.55, bonusSpeed: round >= 12 ? 0.12 : 0 });
  if (round >= 5) spawns.push({ enemy: "heavy", count: 1 + Math.floor(round / 4), spacing: 0.9, bonusHp: round * 6 });
  if (round >= 7) spawns.push({ enemy: "swarm", count: 5 + round, spacing: 0.32 });
  if (round % 5 === 0 && round !== 10 && round !== 20) {
    spawns.push({ enemy: "heavy", count: 2 + Math.floor(round / 5), spacing: 0.8, bonusHp: 30 });
  }
  return {
    reward,
    briefing: `Order ${round}. Hold the line.`,
    spawns
  };
}

export const gameConfig: GameConfig = {
  path: [
    { x: -5.5, z: 5.5 },
    { x: -5.5, z: 1.5 },
    { x: -2.5, z: 1.5 },
    { x: -2.5, z: -2.5 },
    { x: 1.5, z: -2.5 },
    { x: 1.5, z: 3.5 },
    { x: 5.5, z: 3.5 },
    { x: 5.5, z: -5.5 }
  ],
  buildZones: [
    { x: -7, z: 5 },
    { x: -7, z: 2 },
    { x: -7, z: -1 },
    { x: -7, z: -4 },
    { x: -4, z: 5 },
    { x: -4, z: -1 },
    { x: -4, z: -4 },
    { x: -1, z: 5 },
    { x: -1, z: -5 },
    { x: 2, z: 6 },
    { x: 2, z: 0 },
    { x: 2, z: -5 },
    { x: 5, z: 6 },
    { x: 5, z: 0 },
    { x: 8, z: 3 },
    { x: 8, z: -2 }
  ],
  towers: [
    {
      kind: "cannon",
      name: "Cannon",
      cost: 80,
      sellMultiplier: 0.7,
      color: "#f4b860",
      description: "Reliable single-target damage for early and mid waves.",
      upgrades: [
        { cost: 50, damage: 16, range: 3.3, fireRate: 1.1, value: 91 },
        { cost: 90, damage: 24, range: 3.7, fireRate: 1.0, value: 154 },
        { cost: 150, damage: 36, range: 4.1, fireRate: 0.9, value: 260 }
      ]
    },
    {
      kind: "rapid",
      name: "Rapid",
      cost: 95,
      sellMultiplier: 0.7,
      color: "#7de2a5",
      description: "Fast shots that excel against swarms and quick enemies.",
      upgrades: [
        { cost: 55, damage: 7, range: 3.1, fireRate: 2.2, value: 105 },
        { cost: 100, damage: 9, range: 3.4, fireRate: 2.7, value: 175 },
        { cost: 160, damage: 12, range: 3.8, fireRate: 3.1, value: 287 }
      ]
    },
    {
      kind: "splash",
      name: "Splash",
      cost: 120,
      sellMultiplier: 0.7,
      color: "#89b4ff",
      description: "Area damage for clustered waves and boss support.",
      upgrades: [
        { cost: 70, damage: 20, range: 3.0, fireRate: 0.75, splashRadius: 1.2, value: 126 },
        { cost: 120, damage: 30, range: 3.4, fireRate: 0.8, splashRadius: 1.45, value: 210 },
        { cost: 180, damage: 44, range: 3.8, fireRate: 0.85, splashRadius: 1.7, value: 336 }
      ]
    },
    {
      kind: "slow",
      name: "Slow",
      cost: 100,
      sellMultiplier: 0.7,
      color: "#d992ff",
      description: "Soft control tower that helps other defenses finish targets.",
      upgrades: [
        { cost: 60, damage: 4, range: 3.4, fireRate: 1.2, slowFactor: 0.75, value: 112 },
        { cost: 105, damage: 5, range: 3.7, fireRate: 1.25, slowFactor: 0.65, value: 185 },
        { cost: 170, damage: 7, range: 4.0, fireRate: 1.35, slowFactor: 0.55, value: 297 }
      ]
    }
  ],
  enemies: [
    { kind: "basic", name: "Basic", hp: 60, speed: 1.15, reward: 12, color: "#f1f5f9", radius: 0.34, score: 80 },
    { kind: "fast", name: "Fast", hp: 42, speed: 1.65, reward: 14, color: "#7dd3fc", radius: 0.28, score: 95 },
    { kind: "heavy", name: "Heavy", hp: 150, speed: 0.82, reward: 24, color: "#fda4af", radius: 0.42, score: 150 },
    { kind: "swarm", name: "Swarm", hp: 26, speed: 1.35, reward: 8, color: "#fde68a", radius: 0.24, score: 55 },
    { kind: "boss", name: "Boss", hp: 600, speed: 0.7, reward: 80, color: "#fb7185", radius: 0.55, score: 500 }
  ],
  rounds: Array.from({ length: 20 }, (_, index) => {
    const round = index + 1;
    const override = MILESTONE_OVERRIDES[round];
    const base = override ?? autoRound(index);
    return { round, ...base };
  }),
  tuning: {
    startingLives: 20,
    startingCurrency: 240,
    maxLives: 30,
    maxUpgradeLevel: 3,
    bossHpMultiplier: 1.0,
    killRewardMultiplier: 1.0,
    scoreCap: 1_000_000
  }
};

export const getTowerConfig = (kind: TowerKind) => gameConfig.towers.find((tower) => tower.kind === kind)!;
export const getEnemyConfig = (kind: EnemyKind) => gameConfig.enemies.find((enemy) => enemy.kind === kind)!;
