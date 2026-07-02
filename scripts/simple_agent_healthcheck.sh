#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/simple_agent_env.sh"
simple_agent_load_env "$ROOT_DIR"
runtime_env="${SIMPLE_AGENT_EFFECTIVE_ENV:-${SIMPLE_AGENT_RUNTIME_ENV:-${APP_ENV:-development}}}"

API_BASE="${API_BASE:-http://127.0.0.1:8771}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:8782}"
export NO_PROXY="${NO_PROXY:-127.0.0.1,localhost,::1}"
export no_proxy="${no_proxy:-127.0.0.1,localhost,::1}"
CURL_LOCAL=(curl --noproxy '*' -fsS)

python_bin=".venv/bin/python"
if [ ! -x "$python_bin" ]; then
  python_bin="python3"
fi

cookie_jar="$(mktemp)"
trap 'rm -f "$cookie_jar"' EXIT
login_user="${SIMPLE_AGENT_ADMIN_USER:-admin}"
login_password="${SIMPLE_AGENT_ADMIN_PASSWORD:-admin2026}"
default_generator="codex_cli"
default_image_backend="openai"
case "$runtime_env" in
  prod|production|server|release)
    default_generator="image2svc_chat"
    default_image_backend="image2svc"
    ;;
esac
generator="${SIMPLE_AGENT_GENERATOR:-$default_generator}"
image_backend="${SIMPLE_AGENT_IMAGE_BACKEND:-$default_image_backend}"
codex_bin="${CODEX_BIN:-codex}"

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "required env missing: $key" >&2
    exit 1
  fi
}

require_executable() {
  local label="$1"
  local configured_bin="${2:-}"
  local resolved_bin=""
  if [ -n "$configured_bin" ]; then
    if [ -x "$configured_bin" ]; then
      resolved_bin="$configured_bin"
    elif command -v "$configured_bin" >/dev/null 2>&1; then
      resolved_bin="$(command -v "$configured_bin")"
    else
      echo "$label not found: $configured_bin" >&2
      exit 1
    fi
  else
    resolved_bin="$(command -v "$label" || true)"
    if [ -z "$resolved_bin" ]; then
      echo "$label not found in PATH" >&2
      exit 1
    fi
  fi
  "$resolved_bin" -version >/dev/null 2>&1 || {
    echo "$label is not executable: $resolved_bin" >&2
    exit 1
  }
  echo "$label=$resolved_bin"
}

case "$runtime_env" in
  prod|production|server|release)
    require_env SIMPLE_AGENT_RUNTIME_ENV
    require_env SIMPLE_AGENT_GENERATOR
    require_env SIMPLE_AGENT_IMAGE_BACKEND
    require_env IMAGE2SVC_CHAT_URL
    require_env IMAGE2SVC_IMAGE_URL
    require_env SUBTITLE_ENGINE
    require_env ASR_API_URL
    require_env ASR_MODEL
    require_env ASR_API_KEY
    require_executable ffmpeg "${FFMPEG_BIN:-}"
    require_executable ffprobe "${FFPROBE_BIN:-}"
    require_env LARK_CLI_BIN
    if [ -z "${SIMPLE_AGENT_SCRIPT_LIBRARY_URL:-}${SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN:-}" ]; then
      echo "required env missing: SIMPLE_AGENT_SCRIPT_LIBRARY_URL or SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN" >&2
      exit 1
    fi
    ;;
esac

"${CURL_LOCAL[@]}" "$API_BASE/api/health" >/dev/null
"${CURL_LOCAL[@]}" -c "$cookie_jar" -H "Content-Type: application/json" \
  -X POST "$API_BASE/api/simple-agent/login" \
  --data "{\"username\":\"$login_user\",\"password\":\"$login_password\"}" \
  | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True and d.get("authenticated") is True; print("login user={}".format(d.get("user",{}).get("username")))'
