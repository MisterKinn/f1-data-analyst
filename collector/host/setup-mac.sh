#!/bin/bash
# Kongboda collector host setup for macOS (run once; safe to run again).
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-mac.sh)"
# Installs into ~/Library/Application Support/Kongboda, asks for the F1 login (typed only
# here), creates this Mac's upload key, keeps the Mac awake on the charger and starts the
# collector at login (launchd). The collector registers itself on the site; the owner
# approves it in Account settings.
set -euo pipefail
ROOT="${KONGBODA_ROOT:-$HOME/Library/Application Support/Kongboda}"
CODE="$ROOT/collector"; DATA="$ROOT/data"; ENVF="$ROOT/host.env"
ZIP_URL="${KONGBODA_ZIP_URL:-https://codeload.github.com/MisterKinn/f1-data-analyst/zip/refs/heads/main}"
PY_PKG="https://www.python.org/ftp/python/3.12.10/python-3.12.10-macos11.pkg"
AGENT="$HOME/Library/LaunchAgents/com.kongboda.collector.plist"
RAW_NAME="${1:-$(scutil --get LocalHostName 2>/dev/null || hostname -s)}"
NAME=$(printf '%s' "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)
[ -n "$NAME" ] || NAME="mac-$(date +%s)"
mkdir -p "$ROOT" "$DATA"

echo '[1/6] Python 3.12+'
find_python() {
  local c
  for c in python3.13 python3.12 /opt/homebrew/bin/python3 /usr/local/bin/python3 \
           /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
           /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 python3; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)' 2>/dev/null; then
      command -v "$c"; return 0
    fi
  done
  return 1
}
PY=$(find_python || true)
if [ -z "$PY" ]; then
  if command -v brew >/dev/null 2>&1; then
    echo 'Installing Python 3.12 with Homebrew...'
    brew install python@3.12
  else
    echo 'Installing Python 3.12 from python.org (the Mac login password is asked once)...'
    curl -fsSL "$PY_PKG" -o /tmp/kongboda-python.pkg
    sudo installer -pkg /tmp/kongboda-python.pkg -target /
    rm -f /tmp/kongboda-python.pkg
  fi
  PY=$(find_python || true)
  [ -n "$PY" ] || { echo 'Python could not be installed. Install it from https://www.python.org/downloads/macos/ and run setup again.'; exit 1; }
fi
echo "Using $PY"

echo '[2/6] Collector code (GitHub main)'
TMP=$(mktemp -d)
curl -fsSL "$ZIP_URL" -o "$TMP/main.zip"
unzip -q "$TMP/main.zip" -d "$TMP"
SRC=$(find "$TMP" -maxdepth 2 -type d -name collector | head -n 1)
[ -f "$SRC/host_runner.py" ] || { echo 'Downloaded code has no host_runner.py'; exit 1; }
mkdir -p "$CODE"
rsync -a --delete "$SRC/" "$CODE/"
rm -rf "$TMP"
[ -x "$ROOT/venv/bin/python" ] || "$PY" -m venv "$ROOT/venv"
"$ROOT/venv/bin/python" -m pip install --upgrade pip -q
"$ROOT/venv/bin/python" -m pip install -q fastf1==3.9.0 signalrcore==1.0.2 certifi

echo '[3/6] F1 account (typed here only, stored for this Mac user)'
if [ ! -f "$ENVF" ]; then
  read -r -p 'F1 account email: ' F1_USER </dev/tty
  read -r -s -p 'F1 account password: ' F1_PASS </dev/tty; echo
  umask 077
  printf '%s\n' "F1_USERNAME=$F1_USER" "F1_PASSWORD=$F1_PASS" "HOST_NAME=$NAME" "DATA_DIR=$DATA" "HOST_KEY_FILE=$ROOT/host-key.pem" > "$ENVF"
  chmod 600 "$ENVF"
fi

echo '[4/6] Upload key'
"$ROOT/venv/bin/python" "$CODE/host_auth.py" keygen --name "$(sed -n 's/^HOST_NAME=//p' "$ENVF")" --out "$ROOT/host-key.pem"
chmod 600 "$ROOT/host-key.pem"

echo '[5/6] Power: never sleep while on the charger (asks the Mac login password)'
if [ "${KONGBODA_SKIP_POWER:-}" != 1 ]; then
  sudo pmset -c sleep 0 || echo 'Skipped. Set System Settings > Battery > Options > "Prevent automatic sleeping on power adapter" yourself.'
fi

echo '[6/6] Start at login'
mkdir -p "$(dirname "$AGENT")"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
 <key>Label</key><string>com.kongboda.collector</string>
 <key>ProgramArguments</key><array><string>/bin/bash</string><string>$CODE/host/run-mac.sh</string><string>$ROOT</string></array>
 <key>RunAtLoad</key><true/>
 <key>KeepAlive</key><true/>
 <key>ProcessType</key><string>Background</string>
 <key>StandardOutPath</key><string>/dev/null</string>
 <key>StandardErrorPath</key><string>$DATA/launchd.log</string>
</dict></plist>
PLIST
if [ "${KONGBODA_SKIP_LAUNCHD:-}" != 1 ]; then
  launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENT"
fi
echo ''
echo "Done. This Mac is '$(sed -n 's/^HOST_NAME=//p' "$ENVF")'. It asks the site for approval on its first start."
