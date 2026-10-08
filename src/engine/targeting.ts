import type { EnemyInstance, TowerInstance } from "../shared/gameTypes";

/**
 * Targeting — pick which enemy a tower fires at.
 *
 * The PRD says "Towers acquire targets based on default targeting rules."
 * We provide five strategies; the engine's per-tower default is wired in
 * `Engine.ts`:
 *
 *   cannon  -> strongest
 *   rapid   -> first        (along the path)
 *   splash  -> densest      (most enemies within splashRadius)
 *   slow    -> first
 *
 * The tower's effective range comes from the *current* upgrade level
 * (`tower.config.upgrades[tower.level - 1].range`), not a top-level
 * field — `TowerConfig` doesn't carry a flat `range`.
 */
export type TargetStrategy = "first" | "last" | "strongest" | "weakest" | "densest";

type TowerLike = TowerInstance & {
  config?: { upgrades: Array<{ range: number; splashRadius?: number }> };
};

function currentUpgrade(tower: TowerLike): { range: number; splashRadius?: number } {
  const cfg = tower.config;
  if (!cfg) return { range: 0 };
  return cfg.upgrades[Math.max(0, (tower.level ?? 1) - 1)];
}

function distance2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function acquireTarget(
  tower: TowerInstance,
  enemies: EnemyInstance[],
  strategy: TargetStrategy
): EnemyInstance | null {
  if (enemies.length === 0) return null;
  const range = currentUpgrade(tower as TowerLike).range;
  if (range <= 0) return null;
  const inRange = enemies.filter(
    (e) => e.alive && distance2D(tower.x, tower.z, e.x, e.z) <= range
  );
  if (inRange.length === 0) return null;

  switch (strategy) {
    case "first": {
      return inRange.reduce((a, b) => (a.progress > b.progress ? a : b));
    }
    case "last": {
      return inRange.reduce((a, b) => (a.progress < b.progress ? a : b));
    }
    case "strongest": {
      return inRange.reduce((a, b) => (a.hp > b.hp ? a : b));
    }
    case "weakest": {
      return inRange.reduce((a, b) => (a.hp < b.hp ? a : b));
    }
    case "densest": {
      // The enemy with the most other enemies within `splashRadius` of it.
      // Falls back to "first" if there's no splash radius.
      const r = currentUpgrade(tower as TowerLike).splashRadius ?? 1.2;
      let best = inRange[0];
      let bestCount = -1;
      for (const e of inRange) {
        const c = enemies.reduce(
          (acc, o) => (o !== e && o.alive && distance2D(e.x, e.z, o.x, o.z) <= r ? acc + 1 : acc),
          0
        );
        if (c > bestCount) {
          best = e;
          bestCount = c;
        }
      }
      return best;
    }
  }
}