"${CURL_LOCAL[@]}" -b "$cookie_jar" "$API_BASE/api/simple-agent/session" | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("authenticated") is True; print("session authenticated=true")'
"${CURL_LOCAL[@]}" -b "$cookie_jar" "$API_BASE/api/simple-agent/materials" | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; s=d.get("stats",{}); print("materials total={} selected={}".format(s.get("total"), s.get("selected")))'
"${CURL_LOCAL[@]}" -b "$cookie_jar" "$API_BASE/api/simple-agent/campaigns" | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; s=d.get("stats",{}); print("campaigns total={} selected={}".format(s.get("total"), s.get("selected")))'
"${CURL_LOCAL[@]}" -b "$cookie_jar" "$API_BASE/api/simple-agent/templates" | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; print("templates count={}".format(len(d.get("items",[]))))'
"${CURL_LOCAL[@]}" -b "$cookie_jar" "$API_BASE/api/simple-agent/scripts" | "$python_bin" -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; print("script outputs={}".format(len(d.get("items",[]))))'
if [ -n "${SIMPLE_AGENT_SCRIPT_LIBRARY_URL:-}${SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN:-}" ]; then
  echo "feishu script library configured"
  lark_cli_bin="${LARK_CLI_BIN:-$(command -v lark-cli || true)}"
  if [ -n "$lark_cli_bin" ] && [ -x "$lark_cli_bin" ]; then
    if [ -z "${SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN:-}" ]; then
      echo "feishu script library table check skipped: base token not set separately"
    elif [ -n "${SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID:-}" ]; then
      "$lark_cli_bin" base +field-list \
        --base-token "$SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN" \
        --table-id "$SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID" \
        --as user \
        --limit 100 >/dev/null
      echo "feishu script library table readable"
    else
      "$lark_cli_bin" base +table-list \
        --base-token "$SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN" \
        --as user \
        --limit 20 >/dev/null
      echo "feishu script library base readable"
    fi
  else
    echo "feishu script library lark-cli not found; sync will fail"
  fi
else
  echo "feishu script library not configured; adopted scripts will report sync failure"
fi
"${CURL_LOCAL[@]}" -b "$cookie_jar" -H "Content-Type: application/json" \
  -X POST "$API_BASE/api/simple-agent/logout" \
  --data '{}' >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/materials.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/campaigns.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/generate.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/scripts.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/content-center-v3.5.css" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/content-center-v3.5-materials.js" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/content-center-v3.5-campaigns.js" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/content-center-v3.5-generate.js" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/content-center-v3.5-scripts.js" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/materials.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/campaigns.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/generate.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/scripts.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/v3.5/materials.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/v3.5/campaigns.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/v3.5/generate.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/v3.5/scripts.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-v3.4-materials.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-v3.4-campaigns.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-v3.4-generate.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-v3.4-scripts.html" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/v1/index.html" >/dev/null
echo "generator=$generator"
if [ "$generator" = "codex_cli" ]; then
  if [ -n "${SIMPLE_AGENT_CODEX_SERVICE_URL:-}" ]; then
    echo "codex service=${SIMPLE_AGENT_CODEX_SERVICE_URL}"
    "${CURL_LOCAL[@]}" "${SIMPLE_AGENT_CODEX_SERVICE_URL%/}/health" >/dev/null
  fi
  "$codex_bin" --version
else
  echo "Codex CLI generation disabled by SIMPLE_AGENT_GENERATOR=$generator"
  if [ "$generator" = "image2svc_chat" ]; then
    echo "image2svc chat=${IMAGE2SVC_CHAT_URL:-http://127.0.0.1:9528}"
    "${CURL_LOCAL[@]}" "${IMAGE2SVC_CHAT_URL:-http://127.0.0.1:9528}/health" >/dev/null
  fi
fi
echo "image_backend=$image_backend"
if [ "$image_backend" = "image2svc" ]; then
  echo "image2svc image=${IMAGE2SVC_IMAGE_URL:-http://127.0.0.1:9527}"
  "${CURL_LOCAL[@]}" "${IMAGE2SVC_IMAGE_URL:-http://127.0.0.1:9527}/health" >/dev/null
fi

echo "Simple Agent v3.5 healthcheck passed"
