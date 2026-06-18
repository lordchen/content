#!/usr/bin/env bash
set -euo pipefail

for port in 8771 8782; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)"
  if [ -n "$pids" ]; then
    kill $pids
    echo "Stopped service on port $port"
  else
    echo "No service listening on port $port"
  fi
done

rm -f run/simple-agent-api.pid run/simple-agent-web.pid
