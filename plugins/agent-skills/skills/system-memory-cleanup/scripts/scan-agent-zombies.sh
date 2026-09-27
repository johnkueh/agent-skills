#!/bin/bash
# Scan (and optionally kill) orphan AI-agent runtime processes.
# Pattern vocabulary inspired by z-clean (MIT) + house MCP/helpers lists.
# Dry-run unless --kill. Never touches protected ancestors or foreign owners.

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
own_pgid=$(process_value pgid $$)
min_age_seconds=$((min_age_hours * 3600))
# Strong agent patterns may use a shorter orphan floor (1h) — still never active sessions.
short_age_seconds=3600
targets_file=$(mktemp -t memclean-zombies.XXXXXX)
trap 'rm -f "$targets_file"' EXIT

printf "PID\tPPID\tPGID\tELAPSED\tRSS(MiB)\tCLASS\tAGE_OK\tSESSION\tCOMMAND\n"

classify_command() {
  local cmd="$1"
  # Strong provider patterns
  case "$cmd" in
    *mcp-server*|*mcp-remote*|*@modelcontextprotocol/*) echo MCP_SERVER; return ;;
    *agent-browser*|*chrome-headless-shell*) echo AGENT_BROWSER; return ;;
    *playwright*driver*|*playwright*mcp*) echo PLAYWRIGHT; return ;;
    *claude*--print*|*claude*--session-id*) echo CLAUDE_SUBAGENT; return ;;
    *codex\ exec*|*codex-sandbox*) echo CODEX_ORPHAN; return ;;
    *grok*-p\ *|*/grok\ *|*\ grok\ -p*) echo GROK_ORPHAN; return ;;
  esac
  # Generic AI-path node helpers (stricter age). Skip ChatGPT/Codex.app sandbox hosts.
  case "$cmd" in
    *ChatGPT.app*|*Codex.app*|*cua_node*) echo ""; return ;;
    *npm\ exec*mcp*|*npx\ *mcp*) echo NPM_MCP; return ;;
    *"/.claude/"*|*"/.codex/"*|*"/.cursor/"*|*"/.grok/"*|*"/.windsurf/"*)
      case "$cmd" in
        *node*|*tsx*|*bun*|*deno*) echo AI_PATH_RUNTIME; return ;;
      esac
      ;;
  esac
  echo ""
}

# Process substitution keeps the loop in this shell so targets_file is filled.
while read -r pid ppid pgid user elapsed rss command; do
  [ "$user" = "$current_user" ] || continue
  [ -n "$pid" ] || continue
  [ "$pgid" != "$own_pgid" ] || continue

  full_command=$(process_value command "$pid")
  [ -n "$full_command" ] || full_command=$command
  class=$(classify_command "$full_command")
  [ -n "$class" ] || continue

  age=$(age_seconds "$elapsed")
  rss_mib=$(( ${rss:-0} / 1024 ))

  need_age=$short_age_seconds
  case "$class" in
    AI_PATH_RUNTIME|NPM_MCP) need_age=$min_age_seconds ;;
  esac

  age_ok=no
  [ "$age" -ge "$need_age" ] && age_ok=yes

  session=detached
  if has_live_session "$pid"; then
    session=live
  fi

  eligible=no
  if [ "$ppid" = 1 ] && [ "$session" = detached ] && [ "$age_ok" = yes ]; then
    eligible=yes
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$pid" "$ppid" "$pgid" "$elapsed" "$rss_mib" "$class" "$age_ok" "$session" "$full_command"

  if [ "$eligible" = yes ]; then
    printf "%s\t%s\t%s\n" "$pid" "$pgid" "$full_command" >> "$targets_file"
  fi
done < <("$PS" -axo pid=,ppid=,pgid=,user=,etime=,rss=,command= 2>/dev/null)

if [ "$mode" = dry-run ]; then
  echo "Dry run: no agent zombies were stopped. Eligible rows are PPID=1 + detached + age floor."
  exit 0
fi

# Descendants of a root (Chrome under agent-browser often uses a new PGID).
descendant_pids() {
  local root="$1"
  "$PS" -axo pid=,ppid= 2>/dev/null | /usr/bin/awk -v root="$root" '
    { pid=$1; ppid=$2; children[ppid]=children[ppid] " " pid }
    END {
      queue=root; n=1
      while (n > 0) {
        split(queue, q, " ")
        queue=""; n=0
        for (i in q) {
          p=q[i]
          if (p == "" || seen[p]) continue
          seen[p]=1
          print p
          split(children[p], kids, " ")
          for (j in kids) {
            if (kids[j] != "") { queue=queue " " kids[j]; n++ }
          }
        }
      }
    }'
}

signal_tree() {
  local sig="$1" root="$2" pgid="$3"
  /bin/kill "-$sig" -- "-$pgid" 2>/dev/null || true
  /bin/kill "-$sig" "$root" 2>/dev/null || true
  local child
  for child in $(descendant_pids "$root"); do
    [ "$child" = "$root" ] && continue
    /bin/kill "-$sig" "$child" 2>/dev/null || true
  done
}

while IFS=$'\t' read -r pid pgid cmd; do
  [ -n "$pid" ] || continue
  now_cmd=$(process_value command "$pid")
  [ -n "$now_cmd" ] || { echo "Skip $pid: gone before kill"; continue; }
  if [ "$now_cmd" != "$cmd" ]; then
    echo "Skip $pid: command changed (PID reuse guard)"
    continue
  fi
  if has_live_session "$pid"; then
    echo "Skip $pid: session became live"
    continue
  fi
  group_users=$("$PS" -axo pgid=,user= 2>/dev/null | /usr/bin/awk -v group="$pgid" '$1 == group {print $2}' | sort -u)
  if [ -n "$group_users" ] && [ "$group_users" != "$current_user" ]; then
    echo "Preserved PGID $pgid: foreign or mixed owner"
    continue
  fi
  echo "Sending SIGTERM to zombie tree root $pid (pgid $pgid)"
  signal_tree TERM "$pid" "$pgid"
done < "$targets_file"

sleep 2
if [ "$force" -eq 1 ]; then
  while IFS=$'\t' read -r pid pgid cmd; do
    [ -n "$pid" ] || continue
    if /bin/kill -0 "$pid" 2>/dev/null; then
      now_cmd=$(process_value command "$pid")
      [ "$now_cmd" = "$cmd" ] || continue
      echo "Sending SIGKILL to zombie tree root $pid"
      signal_tree KILL "$pid" "$pgid"
    fi
  done < "$targets_file"
fi
