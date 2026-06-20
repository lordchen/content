#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

version="${1:-$(date +%Y%m%d-%H%M%S)}"
release_name="simple-agent-code-$version"
release_dir="releases/$release_name"

rm -rf "$release_dir"
mkdir -p "$release_dir"

cp -R prototype scripts docs configs services "$release_dir/"
cp README.md package.json package-lock.json requirements.txt "$release_dir/"

find "$release_dir" -type d \( \
  -name ".git" -o \
  -name "node_modules" -o \
  -name ".venv" -o \
  -name "__pycache__" \
\) -prune -exec rm -rf {} +

find "$release_dir" -type f \( \
  -name "*.pyc" -o \
  -name ".DS_Store" -o \
  -name ".env" -o \
  -name ".env.*" -o \
  -name "*password*.txt" \
\) -delete

cat > "$release_dir/RELEASE_MANIFEST.md" <<EOF
# Simple Agent Code Release

- Release: $release_name
- Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Scope: code only
- Data: excluded; use server shared data directory
- Config: excluded; use server shared env file

## Check

\`\`\`bash
node --check prototype/simple-agent.js
node --check prototype/simple-agent-v3.4-materials.js
node --check prototype/simple-agent-v3.4-campaigns.js
node --check prototype/simple-agent-v3.4-generate.js
node --check prototype/simple-agent-v3.4-scripts.js
python3 -m py_compile scripts/prototype_api_server.py
bash -n scripts/simple_agent_env.sh
bash -n scripts/simple_agent_restart_api.sh
scripts/simple_agent_healthcheck.sh
\`\`\`
EOF

archive="releases/$release_name.tar.gz"
COPYFILE_DISABLE=1 tar --format ustar -czf "$archive" -C releases "$release_name"
echo "$archive"
