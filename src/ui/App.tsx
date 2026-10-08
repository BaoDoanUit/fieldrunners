import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { gameConfig, getEnemyConfig, getTowerConfig, type EnemyKind, type TowerConfig, type TowerKind } from "../shared/gameConfig";
import type { BattlePhase, EnemyInstance, ProjectileInstance, SavedProgress, TelemetryEvent, TelemetryEventName, TowerInstance } from "../shared/gameTypes";
import { TELEMETRY_VERSION } from "../shared/gameTypes";
import * as THREE from "three";
import { Sfx } from "../audio/Sfx";
import { Haptics } from "../audio/Haptics";
import { CardstockSheet } from "./CardstockSheet";
import { HomeMenu } from "./HomeMenu";
import { MapPlate } from "./MapPlate";
import { TutorialFlow } from "./TutorialFlow";
import { RoundCompleteSheet } from "./RoundCompleteSheet";
import { PauseSheet } from "./PauseSheet";
import { SettingsScreen } from "./SettingsScreen";
import { SoldConfirmSheet } from "./SoldConfirmSheet";
import { Engine } from "../engine/Engine";
import { VfxManager } from "../engine/vfx";

const STORAGE_KEY = "fieldrunner-defense-save-v1";
const defaultSave: SavedProgress = {
  unlockedRound: 1,
  bestScore: 0,
  tutorialComplete: false,
  settings: { music: true, sfx: true, haptics: false }
};

