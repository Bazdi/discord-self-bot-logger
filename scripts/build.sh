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
  node -e "new (require('better-sqlite3'))(':memory:').close(); console.log('better-sqlite3 OK')"
  node -e "require('sharp'); console.log('sharp OK')"
fi

if [ ! -d dashboard-ui/node_modules ]; then
  echo "Installing dashboard-ui dependencies..."
  (cd dashboard-ui && npm install)
fi

echo "Building backend with tsup..."
npx tsup

echo "Copying database migrations into dist..."
rm -rf dist/migrations
cp -r src/database/migrations dist/migrations

echo "Building frontend with vite..."
(cd dashboard-ui && npx vite build)

echo "Build complete."
