#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p releases
stamp="$(date +%Y%m%d-%H%M%S)"
release_name="simple-agent-v1-beta-image2svc-$stamp"
release_dir="releases/$release_name"
mkdir -p "$release_dir"

backup_path="$(scripts/simple_agent_backup.sh)"

cp -R prototype scripts docs configs services "$release_dir/"
cp README.md package.json package-lock.json requirements.txt "$release_dir/"
mkdir -p "$release_dir/data"
cp "$backup_path/contentwork.db" "$release_dir/data/contentwork.db"
find "$release_dir" -type d -name ".git" -prune -exec rm -rf {} +
find "$release_dir" -type d -name "node_modules" -prune -exec rm -rf {} +
find "$release_dir" -type d -name ".venv" -prune -exec rm -rf {} +
find "$release_dir" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "$release_dir" -type f -name "*.pyc" -delete
find "$release_dir" -type f -name ".env" -delete

cat > "$release_dir/RELEASE_MANIFEST.md" <<EOF
# Simple Agent V1 Beta Release

- Release: $release_name
- Created: $stamp
- Entry: /prototype/simple-agent-materials.html?v=user-menu-v1
- API: http://127.0.0.1:8771
- Backup: $backup_path

## Start

\`\`\`bash
scripts/simple_agent_start.sh
\`\`\`

## Check

\`\`\`bash
scripts/simple_agent_healthcheck.sh
\`\`\`
EOF

tar -czf "releases/$release_name.tar.gz" -C releases "$release_name"
echo "releases/$release_name.tar.gz"
