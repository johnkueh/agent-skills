# Keyword Data reference

Detail for [SKILL.md](SKILL.md). Run every command from the skill directory.

## Server-side filters

Filter `suggestions` and `related` results server-side:

```bash
# Keywords containing "definition"
uv run python cli.py suggestions "insolvency" --filter "keyword" "like" "%definition%"

# Question keywords
uv run python cli.py suggestions "insolvency" --filter "keyword" "regex" "(how|what|when)"

# Volume > 100
uv run python cli.py suggestions "software" --location 2840 --filter "keyword_info.search_volume" ">" "100"
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `like` | SQL LIKE pattern | `%software%` |
| `regex` | Regular expression | `(how\|what)` |
| `>`, `<`, `>=`, `<=` | Numeric comparison | `100` |
| `=`, `<>` | Equals / not equals | `LOW` |

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview cost before executing |
| `--location` | Location code (default: 2036 = Australia) |
| `--language` | Language code (default: en) |
| `--output` / `-o` | Save results to CSV file |
| `--limit` | Max results for suggestions/related |
| `--filter` | Server-side filter (field operator value) |
| `-d` / `--with-difficulty` | Include keyword difficulty scores |
| `--no-intent` | Skip search intent classification (saves ~$0.001) |

## Cost Reference

| Command | Cost |
|---------|------|
| `volume` (up to 1000 keywords) | $0.075 + $0.001 (intent) |
| `volume -d` | +$0.01 + $0.0001/keyword |
| `volume --no-intent` | $0.075 (skip intent) |
| `suggestions` (+ clickstream) | $0.02 + $0.0002/result |
| `related` (+ clickstream) | $0.02 + $0.0002/result |
| `ranked-keywords` (Labs) | ~$0.02-0.05 |
| `domain-overview` (Labs) | ~$0.01/domain |
| `intersection` (Labs) | ~$0.02 |
| `competitors` (Labs) | ~$0.01 |
| `keywords-for-site` (Labs) | ~$0.02 |
| `balance` | FREE |
| `costs` | FREE |
| `analyze.py *` | FREE (local) |

## Output Fields

| Field | Description |
|-------|-------------|
| keyword | The search term |
| search_volume | Monthly search volume |
| keyword_difficulty | Difficulty to rank (0-100) |
| intent | Primary search intent (informational/transactional/commercial/navigational) |
| intent_prob | Confidence of primary intent (0-1) |
| secondary_intent | Secondary intent if present |
| cpc | Cost per click in Google Ads |
| competition | Competition level (LOW/MEDIUM/HIGH) |

## Saved results

All results are automatically saved to:
```
<skill-dir>/results/
```

Filenames: `{command}_{seed}_{timestamp}.csv`

Examples:
- `volume_liquidator_2026-02-05_112358.csv`
- `suggestions_insolvency_2026-02-05_113045.csv`
- `related_voluntary-administration_2026-02-05_114522.csv`

This ensures data is never lost if the chat session ends.

## Python helpers (analyze.py)

```python
from analyze import (
    extract_keywords,
    combine_suggestion_files,
    find_new_keywords,
    filter_keywords,
    summarize_volume,
    categorize_keywords,
    generate_report,
)

# Extract keywords from CSV
keywords = extract_keywords("results/suggestions_insolvency.csv")

# Combine all suggestion files
all_keywords = combine_suggestion_files("suggestions_*.csv")

# Find keywords not in existing volume data
new_keywords = find_new_keywords(discovered_keywords, "results/volume_existing.csv")

# Filter out irrelevant keywords (default excludes non-AU geographic terms)
filtered = filter_keywords(keywords, exclude_patterns=["phoenix", "california"])

# Get summary with min volume threshold
summary = summarize_volume("results/volume_batch.csv", min_volume=10)

# Categorize by topic
categories = categorize_keywords([(kw, vol) for kw, vol in keywords_with_volume])

# Generate markdown report
report = generate_report("results/volume_batch.csv", "report.md")
```
