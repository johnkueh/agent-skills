#!/bin/bash

PS=/bin/ps
PGREP=/usr/bin/pgrep

process_value() {
  "$PS" -o "$1"= -p "$2" 2>/dev/null | sed 's/^ *//;s/ *$//'
}

age_seconds() {
  local value="$1" days=0 main="" one="" two="" three="" seconds=0
  [ -n "$value" ] || { echo 0; return; }
  if [[ "$value" == *-* ]]; then
    days="${value%%-*}"
    main="${value#*-}"
  else
    main="$value"
  fi
  IFS=: read -r one two three <<< "$main"
  if [ -n "${three:-}" ]; then
    seconds=$((10#$one * 3600 + 10#$two * 60 + 10#$three))
  else
    seconds=$((10#$one * 60 + 10#$two))
  fi
  echo $((10#$days * 86400 + seconds))
}

has_live_session() {
  local pid="$1" cursor="$1" parent="" tty="" command="" hops=0
  tty=$(process_value tty "$pid")
  if [ -n "$tty" ] && [ "$tty" != "??" ] && [ "$tty" != "-" ]; then
    return 0
  fi

  while [ "$hops" -lt 32 ] && [ -n "$cursor" ] && [ "$cursor" -gt 1 ] 2>/dev/null; do
    command=$(process_value command "$cursor")
    case "$command" in
      *ghostty*|*Ghostty*|*Terminal.app*|*iTerm*|*Warp*|*kitty*|*Alacritty*|*tmux*|*screen*|*Codex.app*|*Cursor.app*|*cursor-server*)
        return 0
        ;;
    esac
    parent=$(process_value ppid "$cursor")
    [ -n "$parent" ] || break
    cursor="$parent"
    hops=$((hops + 1))
  done
  return 1
}

list_claude_pids() {
  "$PGREP" -x claude 2>/dev/null || true
}
