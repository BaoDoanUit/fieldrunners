#!/usr/bin/env bash
# Start the DeepWiki-Open Next.js UI on :3000.
# Usage: .codegraph/scripts/codegraph-ui.sh

set -euo pipefail

DEEPWIKI_DIR="${DEEPWIKI_DIR:-$HOME/tools/deepwiki-open}"

if [[ ! -d "$DEEPWIKI_DIR" ]]; then
  echo "DeepWiki-Open not found at $DEEPWIKI_DIR" >&2
  exit 1
fi

if [[ ! -d "$DEEPWIKI_DIR/node_modules" ]]; then
  echo "Installing frontend deps (first run only)..."
  (cd "$DEEPWIKI_DIR" && npm install)
fi

cd "$DEEPWIKI_DIR"
exec npm run dev
