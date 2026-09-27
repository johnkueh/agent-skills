#!/bin/bash
# List Next/Portless/Eve development processes with their process groups.

set -u

PS=/bin/ps
LSOF=/usr/sbin/lsof

if [ ! -x "$PS" ]; then
  echo "ps is unavailable" >&2
  exit 1
fi

printf "PID\tPPID\tPGID\tSESS\tUSER\tSTATE\tCPU%%\tRSS(MiB)\tELAPSED\tGROUP_ROOT\tCWD\tLISTENING\tCOMMAND\n"

rows=$("$PS" -axo pid=,ppid=,pgid=,sess=,user=,state=,%cpu=,rss=,etime=,command= 2>/dev/null | /usr/bin/awk '
{
  pid=$1; ppid=$2; pgid=$3; session=$4; user=$5; state=$6; cpu=$7; rss=$8; elapsed=$9;
  command=$10;
  for (i=11; i<=NF; i++) command=command " " $i;
  if (command ~ /\/awk([[:space:]]|$)/ || command ~ /\/sed([[:space:]]|$)/) next;
  if (command ~ /next-server/ ||
      command ~ /next([^[:alnum:]_-]|$).* dev/ ||
      command ~ /pnpm([^[:alnum:]_-]|$).* dev/ ||
      command ~ /portless.*(pnpm|npm|yarn).* dev/ ||
      command ~ /local-server-child\.js/ ||
      command ~ /dev-server-process\.sh/) {
    printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%.1f\t%s\t%s\n", pid, ppid, pgid, session, user, state, cpu, rss / 1024, elapsed, command;
  }
}' )

if [ -z "$rows" ]; then
  echo "No matching development processes found."
  exit 0
fi

while IFS=$'\t' read -r pid ppid pgid session user state cpu rss elapsed command; do
  [ -n "$pid" ] || continue

  group_root=$("$PS" -axo pid=,ppid=,pgid=,command= 2>/dev/null | /usr/bin/awk -v group="$pgid" '
    $3 == group { member[$1] = 1; parent[$1] = $2 }
    END {
      for (pid in member) {
        if (!(parent[pid] in member)) { print pid; exit }
      }
    }')

  cwd=""
  listening=""
  if [ -x "$LSOF" ]; then
    cwd=$("$LSOF" -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/awk '/^n/ {sub(/^n/, ""); print; exit}')
    listening=$("$LSOF" -a -p "$pid" -iTCP -sTCP:LISTEN -nP 2>/dev/null | /usr/bin/awk 'NR > 1 {print $9}' | /usr/bin/paste -sd, -)
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$pid" "$ppid" "$pgid" "$session" "$user" "$state" "$cpu" "$rss" "$elapsed" \
    "${group_root:-unknown}" "${cwd:-unknown}" "${listening:-none}" "$command"
done <<< "$rows"
