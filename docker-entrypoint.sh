#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${PM2_PUBLIC_KEY:-}" && -n "${PM2_SECRET_KEY:-}" ]]; then
  echo "Linking PM2 with provided keys..."
  npx pm2 link "$PM2_PUBLIC_KEY" "$PM2_SECRET_KEY" || echo "PM2 link failed (continuing)."
else
  echo "PM2 keys not provided; skipping pm2 link."
fi

exec "$@"


