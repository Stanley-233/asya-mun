#!/bin/sh
set -eu

cd /app

java -jar /app/backend/asya-backend.jar &
backend_pid=$!

cd /app/frontend
HOSTNAME=127.0.0.1 PORT="${FRONTEND_INTERNAL_PORT:-3001}" node server.js &
frontend_pid=$!

nginx -g 'daemon off;' &
proxy_pid=$!

terminate() {
  echo "Stopping application..."
  kill "$backend_pid" "$frontend_pid" "$proxy_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
  wait "$proxy_pid" 2>/dev/null || true
}

trap 'terminate; exit 143' INT TERM

while :; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Backend process exited. Stopping frontend and proxy..."
    kill "$frontend_pid" "$proxy_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    echo "Frontend process exited. Stopping backend and proxy..."
    kill "$backend_pid" "$proxy_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    echo "Proxy process exited. Stopping backend and frontend..."
    kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
    exit 1
  fi

  sleep 2
done
