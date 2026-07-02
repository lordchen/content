#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

version="${1:-v3.5-$(date +%Y%m%d-%H%M%S)}"
release_name="simple-agent-code-$version"
release_dir="releases/$release_name"

rm -rf "$release_dir"
mkdir -p "$release_dir"

cp -R prototype scripts docs configs services "$release_dir/"
cp README.md package.json package-lock.json requirements.txt "$release_dir/"
cp materials.html campaigns.html generate.html scripts.html content-center-v3.5.css "$release_dir/"
cp content-center-v3.5-materials.js content-center-v3.5-campaigns.js content-center-v3.5-generate.js content-center-v3.5-scripts.js "$release_dir/"

find "$release_dir" -type d \( \
  -name ".git" -o \
  -name "node_modules" -o \
  -name ".venv" -o \
  -name "__pycache__" -o \
  -name "data" -o \
  -name "logs" -o \
  -name "run" -o \
  -name "backups" -o \
  -name "releases" \
\) -prune -exec rm -rf {} +

find "$release_dir" -type f \( \
  -name "*.pyc" -o \
  -name ".DS_Store" -o \
  -name ".env" -o \
  -name ".env.*" -o \
  -name "*.db" -o \
  -name "*.sqlite" -o \
  -name "*.sqlite3" -o \
  -name "*password*.txt" \
\) -delete

cat > "$release_dir/RELEASE_MANIFEST.md" <<EOF
# Simple Agent v3.5 Code Release

- Release: $release_name
- Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Scope: code only, frontend v3.5 as /content formal entry
- Data: excluded; use server shared data directory
- Config: excluded; use server shared env file
- Production data: must not be migrated, overwritten, or packaged

## Check

\`\`\`bash
bash scripts/simple_agent_v3_5_release_audit.sh
node --check prototype/simple-agent.js
node --check prototype/v3.5/content-center-v3.5-materials.js
node --check prototype/v3.5/content-center-v3.5-campaigns.js
node --check prototype/v3.5/content-center-v3.5-generate.js
node --check prototype/v3.5/content-center-v3.5-scripts.js
node --check content-center-v3.5-materials.js
node --check content-center-v3.5-campaigns.js
node --check content-center-v3.5-generate.js
node --check content-center-v3.5-scripts.js
python3 -m py_compile scripts/prototype_api_server.py
bash -n scripts/simple_agent_env.sh
bash -n scripts/simple_agent_restart_api.sh
scripts/simple_agent_healthcheck.sh
\`\`\`
EOF

archive="releases/$release_name.tar.gz"
COPYFILE_DISABLE=1 tar --format ustar -czf "$archive" -C releases "$release_name"
if tar -tzf "$archive" | grep -E '(^|/)(data|logs|run|backups|releases)(/|$)|(^|/)\.env($|\.)|\.sqlite3?$|\.db$' >/dev/null; then
  echo "Release archive contains forbidden data/config paths" >&2
  exit 1
fi
echo "$archive"