type PlacedTower = TowerInstance & { config: TowerConfig };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance2D = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function loadSave(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSave, ...JSON.parse(raw) } : defaultSave;
  } catch {
    return defaultSave;
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function usePersistedProgress() {
  const [progress, setProgress] = useState<SavedProgress>(() => loadSave());

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  return [progress, setProgress] as const;
}

export function App() {
  const [progress, setProgress] = usePersistedProgress();
  const [phase, setPhase] = useState<BattlePhase>(progress.tutorialComplete ? "menu" : "tutorial");
  const [roundIndex, setRoundIndex] = useState(0);
  const [currency, setCurrency] = useState(gameConfig.tuning.startingCurrency);
  const [lives, setLives] = useState(gameConfig.tuning.startingLives);
  const [score, setScore] = useState(0);
  const [selectedTower, setSelectedTower] = useState<TowerConfig | null>(null);
  const [inspectTower, setInspectTower] = useState<PlacedTower | null>(null);
  // Cursor world position; null when the pointer is not over the stage.
  // Drives the in-canvas range ring for the currently selected tower.
  const [cursorWorld, setCursorWorld] = useState<{ x: number; z: number } | null>(null);
  const [message, setMessage] = useState("Tap Play to begin Round 1.");
  const [towerCount, setTowerCount] = useState(0);
  const [activeRound, setActiveRound] = useState(1);
  const [debugMode, setDebugMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ score: number; round: number; name: string }[]>([]);
  const [configReady, setConfigReady] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [roundSummary, setRoundSummary] = useState<{ defeated: number; escaped: number; earned: number; score: number } | null>(null);
  // Phase 3.5: confirmed sell — when set, the SoldConfirmSheet is shown.
  const [soldConfirm, setSoldConfirm] = useState<{ id: string; name: string; refund: number } | null>(null);
  // Phase 3.10: reduced motion preference (overrides system default).
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  });

  // Mirror the in-app reduced-motion setting onto a <html> class so
  // CSS animations (sheet-rise, overlay-fade, loading-blink, etc.)
  // are skipped. The class-based media query in styles.css is what
  // most rules already opt into via @media (prefers-reduced-motion).
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) root.classList.add("reduced-motion");
    else root.classList.remove("reduced-motion");
    vfxRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Subscribe to OS-level reduced-motion changes. The SettingsScreen
  // toggle overrides the OS preference, but when the user hasn't
  // explicitly toggled, we follow the OS live.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  // Phase 3.1: world events the TutorialFlow listens for.
  const [worldEventCount, setWorldEventCount] = useState<{ placement: number; wave_started: number }>({ placement: 0, wave_started: 0 });

  const socketRef = useRef<Socket | null>(null);
  // Phase 2.6 bug fix: the canvas is only mounted when phase is
  // "building" / "combat" (HomeMenu / PauseSheet / etc. take over the
  // screen otherwise). A plain useRef would be null on first mount
  // and the Three.js init effect would no-op forever. A callback ref
  // (via useState) gives us a re-render trigger when the canvas
  // actually appears, so the effect can re-run and pick it up.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const engineRef = useRef(new Engine("fieldrunner-default"));

  // Phase 2.1: wire the engine's event hook to SFX so each fire / kill /
  // leak plays the right cue without changing gameplay logic.
  useEffect(() => {
    const engine = engineRef.current;
    return engine.on((e) => {
      switch (e.type) {
        case "fire":    Sfx.play(`fire-${e.towerKind}`); break;
        case "kill":    Sfx.play("enemy-killed"); break;
        case "leak":    /* subtle — no cue in MVP */ break;
        case "roundClear": Sfx.play("round-cleared"); break;
        case "victory": Sfx.play("victory"); break;
        case "defeat":  Sfx.play("defeat"); break;
      }
    });
  }, []);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    map: THREE.Group;
    towerGroup: THREE.Group;
    enemyGroup: THREE.Group;
    projectileGroup: THREE.Group;
    rangeGroup: THREE.Group;
    buildMarkerGroup: THREE.Group;
    vfxGroup: THREE.Group;
  } | null>(null);
  const vfxRef = useRef<VfxManager | null>(null);
  // Phase 2.4: tracks the engine event subscription so beginRun can
  // rebind VFX to a fresh engine.
  const engineVfxOffRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);

  const currentRound = gameConfig.rounds[roundIndex];
  const unlockedRound = progress.unlockedRound;
  const readyToStart = phase === "building" && !paused;

  const towerOptions = useMemo(() => gameConfig.towers, []);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then(() => {
        setServerOnline(true);
        // Emit the canonical "app open" tracking event once the
        // config is loaded. server_connected is shown in the
        // local UI but is NOT in the tracking plan.
        pushTelemetry("app_open", { source: "boot" });
      })
      .catch(() => setServerOnline(false))
      .finally(() => setConfigReady(true));

    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => setLeaderboard(data.entries ?? []))
      .catch(() => undefined);

    const socket = io("/", { path: "/socket.io" });
    socketRef.current = socket;
    socket.on("connect", () => setServerOnline(true));
    socket.on("disconnect", () => setServerOnline(false));
    socket.on("server:hello", () => {
      // Local-only signal — not part of the 20-event tracking plan.
      setTelemetryLog((logs) => ["socket_connected", ...logs].slice(0, 6));
    });
    socket.on("telemetry", (event) => console.log("telemetry", event));

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === "combat") setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Phase 2.6 (BGM): the looping background pad. Driven by
  // settings.music + phase. Stops in settings / victory / defeat
  // so the SFX cues and the round-complete sheet read clean.
  useEffect(() => {
    if (!progress.settings.music) {
      Sfx.stopBgm();
      return;
    }
    const quiet = new Set<BattlePhase>(["settings", "victory", "defeat"]);
    if (quiet.has(phase)) {
      Sfx.stopBgm();
      return;
    }
    Sfx.unlock();
    Sfx.startBgm();
    return () => {
      Sfx.stopBgm();
    };
  }, [progress.settings.music, phase]);

  useEffect(() => {
    if (!canvasEl) return;
    const canvas = canvasEl;
    // Phase 2.6: no `alpha: true`. With alpha enabled the WebGL
    // framebuffer stays at alpha=0 until the scene actively paints;
    // if the animate loop is throttled (e.g. tab not focused) the
    // CSS background bleeds through. Opaque canvas + explicit clear
    // color = the playfield is always filled, even between frames.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Guard: if the layout hasn't settled yet, defer sizing the
    // renderer until the next frame. Without this, an early mount
    // can produce a 0×0 or inflated buffer and the scene paints
    // nothing.
    const initialW = canvas.clientWidth;
    const initialH = canvas.clientHeight;
    renderer.setSize(initialW || 1, initialH || 1, false);
    renderer.setClearColor("#08101d", 1.0);
    // Phase 2.5: enable shadow maps. Soft PCF, tuned tight to the playfield.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08101d");
    scene.fog = new THREE.Fog("#08101d", 18, 38);

    const camera = new THREE.PerspectiveCamera(40, (initialW || 1) / (initialH || 1), 0.1, 100);
    camera.position.set(0, 17, 16);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    const directional = new THREE.DirectionalLight(0xfff1d8, 1.6);
    directional.position.set(7, 14, 10);
    // Phase 2.5: directional light casts shadows over a 24×24 area
    // that covers the playfield.
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.near = 1;
    directional.shadow.camera.far = 40;
    directional.shadow.camera.left = -12;
    directional.shadow.camera.right = 12;
    directional.shadow.camera.top = 12;
    directional.shadow.camera.bottom = -12;
    directional.shadow.bias = -0.0005;
    directional.shadow.normalBias = 0.02;
    scene.add(ambient, directional);

    const map = new THREE.Group();
    const towerGroup = new THREE.Group();
    const enemyGroup = new THREE.Group();
    const projectileGroup = new THREE.Group();
    const rangeGroup = new THREE.Group();
    const buildMarkerGroup = new THREE.Group();
    // Phase 2.4: VFX group, owned by the VfxManager.
    const vfxManager = new VfxManager(reducedMotion);
    const vfxGroup = vfxManager.sceneGroup();
    vfxRef.current = vfxManager;
    scene.add(map, towerGroup, enemyGroup, projectileGroup, rangeGroup, buildMarkerGroup, vfxGroup);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 20),
      new THREE.MeshStandardMaterial({ color: "#102036", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    // Phase 2.5: ground receives tower shadows.
    ground.receiveShadow = true;
    map.add(ground);

    const pathMaterial = new THREE.MeshStandardMaterial({ color: "#2d415f", roughness: 1 });
    const pathPoints = gameConfig.path.map((point) => new THREE.Vector3(point.x, 0.02, point.z));
    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const length = a.distanceTo(b);
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.05, length + 0.2),
        pathMaterial
      );
      segment.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
      segment.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      map.add(segment);
    }

    gameConfig.buildZones.forEach((zone) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.05, 6),
        new THREE.MeshStandardMaterial({ color: "#14324c", transparent: true, opacity: 0.85 })
      );
      pad.position.set(zone.x, 0.04, zone.z);
      buildMarkerGroup.add(pad);
    });

    sceneRef.current = { renderer, scene, camera, map, towerGroup, enemyGroup, projectileGroup, rangeGroup, buildMarkerGroup, vfxGroup };

    // Phase 2.4: subscribe to engine events for VFX. We only do this
    // once per engine instance; the VFX manager decides whether to
    // actually emit (it is a no-op when reducedMotion is set).
    const engineVfxOff = engineRef.current.on((ev) => {
      const cfg = getTowerConfig;
      if (ev.type === "fire") {
        const tc = cfg(ev.towerKind as Parameters<typeof cfg>[0]);
        vfxManager.spawn("trail", ev.x, ev.z, tc.color);
        vfxManager.spawn("trail", ev.x, ev.z, tc.color, { life: 0.18 });
      } else if (ev.type === "kill") {
        const ec = getEnemyConfig(ev.enemyKind);
        vfxManager.spawnBurst("death", ev.x, ev.z, ec.color, 12, { speed: 2.4, life: 0.85 });
      }
    });
    engineVfxOffRef.current = engineVfxOff;

    const resize = () => {
      if (!canvas.parentElement) return;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      // Skip zero-size frames (layout not yet settled). The
      // ResizeObserver will call us again on the next layout change.
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement!);
    // Defer the first resize to the next frame so the responsive
    // grid has actually settled to its final size before we sample
    // the canvas's clientWidth/clientHeight.
    requestAnimationFrame(resize);

    // Phase 2.5: camera parallax target follows the cursor with a
    // gentle lerp. Reduced motion short-circuits the offset to 0.
    const baseCamPos = camera.position.clone();
    const baseTarget = new THREE.Vector3(0, 0, 0);
    const lerpedTarget = new THREE.Vector3(0, 0, 0);

    // Phase 2.6: extract the per-frame work so it can be called
    // from either requestAnimationFrame (when the tab is visible)
    // or a setInterval fallback (when rAF is throttled because the
    // tab is hidden). The fallback keeps the engine ticking so
    // observation tests don't stall when the browser window is
    // behind another window.
    const tick = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = now;
      if (!pausedRef.current) {
        stepEngine(dt);
        vfxManager.tick(dt);
      } else {
        // Even while paused, drain any leftover VFX so they don't
        // freeze on screen forever.
        vfxManager.tick(dt * 0.5);
      }

      // Phase 2.5: subtle camera parallax toward the cursor (or
      // the selected tower, if any). Skipped when reducedMotion
      // is on so a player who opted out sees a static camera.
      if (!reducedMotion && cursorWorld) {
        const targetX = clamp(cursorWorld.x * 0.05, -0.7, 0.7);
        const targetZ = clamp(cursorWorld.z * 0.05, -0.7, 0.7);
        lerpedTarget.x += (targetX - lerpedTarget.x) * Math.min(1, dt * 4);
        lerpedTarget.z += (targetZ - lerpedTarget.z) * Math.min(1, dt * 4);
        camera.position.set(baseCamPos.x + lerpedTarget.x, baseCamPos.y, baseCamPos.z + lerpedTarget.z);
        camera.lookAt(baseTarget.x + lerpedTarget.x * 0.5, baseTarget.y, baseTarget.z + lerpedTarget.z * 0.5);
      } else if (!reducedMotion) {
        // Decay back to center when the cursor leaves the canvas.
        lerpedTarget.x *= Math.max(0, 1 - dt * 3);
        lerpedTarget.z *= Math.max(0, 1 - dt * 3);
        camera.position.set(baseCamPos.x + lerpedTarget.x, baseCamPos.y, baseCamPos.z + lerpedTarget.z);
        camera.lookAt(baseTarget.x + lerpedTarget.x * 0.5, baseTarget.y, baseTarget.z + lerpedTarget.z * 0.5);
      } else {
        camera.position.copy(baseCamPos);
        camera.lookAt(baseTarget);
      }

      syncScene();
      vfxManager.render();
      renderer.render(scene, camera);
    };

    // Phase 2.6: hybrid rAF + setInterval safety net.
    //
    // requestAnimationFrame is throttled (often to 1 Hz) when the
    // browser tab isn't the user's active focus — which can happen
    // during Playwright observation runs and during normal
    // window-switching. We track when rAF last fired; a 100 ms
    // setInterval checks that timestamp and ticks the simulation
    // only if rAF hasn't fired recently. This means:
    //   - rAF drives the loop at full rate when the tab is focused
    //   - setInterval takes over at 10 fps when rAF is throttled
    //   - the two never double-tick (the guard skips setInterval
    //     whenever rAF is keeping up)
    let lastRafTime = 0;
    const animate = (now: number) => {
      lastRafTime = now;
      animationRef.current = requestAnimationFrame(animate);
      tick(now);
    };
    animationRef.current = requestAnimationFrame(animate);

    const safetyIntervalId = setInterval(() => {
      const now = performance.now();
      if (now - lastRafTime < 80) return;
      tick(now);
    }, 100);

    return () => {
      engineVfxOff();
      engineVfxOffRef.current = null;
      vfxManager.clear();
      vfxRef.current = null;
      resizeObserver.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearInterval(safetyIntervalId);
      renderer.dispose();
    };
  }, [canvasEl, reducedMotion]);

  useEffect(() => {
    if (phase === "building") {
      setMessage(`Round ${activeRound} ready. Place towers or start the wave.`);
    }
  }, [activeRound, phase]);

  function pushTelemetry(name: TelemetryEventName, payload: Record<string, unknown> = {}) {
    const event: TelemetryEvent = { version: TELEMETRY_VERSION, name, ts: Date.now(), payload };
    setTelemetryLog((logs) => [`${name}`, ...logs].slice(0, 6));
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    }).catch(() => undefined);
    socketRef.current?.emit("telemetry", event);
  }

  function beginRun(startRound = progress.unlockedRound) {
    // Phase 2.4: detach VFX listener from the old engine before
    // replacing it, then rebind to the fresh one.
    engineVfxOffRef.current?.();
    engineVfxOffRef.current = null;
    vfxRef.current?.clear();
    const fresh = new Engine("fieldrunner-default");
    engineRef.current = fresh;
    if (vfxRef.current) {
      engineVfxOffRef.current = fresh.on((ev) => {
        if (ev.type === "fire") {
          const tc = getTowerConfig(ev.towerKind);
          vfxRef.current?.spawn("trail", ev.x, ev.z, tc.color);
          vfxRef.current?.spawn("trail", ev.x, ev.z, tc.color, { life: 0.18 });
        } else if (ev.type === "kill") {
          const ec = getEnemyConfig(ev.enemyKind);
          vfxRef.current?.spawnBurst("death", ev.x, ev.z, ec.color, 12, { speed: 2.4, life: 0.85 });
        }
      });
    }
    setRoundIndex(startRound - 1);
    setActiveRound(startRound);
    setCurrency(gameConfig.tuning.startingCurrency);
    setLives(gameConfig.tuning.startingLives);
    setScore(0);
    setSelectedTower(null);
    setInspectTower(null);
    setTowerCount(0);
    setRoundSummary(null);
    setPhase("building");
    setPaused(false);
    setMessage(`Survive all 20 rounds. Current run starts at Round ${startRound}.`);
    pushTelemetry("run_started", { round: startRound });
  }

  function nextRound() {
    if (roundIndex + 1 >= gameConfig.rounds.length) {
      handleVictory();
      return;
    }
    const nextIndex = roundIndex + 1;
    setRoundIndex(nextIndex);
    setActiveRound(nextIndex + 1);
    setPhase("building");
    const nextRoundCfg = gameConfig.rounds[nextIndex];
    setMessage(
      `Prepare for Round ${nextIndex + 1}. ${nextRoundCfg.briefing}`
    );
    pushTelemetry("round_completed", { round: activeRound });
    // Bump unlockedRound so the player can start the run from this
    // new round. Emit round_unlocked only when it actually advances.
    setProgress((prev) => {
      const nextUnlocked = Math.max(prev.unlockedRound, nextIndex + 1);
      if (nextUnlocked > prev.unlockedRound) {
        pushTelemetry("round_unlocked", { round: nextUnlocked });
      }
      return { ...prev, unlockedRound: nextUnlocked };
    });
  }

  function handleVictory() {
    setPhase("victory");
    setMessage("Round 20 cleared. Victory!");
    setProgress((prev) => {
      const nextUnlocked = Math.max(prev.unlockedRound, 20);
      if (nextUnlocked > prev.unlockedRound) {
        pushTelemetry("round_unlocked", { round: nextUnlocked });
      }
      return {
        ...prev,
        unlockedRound: nextUnlocked,
        bestScore: Math.max(prev.bestScore, score)
      };
    });
    pushTelemetry("run_won", { finalScore: score });
  }

  function handleDefeat() {
    setPhase("defeat");
    setPaused(false);
    setMessage("The defense fell. Retry quickly from the current state.");
    setProgress((prev) => ({ ...prev, bestScore: Math.max(prev.bestScore, score) }));
    pushTelemetry("round_failed", { round: activeRound, score });
  }

  function completeTutorial() {
    setProgress((prev) => ({ ...prev, tutorialComplete: true }));
    setPhase("menu");
    setMessage("Tutorial complete. Tap Play to begin.");
  }

  function startTutorial() {
    setPhase("tutorial");
    setMessage("Tutorial: tap a tower card, then tap a green build zone.");
    pushTelemetry("tutorial_started");
  }

  function skipTutorial() {
    completeTutorial();
    pushTelemetry("tutorial_completed");
  }

  function attemptPlacement(zoneX: number, zoneZ: number) {
    if (!selectedTower || phase !== "building" || paused) return;
    if (currency < selectedTower.cost) {
      setMessage("Not enough currency for that tower.");
      return;
    }
    if (engineRef.current.hasTowerNear(zoneX, zoneZ)) {
      setMessage("That build zone is occupied.");
      return;
    }
    const placed = engineRef.current.placeTower(selectedTower.kind, zoneX, zoneZ);
    if (placed) {
      setCurrency((value) => value - selectedTower.cost);
      setTowerCount((value) => value + 1);
      setSelectedTower(null);
      setMessage(`${selectedTower.name} placed. Tap Start Wave when ready.`);
      pushTelemetry("tower_placed", { kind: selectedTower.kind });
      Sfx.play("place-tower");
      if (progress.settings.haptics) navigator.vibrate?.(10);
      setWorldEventCount((c) => ({ ...c, placement: c.placement + 1 }));
    }
  }

  function startWave() {
    if (phase !== "building") return;
    engineRef.current.startRound(gameConfig.rounds[roundIndex]);
    setPhase("combat");
    setMessage(`Round ${activeRound} is underway.`);
    pushTelemetry("round_started", { round: activeRound });
    setWorldEventCount((c) => ({ ...c, wave_started: c.wave_started + 1 }));
  }

  function togglePause() {
    setPaused((value) => {
      const next = !value;
      pushTelemetry(next ? "player_paused" : "player_resumed");
      return next;
    });
  }

  function upgradeTower(towerId: string) {
    const result = engineRef.current.upgradeTower(towerId);
    if (!result.ok) return setMessage(result.reason ?? "Cannot upgrade.");
    setCurrency((value) => value - (result.cost ?? 0));
    setInspectTower(engineRef.current.getTower(towerId));
    setMessage("Tower upgraded.");
    pushTelemetry("tower_upgraded", { towerId });
    Sfx.play("ink-press");
    // Phase 2.4: a quick radial spark ring on the upgraded tower.
    const t = engineRef.current.getTower(towerId);
    if (t && vfxRef.current) {
      const towerConfig = getTowerConfig(t.kind);
      vfxRef.current.spawn("upgrade", t.x, t.z, towerConfig.color, { ringRadius: 1.6 });
    }
  }

  function sellTower(towerId: string) {
    const result = engineRef.current.sellTower(towerId);
    if (!result.ok) return;
    setCurrency((value) => value + result.value);
    setTowerCount((value) => Math.max(0, value - 1));
    setInspectTower(null);
    setMessage("Tower sold.");
    pushTelemetry("tower_sold", { towerId });
    setSoldConfirm(null);
    Sfx.play("ink-press");
  }

  function requestSell(towerId: string) {
    const t = engineRef.current.getTower(towerId);
    if (!t) return;
    const invested = t.config.cost + t.config.upgrades.slice(0, t.level - 1).reduce((s, u) => s + u.cost, 0);
    const refund = Math.round(invested * t.config.sellMultiplier);
    setSoldConfirm({ id: towerId, name: t.config.name, refund });
  }

  function spawnDebugEnemy(kind: EnemyKind) {
    engineRef.current.spawnDebugEnemy(kind);
    setMessage(`Spawned ${kind}.`);
  }

  function stepEngine(dt: number) {
    const eng = engineRef.current;
    eng.tick(dt);
    const currencyDelta = eng.currencyDelta();
    const scoreDelta = eng.scoreDelta();
    const livesDelta = eng.livesDelta();
    if (currencyDelta) setCurrency((value) => value + currencyDelta);
    if (scoreDelta) setScore((value) => value + scoreDelta);
    if (livesDelta) setLives((value) => value + livesDelta);
    if (eng.enemyKilled()) pushTelemetry("enemy_killed", { kind: eng.enemyKilled()! });
    if (eng.enemyEscaped()) pushTelemetry("enemy_escaped", { kind: eng.enemyEscaped()! });
    const roundComplete = eng.roundComplete();
    if (roundComplete) {
      setRoundSummary(roundComplete);
      setProgress((prev) => ({
        ...prev,
        unlockedRound: Math.max(prev.unlockedRound, activeRound + 1),
        bestScore: Math.max(prev.bestScore, score + roundComplete.score)
      }));
      if (activeRound >= 20) {
        handleVictory();
      } else {
        setPhase("building");
        setMessage(`Round ${activeRound} cleared. Buy more defense or start the next wave.`);
        const clearedRound = gameConfig.rounds[roundIndex];
        setCurrency((value) => value + clearedRound.reward);
        // livesBonus is a hand-tuned milestone reward (round 10 +2, round 20 +3).
        if (clearedRound.livesBonus) {
          setLives((value) => Math.min(gameConfig.tuning.maxLives, value + clearedRound.livesBonus!));
        }
        nextRound();
        Sfx.play("round-cleared");
      }
    }
    if (lives + livesDelta <= 0) handleDefeat();
  }

  function syncScene() {
    const scene = sceneRef.current;
    if (!scene) return;

    // Phase 2.6 UX: when a tower is selected, find the nearest build
    // zone to the cursor so we can highlight it as "where the click
    // will land". This gives instant feedback even before the user
    // commits to a placement.
    let nearestZoneIndex: number | null = null;
    if (selectedTower && cursorWorld) {
      let minDist = Number.POSITIVE_INFINITY;
      gameConfig.buildZones.forEach((zone, index) => {
        const d = distance2D(cursorWorld.x, cursorWorld.z, zone.x, zone.z);
        if (d < minDist) {
          minDist = d;
          nearestZoneIndex = index;
        }
      });
    }

    scene.buildMarkerGroup.children.forEach((child, index) => {
      const zone = gameConfig.buildZones[index];
      const occupied = engineRef.current.hasTowerNear(zone.x, zone.z);
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (selectedTower) {
        const isNearest = nearestZoneIndex === index;
        if (occupied) {
          // Hard "no" — zone is taken.
          material.color.set("#ef4444");
          material.opacity = 0.4;
        } else if (isNearest) {
          // Hover target — the click will land here.
          material.color.set("#7dd3fc");
          material.opacity = 0.95;
        } else {
          // Available but not the hover target.
          material.color.set("#22c55e");
          material.opacity = 0.55;
        }
      } else {
        // Resting state — make zones clearly visible so the player
        // can see the buildable area at a glance.
        material.color.set("#2c5d8a");
        material.opacity = 0.7;
      }
    });

    while (scene.towerGroup.children.length) scene.towerGroup.remove(scene.towerGroup.children[0]);
    while (scene.enemyGroup.children.length) scene.enemyGroup.remove(scene.enemyGroup.children[0]);
    while (scene.projectileGroup.children.length) scene.projectileGroup.remove(scene.projectileGroup.children[0]);
    while (scene.rangeGroup.children.length) scene.rangeGroup.remove(scene.rangeGroup.children[0]);

    // Pull rim colours from the design system so the 3D scene stays in sync with CSS.
    const css = getComputedStyle(document.documentElement);
    const cInk       = css.getPropertyValue("--ink").trim()       || "#14202e";
    const cTopo2     = css.getPropertyValue("--topo-2").trim()     || "#14223a";
    const cTopo      = css.getPropertyValue("--topo").trim()      || "#0e1b2c";
    const cFlare     = css.getPropertyValue("--flare").trim()     || "#e15a1c";
    const cFlare2    = css.getPropertyValue("--flare-2").trim()    || "#f4a13a";
    const cVerdigris = css.getPropertyValue("--verdigris").trim() || "#2c7a6a";
    // Phase 2.3: tower level visual states
    const TOWER_BODY: Record<1 | 2 | 3, string> = { 1: cInk, 2: cTopo2, 3: cTopo };
    const TOWER_RIM:  Record<1 | 2 | 3, string> = { 1: cFlare2, 2: cFlare, 3: cVerdigris };

    engineRef.current.towers.forEach((tower) => {
      const towerConfig = getTowerConfig(tower.kind);
      const level = (tower.level as 1 | 2 | 3);
      // Phase 2.6 UX: each tower now wears its own type color as an
      // emissive glow (cannon=orange, rapid=green, splash=blue,
      // slow=purple) and gets a flat colored ring on the ground under
      // it, so a freshly placed tower is impossible to miss on the
      // dark navy playfield.
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.55, 1.1 + (level - 1) * 0.05, 8),
        new THREE.MeshStandardMaterial({
          color: TOWER_BODY[level],
          emissive: towerConfig.color,
          emissiveIntensity: 0.55
        })
      );
      mesh.position.set(tower.x, 0.55, tower.z);
      // Phase 2.5: towers cast shadows.
      mesh.castShadow = true;
      scene.towerGroup.add(mesh);

      // Bright base ring lying flat on the ground — a per-tower
      // "stand" that makes placement obvious from any camera angle.
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.88, 24),
        new THREE.MeshBasicMaterial({
          color: towerConfig.color,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        })
      );
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.position.set(tower.x, 0.045, tower.z);
      scene.towerGroup.add(baseRing);

      if (inspectTower?.id === tower.id) {
        const range = towerConfig.upgrades[level - 1].range;
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(range, range, 0.02, 32, 1, true),
          new THREE.MeshBasicMaterial({ color: cInk, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
        );
        ring.position.set(tower.x, 0.05, tower.z);
        scene.rangeGroup.add(ring);
      }
    });

    // Phase 2.2: range ring for the currently selected tower, following the cursor.
    if (selectedTower && cursorWorld && phase === "building") {
      const range = selectedTower.upgrades[0].range;
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(range, range, 0.02, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: cFlare, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      ring.position.set(cursorWorld.x, 0.04, cursorWorld.z);
      scene.rangeGroup.add(ring);
    }

    engineRef.current.enemies.forEach((enemy) => {
      const enemyConfig = getEnemyConfig(enemy.kind);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(enemy.radius, 12, 12),
        new THREE.MeshStandardMaterial({ color: enemyConfig.color, roughness: 0.5 })
      );
      mesh.position.set(enemy.x, 0.38, enemy.z);
      scene.enemyGroup.add(mesh);

      const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);
      // Phase 2.6 UX: HP bar color tracks the percentage so you can
      // tell at a glance which enemies are about to die.
      //   > 60% → green  (healthy)
      //   > 30% → yellow (wounded)
      //   ≤ 30% → red    (near death)
      const fillColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#eab308" : "#ef4444";
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: "#334155" })
      );
      bar.position.set(enemy.x, 1.0, enemy.z);
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 * hpPct, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: fillColor })
      );
      fill.position.set(enemy.x - (0.7 * (1 - hpPct)) / 2, 1.0, enemy.z);
      scene.enemyGroup.add(bar, fill);
    });

    engineRef.current.projectiles.forEach((projectile) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshStandardMaterial({ color: projectile.color, emissive: projectile.color, emissiveIntensity: 0.8 })
      );
      mesh.position.set(projectile.x, 0.7, projectile.z);
      scene.projectileGroup.add(mesh);
    });
  }

  const boardMessage = phase === "tutorial" ? "Tutorial active: learn placement, upgrades, and wave flow." : message;

  // Home menu takes over the full screen — hide the rest of the chrome
  // so the manual metaphor is uninterrupted.
  if (phase === "menu") {
    return (
      <HomeMenu
        bestScore={progress.bestScore}
        unlockedRound={progress.unlockedRound}
        tutorialComplete={progress.tutorialComplete}
        onBegin={() => beginRun(1)}
        onContinue={() => beginRun(progress.unlockedRound)}
        onHowToPlay={startTutorial}
        onSettings={() => setPhase("settings")}
      />
    );
  }

  // Settings screen (Phase 3.4)
  if (phase === "settings") {
    return (
      <SettingsScreen
        progress={progress}
        reducedMotion={reducedMotion}
        onChange={(next) => {
          // Compute the keys that actually changed (settings block only).
          const changed = Object.keys(next.settings ?? {});
          setProgress((prev) => ({ ...prev, ...next }));
          if (changed.length > 0) {
            pushTelemetry("settings_changed", { keys: changed });
          }
        }}
        onReducedMotionChange={(next) => {
          setReducedMotion(next);
          pushTelemetry("settings_changed", { keys: ["reducedMotion"], value: next });
        }}
        onResetProgress={() => {
          const fresh = { ...defaultSave };
          setProgress(fresh);
          setRoundIndex(0);
          setActiveRound(1);
          setLives(gameConfig.tuning.startingLives);
          setCurrency(gameConfig.tuning.startingCurrency);
          setScore(0);
          setTowerCount(0);
          setInspectTower(null);
          setSoldConfirm(null);
          setPhase("tutorial");
          Sfx.mute(false);
          Haptics.setEnabled(false);
        }}
        onClose={() => setPhase("menu")}
      />
    );
  }

  // Pause overlay (Phase 3.3)
  if (paused && (phase === "building" || phase === "combat")) {
    return (
      <PauseSheet
        onResume={() => setPaused(false)}
        onRestart={() => beginRun(activeRound)}
        onHome={() => setPhase("menu")}
      />
    );
  }

  // Round-complete sheet (Phase 3.2) — only show after the build->combat
  // round transition has settled, and the engine has handed us a
  // roundComplete payload.
  if (phase === "building" && roundSummary && !paused) {
    return (
      <RoundCompleteSheet
        round={roundSummary.earned ? activeRound : activeRound}
        defeated={roundSummary.defeated}
        escaped={roundSummary.escaped}
        earned={roundSummary.earned}
        score={roundSummary.score}
        isFinal={activeRound >= 20}
        onNext={() => {
          setRoundSummary(null);
          if (activeRound >= 20) beginRun(1);
        }}
        onReview={() => setRoundSummary(null)}
      />
    );
  }

  // Sold-tower confirmation (Phase 3.5)
  if (soldConfirm) {
    return (
      <SoldConfirmSheet
        towerName={soldConfirm.name}
        refund={soldConfirm.refund}
        onConfirm={() => sellTower(soldConfirm.id)}
        onCancel={() => setSoldConfirm(null)}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">FieldRunner Defense</div>
          <h1>Protect the path through 20 handcrafted rounds</h1>
        </div>
        <div className={`status-pill ${serverOnline ? "online" : "offline"}`}>{serverOnline ? "Server online" : "Offline fallback"}</div>
      </header>

      <main className="layout">
        <section className="stage-card">
          <div className="stage-frame">
            <canvas
              ref={setCanvasEl}
              className="stage-canvas"
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;
                const z = (event.clientY - rect.top) / rect.height;
                const worldX = clamp((x - 0.5) * 18, -9, 9);
                const worldZ = clamp((0.5 - z) * 16, -8, 8);
                setCursorWorld({ x: worldX, z: worldZ });
              }}
              onPointerLeave={() => setCursorWorld(null)}
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;
                const z = (event.clientY - rect.top) / rect.height;
                const worldX = clamp((x - 0.5) * 18, -9, 9);
                const worldZ = clamp((0.5 - z) * 16, -8, 8);
                const nearest = gameConfig.buildZones.reduce((best, zone) => {
                  const distance = distance2D(worldX, worldZ, zone.x, zone.z);
                  return distance < best.distance ? { zone, distance } : best;
                }, { zone: null as (typeof gameConfig.buildZones)[number] | null, distance: Number.POSITIVE_INFINITY });

                if (nearest.zone && nearest.distance < 1.4) {
                  attemptPlacement(nearest.zone.x, nearest.zone.z);
                  return;
                }

                const clickedTower = engineRef.current.findTowerAt(worldX, worldZ);
                if (clickedTower) {
                  setInspectTower(clickedTower);
                  setMessage(`${getTowerConfig(clickedTower.kind).name} selected.`);
                }
              }}
            />
            <div className="hud-overlay">
              <div className="hud-row">
                <span>Round {activeRound}/20</span>
                <span>Lives {lives}</span>
                <span>Score {score}</span>
                <span>Cash {currency}</span>
              </div>
              <div className="hud-message">{boardMessage}</div>
              <div className="hud-subrow">
                <span>{towerCount} towers built</span>
                <span>Unlocked round {unlockedRound}</span>
                <span>{currentRound ? `${currentRound.spawns.length} wave groups` : "Ready"}</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <section className="panel-block">
            <div className="panel-title">Actions</div>
            <div className="button-grid">
              <button onClick={() => beginRun(1)}>Play</button>
              <button onClick={() => beginRun(progress.unlockedRound)}>Continue</button>
              <button onClick={() => setPhase("menu")}>Home</button>
              <button onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
            </div>
            <div className="button-grid compact">
              <button onClick={startTutorial}>Tutorial</button>
              <button onClick={skipTutorial}>Skip Tutorial</button>
              <button onClick={() => setDebugMode((value) => !value)}>Debug {debugMode ? "On" : "Off"}</button>
            </div>
          </section>

          <section className="panel-block">
            <div className="panel-title">Towers</div>
            <div className="tower-list">
              {towerOptions.map((tower) => {
                const active = selectedTower?.kind === tower.kind;
                return (
                  <button
                    key={tower.kind}
                    className={`tower-card ${active ? "active" : ""}`}
                    onClick={() => {
                      setSelectedTower(tower);
                      setMessage(`${tower.name}: ${tower.description}`);
                      pushTelemetry("tower_selected", { kind: tower.kind });
                    }}
                  >
                    <span className="glyph" aria-hidden>
                      <TowerSilhouette kind={tower.kind} />
                    </span>
                    <span className="name">{tower.name}</span>
                    <span className="meta">
                      <span className="cost">¤{tower.cost}</span>
                      <span>↻ {Math.round(tower.cost * tower.sellMultiplier)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-block">
            <div className="panel-title">Selected</div>
            {selectedTower ? (
              <div className="detail-card">
                <strong>{selectedTower.name}</strong>
                <p>{selectedTower.description}</p>
                <p>Tap a green build zone on the battlefield to place it.</p>
              </div>
            ) : (
              <div className="detail-card muted">Pick a tower card to preview its placement range and stats.</div>
            )}
          </section>

          <section className="panel-block">
            <div className="panel-title">Inspector</div>
            {inspectTower ? (
              <div className="detail-card">
                <strong>{getTowerConfig(inspectTower.kind).name} Lv {inspectTower.level}</strong>
                <p>Damage {getTowerConfig(inspectTower.kind).upgrades[inspectTower.level - 1].damage}</p>
                <p>Range {getTowerConfig(inspectTower.kind).upgrades[inspectTower.level - 1].range}</p>
                <p>Fire rate {getTowerConfig(inspectTower.kind).upgrades[inspectTower.level - 1].fireRate.toFixed(2)}</p>
                <div className="button-grid compact">
                  <button disabled={inspectTower.level >= 3 || currency < (getTowerConfig(inspectTower.kind).upgrades[inspectTower.level] ?? { cost: 9999 }).cost} onClick={() => upgradeTower(inspectTower.id)}>
                    Upgrade
                  </button>
                  <button onClick={() => requestSell(inspectTower.id)}>Sell</button>
                  <button onClick={() => setInspectTower(null)}>Close</button>
                </div>
              </div>
            ) : (
              <div className="detail-card muted">Tap an owned tower to inspect upgrade and sell options.</div>
            )}
          </section>

          <section className="panel-block">
            <div className="panel-title">Round Control</div>
            <div className="button-grid">
              <button disabled={!readyToStart} onClick={startWave}>Start Wave</button>
              <button onClick={() => setCurrency((value) => value + 250)}>Add Cash</button>
              <button onClick={() => spawnDebugEnemy("basic")}>Spawn Basic</button>
              <button onClick={() => spawnDebugEnemy("boss")}>Spawn Boss</button>
            </div>
            <p className="helper">Debug controls are intended for tuning balance and checking edge cases quickly.</p>
          </section>

          <section className="panel-block">
            <div className="panel-title">Telemetry</div>
            <div className="telemetry-list">
              {telemetryLog.length === 0 ? <div className="helper">Telemetry events will appear here during play.</div> : telemetryLog.map((event, index) => <div key={`${event}-${index}`}>{event}</div>)}
            </div>
          </section>

          <section className="panel-block">
            <div className="panel-title">Leaderboard Preview</div>
            <div className="telemetry-list">
              {leaderboard.length === 0 ? <div className="helper">No leaderboard entries yet.</div> : leaderboard.map((entry, index) => (
                <div key={`${entry.score}-${index}`}>
                  {entry.name} - {entry.score} pts - Round {entry.round}
                </div>
              ))}
            </div>
          </section>

          <section className="panel-block">
            <div className="panel-title">Progress</div>
            <div className="detail-card">
              <p>Best score: {progress.bestScore}</p>
              <p>Tutorial complete: {progress.tutorialComplete ? "Yes" : "No"}</p>
              <p>Config loaded: {configReady ? "Yes" : "Loading..."}</p>
            </div>
          </section>
        </aside>
      </main>

      {phase === "victory" && <Overlay stamp="Order 20 · Complete" folio="P. 13 / 13" title="Victory" body="You cleared Round 20. Replay or start a new run to improve score." actions={[{ label: "Restart Round 1", onClick: () => beginRun(1), primary: true }, { label: "Continue Run", onClick: () => beginRun(progress.unlockedRound) }]} />}
      {phase === "defeat" && <Overlay stamp={`Order ${activeRound} · Failed`} folio={`P. ${String(Math.min(activeRound, 13)).padStart(2, "0")} / 13`} title="Defeat" body="Enemies reached the endpoint. Retry immediately and refine tower placement." actions={[{ label: `Retry Round ${activeRound}`, onClick: () => { pushTelemetry("retry_clicked", { round: activeRound }); beginRun(activeRound); }, primary: true }, { label: "Home", onClick: () => setPhase("menu") }]} />}
      {phase === "tutorial" && (
        <TutorialFlow
          onFinish={() => {
            setProgress((prev) => ({ ...prev, tutorialComplete: true }));
            setPhase("menu");
          }}
          onSkip={() => {
            setProgress((prev) => ({ ...prev, tutorialComplete: true }));
            setPhase("menu");
          }}
          onWorldEvent={() => { /* counter is read via worldEventCount below */ }}
          worldEventCount={worldEventCount}
        />
      )}

      {debugMode && (
        <div className="debug-strip">
          <span>Debug mode active</span>
          <span>Phase: {phase}</span>
          <span>Selected tower: {selectedTower?.name ?? "none"}</span>
          <span>Paused: {paused ? "yes" : "no"}</span>
          <span>Round summary: {roundSummary ? `${roundSummary.defeated} defeated / ${roundSummary.escaped} escaped` : "n/a"}</span>
        </div>
      )}
    </div>
  );
}

function Overlay(props: {
  title: string;
  body: string;
  stamp?: string;
  folio?: string;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
}) {
  // Thin shim kept for backwards compatibility with existing call sites
  // (Tutorial, Victory, Defeat). New code should import CardstockSheet
  // directly from "./CardstockSheet" so it can add children, multiple
  // paragraphs, and a dismissible close affordance.
  return (
    <CardstockSheet
      title={props.title}
      stamp={props.stamp ?? "Briefing"}
      folio={props.folio ?? "P. 03 / 13"}
      actions={props.actions}
    >
      <p>{props.body}</p>
    </CardstockSheet>
  );
}

/**
 * Printed top-down silhouette of a tower's coverage area.
 * Drawn in the same shape the in-game range preview uses, so the card
 * is honest: tap a card, you see exactly the printed silhouette.
 */
function TowerSilhouette(props: { kind: TowerKind }) {
  // 32x32 viewBox; range shapes drawn as ink lines on parchment.
  switch (props.kind) {
    case "cannon":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden>
          {/* cannon = one sharp burst, concentric rings */}
          <circle cx="16" cy="16" r="13" className="sil-cannon" />
          <circle cx="16" cy="16" r="7"  className="sil-cannon" />
          <path d="M16 3 L18 6 L14 6 Z" className="sil-cannon" fill="currentColor" />
        </svg>
      );
    case "rapid":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden>
          {/* rapid = dashed rings + tick marks (small, fast) */}
          <circle cx="16" cy="16" r="13" className="sil-rapid" />
          <circle cx="16" cy="16" r="8"  className="sil-rapid" />
          <path d="M16 2 L16 5 M16 27 L16 30 M2 16 L5 16 M27 16 L30 16"
                stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "splash":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden>
          {/* splash = three filled dots, like blast marks */}
          <circle cx="16" cy="16" r="13" className="sil-splash" />
          <circle cx="16" cy="16" r="6"  className="sil-splash" />
          <circle cx="16" cy="16" r="2"  fill="currentColor" />
        </svg>
      );
    case "slow":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden>
          {/* slow = dotted ring + arc (a current) */}
          <circle cx="16" cy="16" r="13" className="sil-slow" />
          <path d="M3 16 a13 13 0 0 1 26 0" stroke="currentColor"
                strokeWidth="1.5" fill="none" />
        </svg>
      );
  }
}

