import { defineConfig } from "vitest/config";

/**
 * Vitest config.
 *
 * Phase 3.9: introduces a test harness for engine, targeting, spawn
 * (rounds) and API utilities. Tests run in Node (no browser DOM) and
 * only load files that don't import React or Three.js.
 *
 * The test files that exercise the React/Three.js layer (App.tsx) are
 * deferred — those need jsdom + a renderer mock and are not in scope
 * for this pass.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false
  }
});
