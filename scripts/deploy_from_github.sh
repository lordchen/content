#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${CONTENT_AGENT_APP_ROOT:-/home/appadmin/content-agent}"
REPO_URL="${CONTENT_AGENT_GIT_REPO_URL:-}"
REF="${1:-${CONTENT_AGENT_GIT_REF:-main}}"
SERVICE_NAME="${CONTENT_AGENT_SERVICE_NAME:-content-agent-api}"
ENV_FILE="${CONTENT_AGENT_ENV_FILE:-$APP_ROOT/shared/content-agent.env}"

if [ -z "$REPO_URL" ]; then
  echo "CONTENT_AGENT_GIT_REPO_URL is required" >&2
  exit 1
fi

release_id="$(date +%Y%m%d-%H%M%S)-${REF//[^a-zA-Z0-9._-]/-}"
release_dir="$APP_ROOT/releases/$release_id"
work_dir="$APP_ROOT/.deploy-worktree"

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/logs" "$APP_ROOT/shared/run"
rm -rf "$work_dir"

git clone --depth 1 --branch "$REF" "$REPO_URL" "$work_dir" 2>/dev/null || {
  git clone --depth 1 "$REPO_URL" "$work_dir"
  git -C "$work_dir" fetch --depth 1 origin "$REF"
  git -C "$work_dir" checkout FETCH_HEAD
}

mkdir -p "$release_dir"
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude "data/" \
  --exclude "logs/" \
  --exclude "run/" \
  --exclude "backups/" \
  --exclude "releases/" \
  --exclude "node_modules/" \
  --exclude ".venv/" \
  "$work_dir/" "$release_dir/"

ln -sfn "$APP_ROOT/shared/data" "$release_dir/data"
ln -sfn "$APP_ROOT/shared/logs" "$release_dir/logs"
ln -sfn "$APP_ROOT/shared/run" "$release_dir/run"

if [ -f "$ENV_FILE" ]; then
  ln -sfn "$ENV_FILE" "$release_dir/.env.production"
fi

node --check "$release_dir/prototype/simple-agent.js"
node --check "$release_dir/prototype/simple-agent-v3.4-materials.js"
node --check "$release_dir/prototype/simple-agent-v3.4-campaigns.js"
node --check "$release_dir/prototype/simple-agent-v3.4-generate.js"
node --check "$release_dir/prototype/simple-agent-v3.4-scripts.js"
python3 -m py_compile "$release_dir/scripts/prototype_api_server.py"

previous="$(readlink "$APP_ROOT/current" 2>/dev/null || true)"
ln -sfn "$release_dir" "$APP_ROOT/current"

rollback_release() {
  if [ -n "$previous" ]; then
    ln -sfn "$previous" "$APP_ROOT/current"
    if command -v systemctl >/dev/null 2>&1; then
      sudo systemctl restart "$SERVICE_NAME" || true
    fi
  fi
}

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SERVICE_NAME.service" >/dev/null 2>&1; then
  sudo systemctl restart "$SERVICE_NAME"
elif [ -x "$APP_ROOT/current/scripts/simple_agent_restart_api.sh" ]; then
  "$APP_ROOT/current/scripts/simple_agent_restart_api.sh"
fi

if ! curl -fsS "http://127.0.0.1:8771/api/health" >/dev/null; then
  rollback_release
  echo "Health check failed; rolled back to previous release." >&2
  exit 1
fi

if [ -x "$APP_ROOT/current/scripts/simple_agent_healthcheck.sh" ]; then
  if ! "$APP_ROOT/current/scripts/simple_agent_healthcheck.sh"; then
    rollback_release
    echo "Full release healthcheck failed; rolled back to previous release." >&2
    exit 1
  fi
fi

rm -rf "$work_dir"
echo "Deployed $REF to $release_dir"
