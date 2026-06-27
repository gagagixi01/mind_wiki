#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_KEY="$(printf '%s' "$ROOT_DIR" | cksum | awk '{print $1}')"
RUN_BASE="${TMPDIR:-/tmp}"
DEFAULT_RUN_DIR="${RUN_BASE%/}/mind-wiki-site-${ROOT_KEY}"
RUN_DIR="${MIND_WIKI_RUN_DIR:-$DEFAULT_RUN_DIR}"
PID_FILE="${MIND_WIKI_PID_FILE:-$RUN_DIR/site.pid}"
LOG_FILE="${MIND_WIKI_LOG_FILE:-$RUN_DIR/site.log}"
PORT="${PORT:-3000}"
SITE_URL="${MIND_WIKI_SITE_URL:-http://127.0.0.1:${PORT}}"

mkdir -p "$RUN_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if [[ "$EXISTING_PID" =~ ^[0-9]+$ ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Website is already running at $SITE_URL (pid $EXISTING_PID)."
    echo "Log: $LOG_FILE"
    exit 0
  fi

  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"
echo "Starting website at $SITE_URL..."
nohup env PORT="$PORT" pnpm dev:site >"$LOG_FILE" 2>&1 &
PID="$!"
printf '%s\n' "$PID" >"$PID_FILE"

sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Website failed to start. Last log lines:"
  tail -n 40 "$LOG_FILE" || true
  rm -f "$PID_FILE"
  exit 1
fi

echo "Website started at $SITE_URL (pid $PID)."
echo "Log: $LOG_FILE"
