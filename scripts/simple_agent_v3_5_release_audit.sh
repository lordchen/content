#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FORMAL_ASSETS=(
  "materials.html"
  "campaigns.html"
  "generate.html"
  "scripts.html"
  "content-center-v3.5.css"
  "content-center-v3.5-materials.js"
  "content-center-v3.5-campaigns.js"
  "content-center-v3.5-generate.js"
  "content-center-v3.5-scripts.js"
)

RUNTIME_FILES=(
  "scripts/prototype_api_server.py"
  "scripts/simple_agent_code_release_pack.sh"
  "scripts/deploy_content_agent_archive.sh"
  "scripts/simple_agent_healthcheck.sh"
  "scripts/simple_agent_restart_api.sh"
  "scripts/simple_agent_screen_start.sh"
  "scripts/simple_video_engine/platform_router.py"
  "scripts/simple_video_engine/universal_parser.py"
)

ALL_BOUNDARY_FILES=("${FORMAL_ASSETS[@]}" "${RUNTIME_FILES[@]}")

echo "branch=$(git branch --show-current)"
echo "formal_assets=${#FORMAL_ASSETS[@]}"
echo "runtime_files=${#RUNTIME_FILES[@]}"

missing=0
for file in "${ALL_BOUNDARY_FILES[@]}"; do
  if [ ! -e "$file" ]; then
    echo "MISSING $file" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo
echo "[1/4] Node syntax checks"
node --check content-center-v3.5-materials.js
node --check content-center-v3.5-campaigns.js
node --check content-center-v3.5-generate.js
node --check content-center-v3.5-scripts.js

echo
echo "[2/4] Python compile checks"
python3 -m py_compile scripts/prototype_api_server.py
python3 -m py_compile scripts/simple_video_engine/platform_router.py
python3 -m py_compile scripts/simple_video_engine/universal_parser.py

echo
echo "[3/4] Shell syntax checks"
bash -n scripts/simple_agent_code_release_pack.sh
bash -n scripts/deploy_content_agent_archive.sh
bash -n scripts/simple_agent_healthcheck.sh
bash -n scripts/simple_agent_restart_api.sh
bash -n scripts/simple_agent_screen_start.sh

echo
echo "[4/4] Git status within v3.5 formal boundary"
git status --short -- "${ALL_BOUNDARY_FILES[@]}" || true

echo
echo "simple-agent v3.5 release audit passed"
