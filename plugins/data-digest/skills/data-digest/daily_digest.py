#!/usr/bin/env python3
"""
daily-digest — per-project digest of installs, activity, purchases, and
freshness from the dev-telemetry views (GA4 -> BigQuery), or signups,
activities, and costs from the legacy bq-analytics layout, with the latest
x-monitor posts appended.

Designed to be invoked daily via `/loop`. Emits structured JSON the
parent agent reformats for the user.

Usage:
    daily_digest.py setup                              create dirs
    daily_digest.py add  <name> [flags]                add project
    daily_digest.py rm   <name>                        remove project
    daily_digest.py list [--json]                      list projects
    daily_digest.py check [--project N] [--since DUR]  produce digest
                          [--json] [--no-state]

Flags for `add`:
    --repo PATH             repo root; if it has .telemetry.json the project
                            is read from the dev-telemetry views
    --bq-project ID         GCP project for legacy bq-analytics tables
    --group-type T          bq-analytics group_type to attach to signups
                            (e.g. household, workspace)
    --description TEXT      one-line note shown in digest header

State home (env override):
    DAILY_DIGEST_HOME, default ~/.cache/daily-digest
    Layout: projects.json, state.json, runs/<iso>.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_LOOKBACK = timedelta(days=1)


def home_dir() -> Path:
    raw = os.environ.get("DAILY_DIGEST_HOME") or "~/.cache/daily-digest"
    return Path(os.path.expandvars(os.path.expanduser(raw)))


def projects_path() -> Path:
    return home_dir() / "projects.json"


def state_path() -> Path:
    return home_dir() / "state.json"


def runs_dir() -> Path:
    return home_dir() / "runs"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp.replace(path)


def parse_duration(s: str) -> timedelta:
    m = re.fullmatch(r"\s*(\d+)\s*([smhd])\s*", s)
    if not m:
        raise SystemExit(f"bad duration {s!r}; use forms like 30m, 6h, 7d")
    n, unit = int(m.group(1)), m.group(2)
    return {"s": timedelta(seconds=n), "m": timedelta(minutes=n),
            "h": timedelta(hours=n), "d": timedelta(days=n)}[unit]


# ---------------------------------------------------------------------------
# bq runner
# ---------------------------------------------------------------------------

def bq(project: str, sql: str, account: str | None = None) -> list[dict]:
    cmd = ["bq", "query", f"--project_id={project}",
           "--nouse_legacy_sql", "--format=json", "--max_rows=1000"]
    env = None
    if account:
        env = {**os.environ, "CLOUDSDK_CORE_ACCOUNT": account}
    p = subprocess.run(cmd, input=sql, capture_output=True, text=True, env=env)
    if p.returncode != 0:
        return [{"_error": p.stderr.strip() or p.stdout.strip()}]
    out = p.stdout.strip()
    if not out:
        return []
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return [{"_error": f"non-JSON output: {out[:200]}"}]


def bq_users(project: str, since: datetime, group_type: str | None = None) -> dict:
    since_iso = iso(since)
    enrich_select = ""
    enrich_join = ""
    if group_type:
        enrich_select = """,
         ug.group_id,
         COALESCE(JSON_VALUE(g.traits, '$.display_name'),
                  JSON_VALUE(g.traits, '$.name')) AS group_name"""
        enrich_join = f"""
  LEFT JOIN `{project}.events.user_groups_current` ug
    ON ug.user_id = f.user_id AND ug.group_type = "{group_type}"
  LEFT JOIN `{project}.events.groups_current` g
    ON g.group_type = ug.group_type AND g.group_id = ug.group_id"""
    struct_fields = "user_id, FORMAT_TIMESTAMP('%FT%TZ', first_ts) AS first_seen"
    if group_type:
        struct_fields += ", group_id, group_name"
    sql = f"""
