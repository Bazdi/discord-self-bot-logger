#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Node version: $(node -v)"

if [ ! -d node_modules ]; then
  echo "Installing root dependencies..."
  npm install
fi

if ! node -e "new (require('better-sqlite3'))(':memory:').close(); require('sharp')" >/dev/null 2>&1; then
  echo "Restoring native modules (better-sqlite3, sharp)..."
  npm rebuild better-sqlite3 sharp
fi

if [ ! -d dashboard-ui/node_modules ]; then
  echo "Installing dashboard-ui dependencies..."
  (cd dashboard-ui && npm install)
fi

echo "Starting bot + dashboard dev concurrently..."

npx concurrently \
  -n "bot,dashboard" \
  -c "cyan,green" \
  "tsx watch src/main.ts" \
  "cd dashboard-ui && npx vite"
