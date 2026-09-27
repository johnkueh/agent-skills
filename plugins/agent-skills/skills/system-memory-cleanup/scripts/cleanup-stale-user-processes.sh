#!/bin/bash
# Find known detached helper classes and optionally stop exact stale PIDs.

set -u
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/memory-process-lib.sh"

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
      min_age_hours="$2"; shift 2 ;;
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
min_age_seconds=$((min_age_hours * 3600))
current_app_version=$(readlink \
  '/Applications/ChatGPT.app/Contents/Frameworks/Codex Framework.framework/Versions/Current' \
  2>/dev/null || true)
printf "PID\tPPID\tPGID\tELAPSED\tRSS(MiB)\tCLASS\tCOMMAND\n"

"$PS" -axo pid=,ppid=,pgid=,user=,etime=,rss=,command= 2>/dev/null |
while read -r pid ppid pgid user elapsed rss command; do
  [ "$user" = "$current_user" ] || continue
  [ "$ppid" = 1 ] || continue

  full_command=$(process_value command "$pid")
  class=""
  case "$full_command" in
    *"/cua_node/bin/node"*"kernel.js"*) class=DETACHED_CHATGPT_KERNEL ;;
    *agent-browser*"agent-browser-"*) class=AGENT_BROWSER_DAEMON ;;
    *probe_provider_windows.js*) class=PROVIDER_PROBE ;;
    *" -m http.server "*) class=TEMP_HTTP_SERVER ;;
    *"qlmanage -t "*) class=QUICKLOOK_JOB ;;
    *browser_crashpad_handler*)
      helper_version=$(printf '%s\n' "$full_command" | sed -n 's#.*Versions/\([^/]*\)/Helpers/.*#\1#p')
      if [ -n "$current_app_version" ] && [ "$helper_version" = "$current_app_version" ]; then
        class=""
      else
        class=OLD_CRASHPAD_HANDLER
      fi
      ;;
    *detached-flush.js*) class=NEXT_TELEMETRY_FLUSH ;;
    *"node_repl"*) class=DETACHED_CODE_REPL ;;
    *"/argent"*" mcp"*) class=DETACHED_ARGENT_MCP ;;
    *tool-server.cjs*" start"*) class=DETACHED_ARGENT_SERVER ;;
    *"until grep"*) class=POLLING_SHELL ;;
  esac
  [ -n "$class" ] || continue

  age=$(age_seconds "$elapsed")
  status=TOO_RECENT
  [ "$age" -lt "$min_age_seconds" ] || status="$class"
  printf "%s\t%s\t%s\t%s\t%.1f\t%s\t%s\n" \
    "$pid" "$ppid" "$pgid" "$elapsed" "$((rss / 1024))" "$status" "$full_command"

  [ "$status" = "$class" ] || continue
  [ "$mode" = kill ] || continue
  if /bin/kill -TERM "$pid" 2>/dev/null; then
    echo "Sent SIGTERM to $class PID $pid"
    sleep 1
    if /bin/kill -0 "$pid" 2>/dev/null && [ "$force" -eq 1 ]; then
      /bin/kill -KILL "$pid" 2>/dev/null && echo "Sent SIGKILL to PID $pid"
    fi
  fi
done

if [ "$mode" = dry-run ]; then
  echo "Dry run: no detached helpers were stopped."
fi
