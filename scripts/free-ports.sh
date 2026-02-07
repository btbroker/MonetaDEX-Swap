#!/usr/bin/env bash
# Free ports 3000 and 3001 so pnpm dev can start swaps-web (3000) and swaps-api (3001).
# Usage: ./scripts/free-ports.sh

set -e
for port in 3000 3001; do
  pids=$(lsof -i :$port -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
echo "Ports 3000 and 3001 are free. Run: pnpm dev"
