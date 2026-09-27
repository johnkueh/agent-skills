#!/bin/bash
# Rank physical footprint and expose system-daemon and kernel pressure signals.

set -u

TOP=/usr/bin/top
PS=/bin/ps

echo "=== PHYSICAL FOOTPRINT ==="
"$TOP" -l 1 -n 30 -o mem \
  -stats pid,command,mem,rsize,cpu,time,threads,ports 2>&1 | sed -n '1,38p'

echo ""
echo "=== LIVE CPU (ps sample) ==="
"$PS" -Ao state=,pcpu=,pid=,ppid=,rss=,etime=,comm= 2>/dev/null |
  sort -k2 -nr | head -25

echo ""
echo "=== PROTECTED SYSTEM DAEMONS (RSS is not footprint) ==="
"$PS" -axo pid=,ppid=,user=,state=,%cpu=,rss=,etime=,command= 2>/dev/null |
  /usr/bin/awk '
    $8 ~ /(^|\/)fseventsd$/ ||
    $8 ~ /(^|\/)launchservicesd$/ ||
    $8 ~ /(^|\/)WindowServer([[:space:]]|$)/ ||
    $8 ~ /(^|\/)mds([[:space:]]|$)/ {
      printf "%s\t%s\t%s\t%s\t%s\t%.1f MiB\t%s\t", $1, $2, $3, $4, $5, $6 / 1024, $7
      for (i=8; i<=NF; i++) printf "%s%s", $i, (i<NF ? " " : "\n")
    }'

echo ""
echo "=== MEMORY AND SWAP ==="
/usr/sbin/sysctl vm.swapusage 2>&1 || true
/usr/bin/memory_pressure -Q 2>&1 || true
/usr/bin/uptime

echo ""
echo "=== VOLUMES ==="
/bin/df -h / /System/Volumes/Data /Volumes/* 2>/dev/null || true

echo ""
echo "Do not kill protected system daemons. A large fseventsd footprint, extreme"
echo "launchservicesd port count, or high WindowServer footprint after long uptime"
echo "is a restart/login-session finding, not an orphan-process cleanup target."

