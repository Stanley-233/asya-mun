#!/bin/sh
set -eu

cd /app

java -jar /app/backend/asya-backend.jar &
backend_pid=$!

nginx -g 'daemon off;' &
proxy_pid=$!

terminate() {
  echo "Stopping application..."
  kill "$backend_pid" "$proxy_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
  wait "$proxy_pid" 2>/dev/null || true
}

trap 'terminate; exit 143' INT TERM

while :; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Backend process exited. Stopping proxy..."
    kill "$proxy_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    echo "Proxy process exited. Stopping backend..."
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
    exit 1
  fi

  sleep 2
done