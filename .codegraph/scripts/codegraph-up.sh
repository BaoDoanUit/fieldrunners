#!/usr/bin/env bash
# Start the DeepWiki-Open FastAPI backend on :8001.
# Usage: .codegraph/scripts/codegraph-up.sh

set -euo pipefail

DEEPWIKI_DIR="${DEEPWIKI_DIR:-$HOME/tools/deepwiki-open}"
PORT="${PORT:-8001}"
LOG_DIR="$DEEPWIKI_DIR/logs"
PID_FILE="$DEEPWIKI_DIR/.codegraph.pid"

# Make user-installed Python visible.
export PATH="$HOME/.local/bin:$PATH"

if [[ ! -d "$DEEPWIKI_DIR" ]]; then
  echo "DeepWiki-Open not found at $DEEPWIKI_DIR" >&2
  echo "Clone it first: git clone --depth 1 https://github.com/AsyncFuncAI/deepwiki-open.git \"$DEEPWIKI_DIR\"" >&2
  exit 1
fi

if [[ ! -f "$DEEPWIKI_DIR/.env" ]]; then
  echo "Missing $DEEPWIKI_DIR/.env" >&2
  echo "See .codegraph/setup.md for the template." >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Already running (pid $(cat "$PID_FILE")). Stop with: kill \$(cat $PID_FILE)" >&2
  exit 0
fi

mkdir -p "$LOG_DIR"
cd "$DEEPWIKI_DIR"

echo "Starting DeepWiki-Open API on :$PORT (logs: $LOG_DIR/api.log)"
PORT="$PORT" nohup python3 -m api.main >"$LOG_DIR/api.log" 2>&1 &
echo $! >"$PID_FILE"

# Wait for the / endpoint to respond (max ~20s)
for i in {1..40}; do
  if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
    echo "API ready: http://localhost:$PORT"
    exit 0
  fi
  sleep 0.5
done

echo "API did not become ready in time. Tail of $LOG_DIR/api.log:" >&2
tail -40 "$LOG_DIR/api.log" >&2
exit 1
