#!/bin/bash
# Retire disabled MCPs and old duplicate launcher groups without killing clients.

set -u
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/memory-process-lib.sh"

mode=dry-run
force=0
min_age_hours=24
keep_per_kind=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) mode=dry-run; shift ;;
    --kill) mode=kill; shift ;;
    --force) force=1; shift ;;
    --min-age-hours)
      [ "$#" -ge 2 ] || { echo "Missing value for --min-age-hours" >&2; exit 2; }
      min_age_hours="$2"; shift 2 ;;
    --keep-per-kind)
      [ "$#" -ge 2 ] || { echo "Missing value for --keep-per-kind" >&2; exit 2; }
      keep_per_kind="$2"; shift 2 ;;
    *)
      echo "Usage: $0 [--dry-run | --kill] [--force] [--min-age-hours HOURS] [--keep-per-kind COUNT]" >&2
      exit 2
      ;;
  esac
done

case "$min_age_hours:$keep_per_kind" in
  *[!0-9:]*) echo "Age and keep count must be non-negative integers" >&2; exit 2 ;;
esac
[ "$force" -eq 0 ] || [ "$mode" = kill ] || { echo "--force requires --kill" >&2; exit 2; }

current_user=$(id -un)
own_pgid=$(process_value pgid $$)
min_age_seconds=$((min_age_hours * 3600))
rows_file=$(mktemp -t memory-mcp-rows.XXXXXX)
targets_file=$(mktemp -t memory-mcp-targets.XXXXXX)
trap 'rm -f "$rows_file" "$targets_file"' EXIT

"$PS" -axo pid=,ppid=,pgid=,user=,etime=,command= 2>/dev/null | /usr/bin/awk '
  function seconds(value, d, main, n, p) {
    d=0; main=value
    if (index(value, "-")) { split(value, p, "-"); d=p[1]; main=p[2] }
    n=split(main, p, ":")
    if (n == 3) return d*86400 + p[1]*3600 + p[2]*60 + p[3]
    return d*86400 + p[1]*60 + p[2]
  }
  {
    pid=$1; parent=$2; pgid=$3; user=$4; elapsed=$5
    command=$6; for (i=7; i<=NF; i++) command=command " " $i
    kind=""
    if (command ~ /^npm exec prisma mcp([[:space:]]|$)/) kind="prisma"
    else if (command ~ /^npm exec @growthbook\/mcp/) kind="growthbook"
    else if (command ~ /^npm exec @notionhq\/notion-mcp-server/) kind="notion"
    else if (command ~ /^npm exec @playwright\/mcp/) kind="playwright"
    else if (command ~ /(^|\/)argent mcp([[:space:]]|$)/) kind="argent"
    if (kind != "") printf "%s\t%s\t%012d\t%s\t%s\t%s\t%s\t%s\n", parent, kind, seconds(elapsed), pid, pgid, user, elapsed, command
  }
' | sort -t $'\t' -k1,1n -k2,2 -k3,3n > "$rows_file"

printf "PARENT\tKIND\tPID\tPGID\tELAPSED\tCLASS\tCOMMAND\n"
last_key=""
seen=0
while IFS=$'\t' read -r parent kind age pid pgid user elapsed command; do
  [ -n "$pid" ] || continue
  key="$parent:$kind"
  if [ "$key" != "$last_key" ]; then
    last_key="$key"
    seen=0
  fi

  class=NEWEST_PRESERVED
  if [ "$kind" = prisma ] || [ "$kind" = growthbook ] || [ "$kind" = playwright ]; then
    class=RETIRED_MCP_CANDIDATE
  elif [ "$parent" = 1 ] && [ "$age" -ge "$min_age_seconds" ]; then
    class=ORPHAN_CANDIDATE
  elif [ "$seen" -ge "$keep_per_kind" ] && [ "$age" -ge "$min_age_seconds" ]; then
    class=DUPLICATE_CANDIDATE
  elif [ "$seen" -ge "$keep_per_kind" ]; then
    class=DUPLICATE_TOO_RECENT
  fi
  seen=$((seen + 1))

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$parent" "$kind" "$pid" "$pgid" "$elapsed" "$class" "$command"

  case "$class" in RETIRED_MCP_CANDIDATE|ORPHAN_CANDIDATE|DUPLICATE_CANDIDATE) ;; *) continue ;; esac
  [ "$user" = "$current_user" ] || continue
  [ -n "$pgid" ] && [ "$pgid" != "$own_pgid" ] || continue
  printf "%s\t%s\n" "$pid" "$pgid" >> "$targets_file"
done < "$rows_file"

if [ "$mode" = dry-run ]; then
  echo "Dry run: no MCP groups were stopped."
  exit 0
fi

while IFS=$'\t' read -r pid pgid; do
  [ -n "$pid" ] || continue
  group_users=$("$PS" -axo pgid=,user= 2>/dev/null | /usr/bin/awk -v group="$pgid" '$1 == group {print $2}' | sort -u)
  [ "$group_users" = "$current_user" ] || { echo "Preserved PGID $pgid: foreign or mixed owner"; continue; }
  echo "Sending SIGTERM to MCP PGID $pgid (launcher $pid)"
  /bin/kill -TERM -- "-$pgid" 2>/dev/null || true
done < "$targets_file"

sleep 2
if [ "$force" -eq 1 ]; then
  while IFS=$'\t' read -r pid pgid; do
    [ -n "$pid" ] || continue
    if /bin/kill -0 "$pid" 2>/dev/null; then
      echo "Sending SIGKILL to MCP PGID $pgid"
      /bin/kill -KILL -- "-$pgid" 2>/dev/null || true
    fi
  done < "$targets_file"
fi
