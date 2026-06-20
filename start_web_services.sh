#!/usr/bin/env bash
#
# Mac/Linux launcher for the QMT dashboard web tier (BFF :3000 + React :3001).
# Counterpart to start_web_services.bat on Windows.
#
# The Python backend (FastAPI) is Windows-only and must already be running and
# reachable at $API_BASE_URL. On a Mac, point at a remote backend, e.g.:
#
#   # via SSH tunnel (recommended):
#   ssh -N -L 8001:localhost:8001 user@your-ecs-host    # in another terminal
#   ./start_web_services.sh
#
#   # or directly:
#   API_BASE_URL="http://<host>:8001/api" ./start_web_services.sh
#
set -euo pipefail
cd "$(dirname "$0")"

export API_BASE_URL="${API_BASE_URL:-http://localhost:8001/api}"
CLIENT_PORT="${CLIENT_PORT:-3001}"

echo "==============================================="
echo " QMT Trading Dashboard - Web Services (Mac/Linux)"
echo "==============================================="
echo " BFF        : http://localhost:${PORT:-3000}"
echo " React      : http://localhost:${CLIENT_PORT}"
echo " Proxying to: ${API_BASE_URL}"
echo "==============================================="

# Warn early if the backend is unreachable (non-fatal).
if command -v curl >/dev/null 2>&1; then
  if ! curl -sf "${API_BASE_URL%/api}/api/health" >/dev/null 2>&1; then
    echo "WARNING: backend health check failed at ${API_BASE_URL%/api}/api/health"
    echo "         Start the FastAPI backend (Windows/ECS) or open the SSH tunnel first."
  fi
fi

# Start BFF and React; kill both on Ctrl-C / exit.
npm start &
BFF_PID=$!

( cd client && PORT="${CLIENT_PORT}" npm start ) &
CLIENT_PID=$!

trap 'echo; echo "Shutting down..."; kill "$BFF_PID" "$CLIENT_PID" 2>/dev/null || true' EXIT INT TERM
wait