WITH first_seen AS (
  SELECT user_id, MIN(ts) AS first_ts
  FROM `{project}.events.identifies`
  GROUP BY user_id
), enriched AS (
  SELECT f.user_id, f.first_ts{enrich_select}
  FROM first_seen f{enrich_join}
)
SELECT
  (SELECT COUNT(*) FROM first_seen) AS total_users,
  COUNTIF(first_ts >= TIMESTAMP("{since_iso}")) AS new_users,
  ARRAY_AGG(IF(first_ts >= TIMESTAMP("{since_iso}"),
               STRUCT({struct_fields}),
               NULL) IGNORE NULLS
            ORDER BY first_ts DESC LIMIT 10) AS sample
FROM enriched
"""
    rows = bq(project, sql)
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    if not rows:
        return {"new": 0, "total": 0, "sample": []}
    r = rows[0]
    return {"new": int(r.get("new_users") or 0),
            "total": int(r.get("total_users") or 0),
            "sample": r.get("sample") or [],
            "group_type": group_type}


def bq_activities(project: str, since: datetime) -> dict:
    since_iso = iso(since)
    sql = f"""
SELECT event_name, COUNT(*) AS n,
       COUNT(DISTINCT user_id) AS users
FROM `{project}.events.raw`
WHERE ts >= TIMESTAMP("{since_iso}")
  AND DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY event_name ORDER BY n DESC LIMIT 15
"""
    rows = bq(project, sql)
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    return {"top": [{"event_name": r["event_name"],
                     "n": int(r["n"]),
                     "users": int(r["users"])} for r in rows]}


def bq_costs(project: str, since: datetime) -> dict:
    since_iso = iso(since)
    sql = f"""
SELECT
  COALESCE(JSON_VALUE(properties, '$.provider'), 'unknown') AS provider,
  COALESCE(JSON_VALUE(properties, '$.operation'), '') AS operation,
  COALESCE(JSON_VALUE(properties, '$.model'), '') AS model,
  COUNT(*) AS calls,
  ROUND(SUM(SAFE_CAST(JSON_VALUE(properties, '$.cost_micros') AS FLOAT64)) / 1e6, 4) AS cost_usd
FROM `{project}.events.raw`
WHERE event_name = 'cost.recorded'
  AND ts >= TIMESTAMP("{since_iso}")
  AND DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2, 3 ORDER BY cost_usd DESC NULLS LAST LIMIT 20
"""
    rows = bq(project, sql)
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    breakdown = []
    total = 0.0
    total_calls = 0
    for r in rows:
        cost = float(r.get("cost_usd") or 0)
        calls = int(r.get("calls") or 0)
        breakdown.append({"provider": r["provider"],
                          "operation": r["operation"],
                          "model": r["model"],
                          "calls": calls, "cost_usd": cost})
        total += cost
        total_calls += calls
    return {"total_usd": round(total, 4),
            "total_calls": total_calls,
            "breakdown": breakdown}


def bq_errors(project: str, since: datetime) -> dict:
    since_iso = iso(since)
    sql = f"""
SELECT path,
       COUNTIF(status >= 500) AS errs,
       COUNT(*) AS total
FROM `{project}.logs.raw`
WHERE ts >= TIMESTAMP("{since_iso}")
  AND DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND path IS NOT NULL
GROUP BY path
HAVING errs > 0
ORDER BY errs DESC LIMIT 10
"""
    rows = bq(project, sql)
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    return {"top": [{"path": r["path"],
                     "errs": int(r["errs"]),
                     "total": int(r["total"])} for r in rows]}


def bq_feedback(project: str, since: datetime) -> dict:
    since_iso = iso(since)
    sql = f"""
SELECT FORMAT_TIMESTAMP('%FT%TZ', ts) AS ts, kind, subject,
       SUBSTR(message, 1, 240) AS message, user_id
FROM `{project}.events.feedback`
WHERE ts >= TIMESTAMP("{since_iso}")
  AND DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY ts DESC LIMIT 20
