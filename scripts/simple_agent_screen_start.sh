#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs run

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/simple_agent_env.sh"
simple_agent_load_env "$ROOT_DIR"

screen -S simple-agent-api -X quit >/dev/null 2>&1 || true
screen -S simple-agent-web -X quit >/dev/null 2>&1 || true
"$ROOT_DIR/scripts/simple_agent_stop.sh" >/dev/null 2>&1 || true

screen -dmS simple-agent-api bash -lc "cd '$ROOT_DIR' && source '$ROOT_DIR/scripts/simple_agent_env.sh' && simple_agent_load_env '$ROOT_DIR' && exec .venv/bin/python scripts/prototype_api_server.py >> logs/simple-agent-api.log 2>&1"
if [ -f "scripts/simple_agent_dev_static_server.py" ]; then
  screen -dmS simple-agent-web bash -lc "cd '$ROOT_DIR' && exec python3 scripts/simple_agent_dev_static_server.py --host 127.0.0.1 --port 8782 --root '$ROOT_DIR' --quiet >> logs/simple-agent-web.log 2>&1"
else
  screen -dmS simple-agent-web bash -lc "cd '$ROOT_DIR' && exec python3 -m http.server 8782 --bind 127.0.0.1 >> logs/simple-agent-web.log 2>&1"
fi

for attempt in $(seq 1 20); do
  if curl --noproxy '*' -fsS http://127.0.0.1:8771/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
"$ROOT_DIR/scripts/simple_agent_healthcheck.sh"
