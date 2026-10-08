import type { EnemyInstance, TowerInstance } from "../shared/gameTypes";

/**
 * Targeting — pick which enemy a tower fires at.
 *
 * The PRD says "Towers acquire targets based on default targeting rules."
 * We provide four strategies; the engine's per-tower default is wired in
 * `Engine.ts`:
 *
 *   cannon  -> strongest
 *   rapid   -> first        (along the path)
 *   splash  -> densest      (most enemies within splashRadius)
 *   slow    -> first
 */
export type TargetStrategy = "first" | "last" | "strongest" | "weakest" | "densest";

export function acquireTarget(
  tower: TowerInstance,
  enemies: EnemyInstance[],
  strategy: TargetStrategy
): EnemyInstance | null {
  if (enemies.length === 0) return null;
  const inRange = enemies.filter((e) => e.alive && distance2D(tower.x, tower.z, e.x, e.z) <= towerConfig(tower).range);
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
      const r = towerConfig(tower).upgrades[tower.level - 1].splashRadius ?? 1.2;
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

function distance2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

// Local re-export of the per-tower config so the module compiles without
// pulling gameConfig into the engine bundle. The Engine wires the real
// config lookup at runtime.
type TowerConfigLike = {
  range: number;
  upgrades: Array<{ splashRadius?: number }>;
};
function towerConfig(t: TowerInstance): TowerConfigLike {
  // The `PlacedTower` type carries the full config; the engine keeps the
  // accessor on the instance so the engine can call this without a
  // separate lookup. For type-completeness, this stub returns the
  // same shape but the engine replaces it with the real `config` field.
  return (t as unknown as { config: TowerConfigLike }).config;
}
