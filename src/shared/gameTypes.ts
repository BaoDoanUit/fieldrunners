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

/**
 * Strict contract for telemetry event names.
 *
 * The 20 names below are the entire PRD tracking plan. The client
 * is statically prevented from emitting anything else (via the
 * `TelemetryEventName` union), and the server enforces the same set
 * at runtime by deriving its allowlist from `TELEMETRY_EVENT_NAMES`.
 *
 * If a new event is needed, add it here, then update the server in
 * the same commit. The server cannot drift from the client because
 * both import from this file.
 */
export const TELEMETRY_EVENT_NAMES = [
  "app_open",
  "tutorial_started",
  "tutorial_completed",
  "run_started",
  "round_started",
  "round_completed",
  "round_failed",
  "tower_selected",
  "tower_placed",
  "tower_upgraded",
  "tower_sold",
  "enemy_killed",
  "enemy_escaped",
  "player_paused",
  "player_resumed",
  "run_won",
  "retry_clicked",
  "settings_changed",
  "round_unlocked",
  "telemetry_error"
] as const;

export type TelemetryEventName = typeof TELEMETRY_EVENT_NAMES[number];

/** Bump when the TelemetryEvent wire shape changes in a breaking way. */
export const TELEMETRY_VERSION = 1 as const;

export interface TelemetryEvent {
  /** Schema version. Always 1 in the current contract. */
  version: typeof TELEMETRY_VERSION;
  /** One of the 20 names in TELEMETRY_EVENT_NAMES. */
  name: TelemetryEventName;
  /** Wall-clock ms when the event was emitted by the client. */
  ts: number;
  /** Event-specific structured payload. Optional. */
  payload?: Record<string, unknown>;
}
