#!/usr/bin/env bash
set -euo pipefail

USER_ID="$(id -u)"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
API_PLIST="$LAUNCH_DIR/com.contentwork.simple-agent-api.plist"
WEB_PLIST="$LAUNCH_DIR/com.contentwork.simple-agent-web.plist"

launchctl bootout "gui/$USER_ID" "$API_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$USER_ID" "$WEB_PLIST" >/dev/null 2>&1 || true

echo "Stopped simple-agent LaunchAgents"
