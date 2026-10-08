import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { TelemetryRingBuffer } from "../server/telemetryBuffer";
import { TELEMETRY_VERSION } from "../src/shared/gameTypes";
import type { TelemetryEvent } from "../src/shared/gameTypes";

/**
 * Phase 3.9 — Telemetry ring buffer.
 *
 * Verifies capacity, recent() slicing, and JSONL flush to a temp file.
 */

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "telemetry-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function ev(name: string, ts = Date.now()): TelemetryEvent {
  return { version: TELEMETRY_VERSION, name: name as TelemetryEvent["name"], ts, payload: { name } };
}

describe("TelemetryRingBuffer", () => {
  it("stores up to capacity and drops the oldest", async () => {
    const sink = path.join(tmpDir, "out.log");
    const buf = new TelemetryRingBuffer({ capacity: 3, sinkPath: sink });
    for (let i = 0; i < 5; i++) buf.push(ev(`app_open`, i));
    const recent = buf.recent(10);
    expect(recent).toHaveLength(3);
    // The first two are dropped; the latest three remain.
    expect(recent.map((e) => e.ts)).toEqual([2, 3, 4]);
  });

  it("recent(N) returns the most recent N events", () => {
    const sink = path.join(tmpDir, "out.log");
    const buf = new TelemetryRingBuffer({ capacity: 100, sinkPath: sink });
    for (let i = 0; i < 10; i++) buf.push(ev(`app_open`, i));
    expect(buf.recent(3).map((e) => e.ts)).toEqual([7, 8, 9]);
    expect(buf.recent(100).map((e) => e.ts)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("flush() writes JSONL to the sink file", async () => {
    const sink = path.join(tmpDir, "out.log");
    const buf = new TelemetryRingBuffer({ capacity: 100, sinkPath: sink });
    buf.push(ev("app_open", 1));
    buf.push(ev("run_started", 2));
    const n = await buf.flush();
    expect(n).toBe(2);
    const lines = (await fs.readFile(sink, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).name).toBe("app_open");
    expect(JSON.parse(lines[1]).name).toBe("run_started");
  });

  it("flush() is a no-op when the buffer is empty", async () => {
    const sink = path.join(tmpDir, "out.log");
    const buf = new TelemetryRingBuffer({ capacity: 100, sinkPath: sink });
    const n = await buf.flush();
    expect(n).toBe(0);
    // No file was created.
    await expect(fs.access(sink)).rejects.toThrow();
  });
});
