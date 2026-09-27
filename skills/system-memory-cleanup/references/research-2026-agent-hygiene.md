# Research notes — agent/Electron runtime hygiene (2026)

Sources reviewed when building `memclean`. Patterns inspired by MIT `z-clean` (npm `z-clean` / `@thestackai/zclean`, github.com/TheStack-ai/zclean) — rewritten with stricter rules; not a fork.

## Problem class

1. **Agent/MCP zombies** — Claude Code, Cursor, Codex, Grok, Gemini, etc. spawn MCP servers, headless Chrome, Playwright, sub-agents. Session end often fails to SIGTERM the process group → `PPID=1` orphans accumulate (multi‑GB by afternoon). Confirmed across multiple GitHub issues (Claude Code MCP/subagent cleanup) and Cursor MCP process-leak reports.

2. **Electron / Chromium apps** — macOS 26 (Tahoe) had a system-wide lag class from outdated Electron; use shamelectron.com / avarayr.github.io/shamelectron to audit installed apps. Idle Electron apps (Cursor, Slack, Discord, Notion) still cost multi‑GB footprint.

3. **Detached dev trees** — Portless / launchd / Eve / next-server trees respawn if you only kill the child.

## Public tools

| Tool | Role | Steal? |
|------|------|--------|
| **z-clean / zclean** | Dry-run scan, `--yes` kill, classification + confidence, PID re-verify, protect list, hourly *read-only* audit scheduler, cache cleanup | UX + safety patterns (MIT). Do not vendor blindly — our scanners are stricter on launchd/dev trees. |
| **cc-reaper / claude-code-cleanup** | Claude-specific orphan reaping + hooks | Claude scope only |
| **shamelectron** | List apps on bad Electron builds | Separate; link from doctor later |
| **ProcXray / htop** | Process trees | Observability only |
| **App Tamer** | Throttle CPU | Not kill |

## zclean design worth keeping

- Dry-run default; explicit `--yes`
- `confirmed-stale` vs `suspected` / `unattributed` (only eligible kill)
- Strong provider pattern + orphan + age grace + start-time verify
- PID identity re-check before kill (start time + cmdline)
- Process tree once (`ps`), no per-PID exec storm
- Protect tmux/screen/pm2/active parents
- Hourly scheduler is **audit only** (never auto `--yes`) — they removed unsafe SessionEnd auto-kill hooks in v0.3.4
- JSON report surface for agents
- Custom patterns as **literals**, not free regex

## House advantages already in system-memory-cleanup

- Physical footprint guidance (`footprint`, not just RSS)
- launchd dev-job unload before kill (prevents respawn)
- MCP generation policy (retire prisma/growthbook/playwright; keep newest Notion/Argent)
- Dev-tree stop via exact root (`stop-dev-tree.sh`)
- Allowlisted helpers (not generic PPID=1 node killer)
- 24h floor + 500 MiB / 90% CPU for scheduled policy
- Never kill protected system daemons

## Practices (2026)

1. Kill process groups / labels, not name patterns.
2. Cap MCP count; prefer skills/CLI over always-on MCP where possible.
3. SessionEnd hooks are optional; prefer manual `--yes` + hourly audit log.
4. After OS upgrades, check Electron currency (shamelectron).
5. Long-uptime `fseventsd` / `WindowServer` bloat → login restart, not kill.

## memclean mapping

| zclean idea | memclean |
|-------------|----------|
| `zclean` dry-run | `memclean audit` |
| `zclean --yes` | `memclean clean --yes` |
| patterns scanner | `scripts/scan-agent-zombies.sh` |
| MCP duplicates | `cleanup-stale-mcp.sh` |
| protect list | `memclean protect list` |
| init hourly audit | `memclean init` (read-only) |
| doctor | `memclean doctor` |
| launchd/dev awareness | existing cleanup-launchd + stop-dev-tree |
