#!/usr/bin/env bash
# The Last Way Out - launcher for Ubuntu.  Usage: ./run.sh
set -e
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js (>=18) is required:  sudo apt install nodejs npm   (or use https://github.com/nodesource/distributions)"; exit 1
fi
[ -d node_modules ] || npm install
[ -d dist ] || npm run build
# Sandbox stays on when Electron's SUID helper is configured correctly.
# TLWO_NO_SANDBOX=1 forces it off; otherwise auto-detect the common case where
# chrome-sandbox exists but is not owned by root + setuid.
SANDBOX_FLAG=""
if [ "${TLWO_NO_SANDBOX:-}" = "1" ]; then
  SANDBOX_FLAG="--no-sandbox"
elif [ -z "${TLWO_NO_SANDBOX:-}" ]; then
  SB="node_modules/electron/dist/chrome-sandbox"
  if [ -e "$SB" ]; then
    SB_UID=$(stat -c '%u' "$SB" 2>/dev/null || echo '?')
    SB_MODE=$(stat -c '%a' "$SB" 2>/dev/null || echo '?')
    case "$SB_MODE" in 4???|5???|6???|7???) SB_SUID=1 ;; *) SB_SUID=0 ;; esac
    if [ "$SB_UID" != "0" ] || [ "$SB_SUID" -ne 1 ]; then
      SANDBOX_FLAG="--no-sandbox"
      echo "[TLWO] chrome-sandbox not setuid-root (uid=$SB_UID mode=$SB_MODE) - using --no-sandbox."
      echo "[TLWO] Proper fix: sudo chown root:root \"$SB\" && sudo chmod 4755 \"$SB\""
    fi
  fi
fi
if [ -x node_modules/.bin/electron ]; then
  exec node_modules/.bin/electron . $SANDBOX_FLAG "$@"
fi
echo "Electron not installed - falling back to your browser (http://localhost:3000). For the desktop window run: npm install --save-dev electron"
( sleep 1.5; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &
exec npx vite preview --host 127.0.0.1 --port 3000
