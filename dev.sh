#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  ( cd "$ROOT/frontend" && npm install )
fi

( cd "$ROOT/backend" && wrangler dev --local --port 8787 ) &
BACK_PID=$!
( cd "$ROOT/frontend" && npm run dev -- --host --port 8000 ) &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID' INT TERM EXIT

echo "frontend: http://localhost:8000"
echo "backend:  http://localhost:8787"

wait
