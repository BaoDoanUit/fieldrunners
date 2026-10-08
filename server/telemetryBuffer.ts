import { promises as fs } from "node:fs";
import path from "node:path";
import type { TelemetryEvent } from "../src/shared/gameTypes";

export type { TelemetryEvent };

/**
 * Telemetry ring buffer with periodic flush to a JSON-lines file.
 *
 * Phase 3.6 of the plan. The buffer holds the last N events in memory
 * for /api/telemetry/recent reads; every `flushIntervalMs` we append
 * the unread tail to a sink file (configurable path; default
 * `server/telemetry.log`).
 *
 * The TelemetryEvent type is shared with the client
 * (`src/shared/gameTypes.ts`) so the on-wire shape is identical.
 */

export type RingBufferOptions = {
  capacity?: number;
  flushIntervalMs?: number;
  sinkPath?: string;
};

export class TelemetryRingBuffer {
  private capacity: number;
  private flushIntervalMs: number;
  private sinkPath: string;
  private buffer: TelemetryEvent[] = [];
  private cursor = 0; // index up to which the buffer has been flushed
  private timer: NodeJS.Timeout | null = null;

  constructor(opts: RingBufferOptions = {}) {
    this.capacity = opts.capacity ?? 10000;
    this.flushIntervalMs = opts.flushIntervalMs ?? 30000;
    this.sinkPath = opts.sinkPath ?? path.join(process.cwd(), "server", "telemetry.log");
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => console.error("[telemetry] flush failed", err));
    }, this.flushIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  push(ev: TelemetryEvent): void {
    this.buffer.push(ev);
    if (this.buffer.length > this.capacity) {
      // Drop the oldest in insertion order. O(n) on overflow only;
      // the ring is sized to absorb typical burst rates.
      this.buffer.shift();
    }
    this.cursor++;
  }

  recent(limit = 100): TelemetryEvent[] {
    const n = Math.min(limit, this.buffer.length);
    return this.buffer.slice(-n);
  }

  async flush(): Promise<number> {
    // Writes the events from cursor up to the latest appended index.
    if (this.buffer.length === 0) return 0;
    const startIdx = Math.max(0, this.cursor - this.buffer.length);
    const endIdx = this.cursor;
    if (endIdx <= startIdx) return 0;
    const slice = this.buffer.slice(endIdx - this.buffer.length, endIdx);
    if (slice.length === 0) return 0;
    const lines = slice.map((e) => JSON.stringify({ ...e, _flushedAt: Date.now() })).join("\n") + "\n";
    await fs.mkdir(path.dirname(this.sinkPath), { recursive: true });
    await fs.appendFile(this.sinkPath, lines, "utf8");
    return slice.length;
  }
}
