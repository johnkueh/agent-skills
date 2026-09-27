---
name: marketing-serp
description: "Analyze geo-targeted Google SERPs with DataForSEO, including rankings, competitors, snippets, PAA, and content gaps. Use for who-ranks queries, SERP analysis, ranking domains, or search-result research; supports dry-run costs."
---

# SERP data (DataForSEO)

Shows who ranks for a keyword in a specific country, which SERP features appear, and
where a domain is missing. Ordinary web fetches can't pin a search to a location; this
can.

Run everything from this skill directory with `uv run python cli.py …`.

## Setup

Set `DATAFORSEO_API_KEY` to the base64 of your DataForSEO `login:password`
(`echo -n 'login:pass' | base64`). Load it from the user's secret manager or
environment; keep it out of chat and the repo.

Transient errors (429/503/504) retry 3 times with 2s/4s backoff. `dataforseo.py` is
synced from `scripts/shared/dataforseo.py` in this repo; edit that copy.

Calls are cheap (about $0.003 per keyword), but use `--dry-run` to preview cost and
stay inside the budget the user gave you. `balance`, `costs`, and `locations` are free.

## Commands

| Command | Use it to | Cost |
|---|---|---|
| `serp "kw"` | see the organic top 10/20 and SERP features for one keyword | ~$0.003 / 10 results (`-a` all features: $0.004) |
| `bulk "kw1" "kw2" …` | find which domains rank across a set of keywords | ~$0.003 / keyword |
| `features "question kw"` | featured snippet holder, People Also Ask, related searches, knowledge graph, and suggestions | ~$0.004 / 10 results |
| `gaps domain.com "kw1" …` | keywords where a domain misses the top 20, its current ranks elsewhere, and who holds #1 | ~$0.003 / keyword |
| `balance`, `costs`, `locations` | check account and shortcuts | free |

Options (`--device`, `-a`, and `-j` are `serp` only; `-o` is `serp` and `bulk`):

| Option | Meaning |
|---|---|
| `-l`, `--location` | `au` (default), `us`, `uk`, `ca`, `nz`, or a numeric code |
| `-d`, `--depth` | number of results (default 10 or 20) |
| `--device` | `desktop` (default) or `mobile` |
| `-a`, `--advanced` | include every SERP feature |
| `-o`, `--output` | also write a CSV to a chosen path |
| `-j`, `--json-output` | also save the raw JSON |
| `--dry-run` | preview cost without calling |

## A research pass

```bash
uv run python cli.py balance

# Who dominates the category? (~$0.03 for 10 keywords)
uv run python cli.py bulk "liquidator" "voluntary administration" "doca" "winding up"

# One SERP in detail
uv run python cli.py serp "rocap form" --location au -a

# Snippet and PAA openings on question keywords
uv run python cli.py features "what is voluntary administration"

# Where does my site not rank?
uv run python cli.py gaps example.com "liquidator" "doca" "form 507"
```

Pair it with `marketing-keyword-data`: find and size keywords there, then check the
high-volume ones here with `bulk`, `features`, and `gaps`.

## Output

Every call saves a CSV to `results/` as `{command}_{keyword}_{location}_{timestamp}.csv`.

- `serp` / `bulk`: rank, domain, title, url, description.
- `features`: featured snippet (domain, title, content), PAA questions, related
  searches, knowledge graph, organic rankings.
- `gaps`: keyword, domain_rank (null when not ranking), top_competitor, top_rank.
