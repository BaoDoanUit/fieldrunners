import type { RoundConfig, EnemyConfig } from "../shared/gameConfig";

/**
 * Waypoint sampling for the fixed enemy path.
 *
 * `path` is a polyline of world-space (x, z) coordinates from
 * `gameConfig.path`. We linearly interpolate along its segments by a
 * normalized progress in [0, 1].
 */
export type PathPoint = { x: number; z: number; segment: number; local: number };

export function pathPosition(
  path: ReadonlyArray<{ x: number; z: number }>,
  progress: number
): PathPoint {
  if (path.length < 2) {
    const p = path[0] ?? { x: 0, z: 0 };
    return { ...p, segment: 0, local: 0 };
  }
  const clamped = Math.max(0, Math.min(1, progress));
  const segmentLength = 1 / (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(clamped / segmentLength));
  const local = (clamped - index * segmentLength) / segmentLength;
  const start = path[index];
  const end = path[index + 1];
  return {
    x: start.x + (end.x - start.x) * local,
    z: start.z + (end.z - start.z) * local,
    segment: index,
    local
  };
}

/** Total polyline length (Euclidean). */
export function pathLength(path: ReadonlyArray<{ x: number; z: number }>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

/** Linear distance between two world points. */
export function distance2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/**
 * Expand a `RoundConfig` into a flat list of `SpawnEvent`s with explicit
 * times. Each spawn is timed by `enemyKind.spawnSpacing` plus a per-group
 * offset so heavy / fast / swarm spawns interleave naturally.
 */
export type SpawnEvent = {
  enemy: EnemyConfig;
  at: number;
  bonusHp?: number;
  bonusSpeed?: number;
};

export function planSpawns(round: RoundConfig): SpawnEvent[] {
  // Imported lazily to avoid a circular import with Engine.
  // (path.ts is loaded by Engine.ts, which loads gameConfig.ts.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getEnemyConfig } = require("../shared/gameConfig") as typeof import("../shared/gameConfig");
  const events: SpawnEvent[] = [];
  let cursor = 0.4;
  for (const group of round.spawns) {
    for (let i = 0; i < group.count; i++) {
      events.push({
        enemy: getEnemyConfig(group.enemy),
        at: cursor,
        bonusHp: group.bonusHp,
        bonusSpeed: group.bonusSpeed
      });
      cursor += group.spacing;
    }
  }
  return events;
}
