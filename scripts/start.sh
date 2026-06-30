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
BACKEND_PID_FILE="${MIND_WIKI_BACKEND_PID_FILE:-$RUN_DIR/backend.pid}"
BACKEND_LOG_FILE="${MIND_WIKI_BACKEND_LOG_FILE:-$RUN_DIR/backend.log}"
STOP_TIMEOUT_SECONDS="${MIND_WIKI_STOP_TIMEOUT_SECONDS:-10}"
PORT="${PORT:-3000}"
SITE_URL="${MIND_WIKI_SITE_URL:-http://127.0.0.1:${PORT}}"
BACKEND_URL="http://127.0.0.1:8001"

is_running_pid() {
  local pid="${1:-}"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

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

reset_service() {
  local label="$1"
  local pid_file="$2"
  local pid

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  pid="$(cat "$pid_file")"
  if is_running_pid "$pid"; then
    echo "Resetting $label from partial state (pid $pid)..."
    stop_pid_tree "$pid" "$STOP_TIMEOUT_SECONDS" "$label"
  else
    echo "Removing stale $label PID file at $pid_file."
  fi

  rm -f "$pid_file"
}

mkdir -p "$RUN_DIR"

site_pid=""
backend_pid=""
site_running=0
backend_running=0

if [[ -f "$PID_FILE" ]]; then
  site_pid="$(cat "$PID_FILE")"
  if is_running_pid "$site_pid"; then
    site_running=1
  fi
fi

if [[ -f "$BACKEND_PID_FILE" ]]; then
  backend_pid="$(cat "$BACKEND_PID_FILE")"
  if is_running_pid "$backend_pid"; then
    backend_running=1
  fi
fi

if [[ "$site_running" -eq 1 && "$backend_running" -eq 1 ]]; then
  echo "Local app stack is already running."
  echo "Site: $SITE_URL (pid $site_pid)"
  echo "Site log: $LOG_FILE"
  echo "Backend: $BACKEND_URL (pid $backend_pid)"
  echo "Backend log: $BACKEND_LOG_FILE"
  exit 0
fi

if [[ "$site_running" -eq 1 || "$backend_running" -eq 1 || -f "$PID_FILE" || -f "$BACKEND_PID_FILE" ]]; then
  echo "Detected partial local app state. Resetting managed services before start."
  reset_service "website" "$PID_FILE"
  reset_service "local backend" "$BACKEND_PID_FILE"
fi

cd "$ROOT_DIR"

echo "Starting local backend at $BACKEND_URL..."
nohup pnpm dev:backend >"$BACKEND_LOG_FILE" 2>&1 &
backend_pid="$!"
printf '%s\n' "$backend_pid" >"$BACKEND_PID_FILE"

sleep 2
if ! is_running_pid "$backend_pid"; then
  echo "Local backend failed to start. Last log lines:"
  tail -n 40 "$BACKEND_LOG_FILE" || true
  rm -f "$BACKEND_PID_FILE"
  exit 1
fi

echo "Starting site at $SITE_URL..."
nohup env PORT="$PORT" pnpm dev:site >"$LOG_FILE" 2>&1 &
site_pid="$!"
printf '%s\n' "$site_pid" >"$PID_FILE"

sleep 2
if ! is_running_pid "$site_pid"; then
  echo "Site failed to start. Last log lines:"
  tail -n 40 "$LOG_FILE" || true
  rm -f "$PID_FILE"

  echo "Stopping local backend because the site did not start."
  stop_pid_tree "$backend_pid" "$STOP_TIMEOUT_SECONDS" "Local backend"
  rm -f "$BACKEND_PID_FILE"
  echo "Backend log: $BACKEND_LOG_FILE"
  exit 1
fi

echo "Local app stack started."
echo "Site: $SITE_URL (pid $site_pid)"
echo "Site log: $LOG_FILE"
echo "Backend: $BACKEND_URL (pid $backend_pid)"
echo "Backend log: $BACKEND_LOG_FILE"
