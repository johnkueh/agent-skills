#!/bin/bash
# Show macOS physical-footprint and CPU snapshots.

set -u

TOP=/usr/bin/top
PS=/bin/ps
MEMORY_PRESSURE=/usr/bin/memory_pressure

echo "=== TOP MEMORY (Activity Monitor-style footprint) ==="
if [ -x "$TOP" ]; then
  "$TOP" -l 1 -n 30 -o mem -stats pid,command,mem,rsize,vsize,cpu,time,threads,ports 2>&1 | sed -n '1,38p'
else
  echo "top is unavailable"
fi

echo ""
echo "=== LIVE CPU (ps sample) ==="
if [ -x "$PS" ]; then
  "$PS" -Ao state=,pcpu=,pid=,ppid=,rss=,etime=,comm= 2>/dev/null |
    sort -k2 -nr | head -20
else
  echo "ps is unavailable"
fi

echo ""
echo "=== MEMORY PRESSURE ==="
if [ -x "$MEMORY_PRESSURE" ]; then
  "$MEMORY_PRESSURE" 2>&1 | sed -n '1,24p'
else
  echo "memory_pressure is unavailable"
fi

echo ""
echo "=== RSS TOTAL (not the Activity Monitor footprint) ==="
if [ -x "$PS" ]; then
  "$PS" -axo rss= | /usr/bin/awk '{sum += $1} END {printf "%.1f GB\n", sum / 1024 / 1024}'
else
  echo "ps is unavailable"
fi

echo ""
echo "=== SWAP AND UPTIME ==="
/usr/sbin/sysctl vm.swapusage 2>&1 || true
/usr/bin/uptime