"""
    rows = bq(project, sql)
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    return {"items": rows}



# ---------------------------------------------------------------------------
# dev-telemetry views (GA4 -> BigQuery export, shared `telemetry` dataset)
# ---------------------------------------------------------------------------

def telemetry_config(repo: str | None) -> dict | None:
    """Read <repo>/.telemetry.json. Returns None when the repo isn't on
    dev-telemetry (no file, unreadable, or no gcpProject)."""
    if not repo:
        return None
    path = Path(os.path.expanduser(repo)) / ".telemetry.json"
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    project = raw.get("gcpProject")
    if not project:
        return None
    dataset = (raw.get("views") or {}).get("dataset") or "telemetry"
    return {"project": project, "dataset": dataset,
            "account": telemetry_account(project, raw.get("gcpAccount"))}


def telemetry_account(project: str, pinned: str | None) -> str:
    """dev-telemetry account pinning: gcpAccount, else by project name."""
    if pinned:
        return pinned
    if project.startswith(("vibejar-", "popkr-")):
        return "john.kueh.dev@gmail.com"
    return "john.kueh@gmail.com"


def tel_window(since: datetime, until: datetime | None = None) -> str:
    """Event-time window over `telemetry.events`. Provisional (intraday)
    rows only count when the window reaches today; for closed past days
    the final daily export is the only source of truth."""
    since_iso = iso(since)
    clauses = [f'event_ts >= TIMESTAMP("{since_iso}")',
               f'event_date >= DATE_SUB(DATE(TIMESTAMP("{since_iso}")), INTERVAL 1 DAY)']
    if until is not None:
        clauses.append(f'event_ts < TIMESTAMP("{iso(until)}")')
        if until.date() < now_utc().date():
            clauses.append("NOT provisional")
    return "\n  AND ".join(clauses)


def tel_error(rows: list[dict]) -> dict | None:
    if rows and "_error" in rows[0]:
        return {"error": rows[0]["_error"]}
    return None


def tel_installs(t: dict, since: datetime) -> dict:
    """New prod app installs (IOS/ANDROID, not internal) by platform."""
    since_iso = iso(since)
    sql = f"""
SELECT platform,
       COUNTIF(first_seen_ts >= TIMESTAMP("{since_iso}")) AS new_installs,
       COUNTIF(first_seen_ts >= TIMESTAMP("{since_iso}") AND has_first_open) AS new_with_first_open,
       COUNT(*) AS total_installs
FROM `{t["project"]}.{t["dataset"]}.installs`
WHERE env = 'prod' AND NOT IFNULL(is_internal, FALSE)
  AND platform IN ('IOS', 'ANDROID')
GROUP BY platform ORDER BY platform
"""
    rows = bq(t["project"], sql, t["account"])
    if err := tel_error(rows):
        return err
    by_platform = [{"platform": r["platform"],
                    "new": int(r["new_installs"]),
                    "new_with_first_open": int(r["new_with_first_open"]),
                    "total": int(r["total_installs"])} for r in rows]
    return {"new": sum(p["new"] for p in by_platform),
            "total": sum(p["total"] for p in by_platform),
            "by_platform": by_platform}


def tel_active(t: dict, since: datetime) -> dict:
    """Distinct prod, non-internal installs with any event, by platform.
    WEB installs are the web readers."""
    sql = f"""
SELECT platform,
       COUNT(DISTINCT install_id) AS installs,
       COUNTIF(provisional) AS provisional_rows
FROM `{t["project"]}.{t["dataset"]}.events`
WHERE {tel_window(since)}
  AND env = 'prod' AND NOT IFNULL(is_internal, FALSE)
GROUP BY platform ORDER BY platform
"""
    rows = bq(t["project"], sql, t["account"])
    if err := tel_error(rows):
        return err
    by_platform = {r["platform"]: int(r["installs"]) for r in rows}
    return {"app_installs": sum(n for p, n in by_platform.items() if p != "WEB"),
            "web_readers": by_platform.get("WEB", 0),
            "by_platform": by_platform,
            "includes_provisional": any(int(r["provisional_rows"]) for r in rows)}


def tel_events(t: dict, since: datetime) -> dict:
    sql = f"""
