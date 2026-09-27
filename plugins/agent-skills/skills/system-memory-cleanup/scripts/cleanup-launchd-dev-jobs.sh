#!/bin/bash
# Find and optionally unload stale launchd-submitted development jobs.

set -u
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/memory-process-lib.sh"

mode=dry-run
min_age_hours=24
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) mode=dry-run; shift ;;
    --kill) mode=kill; shift ;;
    --min-age-hours)
      [ "$#" -ge 2 ] || { echo "Missing value for --min-age-hours" >&2; exit 2; }
      min_age_hours="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--dry-run | --kill] [--min-age-hours HOURS]" >&2
      exit 2
      ;;
  esac
done

case "$min_age_hours" in
  ''|*[!0-9]*) echo "Age must be a non-negative integer" >&2; exit 2 ;;
esac

uid=$(id -u)
domain="gui/$uid"
min_age_seconds=$((min_age_hours * 3600))
# Only labels matching MEMCLEAN_DEV_JOB_LABELS (an awk ERE) are considered,
# e.g. '^com\.example\.(dev-server|metro)\.'. Unset means nothing is selected.
label_regex="${MEMCLEAN_DEV_JOB_LABELS:-}"
if [ -z "$label_regex" ]; then
  echo "MEMCLEAN_DEV_JOB_LABELS is unset; no launchd job families to check."
  exit 0
fi
labels=$(launchctl print "$domain" 2>/dev/null | /usr/bin/awk -v re="$label_regex" '
  $3 ~ re { print $3 }
' | sort -u)

has_active_client() {
  local path="$1"
  [ -n "$path" ] || return 1
  "$PS" -axo command= 2>/dev/null | /usr/bin/awk -v target="$path" '
    index($0, target) &&
    ($0 ~ /ChatGPT\.app/ || $0 ~ /Codex\.app/ || $0 ~ /kernel\.js/ ||
     $0 ~ /(^|\/)claude([[:space:]]|$)/ || $0 ~ /(^|\/)grok([[:space:]]|$)/) {
      found=1; exit
    }
    END { exit(found ? 0 : 1) }
  '
}

printf "LABEL\tPID\tELAPSED\tCLASS\tSTATE_DIR\tWORKTREE\tPROGRAM\n"
if [ -z "$labels" ]; then
  echo "No matching launchd development jobs found."
  exit 0
fi

for label in $labels; do
  job=$(launchctl print "$domain/$label" 2>/dev/null || true)
  [ -n "$job" ] || continue
  pid=$(printf '%s\n' "$job" | sed -n 's/^[[:space:]]*pid = //p' | head -n 1)
  program=$(printf '%s\n' "$job" | sed -n 's/^[[:space:]]*program = //p' | head -n 1)
  log_path=$(printf '%s\n' "$job" | sed -n 's/^[[:space:]]*stdout path = //p' | head -n 1)
  state_dir=""
  [ -z "$log_path" ] || state_dir=$(dirname "$log_path")
  worktree=""
  if [ -n "$state_dir" ]; then
    worktree=$(cat "$state_dir/worktree" 2>/dev/null || cat "$state_dir/dir" 2>/dev/null || true)
  fi

  elapsed="not-running"
  age=0
  if [ -n "$pid" ]; then
    elapsed=$(process_value etime "$pid")
    age=$(age_seconds "$elapsed")
  elif [ -n "$state_dir" ] && [ -d "$state_dir" ]; then
    state_mtime=$(stat -f %m "$state_dir" 2>/dev/null || echo 0)
    now=$(date +%s)
    if [ "$state_mtime" -gt 0 ] 2>/dev/null; then
      age=$((now - state_mtime))
      elapsed="state-age:$((age / 3600))h"
    fi
  fi

  class=RECENT_OR_ACTIVE
  if [ -n "$worktree" ] && [ ! -d "$worktree" ]; then
    class=MISSING_WORKTREE
  elif [ -n "$worktree" ] && has_active_client "$worktree"; then
    class=ACTIVE_CLIENT
  elif [ -n "$pid" ] && [ "$age" -ge "$min_age_seconds" ]; then
    class=STALE_KEEPALIVE
  elif [ -z "$pid" ]; then
    class=LOADED_NOT_RUNNING
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$label" "${pid:-none}" "$elapsed" "$class" "${state_dir:-unknown}" \
    "${worktree:-unknown}" "${program:-unknown}"

  eligible=0
  [ "$class" = STALE_KEEPALIVE ] && eligible=1
  [ "$class" = MISSING_WORKTREE ] && [ "$age" -ge "$min_age_seconds" ] && eligible=1
  [ "$eligible" -eq 1 ] || continue
  [ "$mode" = kill ] || continue

  echo "Unloading $domain/$label"
  launchctl bootout "$domain/$label" 2>/dev/null || launchctl remove "$label" 2>/dev/null || {
    echo "Could not unload $label" >&2
    continue
  }
done

if [ "$mode" = dry-run ]; then
  echo "Dry run: no launchd jobs were unloaded."
fi
