import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
import { gameConfig } from "../src/shared/gameConfig";
import { ConfigStore } from "./configStore";
import { TelemetryRingBuffer } from "./telemetryBuffer";
import { ApiError, errorHandler, notFoundHandler } from "./errorHandler";
import { TELEMETRY_EVENT_NAMES, TELEMETRY_VERSION, type TelemetryEvent, type TelemetryEventName } from "../src/shared/gameTypes";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const port = Number(process.env.PORT ?? 3001);
const configStore = new ConfigStore();
const telemetry = new TelemetryRingBuffer({ capacity: 10000, flushIntervalMs: 30_000 });

/**
 * Source of truth for the telemetry allowlist is `TELEMETRY_EVENT_NAMES`
 * in `src/shared/gameTypes.ts`. We build a Set once at boot.
 *
 * If a name is added to the shared list, the server picks it up
 * automatically — no drift between client and server.
 */
const ALLOWED_TELEMETRY: ReadonlySet<TelemetryEventName> = new Set(TELEMETRY_EVENT_NAMES);

function isTelemetryEventName(value: unknown): value is TelemetryEventName {
  return typeof value === "string" && (ALLOWED_TELEMETRY as ReadonlySet<string>).has(value);
}

// Initial config fetch (bundled or remote).
void configStore.load().catch((err) => {
  console.warn("[config] load failed; using bundled", err);
});

// Body parsers + CORS + logs.
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Rate limit only the write endpoints to avoid abuse while keeping the
// gameplay path light. Health + config + leaderboard GET are unaffected.
const writeLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use("/api/leaderboard", writeLimiter);
app.use("/api/telemetry", writeLimiter);

const leaderboard: { score: number; round: number; name: string; createdAt: string }[] = [];

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tower-defense-api", version: "0.2.0" });
});

app.get("/api/config", (_req, res) => {
  // Re-fetch in case BALANCE_CONFIG_URL was set after boot.
  res.json(configStore.current());
});

app.get("/api/balance", (_req, res) => {
  const c = configStore.current();
  // Return only the balance block so clients can do partial updates
  // without re-fetching the path/buildZones.
  res.json({ towers: c.towers, enemies: c.enemies, rounds: c.rounds });
});

app.get("/api/leaderboard", (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));
  const near = req.query.near ? Number(req.query.near) : null;
  let entries = leaderboard.slice(0, limit);
  if (near !== null && Number.isFinite(near)) {
    entries = [...leaderboard].sort((a, b) => Math.abs(a.score - near) - Math.abs(b.score - near)).slice(0, limit);
  } else {
    entries = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, limit);
  }
  res.json({ entries });
});

app.post("/api/leaderboard", (req, res) => {
  const { score = 0, round = 1, name = "Commander" } = req.body ?? {};
  const safeName = String(name).slice(0, 24);
  const safeScore = Math.max(0, Math.min(1_000_000, Math.round(Number(score))));
  const safeRound = Math.max(1, Math.min(20, Math.round(Number(round))));
  leaderboard.push({
    score: safeScore,
    round: safeRound,
    name: safeName,
    createdAt: new Date().toISOString()
  });
  // Cap the in-memory store to top 200.
  if (leaderboard.length > 200) {
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard.length = 200;
  }
  res.json({ ok: true });
});

app.post("/api/telemetry", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Partial<TelemetryEvent>;
  if (!isTelemetryEventName(body.name)) {
    throw new ApiError(400, "invalid_event", `Event name not allowed: ${String(body?.name)}`);
  }
  if (body.version !== TELEMETRY_VERSION) {
    throw new ApiError(400, "invalid_version", `Telemetry version mismatch: expected ${TELEMETRY_VERSION}, got ${String(body.version)}`);
  }
  const event: TelemetryEvent = {
    version: TELEMETRY_VERSION,
    name: body.name,
    ts: typeof body.ts === "number" ? body.ts : Date.now(),
    payload: body.payload && typeof body.payload === "object" ? body.payload : undefined
  };
  telemetry.push(event);
  io.emit("telemetry", event);
  // eslint-disable-next-line no-console
  console.log("[telemetry]", JSON.stringify(event));
  res.json({ ok: true });
});

app.get("/api/telemetry/recent", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
  res.json({ events: telemetry.recent(limit) });
});

io.on("connection", (socket) => {
  socket.emit("server:hello", { ok: true, time: new Date().toISOString() });
  socket.on("telemetry", (event: Partial<TelemetryEvent>) => {
    if (
      event &&
      isTelemetryEventName(event.name) &&
      event.version === TELEMETRY_VERSION
    ) {
      telemetry.push({
        version: TELEMETRY_VERSION,
        name: event.name,
        ts: typeof event.ts === "number" ? event.ts : Date.now(),
        payload: event.payload && typeof event.payload === "object" ? event.payload : undefined
      });
    }
  });
});

// Start the periodic flush.
telemetry.start();
process.on("SIGINT", () => {
  telemetry.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  telemetry.stop();
  process.exit(0);
});

// 404 + error handler must come last.
app.use(notFoundHandler);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
  errorHandler(err, req, res, next)
);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tower Defense API listening on http://localhost:${port}`);
});

// Suppress unused-import warning for the type re-export of GameConfig.
void gameConfig;
