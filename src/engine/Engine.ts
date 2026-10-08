import {
  gameConfig,
  getEnemyConfig,
  getTowerConfig,
  type EnemyKind,
  type TowerConfig,
  type TowerKind
} from "../shared/gameConfig";
import type {
  BattlePhase,
  EnemyInstance,
  ProjectileInstance,
  TowerInstance
} from "../shared/gameTypes";
import { pathPosition, distance2D, type SpawnEvent } from "./path";
import { acquireTarget, type TargetStrategy } from "./targeting";
import { mulberry32, combineSeed } from "./rng";

/**
 * Engine — owns all gameplay state and the per-frame simulation.
 *
 * Extracted from `createEngine()` in `src/ui/App.tsx` (Phase 2 of the
 * implementation plan). The public surface is unchanged from the old
 * factory return value so call sites in App.tsx work without rewrite.
 *
 * New in Phase 2:
 *  - Event subscription (`on(event, fn)`) for VFX / SFX hooks:
 *      - "fire"      (tower kind, projectile spawn point)
 *      - "kill"      (enemy kind, position)
 *      - "leak"      (enemy kind)
 *      - "roundClear" (round number)
 *      - "victory"
 *      - "defeat"
 *  - Tower-level visual hint via `towerVariant(id)` returning the
 *    1/2/3 "kind" used by the scene to pick a rim color (Phase 2.3).
 *  - Range ring helper `towerRange(id)` for the in-canvas ring (Phase 2.2).
 */

export type EngineEvent =
  | { type: "fire"; towerKind: TowerKind; x: number; z: number }
  | { type: "kill"; enemyKind: EnemyKind; x: number; z: number }
  | { type: "leak"; enemyKind: EnemyKind }
  | { type: "roundClear"; round: number; score: number }
  | { type: "victory"; score: number }
  | { type: "defeat"; round: number };

type EventListener = (e: EngineEvent) => void;

type PlacedTower = TowerInstance & { config: TowerConfig };

const TARGET_STRATEGY: Record<TowerKind, TargetStrategy> = {
  cannon: "strongest",
  rapid: "first",
  splash: "densest",
  slow: "first"
};

export class Engine {
  // Public read-only state
  readonly towers: PlacedTower[] = [];
  readonly enemies: EnemyInstance[] = [];
  readonly projectiles: ProjectileInstance[] = [];

  // Internal state
  private currentRound: null | (typeof gameConfig.rounds)[number] = null;
  private spawnQueue: SpawnEvent[] = [];
  private spawnTimer = 0;
  private defeatedThisRound = 0;
  private escapedThisRound = 0;
  private scoreThisRound = 0;
  private roundCompleteTriggered = false;
  private listeners: Set<EventListener> = new Set();
  private rng: () => number;

  // Per-frame tick outputs (consumed by App.tsx)
  private _currencyDelta = 0;
  private _scoreDelta = 0;
  private _livesDelta = 0;
  private _roundComplete: null | { defeated: number; escaped: number; earned: number; score: number } = null;
  private _enemyKilled: EnemyKind | null = null;
  private _enemyEscaped: EnemyKind | null = null;

