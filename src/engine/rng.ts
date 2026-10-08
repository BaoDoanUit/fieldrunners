/**
 * Mulberry32 — a small, fast, deterministic PRNG.
 *
 * Used in v2 for replayable runs; for now it gives the engine a single
 * source of randomness so the spawn timing of "swarm" / "basic" etc.
 * can be shuffled without touching React state.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Combine a few 32-bit ints into a single seed. */
export function combineSeed(...parts: Array<number | string>): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    }
  }
  return h >>> 0;
}
