#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="backups/simple-agent-v1-beta-auth-$stamp"
mkdir -p "$backup_dir"

if [ -f data/contentwork.db ]; then
  python3 - "$backup_dir/contentwork.db" <<'PY'
import sqlite3
import sys

source = sqlite3.connect("data/contentwork.db")
target = sqlite3.connect(sys.argv[1])
with target:
    source.backup(target)
source.close()
target.close()
PY
else
  echo "data/contentwork.db not found" >&2
  exit 1
fi

cp -R configs "$backup_dir/configs"
cp package.json "$backup_dir/package.json"

cat > "$backup_dir/manifest.txt" <<EOF
name=simple-agent-v1-beta-auth
created_at=$stamp
db=data/contentwork.db
api=http://127.0.0.1:8771
web=http://127.0.0.1:8782/prototype/simple-agent-materials.html?v=simple-agent-v1-beta-auth
EOF

echo "$backup_dir"
