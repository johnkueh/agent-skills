---
name: system-memory-cleanup
description: "Inspect and relieve macOS CPU and memory pressure with the memclean CLI: physical footprint, swap, launchd jobs, repeated MCP servers, detached dev-server trees, and orphaned Claude/Codex/Node processes. Use for a slow Mac, memory pressure, resource hogs, high CPU, agent zombies, runaway dev servers, or /memclean."
---

# System memory cleanup

Treat cleanup as stopping an exact process tree you've identified, never a name-based
kill. Everything here is dry-run by default.

## memclean first

Run from this skill directory (or symlink `bin/memclean` onto your `PATH`):

```bash
bash bin/memclean doctor
bash bin/memclean audit          # full dry-run report (the default command)
bash bin/memclean zombies        # agent / MCP / headless-browser orphans
bash bin/memclean mcp            # duplicate MCP server generations
bash bin/memclean claude         # detached Claude CLI processes
bash bin/memclean helpers        # known stale helper processes
bash bin/memclean clean --yes    # stop only what the audit marked eligible
bash bin/memclean protect list
bash bin/memclean init           # optional hourly read-only audit LaunchAgent
```

`init` only schedules read-only audits. Nothing here kills on a schedule.

The individual scanners live in `scripts/` if you need one directly
(`audit-memory-hogs.sh`, `find-dev-trees.sh`, `scan-agent-zombies.sh`,
`cleanup-stale-mcp.sh`, `cleanup-stale-user-processes.sh`,
`cleanup-launchd-dev-jobs.sh`, `find-orphan-claude.sh`). All of them take `--dry-run`.

## Measure the right thing

- Activity Monitor's Memory column is **physical footprint**. `ps` RSS is resident
  memory and can be far smaller for Node and Electron. Summed RSS double-counts shared
  pages; never report it as memory used.
- Rank with `top`'s `MEM` column, then confirm a suspect with
  `/usr/bin/footprint --pid <pid> --swapped --wired --noCategories`.
- Footprint, RSS, CPU, swap, and age are separate signals. High memory alone isn't a leak.

For each serious candidate record PID, PPID, PGID, owner, age, CPU, footprint, command,
working directory, and listening ports. Walk the parent chain to find the launcher.
`PPID 1` means detached, not safe to kill.

## Never kill

`kernel_task`, `WindowServer`, `launchd`, `fseventsd`, `launchservicesd`,
`memory_pressure`, or any unknown system process.

- Big `kernel_task`: kernel, drivers, wired memory, thermal throttling.
- Big `fseventsd` with sustained CPU: filesystem churn or indexing. Note volumes,
  disk fullness, indexing state, and uptime.
- Big `launchservicesd` or `WindowServer`: long uptime, process churn, or
  display/simulator churn.

Stop the user-owned churn first. If the anomaly stays after builds finish, recommend a
logout or reboot, and say that's what it is.

## Dev-server trees

Inspect the whole tree: `next-server` / `next dev` / `pnpm dev`, Portless dev
launchers, Eve local servers, `dev-server-process.sh` wrappers. A persistent
`portless … proxy start --foreground` is a proxy, not a dev tree; leave it unless named.

Stop a confirmed tree with `scripts/stop-dev-tree.sh` or
`memclean stop-dev --pid <root> --yes`. Killing only the `next-server` child leaves the
launcher running and respawning it.

Jobs started with `launchctl submit` respawn when their children die. Check them with
`scripts/cleanup-launchd-dev-jobs.sh --dry-run` and unload the exact stale label first.
It only looks at label families you set in `MEMCLEAN_DEV_JOB_LABELS` (an awk regex),
waits 24 hours by default, and keeps any job whose worktree an active Codex, ChatGPT,
Claude, or Grok process still names.

If new roots appear after you stop one, stop killing and report which launcher or agent
task keeps recreating them.

## What counts as an orphan

The conservative rule for scheduled or unattended cleanup:

- owned by the user;
- detached from a live terminal or session, or its launcher is clearly dead;
- stale for 24 hours (strong MCP/browser patterns may use 1 hour);
- at least 90% CPU or 500 MiB footprint for generic processes;
- no sign it's active development, an active agent task, a simulator, or a user session.

A one-off request can authorize stopping a broader exact tree. Don't turn that into a
standing rule.

MCP servers: `cleanup-stale-mcp.sh` groups Prisma, GrowthBook, Notion, Playwright, and
Argent launchers by parent. It keeps the newest Notion and Argent generation per client
and only selects older duplicates or orphans past the age floor. Never kill the client
app just to clear its MCP children.

Preserve active Codex, ChatGPT, Claude, Grok, terminal, simulator, browser, build,
deploy, and dev processes unless the user names that exact process. Swift, Clang,
Hermes, Expo export, and EAS builds legitimately use gigabytes. Never use broad
`pkill -f` for Node, Next, Chrome, Claude, Grok, or Electron.

Stopping: `kill -TERM <pid>` first, recheck the PID is the same process, and use
`--force` / `kill -KILL` only if graceful stop failed and losing its state is in scope.

## Report

After stopping anything, wait briefly and rerun the inspection. Report:

1. the measurements used (footprint, RSS, CPU, swap, memory pressure);
2. the launcher, ports, PGID, and PIDs considered;
3. what was stopped, what was kept, and why;
4. before/after snapshots;
5. anything that respawned and which owner has to be stopped.

Don't call the machine clean while a detached launcher is still recreating children.

Background on the approach: `references/research-2026-agent-hygiene.md`.