  constructor(seedKey: string) {
    this.rng = mulberry32(combineSeed(seedKey));
  }

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch (err) {
        console.warn("[Engine] listener error", err);
      }
    }
  }

  // ---- Per-frame read API (consumed by App.tsx) ----
  currencyDelta(): number { return this._currencyDelta; }
  scoreDelta(): number { return this._scoreDelta; }
  livesDelta(): number { return this._livesDelta; }
  enemyKilled(): EnemyKind | null { return this._enemyKilled; }
  enemyEscaped(): EnemyKind | null { return this._enemyEscaped; }
  roundComplete(): null | { defeated: number; escaped: number; earned: number; score: number } {
    return this._roundComplete;
  }

  // ---- Public mutation API ----
  hasTowerNear(x: number, z: number): boolean {
    return this.towers.some((tower) => distance2D(tower.x, tower.z, x, z) < 0.65);
  }

  findTowerAt(x: number, z: number): PlacedTower | null {
    return this.towers.find((tower) => distance2D(tower.x, tower.z, x, z) < 0.65) ?? null;
  }

  getTower(id: string): PlacedTower | null {
    return this.towers.find((t) => t.id === id) ?? null;
  }

  placeTower(kind: TowerKind, x: number, z: number): PlacedTower {
    const cfg = getTowerConfig(kind);
    const tower: PlacedTower = {
      id: makeId("tower"),
      kind,
      x,
      z,
      level: 1,
      cooldown: 0,
      config: cfg
    };
    this.towers.push(tower);
    return tower;
  }

  upgradeTower(id: string): { ok: boolean; reason?: string; cost?: number } {
    const tower = this.towers.find((t) => t.id === id);
    if (!tower) return { ok: false, reason: "Tower not found" };
    if (tower.level >= 3) return { ok: false, reason: "Tower is already max level" };
    const upgrade = tower.config.upgrades[tower.level];
    tower.level += 1;
    return { ok: true, cost: upgrade.cost };
  }

  sellTower(id: string): { ok: boolean; value: number } {
    const idx = this.towers.findIndex((t) => t.id === id);
    if (idx === -1) return { ok: false, value: 0 };
    const tower = this.towers[idx];
    // The base cost + every upgrade tier the player has paid for.
    // upgrades[i] is the entry that takes the tower from level (i) to
    // (i+1). The tower starts at L1 (no upgrades[0] cost), so we
    // slice(1, level) to sum what was actually spent.
    const invested =
      tower.config.cost +
      tower.config.upgrades.slice(1, tower.level).reduce((s, u) => s + u.cost, 0);
    const value = Math.round(invested * tower.config.sellMultiplier);
    this.towers.splice(idx, 1);
    return { ok: true, value };
  }

  /** Range of a tower at its current level, in world units. */
  towerRange(id: string): number {
    const t = this.getTower(id);
    if (!t) return 0;
    return t.config.upgrades[t.level - 1].range;
  }

  /** Splash radius of a tower at its current level (0 if none). */
  towerSplashRadius(id: string): number {
    const t = this.getTower(id);
    if (!t) return 0;
    return t.config.upgrades[t.level - 1].splashRadius ?? 0;
  }

  /** Tower visual state (1/2/3) — used by the scene to pick a rim color. */
  towerVariant(id: string): 1 | 2 | 3 {
    const t = this.getTower(id);
    if (!t) return 1;
    return t.level as 1 | 2 | 3;
  }

  spawnDebugEnemy(kind: EnemyKind): void {
    const cfg = getEnemyConfig(kind);
    this.enemies.push(makeEnemyAtPathStart(cfg));
  }

  startRound(round: (typeof gameConfig.rounds)[number]): void {
    this.currentRound = round;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.defeatedThisRound = 0;
    this.escapedThisRound = 0;
    this.scoreThisRound = 0;
    this.roundCompleteTriggered = false;
    let cursor = 0.4;
    for (const group of round.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          enemy: getEnemyConfig(group.enemy),
          at: cursor,
          bonusHp: group.bonusHp,
          bonusSpeed: group.bonusSpeed
        });
        cursor += group.spacing;
      }
    }
  }

  /** End a run — clears round state. Towers stay. */
  endRound(): void {
    this.currentRound = null;
    this.spawnQueue = [];
    this.roundCompleteTriggered = false;
  }

  /** Step the simulation forward by `dt` seconds. */
  tick(dt: number): void {
    this._currencyDelta = 0;
    this._scoreDelta = 0;
    this._livesDelta = 0;
    this._roundComplete = null;
    this._enemyKilled = null;
    this._enemyEscaped = null;

    if (this.currentRound) {
      this.tickSpawns(dt);
    }
    this.tickEnemies(dt);
    this.tickTowers(dt);
    this.tickProjectiles(dt);

    if (this.currentRound && !this.roundCompleteTriggered) {
      if (this.spawnQueue.length === 0 && this.enemies.every((e) => !e.alive)) {
        this.roundCompleteTriggered = true;
        this._roundComplete = {
          defeated: this.defeatedThisRound,
          escaped: this.escapedThisRound,
          earned: this.currentRound.reward,
          score: this.scoreThisRound
        };
        this.emit({ type: "roundClear", round: this.currentRound.round, score: this.scoreThisRound });
      }
    }
  }

  private tickSpawns(dt: number): void {
    this.spawnTimer += dt;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.spawnTimer) {
      const next = this.spawnQueue.shift()!;
      const enemy: EnemyInstance = {
        id: makeId("enemy"),
        kind: next.enemy.kind as EnemyKind,
        hp: next.enemy.hp + (next.bonusHp ?? 0),
        maxHp: next.enemy.hp + (next.bonusHp ?? 0),
        speed: next.enemy.speed + (next.bonusSpeed ?? 0),
        progress: 0,
        slowMultiplier: 1,
        x: gameConfig.path[0].x,
        z: gameConfig.path[0].z,
        radius: next.enemy.radius,
        reward: next.enemy.reward,
        score: next.enemy.score,
        alive: true
      };
      this.enemies.push(enemy);
    }
  }

  private tickEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.progress += (enemy.speed * enemy.slowMultiplier * dt) / 16;
      if (enemy.progress >= 1) {
        enemy.alive = false;
        this.escapedThisRound += 1;
        this._livesDelta -= 1;
        this._enemyEscaped = enemy.kind;
        this.emit({ type: "leak", enemyKind: enemy.kind });
        continue;
      }
      const p = pathPosition(gameConfig.path, enemy.progress);
      enemy.x = p.x;
      enemy.z = p.z;
    }
    // Compact dead enemies out so the scene doesn't grow forever.
    if (this.enemies.some((e) => !e.alive)) {
      const alive = this.enemies.filter((e) => e.alive);
      this.enemies.length = 0;
      this.enemies.push(...alive);
    }
  }

  private tickTowers(dt: number): void {
    for (const tower of this.towers) {
      const upgrade = tower.config.upgrades[tower.level - 1];
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const target = acquireTarget(tower, this.enemies, TARGET_STRATEGY[tower.kind]);
      if (!target) continue;
      tower.cooldown = 1 / upgrade.fireRate;
      this.projectiles.push({
        id: makeId("projectile"),
        x: tower.x,
        z: tower.z,
        targetId: target.id,
        speed: 16,
        damage: upgrade.damage,
        splashRadius: upgrade.splashRadius,
        slowFactor: upgrade.slowFactor,
        color: tower.config.color,
        done: false
      });
      this.emit({ type: "fire", towerKind: tower.kind, x: tower.x, z: tower.z });
    }
  }

  private tickProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.done) continue;
      const target = this.enemies.find((e) => e.id === p.targetId && e.alive);
      if (!target) {
        p.done = true;
        continue;
      }
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.18) {
        // Hit
        p.done = true;
        if (p.splashRadius) {
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (distance2D(e.x, e.z, target.x, target.z) <= p.splashRadius) {
              this.damageEnemy(e, p.damage, target);
            }
          }
        } else {
          this.damageEnemy(target, p.damage, target);
        }
        if (p.slowFactor) {
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (distance2D(e.x, e.z, target.x, target.z) <= 1.6) {
              e.slowMultiplier = Math.min(e.slowMultiplier, p.slowFactor);
            }
          }
        }
      } else {
        p.x += (dx / d) * p.speed * dt;
        p.z += (dz / d) * p.speed * dt;
      }
    }
    if (this.projectiles.some((p) => p.done)) {
      const alive = this.projectiles.filter((p) => !p.done);
      this.projectiles.length = 0;
      this.projectiles.push(...alive);
    }
  }

  private damageEnemy(e: EnemyInstance, dmg: number, _at: EnemyInstance): void {
    e.hp -= dmg;
    if (e.hp <= 0) {
      e.alive = false;
      this.defeatedThisRound += 1;
      this.scoreThisRound += e.score;
      this._currencyDelta += e.reward;
      this._scoreDelta += e.score;
      this._enemyKilled = e.kind;
      this.emit({ type: "kill", enemyKind: e.kind, x: e.x, z: e.z });
    }
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEnemyAtPathStart(cfg: ReturnType<typeof getEnemyConfig>): EnemyInstance {
  return {
    id: makeId("enemy"),
    kind: cfg.kind,
    hp: cfg.hp,
    maxHp: cfg.hp,
    speed: cfg.speed,
    progress: 0,
    slowMultiplier: 1,
    x: gameConfig.path[0].x,
    z: gameConfig.path[0].z,
    radius: cfg.radius,
    reward: cfg.reward,
    score: cfg.score,
    alive: true
  };
}
