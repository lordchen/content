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

listener_pids() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp 8771 2>/dev/null | tr ' ' '\n' | awk 'NF'
  elif command -v ss >/dev/null 2>&1; then
    ss -ltnp '( sport = :8771 )' 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p'
  else
    ps -eo pid,cmd | awk '/[p]rototype_api_server.py/ {print $1}'
  fi
}

existing_pids="$(pgrep -f "prototype_api_server.py" || true)"
port_pids="$(listener_pids || true)"
existing_pids="$(printf '%s\n%s\n' "$existing_pids" "$port_pids" | awk 'NF && !seen[$1]++')"
if [ -n "$existing_pids" ]; then
  for pid in $existing_pids; do
    if [ "$pid" != "$$" ]; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  for _ in $(seq 1 20); do
    still_running=""
    for pid in $existing_pids; do
      if [ "$pid" != "$$" ] && kill -0 "$pid" >/dev/null 2>&1; then
        still_running=1
      fi
    done
    [ -z "$still_running" ] && break
    sleep 0.25
  done
  for pid in $existing_pids; do
    if [ "$pid" != "$$" ] && kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done
fi

for _ in $(seq 1 40); do
  if [ -z "$(listener_pids || true)" ]; then
    break
  fi
  sleep 0.25
done

if [ -n "$(listener_pids || true)" ]; then
  echo "Port 8771 is still occupied after stopping existing API processes." >&2
  listener_pids >&2 || true
  exit 1
fi

nohup "$ROOT_DIR/.venv/bin/python" scripts/prototype_api_server.py \
  >> logs/simple-agent-api.log 2>&1 < /dev/null &
api_pid=$!
echo "$api_pid" > run/simple-agent-api.pid

for attempt in $(seq 1 30); do
  if ! kill -0 "$api_pid" >/dev/null 2>&1; then
    echo "Simple Agent API process exited before becoming ready. Recent log:" >&2
    tail -n 80 logs/simple-agent-api.log >&2 || true
    exit 1
  fi
  listener_pid="$(listener_pids | head -n1 || true)"
  if [ -n "$listener_pid" ] && curl --noproxy '*' -fsS "http://127.0.0.1:8771/api/health" >/dev/null 2>&1; then
    listener_cwd="$(readlink "/proc/$listener_pid/cwd" 2>/dev/null || true)"
    if [ "$listener_cwd" != "$ROOT_DIR" ]; then
      echo "Port 8771 is served by unexpected release: $listener_cwd" >&2
      exit 1
    fi
    echo "$listener_pid" > run/simple-agent-api.pid
    echo "Restarted Simple Agent API on 127.0.0.1:8771"
    echo "api_pid=$listener_pid"
    exit 0
  fi
  sleep 1
done

echo "Simple Agent API did not become ready. Recent log:" >&2
tail -n 80 logs/simple-agent-api.log >&2 || true
exit 1
