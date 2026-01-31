#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  ( cd "$ROOT/frontend" && npm install )
fi

WRANGLER_BIN="wrangler"
if [ -x "$ROOT/backend/node_modules/.bin/wrangler" ]; then
  WRANGLER_BIN="$ROOT/backend/node_modules/.bin/wrangler"
fi

( cd "$ROOT/backend" && "$WRANGLER_BIN" d1 execute needanidea --file schema.sql --local ) || {
  echo "Failed to init local D1. Run: cd backend && $WRANGLER_BIN d1 execute needanidea --file schema.sql --local"
}

( cd "$ROOT/backend" && "$WRANGLER_BIN" dev --local --port 8787 ) &
BACK_PID=$!
( cd "$ROOT/frontend" && npm run dev -- --host --port 8000 ) &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID' INT TERM EXIT

echo "frontend: http://localhost:8000"
echo "backend:  http://localhost:8787"

wait
