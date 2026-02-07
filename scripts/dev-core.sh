#!/usr/bin/env bash
# One command to boot the core stack: build deps, free ports, start API (3001) and web (3000).
# Ctrl+C stops both. On exit, kills background swaps-api so ports are clean.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "dev:core — freeing ports, building, starting API + web"

# Free 3000 and 3001 before start
bash scripts/free-ports.sh

# Build packages + swaps-api only (no swaps-web build; use pnpm build for full/CI)
pnpm run build:core

# Temp file for swaps-web output (to show last 80 lines on crash)
WEB_LOG=$(mktemp)
trap 'code=$?; if [ -n "${API_PID:-}" ]; then kill "$API_PID" 2>/dev/null || true; fi; if [ $code -ne 0 ] && [ -s "$WEB_LOG" ]; then echo ""; echo "--- Last 80 lines of swaps-web output ---"; tail -80 "$WEB_LOG"; fi; rm -f "$WEB_LOG"; exit $code' EXIT

echo "Starting swaps-api..."
PORT=3001 pnpm --filter @fortuna/swaps-api dev &
API_PID=$!
echo "swaps-api PID=$API_PID"

echo "Waiting for 3001/healthz..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/healthz >/dev/null 2>&1; then
    echo "swaps-api ready (healthz OK)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAIL: swaps-api did not become ready within 30s"
    exit 1
  fi
  sleep 1
done

echo "Starting swaps-web..."
pnpm --filter @fortuna/swaps-web dev 2>&1 | tee "$WEB_LOG"
exit "${PIPESTATUS[0]:-$?}"
