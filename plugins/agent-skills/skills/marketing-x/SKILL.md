---
name: marketing-x
description: "Monitor X profiles, archive new posts, and produce digests. Use to subscribe to handles, poll timelines, query the archive, run X-monitor, configure recurring X digests, or install monitoring on a Mac."
---

# marketing-x
Tracks X (Twitter) user profiles for new posts since the last check, archives every fetched tweet locally, and writes a per-run JSON record. Designed to be invoked daily via `/loop` so Claude can summarize what's new without re-paying for old data.

**Always run `doctor` before the first `check` of a session** — it catches missing creds, broken cache paths, and sync problems before you burn API credits.

## Setup

### Setup workflow (what Claude does when invoked for setup)

When the user says any of "set up x-monitor", "configure x-monitor", "install x-monitor on this Mac", "share x-monitor across my machines":

1. Inspect `doctor`, the cache location, and available credential sources.
2. Explain the selected cache destination and use plain `setup` for requested
   setup. It can create directories, migrate cached data, update harness settings,
   and install a previously synced credential; it is not read-only.
3. Use `--share-credentials` only when the user explicitly requests copying the
   credential to the selected sync service. Ordinary setup is not permission to
   upload credentials. Prefer a configured secret manager for cross-machine auth.
4. If credentials are missing, use secure authentication and continue independent
   local archive work. Restart the host only if its environment actually requires it.

### What `setup` does (manual reference)

```bash
uv run python x_monitor.py setup                       # plain
uv run python x_monitor.py setup --share-credentials   # also push creds into synced home
uv run python x_monitor.py setup --home ~/Dropbox/...  # non-iCloud sync target
```

Idempotent. Steps:

1. Creates `~/Library/Mobile Documents/com~apple~CloudDocs/x-monitor/` (override with `--home`)
2. Migrates `~/.cache/x-monitor/` into the synced home if it has data and target is empty (leaves source as backup)
3. Adds `X_MONITOR_HOME` through the active harness's environment mechanism (merges, doesn't overwrite)
4. **Credentials:** with `--share-credentials`, copies local `credentials.json` → `<home>/credentials.json` (mode 600). Without the flag, on a machine with no local creds, auto-installs from `<home>/credentials.json` if found there.
5. Runs `doctor` to confirm everything's green

### Credentials

Bearer token at `~/.config/x-monitor/credentials.json` (already populated for this user). Override with `X_BEARER_TOKEN` env var if needed.

```json
{
  "bearer_token": "AAAA...",
  "consumer_key": "...",
  "consumer_secret": "..."
}
```

### Cache home (cross-machine sync)

By default the cache lives at `~/.cache/x-monitor/`. Set `X_MONITOR_HOME` to share state between machines:

```jsonc
// Configure in the active harness environment on both Macs
{
  "env": {
    "X_MONITOR_HOME": "~/Library/Mobile Documents/com~apple~CloudDocs/x-monitor"
  }
}
```

Cloud file sync is not a concurrency lock. Use one writer or serialize runs when
machines share state; verify conflicts before merging. Share credentials only
through the separately authorized mechanism described above.

Layout under `X_MONITOR_HOME`:

```
state.json              # subscriptions + last_seen_id per handle
runs/<iso>.json         # one file per `check` invocation
tweets/<handle>.jsonl   # append-only tweet archive (one JSON per line)
```

### API plan note

The read endpoints (`GET /2/users/by/username`, `GET /2/users/:id/tweets`) need credits or a paid plan. Pay-per-use pricing as of 2026: **$0.010/user**, **$0.005/post**. Free tier is write-only.

## Commands

Run all commands from the skill directory.

### `setup` — one-shot cross-machine config

```bash
uv run python x_monitor.py setup                       # iCloud Drive default
uv run python x_monitor.py setup --share-credentials   # also push creds to synced home
uv run python x_monitor.py setup --home ~/Dropbox/...  # custom sync target
```

See the Setup section above for what it does. Re-running is safe.

### `doctor` — pre-flight check

```bash
uv run python x_monitor.py doctor          # cheap, no API calls
uv run python x_monitor.py doctor --api    # also pings @x to verify auth (~$0.010)
```

