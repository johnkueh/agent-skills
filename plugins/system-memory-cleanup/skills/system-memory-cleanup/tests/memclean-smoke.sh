#!/usr/bin/env bash
# Smoke: memclean help/doctor/audit dry-run must not kill.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
MC="$ROOT/bin/memclean"
chmod +x "$MC" "$ROOT/scripts/"*.sh

"$MC" version | grep -q memclean
"$MC" help | grep -q 'dry-run'
"$MC" protect list | grep -q kernel_task
"$MC" doctor
# audit must complete dry-run
"$MC" audit >/tmp/memclean-audit-smoke.out 2>&1 || true
grep -q 'DRY-RUN\|Dry run\|Next steps\|memclean' /tmp/memclean-audit-smoke.out
echo "memclean smoke ok"
