import type { EnemyKind, TowerKind } from "./gameConfig";

export interface SavedProgress {
  unlockedRound: number;
  bestScore: number;
  tutorialComplete: boolean;
  settings: {
    music: boolean;
    sfx: boolean;
    haptics: boolean;
  };
}

export interface TowerInstance {
  id: string;
  kind: TowerKind;
  x: number;
  z: number;
  level: number;
  cooldown: number;
}

export interface EnemyInstance {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number;
  progress: number;
  slowMultiplier: number;
  x: number;
  z: number;
  radius: number;
  reward: number;
  score: number;
  alive: boolean;
}

export interface ProjectileInstance {
  id: string;
  x: number;
  z: number;
  targetId: string;
  speed: number;
  damage: number;
  splashRadius?: number;
  slowFactor?: number;
  color: string;
  done: boolean;
}

export type BattlePhase = "menu" | "tutorial" | "building" | "combat" | "victory" | "defeat" | "settings" | "roundCleared" | "paused";

export interface TelemetryEvent {
  name: string;
  ts: number;
  payload?: Record<string, unknown>;
}