SELECT event_name, COUNT(*) AS n,
       COUNT(DISTINCT install_id) AS installs
FROM `{t["project"]}.{t["dataset"]}.events`
WHERE {tel_window(since)}
  AND env = 'prod' AND NOT IFNULL(is_internal, FALSE)
GROUP BY event_name ORDER BY n DESC LIMIT 15
"""
    rows = bq(t["project"], sql, t["account"])
    if err := tel_error(rows):
        return err
    return {"top": [{"event_name": r["event_name"],
                     "n": int(r["n"]),
                     "installs": int(r["installs"])} for r in rows]}


def tel_purchases(t: dict, since: datetime) -> dict:
    """RevenueCat purchases. The view is optional; absent -> available=False."""
    since_iso = iso(since)
    sql = f"""
SELECT COUNTIF(is_first_paid) AS new_paid,
       COUNTIF(is_trial) AS trials,
       COUNTIF(is_refunded) AS refunds,
       ROUND(SUM(IF(is_paid AND NOT IFNULL(is_refunded, FALSE), price_usd, 0)), 2) AS revenue_usd
FROM `{t["project"]}.{t["dataset"]}.purchases`
WHERE purchased_at >= TIMESTAMP("{since_iso}")
"""
    rows = bq(t["project"], sql, t["account"])
    if err := tel_error(rows):
        if "Not found" in err["error"]:
            return {"available": False}
        return err
    r = rows[0] if rows else {}
    return {"available": True,
            "new_paid": int(r.get("new_paid") or 0),
            "trials": int(r.get("trials") or 0),
            "refunds": int(r.get("refunds") or 0),
            "revenue_usd": float(r.get("revenue_usd") or 0)}


def tel_freshness(t: dict, since: datetime) -> dict:
    """Per-stream data_through from source_health. A stream is stale when
    its final data ends before the window starts, so its zeros mean
    'not landed yet', not 'nothing happened'."""
    sql = f"""
SELECT source, stream,
       FORMAT_DATE('%F', data_through) AS data_through,
       FORMAT_TIMESTAMP('%FT%TZ', last_event_ts) AS last_event_ts,
       has_provisional, rows_yesterday
FROM `{t["project"]}.{t["dataset"]}.source_health`
ORDER BY source, stream
"""
    rows = bq(t["project"], sql, t["account"])
    if err := tel_error(rows):
        return err
    window_start = since.date().isoformat()
    streams = []
    for r in rows:
        through = r.get("data_through")
        streams.append({"source": r["source"], "stream": r["stream"],
                        "data_through": through,
                        "last_event_ts": r.get("last_event_ts"),
                        "has_provisional": r.get("has_provisional") in (True, "true"),
                        "rows_yesterday": int(r.get("rows_yesterday") or 0),
                        "stale": not through or through < window_start})
    return {"window_start": window_start,
            "any_stale": any(s["stale"] for s in streams),
            "streams": streams}



# ---------------------------------------------------------------------------
# x-monitor — read directly from per-handle archives
# ---------------------------------------------------------------------------

def x_monitor_home() -> Path:
    raw = os.environ.get("X_MONITOR_HOME") or "~/.cache/x-monitor"
    return Path(os.path.expandvars(os.path.expanduser(raw)))


def x_monitor_recent(since: datetime) -> dict:
    """Read each subscribed handle's tweet archive, filter to since."""
    home = x_monitor_home()
    state_file = home / "state.json"
    if not state_file.exists():
        return {"error": "x-monitor not set up (no state.json)"}
    try:
        state = json.loads(state_file.read_text())
    except json.JSONDecodeError as e:
        return {"error": f"could not parse x-monitor state: {e}"}

    subs = state.get("subscriptions", {})
    if not subs:
        return {"error": "x-monitor has no subscriptions"}

    results = []
    total_new = 0
    for handle, info in subs.items():
        archive = home / "tweets" / f"{handle}.jsonl"
        tweets: list[dict] = []
        if archive.exists():
            for line in archive.read_text().splitlines():
                line = line.strip()
                if not line: continue
                try:
                    t = json.loads(line)
                except json.JSONDecodeError:
                    continue
                created = t.get("created_at", "")
                # tweets store "2026-05-06T04:18:21.000Z" or similar
                if created and created[:19] >= since.strftime("%Y-%m-%dT%H:%M:%S"):
                    tweets.append(t)
        tweets.sort(key=lambda t: t.get("created_at", ""), reverse=True)
        total_new += len(tweets)
        results.append({
            "handle": handle,
            "name": info.get("name") or handle,
            "last_checked_at": info.get("last_checked_at"),
            "new_count": len(tweets),
            "tweets": tweets[:10],
        })
    return {"since": iso(since), "total_new": total_new, "results": results}


