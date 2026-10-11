---
name: data-digest
description: "Build a per-project digest of installs, signups, product activity, revenue, API costs, initiative changes, git activity, and monitoring. Use for morning, daily, yesterday, or recurring cross-project roundups."
---

# data-digest
Pulls a per-project digest covering, since the last check. Projects on the dev-telemetry stack (GA4 → BigQuery, read through the shared `telemetry` views) get:

- **Freshness** — `data_through` per source stream, so data that hasn't landed yet isn't read as zero
- **Installs** — new prod app installs (iOS/Android, internal excluded) by platform, plus total
- **Active** — distinct prod installs with any event (app), and web readers (distinct WEB installs)
- **Top events** — top events by count, with distinct-install fanout
- **Purchases** — new first-paid purchases and net revenue, when the project has the RevenueCat `purchases` view

Projects still on the legacy bq-analytics layout get:

- **Users** — `total` distinct user_ids in `events.identifies` ever, plus `new` first-seen-in-window count (signups since last check)
- **Top user activities** — top events by count, with distinct-user fanout
- **API / LLM / scraping costs** — `cost.recorded` rolled up by provider/operation
- **Top error paths** — `logs.raw` 5xx count by path
- **Recent feedback** — `events.feedback` items

It also appends a per-handle **x-monitor section**. The script reads each subscribed handle's local archive (`tweets/<handle>.jsonl`) and filters to tweets within the digest window — it does **not** rely on the latest run file (that file would miss handles subscribed after the run was taken). No re-fetch — costs $0.

The Python script returns structured JSON; the agent (Claude) reformats it into a tight markdown digest.

## Setup

```bash
# from anywhere
uv run --quiet <skill-dir>/daily_digest.py setup
```

State lives at `~/.cache/daily-digest/` (`projects.json`, `state.json`, `runs/<iso>.json`). Override with `DAILY_DIGEST_HOME` if you want it on iCloud Drive for cross-machine sync.

## Add a project

```bash
# dev-telemetry project: point at the repo root that holds .telemetry.json
uv run --quiet daily_digest.py add my-app \
    --repo ~/code/my-app \
    --description "Expo app + marketing site"

# legacy bq-analytics project
uv run --quiet daily_digest.py add my-project \
    --bq-project my-project \
    --group-type household \
    --description "Cooklang recipe iOS app + Next.js + Hono API"
```

Flags:

