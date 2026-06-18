#!/usr/bin/env bash
set -euo pipefail

screen -S simple-agent-api -X quit >/dev/null 2>&1 || true
screen -S simple-agent-web -X quit >/dev/null 2>&1 || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT_DIR/scripts/simple_agent_stop.sh" >/dev/null 2>&1 || true

echo "Stopped simple-agent screen services"
