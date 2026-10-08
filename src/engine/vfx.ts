import * as THREE from "three";

/**
 * In-canvas VFX particle system.
 *
 * Phase 2.4 of the plan. The engine emits gameplay events
 * (`fire` / `kill` / `leak`); this module converts them into
 * short-lived particles that are added to a single Three.js
 * group, ticked each frame, and reaped when they expire.
 *
 * Effect kinds:
 *  - `trail`   — small dim quads that follow projectiles
 *  - `hit`     — outward burst of 6-8 sparkles when a shot lands
 *  - `death`   — larger puff with gravity when an enemy dies
 *  - `upgrade` — radial spark ring when a tower upgrades
 *
 * The whole layer is a no-op when `reducedMotion` is set: nothing
 * is spawned and `tick`/`render` are cheap early-returns.
 */

export type VfxKind = "trail" | "hit" | "death" | "upgrade";

type Particle = {
  kind: VfxKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
  /** ring radius at expiry (for `upgrade`). */
  ringRadius?: number;
};

const POOL_CAP = 240;

export class VfxManager {
  private particles: Particle[] = [];
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private reducedMotion: boolean;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.group = new THREE.Group();
    this.group.name = "vfx";
  }

  setReducedMotion(next: boolean) {
    this.reducedMotion = next;
    if (next) this.clear();
  }

  /** The Three.js group to add to the scene. */
  sceneGroup(): THREE.Group {
    return this.group;
  }

  /** Drop all active particles. Called on reset. */
  clear(): void {
    this.particles.length = 0;
  }

  /**
   * Spawn a single particle. For burst effects, callers should call
   * `spawnBurst` instead which fans out N particles in a ring.
   */
  spawn(kind: VfxKind, x: number, z: number, color: string | number, opts: { y?: number; vx?: number; vy?: number; vz?: number; life?: number; ringRadius?: number } = {}): void {
    if (this.reducedMotion) return;
    if (this.particles.length >= POOL_CAP) return;
    const c = typeof color === "string" ? new THREE.Color(color).getHex() : color;
    const life = opts.life ?? defaultLife(kind);
    this.particles.push({
      kind,
      x,
      y: opts.y ?? defaultY(kind),
      z,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      vz: opts.vz ?? 0,
      life,
      maxLife: life,
      color: c,
      ringRadius: opts.ringRadius
    });
  }

  /** Spawn N particles in a ring around (x, z) for burst effects. */
  spawnBurst(kind: VfxKind, x: number, z: number, color: string | number, count: number, opts: { speed?: number; y?: number; life?: number } = {}): void {
    if (this.reducedMotion) return;
    const speed = opts.speed ?? defaultSpeed(kind);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const v = speed * (0.6 + Math.random() * 0.5);
      this.spawn(kind, x, z, color, {
        y: opts.y ?? defaultY(kind),
        vx: Math.cos(angle) * v,
        vy: kind === "death" ? 1.2 + Math.random() * 1.0 : 0.4 + Math.random() * 0.4,
        vz: Math.sin(angle) * v,
        life: opts.life ?? defaultLife(kind)
      });
    }
  }

  /**
   * Advance all particles by `dt` seconds. Expired ones are removed.
   * Returns the number of live particles.
   */
  tick(dt: number): number {
    if (this.reducedMotion) return 0;
    const gravity = -8;
    const drag = Math.exp(-1.4 * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += gravity * dt;
      p.vx *= drag;
      p.vz *= drag;
      if (p.y < 0) p.y = 0;
    }
    return this.particles.length;
  }

  /**
   * Rebuild the Three.js mesh group from the current particle list.
   * Cheap: reuses a small mesh pool to avoid per-frame allocations.
   */
  render(): void {
    // Remove all existing meshes from the group.
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
    }
    if (this.reducedMotion || this.particles.length === 0) return;

    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife; // 0 → 1
      const size = particleSize(p.kind, t);
      const opacity = Math.max(0, 1 - t);
      let geom: THREE.BufferGeometry;
      if (p.kind === "upgrade") {
        // Ring expanding outward — render as a thin ring at p.y on the ground plane.
        const r = (p.ringRadius ?? 1.4) * (0.4 + 1.0 * t);
        geom = new THREE.RingGeometry(r - 0.04, r, 18);
      } else {
        geom = new THREE.SphereGeometry(size, 6, 6);
      }
      const mat = new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(p.x, p.kind === "upgrade" ? 0.05 : p.y, p.z);
      if (p.kind === "upgrade") mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
    // Best-effort dispose; small counts mean this is fine.
    this.meshes.length = 0;
  }

  /** Diagnostic: how many particles are currently live. */
  count(): number {
    return this.particles.length;
  }
}

function defaultLife(kind: VfxKind): number {
  switch (kind) {
    case "trail":   return 0.25;
    case "hit":     return 0.45;
    case "death":   return 0.85;
    case "upgrade": return 0.55;
  }
}

function defaultY(kind: VfxKind): number {
  switch (kind) {
    case "trail":   return 0.7;
    case "hit":     return 0.7;
    case "death":   return 0.5;
    case "upgrade": return 0.05;
  }
}

function defaultSpeed(kind: VfxKind): number {
  switch (kind) {
    case "hit":     return 1.6;
    case "death":   return 2.4;
    case "upgrade": return 1.4;
    case "trail":   return 0;
  }
}

function particleSize(kind: VfxKind, t: number): number {
  // t goes 0 → 1. Most particles shrink slightly; trails stay small.
  switch (kind) {
    case "trail":   return 0.06 * (1 - 0.5 * t);
    case "hit":     return 0.08 * (1 - 0.4 * t);
    case "death":   return 0.12 * (1 - 0.5 * t);
    case "upgrade": return 0.05;
  }
}