Validates: cache dir writable, sync mode (iCloud vs local), state.json parses, archive size, bearer token loaded. **Run this before every `/loop` cycle and before any expensive `check`.**

### `add` — subscribe

```bash
uv run python x_monitor.py add bcherny
uv run python x_monitor.py add https://x.com/bcherny     # URL also works
```

Resolves the handle, fetches up to 5 baseline tweets (~$0.035), archives them, stores the latest id so subsequent `check` runs only return newer tweets.

### `rm` / `list`

```bash
uv run python x_monitor.py rm bcherny
uv run python x_monitor.py list
uv run python x_monitor.py list --json
```

### `check` — fetch new posts

```bash
uv run python x_monitor.py check --json              # all handles
uv run python x_monitor.py check --handle bcherny    # single handle
uv run python x_monitor.py check --limit 5           # cap per-handle batch
```

Each new tweet is appended to `tweets/<handle>.jsonl` (deduped) and included in the run file at `runs/<iso>.json`. Cost = N × $0.005 where N is new posts returned.

### `tweets` — query the local archive (no API calls)

```bash
uv run python x_monitor.py tweets bcherny
uv run python x_monitor.py tweets bcherny --since 2026-04-01
uv run python x_monitor.py tweets bcherny --grep "claude code"
uv run python x_monitor.py tweets bcherny --limit 5 --json
```

Reads only from `tweets/<handle>.jsonl`. Use this when the user asks "what did @user say about X" — answer from the archive instead of paying to refetch.

### `runs` — past digest summaries

```bash
uv run python x_monitor.py runs                  # last 10
uv run python x_monitor.py runs latest           # most recent
uv run python x_monitor.py runs latest --json    # full JSON of last run
```

## Daily digest workflow (this is what /loop fires)

When invoked (typically by `/loop 1d /x-monitor` or similar):

1. Run `uv run python x_monitor.py doctor` first. If it exits non-zero, surface the error and stop — do not call `check`.
2. Run `uv run python x_monitor.py check --json` and capture the JSON.
3. If `total_new == 0`, output a single line: `No new posts from <N> handle(s) since <last_checked>.` and stop.
4. Otherwise, for each handle with `new_count > 0`, write a short bulleted digest:
   - Header: `## @handle — N new`
   - One bullet per tweet with the timestamp, a 1-sentence rephrase of the post, and a link in the form `https://x.com/<handle>/status/<id>`.
   - Group together threads (same author, contiguous in time, narrative continuity) into one bullet.
   - Skip pure-link or quote-only posts unless they add commentary.
5. Close with a one-line takeaway: what theme or signal stands out across handles. Skip if there's only one new post.

Keep the digest tight — the user is reading this every day. No marketing language, no "exciting updates," no emojis unless the user asked for them.

## Recurring checks

Create a schedule only when requested, using the host's supported scheduler.
Preserve the requested cadence and notification policy. For a monitor, stay quiet
when unchanged unless periodic status was requested; notify on meaningful updates
or failures. The CLI itself does not schedule future runs.

## Costs (empirical)

| Action | Cost |
|---|---|
| `add <handle>` | ~$0.035 (1 user + ≤5 baseline posts) |
| `check` returning 0 new | $0 |
| `check` returning N new | N × $0.005 |
| `doctor` (no `--api`) | $0 |
| `doctor --api` | $0.010 |
| `tweets` query | $0 (local archive) |

10 daily-monitored handles averaging 3 standalone posts/week each ≈ **$0.65/month**.

## Troubleshooting

- **402 CreditsDepleted**: developer account is out of credits. Top up at https://developer.x.com/en/portal/products or upgrade the plan. (Account-level, not a code bug.)
- **403 from check**: API plan doesn't allow reads. Upgrade to Basic, or rotate the bearer to one from a project on a paid plan.
- **429 rate limit**: the script prints seconds until reset. Run `check --handle <one>` to limit blast radius.
- **`User @x not found`**: handle misspelled, suspended, or protected.
- **`last_seen_id` stuck**: delete the handle's entry in `state.json` and re-add to rebaseline.
- **Cross-machine state out of sync**: `doctor` will tell you whether `home` is iCloud or local — make sure both machines point at the same `X_MONITOR_HOME`.
