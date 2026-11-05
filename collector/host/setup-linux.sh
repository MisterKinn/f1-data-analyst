#!/bin/bash
# Kongboda collector host setup for Linux servers, e.g. an Oracle Cloud Ubuntu VM (run once; safe to run again).
#   curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-linux.sh | bash -s -- oracle-seoul
# Installs into ~/kongboda, creates this server's upload key, starts the collector at boot
# (systemd, restarts on crash) and checks whether F1 lets this network in. F1 refuses some
# cloud networks before sign-in (403); such a host still runs, but the site uses it only
# when no other host is left. Crew servers use the owner's shared F1 login (press Enter).
set -euo pipefail
ROOT="${KONGBODA_ROOT:-$HOME/kongboda}"
CODE="$ROOT/collector"; DATA="$ROOT/data"; ENVF="$ROOT/host.env"
ZIP_URL="${KONGBODA_ZIP_URL:-https://codeload.github.com/MisterKinn/f1-data-analyst/zip/refs/heads/main}"
SERVICE=/etc/systemd/system/kongboda-collector.service
RAW_NAME="${1:-$(hostname -s)}"
NAME=$(printf '%s' "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)
[ -n "$NAME" ] || NAME="linux-$(date +%s)"
SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"
mkdir -p "$ROOT" "$DATA"

echo '[1/6] System packages (Python 3.12+, venv, unzip, rsync)'
if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update -qq
  $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv python3-pip unzip rsync curl ca-certificates >/dev/null
elif command -v dnf >/dev/null 2>&1; then
  $SUDO dnf install -y -q python3.12 python3.12-pip unzip rsync curl ca-certificates || $SUDO dnf install -y -q python3 python3-pip unzip rsync curl
fi
PY=""
for c in python3.13 python3.12 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)' 2>/dev/null; then PY=$(command -v "$c"); break; fi
done
[ -n "$PY" ] || { echo 'Python 3.12 or newer is needed (Ubuntu 24.04 has it).'; exit 1; }
echo "Using $PY on $(uname -m)"

echo '[2/6] Collector code (GitHub main)'
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$ZIP_URL" -o "$TMP/main.zip"
unzip -q "$TMP/main.zip" -d "$TMP"
SRC=$(find "$TMP" -maxdepth 2 -type d -name collector | head -n 1)
[ -f "$SRC/host_runner.py" ] || { echo 'Downloaded code has no host_runner.py'; exit 1; }
mkdir -p "$CODE"
rsync -a --delete "$SRC/" "$CODE/"
MANIFEST="$(dirname "$SRC")/collector-release.json"
[ -f "$MANIFEST" ] && cp "$MANIFEST" "$DATA/release.json"
[ -x "$ROOT/venv/bin/python" ] || "$PY" -m venv "$ROOT/venv"
"$ROOT/venv/bin/python" -m pip install --upgrade pip -q
"$ROOT/venv/bin/python" -m pip install -q fastf1==3.9.0 signalrcore==1.0.2 certifi keyring

echo '[3/6] F1 account'
umask 077
if [ ! -f "$ENVF" ]; then
  printf '%s\n' "HOST_NAME=$NAME" "DATA_DIR=$DATA" "HOST_KEY_FILE=$ROOT/host-key.pem" > "$ENVF"
fi
chmod 600 "$ENVF"
if ! grep -q '^F1_USERNAME=.' "$ENVF" && [ -r /dev/tty ]; then
  echo 'Kongboda crew / owner server: just press Enter (uses the shared F1 login). Not crew: type your F1 TV account.'
  read -r -p 'F1 account email (crew: Enter): ' F1_USER </dev/tty || F1_USER=''
  if [ -n "$F1_USER" ]; then
    read -r -s -p 'F1 account password: ' F1_PASS </dev/tty; echo
    KEPT=$(grep -v -E '^F1_(USERNAME|PASSWORD)=' "$ENVF" || true)
    printf '%s\n' "F1_USERNAME=$F1_USER" "F1_PASSWORD=$F1_PASS" "$KEPT" > "$ENVF"
  fi
fi

echo '[4/6] Upload key'
"$ROOT/venv/bin/python" "$CODE/host_auth.py" keygen --name "$(sed -n 's/^HOST_NAME=//p' "$ENVF")" --out "$ROOT/host-key.pem"
chmod 600 "$ROOT/host-key.pem"

echo '[5/6] F1 network check (no password or token is sent)'
RESULT=$(cd "$CODE" && HOST_ENV_FILE="$ENVF" PROBE=1 "$ROOT/venv/bin/python" host_runner.py 2>/dev/null | tail -n 1 || true)
CODE_NO_TOKEN=$(printf '%s' "$RESULT" | "$ROOT/venv/bin/python" -c 'import json,sys
try: print(json.loads(sys.stdin.read())["archive_index"]["no_token"][0])
except Exception: print("unknown")')
case "$CODE_NO_TOKEN" in
  401|200) echo "F1 answers this network ($CODE_NO_TOKEN): it can collect." ;;
  403) echo 'F1 REFUSES this network (403 before sign-in). The collector still runs, but the site uses it only when no other host is left.' ;;
  *) echo "Could not tell ($CODE_NO_TOKEN). The collector checks again on its own every few hours." ;;
esac

echo '[6/6] Start at boot (systemd)'
$SUDO tee "$SERVICE" >/dev/null <<UNIT
[Unit]
Description=Kongboda collector host
After=network-online.target
Wants=network-online.target

[Service]
User=$(id -un)
ExecStart=/bin/bash $CODE/host/run-mac.sh $ROOT
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
UNIT
if [ "${KONGBODA_SKIP_SYSTEMD:-}" != 1 ]; then
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable --now kongboda-collector >/dev/null
  $SUDO systemctl restart kongboda-collector
fi
echo ''
HOST="$(sed -n 's/^HOST_NAME=//p' "$ENVF")"
echo "Done. This server is '$HOST'."
for _ in $(seq 1 30); do
  LINK=$(grep -o 'https://[^ ]*host_link=[A-Z0-9-]*' "$DATA/host.log" 2>/dev/null | tail -n 1 || true)
  [ -n "$LINK" ] && break
  grep -q '계정 연결 완료' "$DATA/host.log" 2>/dev/null && break
  sleep 2
done
if [ -n "${LINK:-}" ]; then
  echo "Link it to your Kongboda account (open on any device, sign in with Google): $LINK"
  echo 'Then move it to the top in Account settings > Collector hosts if it should be first.'
fi
echo "Logs: $DATA/host.log   Status: systemctl status kongboda-collector"
