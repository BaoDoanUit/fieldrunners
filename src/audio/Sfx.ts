/**
 * Sfx — a tiny Web Audio synthesizer for the FieldRunner sound palette.
 *
 * No binary audio assets: every cue is a short oscillator + envelope.
 * This keeps the bundle small (~5 KB) and means the game ships silent
 * on the very first paint, then unlocks on the first user gesture
 * (browser autoplay policy).
 *
 * Cues are tuned to be distinguishable with eyes closed:
 *  - sheet-rise:   low paper-rustle (filtered noise, 220ms)
 *  - ink-press:    tiny typewriter click (square wave, 60ms)
 *  - place-tower:  thud (sine, 180ms, 110Hz->70Hz)
 *  - fire-cannon:  thud (square, 130ms, 140Hz)
 *  - fire-rapid:   tick (square, 40ms, 320Hz)
 *  - fire-splash:  boom (sine + noise, 240ms, 80Hz)
 *  - fire-slow:    whoosh (sine sweep, 320ms, 200Hz->100Hz)
 *  - enemy-killed: pop (sine, 80ms, 660Hz)
 *  - round-cleared: short major triad (three sine blips, 200ms apart)
 *  - victory:      longer major triad with shimmer (440/554/659 + 880)
 *  - defeat:       descending minor third (220 -> 196, 600ms)
 */

export type SfxName =
  | "sheet-rise"
  | "ink-press"
  | "place-tower"
  | "fire-cannon"
  | "fire-rapid"
  | "fire-splash"
  | "fire-slow"
  | "enemy-killed"
  | "round-cleared"
  | "victory"
  | "defeat";

type Cue = (ctx: AudioContext, now: number, master: GainNode) => void;

const CUES: Record<SfxName, Cue> = {
  "sheet-rise": (ctx, t, m) => {
    // Filtered white noise -> a paper sound
    const noise = createNoise(ctx, 0.22);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    noise.connect(filter).connect(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.linearRampToValueAtTime(0, t + 0.22);
    noise.start(t);
    noise.stop(t + 0.24);
  },

  "ink-press": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.06);
  },

  "place-tower": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.2);
  },

  "fire-cannon": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.15);
  },

  "fire-rapid": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.05);
  },

  "fire-splash": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 80;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.26);
    // Tiny noise tail
    const noise = createNoise(ctx, 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    noise.connect(filter).connect(m);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t + 0.05);
    ng.gain.linearRampToValueAtTime(0.06, t + 0.07);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    noise.start(t + 0.05);
    noise.stop(t + 0.24);
  },

  "fire-slow": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.34);
  },

  "enemy-killed": (ctx, t, m) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.09);
  },

  "round-cleared": (ctx, t, m) => {
    [440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.18;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.12, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(g).connect(m);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  },

  "victory": (ctx, t, m) => {
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.16;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(g).connect(m);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  },

  "defeat": (ctx, t, m) => {
    [220, 196, 175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.18;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(g).connect(m);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  }
};

class SfxImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  private _unlocked = false;

  /** Lazily create the AudioContext. Safe to call repeatedly. */
  private ensureContext(): { ctx: AudioContext; master: GainNode } | null {
    if (this.ctx) return { ctx: this.ctx, master: this.master! };
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      return { ctx: this.ctx, master: this.master };
    } catch {
      return null;
    }
  }

  /** Call this from a user-gesture handler to satisfy autoplay policy. */
  unlock(): void {
    if (this._unlocked) return;
    const made = this.ensureContext();
    if (!made) return;
    if (made.ctx.state === "suspended") {
      void made.ctx.resume();
    }
    this._unlocked = true;
  }

  /** Play a named cue. No-op if the context hasn't been unlocked yet. */
  play(name: SfxName): void {
    if (this._muted) return;
    const made = this.ensureContext();
    if (!made) return;
    if (made.ctx.state === "suspended") {
      void made.ctx.resume();
    }
    try {
      CUES[name](made.ctx, made.ctx.currentTime, made.master);
    } catch (err) {
      console.warn("[Sfx] cue failed:", name, err);
    }
  }

  /** Toggle the master mute. */
  mute(value: boolean): void {
    this._muted = value;
    if (this.master) this.master.gain.value = value ? 0 : 0.6;
  }

  isMuted(): boolean {
    return this._muted;
  }

  isUnlocked(): boolean {
    return this._unlocked;
  }
}

function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(duration * sampleRate), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

export const Sfx = new SfxImpl();
