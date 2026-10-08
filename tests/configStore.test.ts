import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigStore } from "../server/configStore";
import { gameConfig } from "../src/shared/gameConfig";

/**
 * Phase 3.9 — ConfigStore.
 *
 * The store either returns the bundled gameConfig or fetches a
 * remote JSON (file:// or http(s)://) when BALANCE_CONFIG_URL is
 * set, and validates the required top-level keys.
 */

let tmpDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "config-test-"));
  originalEnv = process.env.BALANCE_CONFIG_URL;
  delete process.env.BALANCE_CONFIG_URL;
});

afterEach(async () => {
  if (originalEnv === undefined) delete process.env.BALANCE_CONFIG_URL;
  else process.env.BALANCE_CONFIG_URL = originalEnv;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("ConfigStore — bundled", () => {
  it("returns the bundled config when BALANCE_CONFIG_URL is unset", async () => {
    const store = new ConfigStore();
    const cfg = await store.load();
    expect(cfg).toBe(gameConfig);
  });

  it("current() returns the bundled config before load()", () => {
    const store = new ConfigStore();
    expect(store.current()).toBe(gameConfig);
  });

  it("load() is idempotent and returns the same instance", async () => {
    const store = new ConfigStore();
    const a = await store.load();
    const b = await store.load();
    expect(a).toBe(b);
  });
});

describe("ConfigStore — file:// URL", () => {
  it("loads and validates a JSON file", async () => {
    const file = path.join(tmpDir, "balance.json");
    await fs.writeFile(file, JSON.stringify(gameConfig), "utf8");
    process.env.BALANCE_CONFIG_URL = `file://${file}`;
    const store = new ConfigStore();
    const cfg = await store.load();
    expect(cfg.towers).toHaveLength(gameConfig.towers.length);
  });

  it("rejects a file missing required keys", async () => {
    const file = path.join(tmpDir, "bad.json");
    await fs.writeFile(file, JSON.stringify({ towers: [] }), "utf8");
    process.env.BALANCE_CONFIG_URL = `file://${file}`;
    const store = new ConfigStore();
    await expect(store.load()).rejects.toThrow(/missing required key/);
  });
});
