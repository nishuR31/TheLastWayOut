#!/usr/bin/env bash
# The Last Way Out - launcher for Ubuntu.  Usage: ./run.sh
set -e
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js (>=18) is required:  sudo apt install nodejs npm   (or use https://github.com/nodesource/distributions)"; exit 1
fi
[ -d node_modules ] || npm install
[ -d dist ] || npm run build
# Sandbox stays on; opt out only when the host blocks unprivileged user namespaces.
SANDBOX_FLAG=""
[ "${TLWO_NO_SANDBOX:-0}" = "1" ] && SANDBOX_FLAG="--no-sandbox"
if [ -x node_modules/.bin/electron ]; then
  exec node_modules/.bin/electron . $SANDBOX_FLAG "$@"
fi
echo "Electron not installed - falling back to your browser (http://localhost:3000). For the desktop window run: npm install --save-dev electron"
( sleep 1.5; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &
exec npx vite preview --host 127.0.0.1 --port 3000
