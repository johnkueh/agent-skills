---
name: system-memory-cleanup
description: "Inspect and clean macOS CPU and memory usage. Use for a slow Mac, resource hogs, orphaned processes, high CPU, memory pressure, or process cleanup."
---

# Inspect and relieve macOS resource pressure

Start with `bash scripts/top-processes.sh`, memory pressure, swap, and process
ownership. `ps` RSS totals can double-count shared pages; do not present their sum
as physical memory used. High RSS alone is not evidence of a leak or an orphan.

Use `bash scripts/find-orphan-claude.sh` as a candidate list, then inspect each
PID's parent, command, working directory, start time, active task, and terminal.
A missing terminal does not make a background agent disposable. Read a cleanup
script before running it; its heuristics do not replace current ownership checks.

When cleanup is authorized, stop only the identified unused process through its
own lifecycle tool or `kill -TERM <pid>`. Recheck PID identity before escalation;
use `kill -KILL <pid>` only if graceful termination fails and losing that process's
state is within scope. Do not use broad `pkill -f` patterns for Chrome, Node,
Electron, or agents. Preserve active browser sessions and unrelated work.

Never terminate essential system processes such as WindowServer, launchd, or
kernel_task. Recheck pressure and the selected processes afterward, and report
observed improvement rather than promising memory from summed RSS.
