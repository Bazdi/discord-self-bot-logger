#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Installing root dependencies..."
npm install

echo "Rebuilding native modules (e.g. better-sqlite3)..."
npm rebuild

echo "Installing dashboard-ui dependencies..."
cd dashboard-ui
npm install
cd ..

echo "Starting bot + dashboard dev concurrently..."

npx concurrently \
  -n "bot,dashboard" \
  -c "cyan,green" \
  "tsx watch src/main.ts" \
  "cd dashboard-ui && npx vite"
