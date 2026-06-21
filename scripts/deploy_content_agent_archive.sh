#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${CONTENT_AGENT_APP_ROOT:-/home/appadmin/content-agent}"
ARCHIVE="${1:-${CONTENT_AGENT_ARCHIVE:-/tmp/simple-agent-v3.4-release.tar.gz}}"
WEB_BASE="${WEB_BASE:-https://ai.guardianhealth.cn/content-agent}"
RELEASE_ID="simple-agent-v3.4-$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
TMP_DIR="$APP_ROOT/releases/.tmp-$RELEASE_ID"
RUNNING_DIR="$(for pid in $(pgrep -f 'prototype_api_server.py' || true); do readlink /proc/$pid/cwd 2>/dev/null && break; done)"
CURRENT_TARGET="$(readlink "$APP_ROOT/current" 2>/dev/null || true)"
BASE_DIR="${RUNNING_DIR:-$CURRENT_TARGET}"
BASE_DATA_DIR="$BASE_DIR/data"
BASE_VENV_DIR="$BASE_DIR/.venv"

rollback() {
  if [ -n "${CURRENT_TARGET:-}" ] && [ -d "$CURRENT_TARGET" ]; then
    ln -sfn "$CURRENT_TARGET" "$APP_ROOT/current"
    if [ -x "$CURRENT_TARGET/scripts/simple_agent_restart_api.sh" ]; then
      (cd "$CURRENT_TARGET" && bash scripts/simple_agent_restart_api.sh) || true
    fi
  fi
}
trap 'echo "deploy_failed=1" >&2; rollback' ERR

echo "base_dir=$BASE_DIR"
echo "release_dir=$RELEASE_DIR"
mkdir -p "$TMP_DIR" "$APP_ROOT/backups" "$APP_ROOT/logs" "$APP_ROOT/run" "$APP_ROOT/releases"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"
EXTRACTED="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"
if [ -z "$EXTRACTED" ]; then echo "extract failed" >&2; exit 1; fi
mv "$EXTRACTED" "$RELEASE_DIR"
rm -rf "$TMP_DIR"

if [ -d "$BASE_DATA_DIR" ]; then
  rm -rf "$RELEASE_DIR/data"
  ln -s "$BASE_DATA_DIR" "$RELEASE_DIR/data"
fi
if [ -d "$BASE_VENV_DIR" ]; then
  rm -rf "$RELEASE_DIR/.venv"
  ln -s "$BASE_VENV_DIR" "$RELEASE_DIR/.venv"
fi
rm -rf "$RELEASE_DIR/logs" "$RELEASE_DIR/run"
ln -s "$APP_ROOT/logs" "$RELEASE_DIR/logs"
ln -s "$APP_ROOT/run" "$RELEASE_DIR/run"
if [ -f "$APP_ROOT/shared/content-agent.env" ]; then
  ln -sfn "$APP_ROOT/shared/content-agent.env" "$RELEASE_DIR/.env.production"
fi

cd "$RELEASE_DIR"
node --check prototype/simple-agent.js
node --check prototype/simple-agent-v3.4-materials.js
node --check prototype/simple-agent-v3.4-campaigns.js
node --check prototype/simple-agent-v3.4-generate.js
node --check prototype/simple-agent-v3.4-scripts.js
.venv/bin/python -m py_compile scripts/prototype_api_server.py
bash -n scripts/simple_agent_env.sh scripts/simple_agent_restart_api.sh scripts/simple_agent_healthcheck.sh

printf 'previous_current=%s\n' "$CURRENT_TARGET" > "$APP_ROOT/backups/$RELEASE_ID.meta"
printf 'previous_running=%s\n' "$RUNNING_DIR" >> "$APP_ROOT/backups/$RELEASE_ID.meta"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

bash scripts/simple_agent_restart_api.sh
pid_file="$(cat "$APP_ROOT/run/simple-agent-api.pid" 2>/dev/null || true)"
echo "tracked_pid=$pid_file"
if [ -z "$pid_file" ] || ! kill -0 "$pid_file" >/dev/null 2>&1; then
  echo "tracked pid is not running" >&2
  exit 1
fi
tracked_cwd="$(readlink /proc/$pid_file/cwd 2>/dev/null || true)"
echo "tracked_cwd=$tracked_cwd"
if [ "$tracked_cwd" != "$RELEASE_DIR" ]; then
  echo "tracked pid cwd mismatch: $tracked_cwd" >&2
  exit 1
fi

API_BASE=http://127.0.0.1:8771 WEB_BASE="$WEB_BASE" scripts/simple_agent_healthcheck.sh
echo "released=$RELEASE_DIR"
trap - ERR
