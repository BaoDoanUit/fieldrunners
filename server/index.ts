import cors from "cors";
import express from "express";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import { gameConfig } from "../src/shared/gameConfig";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const port = Number(process.env.PORT ?? 3001);
const leaderboard: { score: number; round: number; name: string; createdAt: string }[] = [];

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tower-defense-api" });
});

app.get("/api/config", (_req, res) => {
  res.json(gameConfig);
});

app.get("/api/leaderboard", (_req, res) => {
  res.json({ entries: leaderboard.slice(0, 10) });
});

app.post("/api/leaderboard", (req, res) => {
  const { score = 0, round = 1, name = "Commander" } = req.body ?? {};
  leaderboard.push({
    score: Number(score),
    round: Number(round),
    name: String(name).slice(0, 24),
    createdAt: new Date().toISOString()
  });
  leaderboard.sort((a, b) => b.score - a.score);
  res.json({ ok: true });
});

app.post("/api/telemetry", (req, res) => {
  const event = req.body ?? {};
  io.emit("telemetry", event);
  console.log("[telemetry]", JSON.stringify(event));
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.emit("server:hello", { ok: true, time: new Date().toISOString() });
  socket.on("telemetry", (event) => {
    console.log("[socket telemetry]", JSON.stringify(event));
  });
});

server.listen(port, () => {
  console.log(`Tower Defense API listening on http://localhost:${port}`);
});
