#!/bin/bash
# Started at login by launchd (com.kongboda.collector). Updates the code when idle, then
# runs host_runner.py; restarts it if it exits. Usage: run-mac.sh [ROOT] [--probe]
ROOT="${1:-$HOME/Library/Application Support/Kongboda}"
PY="$ROOT/venv/bin/python"
LOG="$ROOT/data/host.log"
export PYTHONUNBUFFERED=1 HOST_ENV_FILE="$ROOT/host.env"
mkdir -p "$ROOT/data"
if [ "${2:-}" = "--probe" ]; then PROBE=1 exec "$PY" "$ROOT/collector/host_runner.py"; fi
while true; do
  /bin/bash "$ROOT/collector/host/update-mac.sh" "$ROOT" >>"$LOG" 2>&1 || true
  # Keep the log small: past 5 MB the old log becomes host.log.1 (one generation kept).
  if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 5242880 ]; then mv -f "$LOG" "$LOG.1"; fi
  "$PY" "$ROOT/collector/host_runner.py" >>"$LOG" 2>&1
  sleep "${KONGBODA_RESTART_DELAY:-30}"
  [ "${KONGBODA_RUN_ONCE:-}" = 1 ] && break
done
