#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_KEY="$(printf '%s' "$ROOT_DIR" | cksum | awk '{print $1}')"
RUN_BASE="${TMPDIR:-/tmp}"
DEFAULT_RUN_DIR="${RUN_BASE%/}/mind-wiki-site-${ROOT_KEY}"
RUN_DIR="${MIND_WIKI_RUN_DIR:-$DEFAULT_RUN_DIR}"
PID_FILE="${MIND_WIKI_PID_FILE:-$RUN_DIR/site.pid}"
BACKEND_PID_FILE="${MIND_WIKI_BACKEND_PID_FILE:-$RUN_DIR/backend.pid}"
STOP_TIMEOUT_SECONDS="${MIND_WIKI_STOP_TIMEOUT_SECONDS:-10}"

terminate_tree() {
  local pid="$1"
  local child

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    terminate_tree "$child"
  done

  kill -TERM "$pid" 2>/dev/null || true
}

stop_pid_tree() {
  local pid="$1"
  local timeout_seconds="$2"
  local label="$3"
  local elapsed

  terminate_tree "$pid"

  for ((elapsed = 0; elapsed < timeout_seconds; elapsed += 1)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "$label did not stop after ${timeout_seconds}s; forcing shutdown."
  kill -KILL "$pid" 2>/dev/null || true
}

stop_service() {
  local label="$1"
  local pid_file="$2"
  local pid

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  pid="$(cat "$pid_file")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    echo "Removing invalid $label PID file at $pid_file."
    rm -f "$pid_file"
    return 1
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$label process $pid is not running. Removing stale PID file."
    rm -f "$pid_file"
    return 1
  fi

  echo "Stopping $label (pid $pid)..."
  stop_pid_tree "$pid" "$STOP_TIMEOUT_SECONDS" "$label"
  rm -f "$pid_file"
  echo "$label stopped."
  return 0
}

stopped_any=0

if stop_service "website" "$PID_FILE"; then
  stopped_any=1
fi

if stop_service "local backend" "$BACKEND_PID_FILE"; then
  stopped_any=1
fi

if [[ "$stopped_any" -eq 0 ]]; then
  echo "Local app stack is not running."
fi
