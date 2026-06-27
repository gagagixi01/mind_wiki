#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_KEY="$(printf '%s' "$ROOT_DIR" | cksum | awk '{print $1}')"
RUN_BASE="${TMPDIR:-/tmp}"
DEFAULT_RUN_DIR="${RUN_BASE%/}/mind-wiki-site-${ROOT_KEY}"
RUN_DIR="${MIND_WIKI_RUN_DIR:-$DEFAULT_RUN_DIR}"
PID_FILE="${MIND_WIKI_PID_FILE:-$RUN_DIR/site.pid}"
STOP_TIMEOUT_SECONDS="${MIND_WIKI_STOP_TIMEOUT_SECONDS:-10}"

terminate_tree() {
  local pid="$1"
  local child

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    terminate_tree "$child"
  done

  kill -TERM "$pid" 2>/dev/null || true
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "Website is not running (no PID file at $PID_FILE)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [[ ! "$PID" =~ ^[0-9]+$ ]]; then
  echo "Removing invalid PID file at $PID_FILE."
  rm -f "$PID_FILE"
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Website process $PID is not running. Removing stale PID file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping website (pid $PID)..."
terminate_tree "$PID"

for ((elapsed = 0; elapsed < STOP_TIMEOUT_SECONDS; elapsed += 1)); do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Website stopped."
    exit 0
  fi
  sleep 1
done

echo "Website did not stop after ${STOP_TIMEOUT_SECONDS}s; forcing shutdown."
kill -KILL "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "Website stopped."
