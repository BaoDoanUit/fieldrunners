#!/usr/bin/env bash
# Stop the DeepWiki-Open FastAPI backend.
# Usage: .codegraph/scripts/codegraph-down.sh

set -euo pipefail

DEEPWIKI_DIR="${DEEPWIKI_DIR:-$HOME/tools/deepwiki-open}"
PID_FILE="$DEEPWIKI_DIR/.codegraph.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No pid file at $PID_FILE. Nothing to stop."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped DeepWiki-Open (pid $PID)"
else
  echo "Process $PID not running; cleaning up stale pid file."
fi
rm -f "$PID_FILE"
