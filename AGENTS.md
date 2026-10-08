# FieldRunner — Agent Context

> Read this before working in the repo. AI coding agents (OpenCode, Codex,
> Cursor, Aider, Gemini CLI, …) auto-load it.

## What this is

A small, single-player tower-defense game. React 18 + Three.js on the client,
Express + Socket.IO on the server. ~5 100 LOC across 21 source files, 9
test files, 4 server files, 6 public assets.

## Where things live

| Concern                      | File                                       |
| ---------------------------- | ------------------------------------------ |
| Game design / balance data   | `src/shared/gameConfig.ts`                 |
| Type definitions             | `src/shared/gameTypes.ts`                  |
| Telemetry event contract     | `src/shared/gameTypes.ts` (TELEMETRY_EVENT_NAMES + version 1) |
| React entry point            | `src/main.tsx`                             |
| Client (UI + render)         | `src/ui/App.tsx`                           |
| Engine (gameplay simulation) | `src/engine/Engine.ts`                     |
| Path math                    | `src/engine/path.ts`                       |
| Targeting strategies         | `src/engine/targeting.ts`                  |
| Seeded RNG                   | `src/engine/rng.ts`                        |
| In-canvas VFX particles      | `src/engine/vfx.ts`                        |
| SFX + procedural BGM (Web Audio) | `src/audio/Sfx.ts`                     |
| Haptic feedback wrapper      | `src/audio/Haptics.ts`                     |
| Server (REST + Socket.IO)    | `server/index.ts`                          |
| Telemetry ring buffer        | `server/telemetryBuffer.ts`                |
| Pluggable balance config     | `server/configStore.ts`                    |
| Uniform JSON errors          | `server/errorHandler.ts`                   |
| Vite dev proxy               | `vite.config.ts`                           |
| Vitest config                | `vitest.config.ts`                         |

`src/shared/*` is the **source of truth** for gameplay data. The client and
the server both import from it. Never duplicate numbers — edit `gameConfig.ts`.
The telemetry event name union is shared by the client (compile-time) and
the server (runtime allowlist).

## Code map

A curated knowledge graph of the repo lives at
[`.codegraph/CODEGRAPH.md`](.codegraph/CODEGRAPH.md). It is the single best
place to learn how the modules fit together before reading code.

To regenerate the file/symbol summary:

```bash
node .codegraph/scripts/build-static-graph.mjs
```

To start the interactive DeepWiki-Open wiki + RAG Q&A backed by the MiniMax M3
Token Plan, follow [`.codegraph/setup.md`](.codegraph/setup.md).

## Conventions

- TypeScript strict mode. No `any` unless unavoidable.
- All shared types go in `src/shared/`. UI-only state stays inside `App.tsx`.
- The Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`.
  Run `npm run dev` (starts both client and server via `concurrently`).
- Style is a single global `src/styles.css` — no CSS modules, no Tailwind.
- Telemetry: emit `TelemetryEvent` from the client with `version: 1` and
  one of the 20 names in `TELEMETRY_EVENT_NAMES`. The server validates the
  version and allowlist before pushing to the ring buffer.
- BGM and SFX are generated entirely with Web Audio — no binary audio
  assets. New cues go in `src/audio/Sfx.ts`.
- VFX particles are managed by `VfxManager` in `src/engine/vfx.ts`. New
  effect kinds add a `VfxKind` and a `defaultLife`/`defaultY`/`defaultSpeed`
  entry, then a subscriber in `App.tsx` listens to the engine event hook.
- `reducedMotion` is a single source of truth: it adds `.reduced-motion`
  to `<html>` (CSS) and is passed to `VfxManager` (which becomes a no-op).

## Common tasks

```bash
npm run dev          # client (:5173) + server (:3001) with watch
npm run typecheck    # tsc --noEmit for client, server, and tests configs
npm run build        # production client bundle in dist/
npm run build:server # tsc emit for the server
npm test             # vitest run (77 tests across 9 files)
npm run test:watch   # vitest --watch
npm run preview      # serve dist/ for a local smoke
bash scripts/review.sh  # full audit: typecheck + tests + build + server smoke

# Docker
npm run docker:build       # build fieldrunner:local image
npm run docker:up          # docker compose up --build (prod, port 3001)
npm run docker:down        # stop + remove the prod container
npm run docker:logs        # tail logs of the prod container
npm run docker:dev:up      # dev stack: Vite (:5173) + server (:3001) with watch
npm run docker:dev:down    # stop the dev stack

# Playwright (drives the live game in a real browser; requires `npm run dev` running)
npm run play:round-1       # headed, slowMo 250ms; opens Chromium, plays Round 1, screenshots → test-results/round-1/
```

The production image is multi-stage (Node 22). In `NODE_ENV=production`,
`server/index.ts` also serves `dist/` and falls back to `index.html` for
SPA routes, so a single container exposes the whole app on `:3001`. The
server itself runs directly from `.ts` via `tsx` (no separate tsc emit).

## Out of scope

- No CI. Tests run locally only.
- No deploy target. The repo is intended to run locally — Docker is provided
  as a packaging option, not a hosted runtime.
- No persistence on the server. Leaderboard is in-memory.
- Native iOS shell (Capacitor) is not wired — PWA + iOS install hint only.

## Out of scope

- No CI. Tests run locally only.
- No deploy target. The repo is intended to run locally.
- No persistence on the server. Leaderboard is in-memory.
- Native iOS shell (Capacitor) is not wired — PWA + iOS install hint only.
