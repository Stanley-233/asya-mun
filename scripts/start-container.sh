#!/bin/sh
set -eu

cd /app

java -jar /app/backend/asya-backend.jar &
backend_pid=$!

cd /app/frontend
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" node server.js &
frontend_pid=$!

terminate() {
  echo "Stopping application..."
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}

trap 'terminate; exit 143' INT TERM

while :; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Backend process exited. Stopping frontend..."
    kill "$frontend_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    echo "Frontend process exited. Stopping backend..."
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
    exit 1
  fi

  sleep 2
done
