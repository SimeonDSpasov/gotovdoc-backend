#!/usr/bin/env bash
set -euo pipefail

SOFFICE_PID=""

cleanup() {
  if [[ -n "$SOFFICE_PID" ]]; then
    if kill -0 "$SOFFICE_PID" >/dev/null 2>&1; then
      echo "Stopping LibreOffice listener (PID $SOFFICE_PID)..."
      kill "$SOFFICE_PID" >/dev/null 2>&1 || true
      wait "$SOFFICE_PID" 2>/dev/null || true
    fi
  fi
}

trap cleanup EXIT

start_libreoffice_listener() {
  if pgrep -f "soffice .*--accept" >/dev/null 2>&1; then
    echo "LibreOffice listener already running."
    return
  fi

  echo "Starting LibreOffice listener..."
  soffice --headless \
    --nologo \
    --nolockcheck \
    --nodefault \
    --norestore \
    --nofirststartwizard \
    --accept="${LIBREOFFICE_CONNECTION:-socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext}" &
  SOFFICE_PID=$!

  local ready=0
  for attempt in {1..40}; do
    if (echo > /dev/tcp/127.0.0.1/2002) >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.5
  done

  if [[ "$ready" -ne 1 ]]; then
    echo "LibreOffice listener failed to start" >&2
    exit 1
  fi

  echo "LibreOffice listener ready (PID $SOFFICE_PID)."
}

start_libreoffice_listener

if [[ -n "${PM2_PUBLIC_KEY:-}" && -n "${PM2_SECRET_KEY:-}" ]]; then
  echo "Linking PM2 with provided keys..."
  npx pm2 link "$PM2_PUBLIC_KEY" "$PM2_SECRET_KEY" || echo "PM2 link failed (continuing)."
else
  echo "PM2 keys not provided; skipping pm2 link."
fi

exec "$@"