# ---------------------------------------------------------------------------
# project record
# ---------------------------------------------------------------------------

def load_projects() -> dict:
    return load_json(projects_path(), {"projects": {}})


def save_projects(data: dict) -> None:
    save_json(projects_path(), data)


def cmd_setup(_args) -> int:
    home_dir().mkdir(parents=True, exist_ok=True)
    runs_dir().mkdir(parents=True, exist_ok=True)
    if not projects_path().exists():
        save_projects({"projects": {}})
    if not state_path().exists():
        save_json(state_path(), {"projects": {}})
    print(f"daily-digest home: {home_dir()}")
    print(f"projects: {projects_path()}")
    print(f"state:    {state_path()}")
    return 0


def cmd_add(args) -> int:
    data = load_projects()
    if args.name in data["projects"] and not args.force:
        sys.exit(f"project {args.name!r} already exists; pass --force to overwrite")
    if not args.bq_project and not args.repo:
        sys.exit("pass --repo (dev-telemetry) and/or --bq-project (legacy bq-analytics)")
    data["projects"][args.name] = {
        "repo": os.path.abspath(os.path.expanduser(args.repo)) if args.repo else None,
        "bq_project": args.bq_project,
        "group_type": args.group_type,
        "description": args.description,
        "added_at": iso(now_utc()),
    }
    save_projects(data)
    print(f"added {args.name}")
    return 0


def cmd_rm(args) -> int:
    data = load_projects()
    if args.name not in data["projects"]:
        sys.exit(f"no such project: {args.name}")
    del data["projects"][args.name]
    save_projects(data)
    state = load_json(state_path(), {"projects": {}})
    state["projects"].pop(args.name, None)
    save_json(state_path(), state)
    print(f"removed {args.name}")
    return 0


def cmd_list(args) -> int:
    data = load_projects()
    if args.json:
        print(json.dumps(data, indent=2)); return 0
    if not data["projects"]:
        print("no projects configured (run `add` first)"); return 0
    for name, p in data["projects"].items():
        tel = telemetry_config(p.get("repo"))
        layout = "telemetry" if tel else ("bq-analytics" if p.get("bq_project") else "—")
        bq = (tel or {}).get("project") or p.get("bq_project") or "—"
        desc = p.get("description") or ""
        print(f"{name:24} layout={layout:12} bq={bq:24} {desc}")
    return 0


# ---------------------------------------------------------------------------
# check (the actual digest)
# ---------------------------------------------------------------------------

def project_since(name: str, override: timedelta | None) -> datetime:
    state = load_json(state_path(), {"projects": {}})
    last = state.get("projects", {}).get(name, {}).get("last_checked_at")
    if override is not None:
        return now_utc() - override
    if last:
        try:
            return parse_iso(last)
        except ValueError:
            pass
    return now_utc() - DEFAULT_LOOKBACK


