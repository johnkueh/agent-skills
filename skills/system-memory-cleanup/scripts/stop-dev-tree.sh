#!/bin/bash
# Stop one exact Next/Portless/Eve development process group.

set -u

PS=/bin/ps
KILL=/bin/kill

usage() {
  echo "Usage: $0 --pid PID [--dry-run | --kill] [--force]" >&2
  exit 2
}

pid=""
mode=dry-run
force=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --pid)
      [ "$#" -ge 2 ] || usage
      pid="$2"
      shift 2
      ;;
    --dry-run)
      mode=dry-run
      shift
      ;;
    --kill)
      mode=kill
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    *)
      usage
      ;;
  esac
done

case "$pid" in
  ''|*[!0-9]*) usage ;;
esac
[ "$force" -eq 0 ] || [ "$mode" = kill ] || usage

current_user=$(id -un)
own_pgid=$("$PS" -o pgid= -p $$ 2>/dev/null | tr -d ' ')
own_session=$("$PS" -o sess= -p $$ 2>/dev/null | tr -d ' ')
target_user=$("$PS" -o user= -p "$pid" 2>/dev/null | tr -d ' ')
pgid=$("$PS" -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
session=$("$PS" -o sess= -p "$pid" 2>/dev/null | tr -d ' ')

[ -n "$target_user" ] || { echo "PID $pid is not running"; exit 1; }
[ "$target_user" = "$current_user" ] || { echo "Refusing non-user-owned PID $pid ($target_user)"; exit 1; }
[ -n "$pgid" ] || { echo "Could not resolve a process group for PID $pid"; exit 1; }
[ "$pgid" != "$own_pgid" ] || { echo "Refusing the current process group"; exit 1; }
if [ -n "$own_session" ] && [ "$own_session" != "0" ] && [ "$session" = "$own_session" ]; then
  echo "Refusing a process in the current session"
  exit 1
fi

group_rows=$("$PS" -axo pid=,ppid=,pgid=,user=,command= 2>/dev/null | /usr/bin/awk -v group="$pgid" '$3 == group {print}')
[ -n "$group_rows" ] || { echo "No members remain in PGID $pgid"; exit 1; }

candidate=0
unsafe=0
while read -r member_pid member_ppid member_pgid member_user member_command; do
  [ -n "${member_pid:-}" ] || continue
  member_line=$("$PS" -o command= -p "$member_pid" 2>/dev/null)
  case "$member_line" in
    *next-server*|*"next dev"*|*"pnpm"*" dev"*|*portless*" dev"*|*local-server-child.js*|*dev-server-process.sh*) candidate=1 ;;
  esac
  case "$member_line" in
    *WindowServer*|*launchd*|*kernel_task*|*Codex.app*|*app-server*|*ChatGPT*|*Terminal.app*|*iTerm.app*) unsafe=1 ;;
  esac
  [ "$member_user" = "$current_user" ] || unsafe=1
done <<< "$group_rows"

[ "$candidate" -eq 1 ] || { echo "Refusing PGID $pgid: no recognized dev-server member"; exit 1; }
[ "$unsafe" -eq 0 ] || { echo "Refusing PGID $pgid: protected or foreign member detected"; exit 1; }

echo "Target PGID: $pgid (requested PID $pid, session $session)"
echo "$group_rows"

if [ "$mode" = dry-run ]; then
  echo "Dry run: no processes were stopped."
  exit 0
fi

echo "Sending SIGTERM to PGID $pgid"
"$KILL" -TERM -- "-$pgid" 2>/dev/null || true
sleep 2

remaining=$("$PS" -axo pid=,pgid=,command= 2>/dev/null | /usr/bin/awk -v group="$pgid" '$2 == group {print $1}')
if [ -z "$remaining" ]; then
  echo "PGID $pgid stopped."
  exit 0
fi

echo "Still running after SIGTERM: $remaining"
if [ "$force" -eq 1 ]; then
  echo "Sending SIGKILL to PGID $pgid"
  "$KILL" -KILL -- "-$pgid" 2>/dev/null || true
  sleep 1
fi

remaining=$("$PS" -axo pid=,pgid= 2>/dev/null | /usr/bin/awk -v group="$pgid" '$2 == group {print $1}')
if [ -n "$remaining" ]; then
  echo "PGID $pgid still has members: $remaining"
  exit 1
fi
echo "PGID $pgid stopped."
