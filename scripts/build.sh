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

echo "Building backend with tsup..."
npx tsup

echo "Building frontend with vite..."
cd dashboard-ui
npx vite build

echo "Build complete."
