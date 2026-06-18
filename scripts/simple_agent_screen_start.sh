#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs run

screen -S simple-agent-api -X quit >/dev/null 2>&1 || true
screen -S simple-agent-web -X quit >/dev/null 2>&1 || true
"$ROOT_DIR/scripts/simple_agent_stop.sh" >/dev/null 2>&1 || true

screen -dmS simple-agent-api bash -lc "cd '$ROOT_DIR' && exec .venv/bin/python scripts/prototype_api_server.py >> logs/simple-agent-api.log 2>&1"
screen -dmS simple-agent-web bash -lc "cd '$ROOT_DIR' && exec python3 -m http.server 8782 --bind 127.0.0.1 >> logs/simple-agent-web.log 2>&1"

sleep 1
"$ROOT_DIR/scripts/simple_agent_healthcheck.sh"

