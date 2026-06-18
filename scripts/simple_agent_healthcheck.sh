#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
login_password="${SIMPLE_AGENT_ADMIN_PASSWORD:-simple-agent-v1}"
runtime_env="${SIMPLE_AGENT_RUNTIME_ENV:-${APP_ENV:-development}}"
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
else
  echo "feishu script library not configured; adopted scripts will report sync failure"
fi
"${CURL_LOCAL[@]}" -b "$cookie_jar" -H "Content-Type: application/json" \
  -X POST "$API_BASE/api/simple-agent/logout" \
  --data '{}' >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-materials.html?v=simple-agent-v1-beta-auth" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-campaigns.html?v=simple-agent-v1-beta-auth" >/dev/null
"${CURL_LOCAL[@]}" "$WEB_BASE/prototype/simple-agent-generate.html?v=simple-agent-v1-beta-auth" >/dev/null
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

echo "V1 beta healthcheck passed"