def update_state(name: str) -> None:
    state = load_json(state_path(), {"projects": {}})
    state.setdefault("projects", {})
    state["projects"][name] = {"last_checked_at": iso(now_utc())}
    save_json(state_path(), state)


def digest_project(name: str, cfg: dict, since: datetime) -> dict:
    out: dict = {
        "name": name,
        "since": iso(since),
        "description": cfg.get("description"),
    }
    tel = telemetry_config(cfg.get("repo"))
    bq_proj = cfg.get("bq_project")
    if tel:
        out["layout"] = "telemetry"
        out["telemetry"] = {"project": tel["project"], "dataset": tel["dataset"]}
        out["freshness"] = tel_freshness(tel, since)
        out["installs"] = tel_installs(tel, since)
        out["active"] = tel_active(tel, since)
        out["activities"] = tel_events(tel, since)
        out["purchases"] = tel_purchases(tel, since)
    elif bq_proj:
        out["layout"] = "bq-analytics"
        out["users"] = bq_users(bq_proj, since, cfg.get("group_type"))
        out["activities"] = bq_activities(bq_proj, since)
        out["costs"] = bq_costs(bq_proj, since)
        out["errors"] = bq_errors(bq_proj, since)
        out["feedback"] = bq_feedback(bq_proj, since)
    else:
        out["bq_skipped"] = "no .telemetry.json in repo and no bq_project configured"

    return out


def cmd_check(args) -> int:
    data = load_projects()
    overrides = parse_duration(args.since) if args.since else None
    targets = ([args.project] if args.project else list(data["projects"].keys()))
    if not targets:
        sys.exit("no projects configured")

    started = now_utc()
    # x-monitor window: same as the widest project window, default 24h.
    xm_since = now_utc() - (overrides or DEFAULT_LOOKBACK)
    digest = {
        "generated_at": iso(started),
        "projects": [],
        "x_monitor": x_monitor_recent(xm_since),
    }
    for name in targets:
        cfg = data["projects"].get(name)
        if not cfg:
            digest["projects"].append({"name": name,
                                       "error": "not configured"})
            continue
        since = project_since(name, overrides)
        digest["projects"].append(digest_project(name, cfg, since))
        if not args.no_state:
            update_state(name)

    runs_dir().mkdir(parents=True, exist_ok=True)
    run_file = runs_dir() / (started.strftime("%Y-%m-%dT%H-%M-%SZ") + ".json")
    run_file.write_text(json.dumps(digest, indent=2))
    digest["run_file"] = str(run_file)

    if args.json:
        print(json.dumps(digest, indent=2))
    else:
        print(f"wrote {run_file}")
        print(f"projects: {[p['name'] for p in digest['projects']]}")
    return 0


# ---------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(prog="daily_digest")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("setup").set_defaults(func=cmd_setup)

    a = sub.add_parser("add")
    a.add_argument("name")
    a.add_argument("--repo", help="repo root; .telemetry.json there selects the dev-telemetry views")
    a.add_argument("--bq-project", help="GCP project for the legacy bq-analytics tables")
    a.add_argument("--group-type", help="bq-analytics group_type to attach to signups (e.g. household, workspace)")
    a.add_argument("--description")
    a.add_argument("--force", action="store_true")
    a.set_defaults(func=cmd_add)

    r = sub.add_parser("rm"); r.add_argument("name"); r.set_defaults(func=cmd_rm)

    l = sub.add_parser("list"); l.add_argument("--json", action="store_true")
    l.set_defaults(func=cmd_list)

    c = sub.add_parser("check")
    c.add_argument("--project")
    c.add_argument("--since", help="lookback override, e.g. 24h, 7d")
    c.add_argument("--json", action="store_true")
    c.add_argument("--no-state", action="store_true",
                   help="don't advance last_checked_at (for ad-hoc runs)")
    c.set_defaults(func=cmd_check)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
