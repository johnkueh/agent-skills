---
name: marketing-keyword-data
description: "Research keywords with DataForSEO, including volume, intent, difficulty, CPC, and suggestions. Use for SEO research, content planning, long-tail ideas, search intent, or keyword opportunities; supports dry-run cost previews."
---

# Keyword data (DataForSEO)

A CLI for search volume, intent, difficulty, CPC, and competitor keywords.
`suggestions` and `related` return clickstream-refined volumes, which are better for
niche terms. `volume` uses Google Ads data for broad coverage.

Run everything from this skill directory with `uv run python cli.py …`.
Options, filters, output fields, full costs, and the Python helpers are in
[REFERENCE.md](REFERENCE.md).

## Setup

Set `DATAFORSEO_API_KEY` to the base64 of your DataForSEO `login:password`
(`echo -n 'login:pass' | base64`). Load it from the user's secret manager or
environment; keep it out of chat and the repo.

Transient errors (429/503/504) retry 3 times with 2s/4s backoff. `dataforseo.py` is
synced from `scripts/shared/dataforseo.py` in this repo; edit that copy.

## The one cost rule

`volume` costs a flat ~$0.075 for 1 to 1,000 keywords. Discover broadly, then send
everything to `volume` in one call. Fifty single-keyword calls cost ~$3.75; the same
research batched costs ~$0.25.

Use `--dry-run` on any paid command to see the estimated cost and balance first, and
stay inside the budget the user gave you. `balance`, `costs`, and `analyze.py` are free.

## A research session

```bash
uv run python cli.py balance

# 1. Discover (~$0.02–0.04 each)
uv run python cli.py suggestions "insolvency" --limit 100
uv run python cli.py suggestions "liquidation" --limit 100
uv run python cli.py related "voluntary administration" --limit 50

# 2. Combine, then drop keywords you already have volume for
uv run python analyze.py combine > /tmp/all_keywords.txt
uv run python analyze.py find-new /tmp/all_keywords.txt

# 3. One batched volume call (~$0.075)
tr '\n' '\0' < /tmp/all_keywords.txt | xargs -0 uv run python cli.py volume

# 4. Report
uv run python analyze.py report results/volume_*.csv -o report.md
uv run python analyze.py summary results/volume_*.csv --min-volume 50
```

500+ keywords typically cost $0.25–0.50.

## Commands

| Command | What it returns | Cost |
|---|---|---|
| `volume kw1 kw2 …` | volume, intent, CPC, competition (`-d` adds difficulty, `--no-intent` skips intent) | ~$0.077 per ≤1,000 |
| `suggestions "seed" --limit N` | long-tail ideas containing the seed | ~$0.02–0.04 |
| `related "kw"` | semantically related keywords | ~$0.02–0.04 |
| `domain-overview a.com b.com` | keyword count, estimated traffic and its value | ~$0.01/domain |
| `ranked-keywords a.com --max-pos 20 --min-vol 50` | every keyword a domain ranks for, with URL | ~$0.02–0.05 |
| `intersection a.com b.com --min-vol 40` | keywords both domains rank for | ~$0.02 |
| `competitors a.com` | rival domains by shared keywords | ~$0.01 |
| `keywords-for-site a.com` | terms a domain ranks for and bids on | ~$0.02 |

Every command takes `--location` (default `2036` Australia; `2840` US, `2826` UK,
`2124` Canada) and `--language` (default `en`). Filter `suggestions` and `related`
server-side with `--filter <field> <operator> <value>`, for example
`--filter "keyword" "regex" "(how|what|when)"`.

## Competitor research

Rather than guessing seeds, take them from sites that already rank:

1. `domain-overview` a few rivals to see who has real traffic.
2. `ranked-keywords` on the leaders to harvest their terms.
3. `intersection` two close rivals to find the proven category keywords.
4. `competitors` to find rivals you didn't know about.
5. Batch the harvest through `volume` for fresh intent and CPC.

## Results

Every call saves a CSV to `results/` as `{command}_{seed}_{timestamp}.csv`, so nothing
is lost if the session ends. `analyze.py list-files` shows them.
