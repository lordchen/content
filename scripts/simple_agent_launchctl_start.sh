#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_DIR" "$ROOT_DIR/logs" "$ROOT_DIR/run"

USER_ID="$(id -u)"
API_PLIST="$LAUNCH_DIR/com.contentwork.simple-agent-api.plist"
WEB_PLIST="$LAUNCH_DIR/com.contentwork.simple-agent-web.plist"

cat > "$API_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.contentwork.simple-agent-api</string>
  <key>ProgramArguments</key>
  <array>
    <string>$ROOT_DIR/.venv/bin/python</string>
    <string>$ROOT_DIR/scripts/prototype_api_server.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$ROOT_DIR/logs/simple-agent-api.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT_DIR/logs/simple-agent-api.log</string>
</dict>
</plist>
PLIST

cat > "$WEB_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.contentwork.simple-agent-web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>-m</string>
    <string>http.server</string>
    <string>8782</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$ROOT_DIR/logs/simple-agent-web.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT_DIR/logs/simple-agent-web.log</string>
</dict>
</plist>
PLIST

plutil -lint "$API_PLIST" "$WEB_PLIST" >/dev/null

launchctl bootout "gui/$USER_ID" "$API_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$USER_ID" "$WEB_PLIST" >/dev/null 2>&1 || true

if lsof -tiTCP:8771 -sTCP:LISTEN >/dev/null 2>&1 || lsof -tiTCP:8782 -sTCP:LISTEN >/dev/null 2>&1; then
  "$ROOT_DIR/scripts/simple_agent_stop.sh" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$USER_ID" "$API_PLIST"
launchctl bootstrap "gui/$USER_ID" "$WEB_PLIST"
launchctl enable "gui/$USER_ID/com.contentwork.simple-agent-api"
launchctl enable "gui/$USER_ID/com.contentwork.simple-agent-web"

sleep 1
"$ROOT_DIR/scripts/simple_agent_healthcheck.sh"

