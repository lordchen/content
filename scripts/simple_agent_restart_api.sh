#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs run

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/simple_agent_env.sh"
simple_agent_load_env "$ROOT_DIR"

if [ ! -x ".venv/bin/python" ]; then
  echo ".venv/bin/python not found. Create the project virtualenv before restarting Simple Agent API." >&2
  exit 1
fi

for pid in $(ps -eo pid,cmd | awk '/[.]venv\/bin\/python scripts\/prototype_api_server.py/ {print $1}'); do
  kill "$pid" >/dev/null 2>&1 || true
done

sleep 1

nohup bash -lc "cd '$ROOT_DIR' && source '$ROOT_DIR/scripts/simple_agent_env.sh' && simple_agent_load_env '$ROOT_DIR' && exec '$ROOT_DIR/.venv/bin/python' scripts/prototype_api_server.py" \
  >> logs/simple-agent-api.log 2>&1 < /dev/null &
echo $! > run/simple-agent-api.pid

for attempt in $(seq 1 30); do
  if curl --noproxy '*' -fsS "http://127.0.0.1:8771/api/health" >/dev/null 2>&1; then
    echo "Restarted Simple Agent API on 127.0.0.1:8771"
    exit 0
  fi
  sleep 1
done

echo "Simple Agent API did not become ready. Recent log:" >&2
tail -n 80 logs/simple-agent-api.log >&2 || true
exit 1
