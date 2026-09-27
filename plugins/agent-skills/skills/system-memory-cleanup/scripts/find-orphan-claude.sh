#!/bin/bash
# Classify Claude CLI processes without killing anything.

set -u
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/claude-process-lib.sh"

printf "PID\tPPID\tPGID\tTTY\tOWNER\tSTATE\tCPU%%\tRSS(MiB)\tELAPSED\tCLASS\tCOMMAND\n"

pids=$(list_claude_pids)
if [ -z "$pids" ]; then
  echo "No claude processes found."
  exit 0
fi

current_user=$(id -un)
for pid in $pids; do
  user=$(process_value user "$pid")
  ppid=$(process_value ppid "$pid")
  pgid=$(process_value pgid "$pid")
  tty=$(process_value tty "$pid")
  state=$(process_value state "$pid")
  cpu=$(process_value %cpu "$pid")
  rss=$(process_value rss "$pid")
  elapsed=$(process_value etime "$pid")
  command=$(process_value command "$pid")
  class=ORPHAN_CANDIDATE
  if [ "$user" != "$current_user" ]; then
    class=FOREIGN
  elif has_live_session "$pid"; then
    class=ACTIVE_SESSION
  fi
  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%.1f\t%s\t%s\t%s\n" \
    "$pid" "$ppid" "$pgid" "$tty" "$user" "$state" "$cpu" \
    "$((rss / 1024))" "$elapsed" "$class" "$command"
done
