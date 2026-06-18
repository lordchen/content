#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p run logs backups

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [ ! -x ".venv/bin/python" ]; then
  echo ".venv/bin/python not found. Create the project virtualenv before starting V1 beta." >&2
  exit 1
fi

start_detached() {
  local pid_file="$1"
  local log_file="$2"
  shift 2
  rm -f "$pid_file"
  local command_string=""
  printf -v command_string "%q " "$@"
  nohup bash -lc "cd '$ROOT_DIR' && exec $command_string" > "$log_file" 2>&1 < /dev/null &
  echo $! > "$pid_file"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempt
  for attempt in $(seq 1 20); do
    if curl --noproxy '*' -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "$label did not become ready: $url" >&2
  return 1
}

runtime_env="${SIMPLE_AGENT_RUNTIME_ENV:-${APP_ENV:-development}}"
default_generator="codex_cli"
case "$runtime_env" in
  prod|production|server|release)
    default_generator="image2svc_chat"
    ;;
esac
generator="${SIMPLE_AGENT_GENERATOR:-$default_generator}"
codex_bin="${CODEX_BIN:-codex}"
if [ "$generator" = "codex_cli" ] && ! command -v "$codex_bin" >/dev/null 2>&1; then
  echo "Warning: Codex CLI not found at '$codex_bin'. The service will start, but generation will fail until CODEX_BIN is configured." >&2
fi

if lsof -tiTCP:8771 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "API already running on 127.0.0.1:8771"
else
  start_detached run/simple-agent-api.pid logs/simple-agent-api.log .venv/bin/python scripts/prototype_api_server.py
  wait_for_http "http://127.0.0.1:8771/api/health" "API"
  echo "Started API on 127.0.0.1:8771"
fi

if lsof -tiTCP:8782 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Static site already running on 127.0.0.1:8782"
else
  start_detached run/simple-agent-web.pid logs/simple-agent-web.log python3 -m http.server 8782 --bind 127.0.0.1
  wait_for_http "http://127.0.0.1:8782/prototype/simple-agent-materials.html" "Static site"
  echo "Started static site on 127.0.0.1:8782"
fi

"$ROOT_DIR/scripts/simple_agent_healthcheck.sh"
