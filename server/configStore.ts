import { promises as fs } from "node:fs";

/**
 * ConfigStore — pluggable game-config source.
 *
 * Resolution order:
 *  1. If `BALANCE_CONFIG_URL` is set, fetch from there at boot.
 *  2. Otherwise, fall back to the bundled `gameConfig` from the shared module.
 *
 * The shape mirrors `GameConfig` in `src/shared/gameConfig.ts`. The
 * `gameConfig` is exported as a singleton, but the store treats it as
 * read-only data.
 */
import { gameConfig as bundledConfig, type GameConfig } from "../src/shared/gameConfig";

const REQUIRED_KEYS: (keyof GameConfig)[] = ["path", "buildZones", "towers", "enemies", "rounds"];

export class ConfigStore {
  private cache: GameConfig | null = null;
  private loadingPromise: Promise<GameConfig> | null = null;

  async load(): Promise<GameConfig> {
    if (this.cache) return this.cache;
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = this.resolve();
    try {
      this.cache = await this.loadingPromise;
      return this.cache;
    } finally {
      this.loadingPromise = null;
    }
  }

  current(): GameConfig {
    return this.cache ?? bundledConfig;
  }

  private async resolve(): Promise<GameConfig> {
    const url = process.env.BALANCE_CONFIG_URL;
    if (!url) return bundledConfig;

    // file:// or http(s)://
    if (url.startsWith("file://")) {
      const path = url.replace(/^file:\/\//, "");
      const raw = await fs.readFile(path, "utf8");
      return validate(JSON.parse(raw));
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load remote config: ${res.status} ${res.statusText}`);
    }
    return validate((await res.json()) as GameConfig);
  }
}

function validate(cfg: GameConfig): GameConfig {
  for (const key of REQUIRED_KEYS) {
    if (!(key in cfg)) {
      throw new Error(`Remote config is missing required key: ${key}`);
    }
  }
  return cfg;
}
