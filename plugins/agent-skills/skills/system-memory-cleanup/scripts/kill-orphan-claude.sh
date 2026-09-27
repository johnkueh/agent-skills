#!/bin/bash
# Stop stale, detached Claude CLI processes. Dry-run unless --kill is supplied.

set -u
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/claude-process-lib.sh"

mode=dry-run
force=0
min_age_hours=24
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) mode=dry-run; shift ;;
    --kill) mode=kill; shift ;;
    --force) force=1; shift ;;
    --min-age-hours)
      [ "$#" -ge 2 ] || { echo "Missing value for --min-age-hours" >&2; exit 2; }
      min_age_hours="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--dry-run | --kill] [--force] [--min-age-hours HOURS]" >&2
      exit 2
      ;;
  esac
done

case "$min_age_hours" in
  ''|*[!0-9]*) echo "Age must be a non-negative integer" >&2; exit 2 ;;
esac
[ "$force" -eq 0 ] || [ "$mode" = kill ] || { echo "--force requires --kill" >&2; exit 2; }

current_user=$(id -un)
own_pgid=$("$PS" -o pgid= -p $$ 2>/dev/null | tr -d ' ')
min_age_seconds=$((min_age_hours * 3600))
pids=$(list_claude_pids)

if [ -z "$pids" ]; then
  echo "No claude processes found."
  exit 0
fi

for pid in $pids; do
  user=$(process_value user "$pid")
  [ "$user" = "$current_user" ] || { echo "Preserved $pid: foreign owner ($user)"; continue; }
  if has_live_session "$pid"; then
    echo "Preserved $pid: attached to a live terminal/session"
    continue
  fi

  elapsed=$(process_value etime "$pid")
  age=$(age_seconds "$elapsed")
  if [ "$age" -lt "$min_age_seconds" ]; then
    echo "Preserved $pid: detached but only $elapsed old (minimum ${min_age_hours}h)"
    continue
  fi

  pgid=$(process_value pgid "$pid")
  if [ -z "$pgid" ] || [ "$pgid" = "$own_pgid" ]; then
    echo "Preserved $pid: unsafe process group ($pgid)"
    continue
  fi

  echo "Candidate $pid: detached, $elapsed old, PGID $pgid"
  if [ "$mode" = dry-run ]; then
    continue
  fi

  if /bin/kill -TERM "$pid" 2>/dev/null; then
    echo "Sent SIGTERM to $pid"
  else
    echo "Could not signal $pid"
    continue
  fi
  sleep 1
  if /bin/kill -0 "$pid" 2>/dev/null && [ "$force" -eq 1 ]; then
    /bin/kill -KILL "$pid" 2>/dev/null && echo "Sent SIGKILL to $pid"
  fi
done