| Flag | Required | Notes |
|---|---|---|
| `--repo` | one of `--repo` / `--bq-project` | Repo root. If it has `.telemetry.json`, the project is read from the dev-telemetry views (see [Schema assumptions](#schema-assumptions)). Checked on every run, so a repo that moves to dev-telemetry switches over without re-adding. |
| `--bq-project` | one of `--repo` / `--bq-project` | GCP project that holds `events.raw`, `events.identifies`, `events.feedback`, `logs.raw` (the legacy bq-analytics layout). Used only when the repo has no `.telemetry.json`. |
| `--group-type` | optional | Legacy only. bq-analytics `group_type` to attach to each signup (e.g. `household`, `workspace`, `team`). When set, signups include the user's `group_id` and group name (`traits.display_name` or `traits.name`). |
| `--description` | optional | One-line note printed in the digest header. |
| `--force` | flag | Overwrite an existing project entry. |

`list`, `rm`, are also there:

```bash
uv run --quiet daily_digest.py list
uv run --quiet daily_digest.py rm my-saas
```

## Daily digest workflow (what `/loop` fires)

```
/loop 1d use the data-digest skill to generate today's roundup
```

When invoked:

1. **Run the check.** Lookback window = `now − last_checked_at` per project (default 1 day on first run). Pass `--since 24h` to override, or `--no-state` to leave `last_checked_at` untouched (useful for ad-hoc runs).

   ```bash
   uv run --quiet daily_digest.py check --json
   ```

2. **Reformat the JSON into a tight bulleted digest.** Use proper markdown — `#` title, `##` per project / x-monitor, real bullet lists. Structure (NOT style) stays minimal: just data-through, installs, active, events, purchases (telemetry) or signups, events, costs, optional 5xx/feedback (legacy), then x-monitor. No priorities, no initiatives, no takeaway.

   ````md
   # Daily digest — DD/MM/YYYY

   ## <telemetry project>

   - **Data through:** DD/MM — _iOS, web; Android stale since DD/MM_   ← always show; name stale streams
   - **Installs:** new N (iOS N, Android N), total M
   - **Active:** N app installs, N web readers               ← add "(today partial)" when includes_provisional
   - **Events:** <rough total> — `event_a` N×, `event_b` N×, `event_c` N×
   - **Purchases:** N new paid, $X.XX revenue                ← omit when purchases.available is false

   ## <legacy project>

   - **Users:** new N, total M _(group: Household Name, …)_   ← group only if new>0 and --group-type set
   - **Events:** <rough total> — `event_a` N×, `event_b` N×, `event_c` N×
   - **Costs:** $X.XX total — `provider/op` $X.XX, `provider/op` $X.XX, …
   - **5xx:** `/path` N×, …                           ← omit line entirely when zero
   - **Feedback:** N items — _[kind] subject_         ← omit line entirely when zero

   ## <next project>
   …

   ## X-monitor

   - No new posts from @a or @b
     OR
   - **@a** — N× new: one-line summary
   ````

   Rules:
   - **Date format `DD/MM/YYYY`** in the title.
   - **`##` for each project** and for x-monitor — gives clear visual separation when scanning multiple projects.
   - **Bold the field name** (`**Signups:**`, `**Events:**`, …); inline-code the event names / paths / providers.
   - **Round large counts** — 1865 → `1.9k`, 12340 → `12k+`. Exact under 1000.
   - **Top 3 events / top 4–5 cost ops** inline, comma-separated. No nested bullets.
   - **Omit 5xx and feedback bullets when zero** — always show signups, events, costs (legacy) or data-through, installs, active, events (telemetry).
   - **Never present a stale stream's zeros as real.** When `freshness.streams[].stale` is true, its data ends before the window starts: say "not landed yet" for that stream instead of reporting 0.
   - **No priorities, no initiatives, no takeaway, no emojis.** This is a glance, not a briefing.

3. **Append the x-monitor section** from `digest.x_monitor` — the script already filtered each subscribed handle's archive to the digest window; just summarize per-handle new tweets following the x-monitor skill's bullet format.

4. Add analysis only when requested; the default digest ends with the observed data.

5. **State advances automatically.** The next `check` only covers what's happened since this run. Pass `--no-state` to skip the advance for ad-hoc questions ("what's happened in the last 7 days?").

## Smoke test (one-shot, no state)

```bash
uv run --quiet daily_digest.py check --since 24h --no-state --json | jq
```

This runs all configured projects with a fixed 24h window and **doesn't** advance `last_checked_at`. Use for development.

## What the JSON looks like

```jsonc
{
  "generated_at": "2026-05-07T06:10:27Z",
  "projects": [
    {
      "name": "my-app",
      "since": "2026-05-06T06:10:29Z",
      "layout": "telemetry",
      "telemetry": { "project": "my-gcp-project", "dataset": "telemetry" },
      "freshness": { "window_start": "2026-05-06", "any_stale": false,
                     "streams": [{source, stream, data_through, last_event_ts,
                                  has_provisional, rows_yesterday, stale}, ...] },
      "installs":  { "new": 6, "total": 758,
                     "by_platform": [{platform, new, new_with_first_open, total}, ...] },
      "active":    { "app_installs": 18, "web_readers": 582,
                     "by_platform": {"IOS": 18, "WEB": 582}, "includes_provisional": true },
      "activities":{ "top": [{event_name, n, installs}, ...] },
      "purchases": { "available": true, "new_paid": 1, "trials": 0,
                     "refunds": 0, "revenue_usd": 29.99 }   // or { "available": false }
    },
    {
      "name": "my-project",
      "since": "2026-05-06T06:10:29Z",
      "layout": "bq-analytics",
      "description": "...",
      "users":     { "new": 1, "total": 120, "sample": [...] },
      "activities":{ "top": [{event_name, n, users}, ...] },
      "costs":     { "total_usd": 0.94, "total_calls": 179, "breakdown": [...] },
      "errors":    { "top": [{path, errs, total}, ...] },
      "feedback":  { "items": [{ts, kind, subject, message, user_id}, ...] },
      "initiatives": {
         "dir": "/abs/path/to/docs/initiatives",
         "total_files": 45,
         "readme": "...full markdown content of README.md...",
         "files": [
           { "file": "...", "title": "...", "summary": "...",
             "mtime": "...", "size_bytes": N,
             "modified_recently": true }, ...
         ]
      }
    }
  ],
  "x_monitor": { ...latest x-monitor run JSON... }
}
```

Per-project fields depend on `layout`. A project with neither `.telemetry.json` in its repo nor a `bq_project` gets `bq_skipped` instead.

## Schema assumptions

Each run picks the layout per project:

1. **dev-telemetry** (current standard) — the project's `--repo` root has `.telemetry.json`. The script reads `gcpProject`, `views.dataset` (default `telemetry`) and optional `gcpAccount` from it.
2. **bq-analytics** (legacy) — no `.telemetry.json`, but `--bq-project` is set. Kept only for projects that haven't moved to dev-telemetry yet; don't set up new projects this way.

### dev-telemetry views

Every query reads the shared views in `<gcpProject>.<views.dataset>`, never the raw GA4 export tables. The `bq` subprocess runs with `CLOUDSDK_CORE_ACCOUNT` pinned the same way dev-telemetry does: `gcpAccount` if set, else `john.kueh.dev@gmail.com` for `vibejar-*` / `popkr-*` projects, else `john.kueh@gmail.com`.

- `events` — `event_date`, `event_ts`, `event_name`, `platform` (`IOS`/`ANDROID`/`WEB`), `install_id`, `user_id`, `env` (`prod`/`dev`/`unknown`, install-level), `is_internal`, `provisional`, JSON `params`, …
- `installs` — `install_id`, `platform`, `env`, `is_internal`, `first_seen_ts`, `has_first_open`, …
- `purchases` (optional, RevenueCat) — `purchased_at`, `price_usd`, `is_trial`, `is_paid`, `is_refunded`, `is_first_paid`, … If the view doesn't exist, the digest returns `{"available": false}`.
- `source_health` — `source`, `stream`, `data_through`, `last_event_ts`, `has_provisional`, `rows_yesterday`.

Rules the fetchers apply:

- Counts are prod only: `env = 'prod'` and not `is_internal`. App installs are `IOS` + `ANDROID`; `WEB` installs are reported as web readers.
- New installs are `installs.first_seen_ts` inside the window.
- Revenue is `SUM(price_usd)` where `is_paid` and not `is_refunded`, by `purchased_at`.
- Provisional (intraday) rows count only for windows that reach today; a window that ends on a past day uses final export rows only. The default windows end at now, so today's provisional rows are included and `active.includes_provisional` says so.
- `freshness.streams[].stale` is true when a stream's `data_through` is before the window's start date. A quiet stream (for example Android with few users, or no recent purchases) can also look stale; check `last_event_ts` and `rows_yesterday` before calling it an outage.

### bq-analytics tables (legacy)

- `events.raw` — `event_name`, `user_id`, `ts`, JSON `properties`. Cost events use `event_name = 'cost.recorded'` with `properties.{provider, operation, model, cost_micros}`.
- `events.identifies` — `user_id`, `ts`, JSON `traits`. First-seen-per-`user_id` = signup.
- `events.feedback` — `kind`, `subject`, `message`, `user_id`, `ts`.
- `logs.raw` — `ts`, `level`, `path`, `status`, `message` (Vercel Log Drain landing zone).

If a project doesn't follow either shape, edit the `tel_*` or `bq_*` fetchers in `daily_digest.py` — they're independent ~20-line functions.

## Costs

- bq queries scan a few MB per project → free under the 1 TB/mo BQ on-demand quota.
- x-monitor section reads the **already-archived** per-handle tweets within the digest window, so $0 in API calls. (The actual fresh fetch happens in the x-monitor skill's own `/loop`.)
- dev-telemetry views scan a few hundred MB per project per run (the views read the GA4 export underneath), still well inside the free quota for a daily digest.
- Total cost of a daily digest across 5 projects: $0.

## Troubleshooting

- **`Access Denied: User does not have bigquery.jobs.create permission`** — for dev-telemetry projects, set `gcpAccount` in `.telemetry.json` (the script pins `CLOUDSDK_CORE_ACCOUNT` per project). For legacy projects, select the account for this process with `CLOUDSDK_CORE_ACCOUNT=<email>`; the skill calls `bq` via subprocess, so it inherits whatever account is active.
- **A dev-telemetry project shows `layout: bq-analytics`** — the project was added without `--repo`, or the repo path moved. Re-add with `--repo <root> --force`.
- **`signups.new_users = 0` but you know there were sign-ups** — verify `events.identifies` is being written; some projects only call `track()` and never `identify()`. In that case, treat first-seen-in-`events.raw` as the signup proxy and add a fetcher.
- **No files flagged `modified_recently`** — mtime floor is 7 days. If recent edits don't appear, the files might have been touched only in git history, not on the local filesystem (e.g. checkout from a different branch). Inspect Git history or widen `INITIATIVES_LOOKBACK`; do not touch source files to manufacture recency.
- **x-monitor section says "no runs yet"** — set `X_MONITOR_HOME` to point at the synced folder, or run x-monitor's `setup` + `check` once.

## Recurring with /loop

```
/loop 1d use the data-digest skill to produce a digest across configured projects
```

For a self-paced cadence (let the model decide when):

```
/loop use the data-digest skill whenever appropriate to summarize project activity
```
