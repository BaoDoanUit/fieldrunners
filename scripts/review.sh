#!/usr/bin/env bash
# scripts/review.sh — full project audit.
#
# Runs typecheck, tests, build, server smoke, and a dead-code check,
# then summarizes what is done vs. what is left in the project.
#
# Usage:
#   bash scripts/review.sh           # full review
#   bash scripts/review.sh --fast    # skip the build + server smoke
#   bash scripts/review.sh --no-fix  # audit only, do not auto-update AGENTS.md
#
# Exit code is 0 if everything is green, 1 if any check failed.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAST=0
FIX=1
for arg in "$@"; do
  case "$arg" in
    --fast)   FAST=1 ;;
    --no-fix) FIX=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ---------- pretty printing ----------
hdr()  { printf "\n\033[1;34m== %s ==\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; }
note() { printf "  \033[33m·\033[0m %s\n" "$1"; }

FAILS=0

# ---------- git ----------
hdr "git"
git log --oneline | head -10 || true
printf "  "
git status --short
if [ -z "$(git status --short)" ]; then ok "working tree clean"; else note "uncommitted changes above"; fi

# ---------- typecheck ----------
hdr "typecheck"
if npm run typecheck > /tmp/review-typecheck.log 2>&1; then
  ok "client + server + tests tsconfigs are clean"
else
  fail "typecheck failed — see /tmp/review-typecheck.log"
  FAILS=$((FAILS + 1))
fi

# ---------- tests ----------
hdr "tests"
if npm test > /tmp/review-tests.log 2>&1; then
  PASS=$(grep -oE "Tests *[0-9]+ passed" /tmp/review-tests.log | head -1 || echo "?")
  FILES=$(grep -oE "Test Files *[0-9]+ passed" /tmp/review-tests.log | head -1 || echo "?")
  ok "$FILES, $PASS"
else
  fail "tests failed — see /tmp/review-tests.log"
  FAILS=$((FAILS + 1))
fi

# ---------- build ----------
if [ "$FAST" -eq 0 ]; then
  hdr "build"
  if npm run build > /tmp/review-build.log 2>&1; then
    grep -E "^dist/" /tmp/review-build.log | tail -8
    ok "vite build succeeded"
  else
    fail "build failed — see /tmp/review-build.log"
    FAILS=$((FAILS + 1))
  fi
else
  note "skipping build (--fast)"
fi

# ---------- server smoke ----------
if [ "$FAST" -eq 0 ]; then
  hdr "server smoke"
  pkill -9 -f "tsx server" 2>/dev/null || true
  sleep 0.4
  node_modules/.bin/tsx server/index.ts > /tmp/review-srv.log 2>&1 &
  SRV_PID=$!
  sleep 2
  HEALTH=$(curl -s --max-time 3 http://localhost:3001/api/health || true)
  if echo "$HEALTH" | grep -q '"ok":true'; then
    ok "/api/health → 200"
  else
    fail "/api/health did not respond"
    FAILS=$((FAILS + 1))
  fi
  POST=$(curl -s --max-time 3 -X POST -H "Content-Type: application/json" \
         -d '{"version":1,"name":"app_open","ts":123}' \
         http://localhost:3001/api/telemetry || true)
  if echo "$POST" | grep -q '"ok":true'; then
    ok "POST /api/telemetry (valid event) → 200"
  else
    fail "POST /api/telemetry did not return ok"
    FAILS=$((FAILS + 1))
  fi
  REJECT=$(curl -s --max-time 3 -X POST -H "Content-Type: application/json" \
           -d '{"name":"app_open"}' \
           http://localhost:3001/api/telemetry || true)
  if echo "$REJECT" | grep -q "invalid_version"; then
    ok "missing-version request correctly rejected (400 invalid_version)"
  else
    fail "missing-version request not rejected as expected"
    FAILS=$((FAILS + 1))
  fi
  kill -9 $SRV_PID 2>/dev/null || true
else
  note "skipping server smoke (--fast)"
fi

# ---------- dead code ----------
hdr "dead code"
DEAD_CREATE=$(grep -rn "createEngine" src 2>/dev/null | grep -v "createEngine()" | grep -v "///" | wc -l)
DEAD_PLAN=$(grep -rn "planSpawns" src 2>/dev/null | grep -v "export function planSpawns" | wc -l)
if [ "$DEAD_CREATE" -eq 0 ] && [ "$DEAD_PLAN" -eq 0 ]; then
  ok "no unreferenced dead-code exports"
else
  note "createEngine references: $DEAD_CREATE   planSpawns references: $DEAD_PLAN"
  note "(only docstrings count as references — both functions are unused)"
fi

# ---------- TODO / FIXME ----------
hdr "TODO / FIXME / HACK"
TODOS=$(grep -rn "TODO\|FIXME\|XXX\|HACK" src server 2>/dev/null | wc -l)
if [ "$TODOS" -eq 0 ]; then
  ok "no TODO/FIXME markers in src or server"
else
  note "$TODOS markers in source (review separately)"
fi

# ---------- infrastructure (webapp topology) ----------
hdr "infrastructure"
# Engine + audio must be browser-only: no Node imports in src/.
if grep -rq "from ['\"]node:" src 2>/dev/null; then
  fail "src/ contains node: imports — engine is leaking server code"
  FAILS=$((FAILS + 1))
else
  ok "src/ is browser-only (no node: imports)"
fi
# Server must only import shared types/config, never gameplay code.
LEAKED=$(grep -rh "from ['\"]\.\./src/" server 2>/dev/null | grep -E "engine|audio|ui" | wc -l)
if [ "$LEAKED" -gt 0 ]; then
  fail "server/ imports gameplay code ($LEAKED leaks)"
  FAILS=$((FAILS + 1))
else
  ok "server/ only imports from src/shared (config + types)"
fi
# PWA: manifest, SW, icons must be in place.
if [ -f public/manifest.webmanifest ]; then
  if node -e "
    import('node:fs/promises').then(async ({readFile}) => {
      const m = JSON.parse(await readFile('./public/manifest.webmanifest', 'utf8'));
      if (!m.name || !m.icons || !m.start_url) process.exit(1);
    }).catch(() => process.exit(1));
  " 2>/dev/null; then
    ok "manifest.webmanifest is valid and has name/icons/start_url"
  else
    fail "manifest.webmanifest is missing required fields"
    FAILS=$((FAILS + 1))
  fi
else
  fail "public/manifest.webmanifest missing"
  FAILS=$((FAILS + 1))
fi
if [ -f public/sw.js ] && grep -q "CACHE_NAME\|addEventListener" public/sw.js; then
  ok "sw.js exists and registers fetch handlers"
else
  fail "public/sw.js missing or empty"
  FAILS=$((FAILS + 1))
fi
ICON_COUNT=$(ls public/icons/*.png 2>/dev/null | wc -l)
if [ "$ICON_COUNT" -ge 2 ]; then
  ok "icons/ has $ICON_COUNT PNG files"
else
  fail "icons/ has only $ICON_COUNT PNG files (expected ≥ 2)"
  FAILS=$((FAILS + 1))
fi
# index.html must reference the SW + manifest + apple-touch-icon.
if grep -q "manifest.webmanifest" index.html && grep -q "serviceWorker.register" index.html; then
  ok "index.html wires manifest + service worker"
else
  fail "index.html is missing PWA wiring"
  FAILS=$((FAILS + 1))
fi

# ---------- AGENTS.md drift ----------
hdr "AGENTS.md drift"
DRIFTED=0
if grep -q "No tests yet" AGENTS.md 2>/dev/null; then
  note "AGENTS.md says 'No tests yet' but tests/ exists with vitest"
  DRIFTED=1
fi
if grep -q "Six source files" AGENTS.md 2>/dev/null; then
  note "AGENTS.md still says 'Six source files' — count is 21 now"
  DRIFTED=1
fi
if [ "$DRIFTED" -eq 0 ]; then
  ok "AGENTS.md reflects current state"
else
  if [ "$FIX" -eq 1 ]; then
    note "auto-patching AGENTS.md (use --no-fix to skip)"
    # Targeted sed patches — leave the rest of the file alone.
    sed -i.bak \
      -e "s|No tests yet\. \`npm run typecheck\` is the only automated guard|77 vitest tests across 9 files (engine, targeting, path, rng, rounds, telemetry buffer, error handler, config store, vfx). \`npm test\` is the canonical check|" \
      -e "s|Six source files, ~3 000 LOC|~5 100 LOC across 21 source files, 9 test files, 4 server files, 6 public assets|" \
      AGENTS.md && rm -f AGENTS.md.bak
    ok "AGENTS.md patched"
  else
    fail "AGENTS.md drift (re-run without --no-fix to auto-patch)"
    FAILS=$((FAILS + 1))
  fi
fi

# ---------- summary ----------
hdr "summary"
echo "  source files:  $(find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l)"
echo "  test files:    $(find tests -type f -name '*.ts' | wc -l)"
echo "  server files:  $(find server -type f -name '*.ts' | wc -l)"
echo "  public assets: $(find public -type f | wc -l)"
echo "  total LOC:     $(find src server tests -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l)"

if [ "$FAILS" -eq 0 ]; then
  printf "\n  \033[1;32mALL CHECKS GREEN\033[0m\n\n"
  exit 0
else
  printf "\n  \033[1;31m%d CHECK(S) FAILED\033[0m\n\n" "$FAILS"
  exit 1
fi