function createEngine() {
  const state = {
    towers: [] as PlacedTower[],
    enemies: [] as EnemyInstance[],
    projectiles: [] as ProjectileInstance[],
    currentRound: null as null | (typeof gameConfig.rounds)[number],
    spawnQueue: [] as { enemy: ReturnType<typeof getEnemyConfig>; delay: number; bonusHp?: number; bonusSpeed?: number }[],
    spawnTimer: 0,
    defeatedThisRound: 0,
    escapedThisRound: 0,
    scoreThisRound: 0,
    roundCompleteTriggered: false
  };

  const pathPoints = gameConfig.path;

  const pathPosition = (progress: number) => {
    const segmentLength = 1 / (pathPoints.length - 1);
    const index = Math.min(pathPoints.length - 2, Math.floor(progress / segmentLength));
    const local = (progress - index * segmentLength) / segmentLength;
    const start = pathPoints[index];
    const end = pathPoints[index + 1];
    return {
      x: start.x + (end.x - start.x) * local,
      z: start.z + (end.z - start.z) * local,
      segment: index,
      local
    };
  };

  return {
    towers: state.towers,
    enemies: state.enemies,
    projectiles: state.projectiles,
    hasTowerNear(x: number, z: number) {
      return state.towers.some((tower) => distance2D(tower.x, tower.z, x, z) < 0.65);
    },
    placeTower(kind: TowerConfig["kind"], x: number, z: number) {
      const towerConfig = getTowerConfig(kind);
      const tower: PlacedTower = {
        id: makeId("tower"),
        kind,
        x,
        z,
        level: 1,
        cooldown: 0,
        config: towerConfig
      };
      state.towers.push(tower);
      return tower;
    },
    getTower(id: string) {
      return state.towers.find((tower) => tower.id === id) ?? null;
    },
    findTowerAt(x: number, z: number) {
      return state.towers.find((tower) => distance2D(tower.x, tower.z, x, z) < 0.65) ?? null;
    },
    upgradeTower(id: string) {
      const tower = state.towers.find((entry) => entry.id === id);
      if (!tower) return { ok: false, reason: "Tower not found" };
      if (tower.level >= 3) return { ok: false, reason: "Tower is already max level" };
      const upgrade = tower.config.upgrades[tower.level];
      tower.level += 1;
      return { ok: true, cost: upgrade.cost };
    },
    sellTower(id: string) {
      const index = state.towers.findIndex((entry) => entry.id === id);
      if (index === -1) return { ok: false, value: 0 };
      const tower = state.towers[index];
      const invested = tower.config.cost + tower.config.upgrades.slice(0, tower.level - 1).reduce((sum, item) => sum + item.cost, 0);
      const value = Math.round(invested * tower.config.sellMultiplier);
      state.towers.splice(index, 1);
      return { ok: true, value };
    },
    spawnDebugEnemy(kind: EnemyKind) {
      const config = gameConfig.enemies.find((enemy) => enemy.kind === kind);
      if (!config) return;
      const enemy = createEnemy({ ...config, hp: config.hp, speed: config.speed });
      state.enemies.push(enemy);
    },
    startRound(round: (typeof gameConfig.rounds)[number]) {
      state.currentRound = round;
      let offset = 0;
      state.spawnQueue = round.spawns.flatMap((spawn) => {
        const config = getEnemyConfig(spawn.enemy);
        const items = Array.from({ length: spawn.count }, (_, index) => ({
          enemy: config,
          delay: offset + spawn.spacing * index,
          bonusHp: spawn.bonusHp,
          bonusSpeed: spawn.bonusSpeed
        }));
        offset += spawn.count * spawn.spacing + 1.2;
        return items;
      });
      state.spawnTimer = 0;
      state.defeatedThisRound = 0;
      state.escapedThisRound = 0;
      state.scoreThisRound = 0;
      state.roundCompleteTriggered = false;
    },
    tick(dt: number) {
      const result: {
        currencyDelta: number;
        scoreDelta: number;
        livesDelta: number;
        enemyKilled?: string;
        enemyEscaped?: string;
        roundComplete?: { defeated: number; escaped: number; earned: number; score: number };
      } = { currencyDelta: 0, scoreDelta: 0, livesDelta: 0 };

      if (state.currentRound) {
        state.spawnTimer += dt;
        const next = state.spawnQueue[0];
        if (next && state.spawnTimer >= next.delay) {
          state.spawnQueue.shift();
          state.enemies.push(createEnemy(next.enemy, next.bonusHp, next.bonusSpeed));
        }
      }

      state.towers.forEach((tower) => {
        tower.cooldown = Math.max(0, tower.cooldown - dt);
      });

      state.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const path = pathPosition(enemy.progress);
        const target = pathPosition(Math.min(0.999, enemy.progress + 0.01));
        const dirX = target.x - path.x;
        const dirZ = target.z - path.z;
        const length = Math.hypot(dirX, dirZ) || 1;
        enemy.progress += (enemy.speed * enemy.slowMultiplier * dt) / 8;
        const pos = pathPosition(enemy.progress);
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.slowMultiplier = Math.min(1, enemy.slowMultiplier + dt * 0.35);
        if (enemy.progress >= 1) {
          enemy.alive = false;
          enemy.hp = 0;
          state.escapedThisRound += 1;
          result.livesDelta -= 1;
          result.enemyEscaped = enemy.kind;
        }
      });

      state.towers.forEach((tower) => {
        if (tower.cooldown > 0) return;
        const towerConfig = tower.config;
        const upgrade = towerConfig.upgrades[tower.level - 1];
        const target = state.enemies
          .filter((enemy) => enemy.alive)
          .filter((enemy) => distance2D(tower.x, tower.z, enemy.x, enemy.z) <= upgrade.range)
          .sort((a, b) => b.progress - a.progress)[0];
        if (!target) return;
        tower.cooldown = 1 / upgrade.fireRate;
        state.projectiles.push({
          id: makeId("shot"),
          x: tower.x,
          z: tower.z,
          targetId: target.id,
          speed: 10,
          damage: upgrade.damage,
          splashRadius: upgrade.splashRadius,
          slowFactor: upgrade.slowFactor,
          color: towerConfig.color,
          done: false
        });
      });

      state.projectiles.forEach((projectile) => {
        const target = state.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.alive);
        if (!target) {
          projectile.done = true;
          return;
        }
        const dx = target.x - projectile.x;
        const dz = target.z - projectile.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.2) {
          const impacted = state.enemies.filter((enemy) => enemy.alive && distance2D(enemy.x, enemy.z, target.x, target.z) <= (projectile.splashRadius ?? 0.1));
          impacted.forEach((enemy) => {
            enemy.hp -= projectile.damage;
            if (projectile.slowFactor) enemy.slowMultiplier = Math.min(enemy.slowMultiplier, projectile.slowFactor);
            if (enemy.hp <= 0 && enemy.alive) {
              enemy.alive = false;
              state.defeatedThisRound += 1;
              state.scoreThisRound += enemy.score;
              result.currencyDelta += enemy.reward;
              result.scoreDelta += enemy.score;
              result.enemyKilled = enemy.kind;
            }
          });
          projectile.done = true;
          return;
        }
        const step = Math.min(projectile.speed * dt, dist);
        projectile.x += (dx / dist) * step;
        projectile.z += (dz / dist) * step;
      });

      for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
        if (state.projectiles[i].done) state.projectiles.splice(i, 1);
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        if (!state.enemies[i].alive && state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
      }

      if (state.currentRound && !state.roundCompleteTriggered) {
        const activeSpawn = state.spawnQueue.length > 0;
        const activeEnemies = state.enemies.some((enemy) => enemy.alive);
        if (!activeSpawn && !activeEnemies) {
          state.roundCompleteTriggered = true;
          result.roundComplete = {
            defeated: state.defeatedThisRound,
            escaped: state.escapedThisRound,
            earned: state.defeatedThisRound * 10,
            score: state.scoreThisRound
          };
        }
      }
      return result;
    }
  };

  function createEnemy(config = getEnemyConfig("basic"), bonusHp = 0, bonusSpeed = 0): EnemyInstance {
    const pos = pathPosition(0);
    return {
      id: makeId("enemy"),
      kind: config.kind,
      hp: config.hp + bonusHp,
      maxHp: config.hp + bonusHp,
      speed: config.speed + bonusSpeed,
      progress: 0,
      slowMultiplier: 1,
      x: pos.x,
      z: pos.z,
      radius: config.radius,
      reward: config.reward,
      score: config.score,
      alive: true
    };
  }
}
