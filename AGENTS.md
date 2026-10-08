# FieldRunner — Agent Context

> Read this before working in the repo. AI coding agents (OpenCode, Codex,
> Cursor, Aider, Gemini CLI, …) auto-load it.

## What this is

A small, single-player tower-defense game. React 18 + Three.js on the client,
Express + Socket.IO on the server. Six source files, ~3 000 LOC.

## Where things live

| Concern                    | File                              |
| -------------------------- | --------------------------------- |
| Game design / balance data | `src/shared/gameConfig.ts`        |
| Type definitions           | `src/shared/gameTypes.ts`         |
| React entry point          | `src/main.tsx`                    |
| Whole client (UI + render) | `src/ui/App.tsx`                  |
| Server (REST + Socket.IO)  | `server/index.ts`                 |
| Vite dev proxy             | `vite.config.ts`                  |

`src/shared/*` is the **source of truth** for gameplay data. The client and
the server both import from it. Never duplicate numbers — edit `gameConfig.ts`.

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
- Telemetry: emit `TelemetryEvent` from the client; the server forwards it
  to all Socket.IO clients and logs it.

## Common tasks

```bash
npm run dev          # client (:5173) + server (:3001) with watch
npm run typecheck    # tsc --noEmit for both projects
npm run build        # production client bundle in dist/
npm run build:server # tsc emit for the server
```

## Out of scope

- No tests yet. `npm run typecheck` is the only automated guard.
- No CI / no deploy target. The repo is intended to run locally.
- No persistence on the server. Leaderboard is in-memory.
