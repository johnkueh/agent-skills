---
name: marketing-aeo
description: >-
  Track whether AI answer engines (ChatGPT, Perplexity, Gemini, Claude, Google AI
  Overview, Google AI Mode) cite or mention a site for a set of buyer questions,
  with citation rates over time, own vs competitor domains, and which URLs got
  cited. One DataForSEO key covers every default surface; OpenAI, Gemini, and
  Anthropic APIs are optional extras. Triggers on "AEO", "GEO", "AI search
  visibility", "are we cited in ChatGPT", "does Perplexity mention us",
  "AI Overview citations", "track AI answers for these queries", "who does
  ChatGPT recommend instead of us", "LLM visibility report".
---

# marketing-aeo

`aeo` asks each answer engine your buyer questions, stores the answer, its cited
sources, and the raw response, then reports how often your domain is **cited**
(in the answer's sources) or **named** (brand or domain in the answer text).

Runs with **bun**, zero install. Data lives in the project you run it from:
`<project>/.aeo/` (SQLite `aeo.sqlite`, gzipped raw responses in `raw/`,
`config.json`). The directory gitignores itself.

```bash
alias aeo='<this-skill-dir>/aeo'   # or: bun <this-skill-dir>/src/cli.ts
```

## Setup: you do 1 thing, I do the rest

1. You: export `DATAFORSEO_API_KEY` = base64 of your DataForSEO `login:password`
   (`printf '%s' 'login:password' | base64`). It is sent as `Authorization: Basic`.

Optional, only if you enable the native surfaces: `OPENAI_API_KEY`,
`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`. Keep keys in your shell profile, secret
manager, or an untracked `.env`; never in the repo or in chat.

Then I run, from the user's project directory:

```bash
aeo init --country US          # ISO country; sets DataForSEO location + search locale
aeo doctor                     # free pings: key validity, DataForSEO balance
aeo domain add example.com --own --brand "Example"
aeo domain add rival.com --competitor
aeo query add "best invoicing tool for agencies"
aeo run --dry-run              # checks x est. cost; nothing is called
aeo run --max-cost 1.00        # refuses if the estimate is higher
```

Before adding queries, read the project (README, landing copy, pricing, docs) and
write 10-20 questions a buyer would type into ChatGPT: category ("best X for Y"),
comparison ("X vs Y"), problem ("how do I ..."), and one brand query ("what is
Example"). Phrase them as questions, not keywords. Bulk add with
`aeo query import queries.txt` (one per line). Add `--brand` names whenever the
brand differs from the domain, or "named" undercounts.

## Platforms

| id | surface | how | est. USD/check |
|---|---|---|---|
| `chatgpt` | chatgpt.com answer | DataForSEO LLM Scraper (live) | 0.004 |
| `perplexity` | Perplexity Sonar | DataForSEO LLM Responses (live) | ~0.006 |
| `gemini` | gemini.google.com answer | DataForSEO LLM Scraper (live) | 0.004 |
| `claude` | Claude API + web search | DataForSEO LLM Responses (live) | ~0.025 |
| `google-aio` | Google AI Overview | DataForSEO SERP organic + async AIO | 0.002 |
| `google-ai-mode` | Google AI Mode | DataForSEO SERP AI Mode (live) | 0.004 |
| `chatgpt-api` | OpenAI API, `web_search` | OpenAI Responses (optional) | ~0.015 |
| `gemini-api` | Gemini API, Search grounding | Gemini generateContent (optional) | ~0.02 |
| `claude-api` | Anthropic API, `web_search` | Anthropic Messages (optional) | ~0.03 |

The first six are on by default. The scraper surfaces (`chatgpt`, `gemini`) are
the consumer apps; the `*-api` and `claude` surfaces are API models with search,
which cite differently from the apps. Report them separately; never merge them.
`aeo platforms` shows the live list; `aeo config set platforms a,b,c` changes the
default set; `aeo config set model.claude claude-sonnet-4-5` swaps a model.
Full default run ≈ $0.045 per query, so 20 queries daily ≈ $0.90/day. Drop
`claude` (half the cost) or run it weekly if spend matters.
Prices, endpoints, and why each was chosen: `reference/providers.md`.

## Daily run

```bash
aeo run                                   # every query x enabled platform
aeo run --platform chatgpt,google-aio     # subset
aeo run --query "best invoicing tool"     # one query (text or id)
aeo report --days 7
```

Schedule it with whatever scheduler the host provides, from the project
directory. Answers are stochastic: judge rates over 7-30 days, not single runs.

## Reading results

| Question | Command |
|---|---|
| Cited / named rate per query x platform, competitors, our cited URLs | `aeo report --days 7` |
| Who gets cited instead of us | `aeo competitors --days 30` |
| One query over time | `aeo history --query "..."` |
| Spend | `aeo cost --by platform` (or `day`, `provider`) |
| Load elsewhere | `aeo export --format jsonl\|csv [--what checks\|citations] -o file` |
| Why did this check look wrong | `aeo raw <check_id>` |

`report` columns: **cited** = own domain (or a subdomain) in the answer's
sources; **named** = a brand term or the domain appears in the answer prose
(links stripped); **retrieved only** = the engine fetched your page but did not
cite it (ChatGPT scraper, OpenAI, Anthropic expose this); **answer shown** =
the surface produced an answer (Google often shows no AI Overview). Scores are
computed at report time, so domains added later re-score old answers. Every
command takes `--json`.

## Gotchas

- **No AI Overview is a result, not an error.** `google-aio` stores the check with
  `answer shown 0/1`. Some queries fail with DataForSEO 40101 only when async
  AIO loading is on; the CLI retries once without it.
- **DataForSEO bills some failed tasks** (e.g. 40101 at $0.002). Those costs are
  recorded on the error row, so `aeo cost` matches the invoice.
- **Gemini API grounding links are redirects** (`vertexaisearch.cloud.google.com`).
  The CLI follows them to the real URL and falls back to the chunk title's
  domain. Gemini 2.5 models are closed to new API users; default is
  `gemini-3.5-flash-lite` (first 5,000 searches/month free, then $14/1k).
- **Brand-name lookalikes** show up in `competitors` (e.g. a similarly named
  domain). That's a real visibility problem worth reporting.
- **Live endpoints only.** DataForSEO's standard queue is cheaper (scraper and AI
  Mode $0.0012) but can take up to 45 minutes; not wired up.
- **Location matters.** `--country` drives DataForSEO `location_code` and the
  native APIs' search locale. `aeo config set location_code <code>` for a
  country without a built-in mapping.
- **Errors never zero a run.** A failing platform is stored as an `error` row
  with its raw response; the rest of the run continues. `run` exits non-zero
  only when every check fails.

## Files

- `aeo`: bash wrapper → `bun src/cli.ts`
- `src/platforms.ts`: request builders, response parsers, price table (date-stamped)
- `src/store.ts`: SQLite schema, raw response storage, project config
- `src/analyze.ts`: cited / named / retrieved scoring and report aggregation
- `src/aeo.test.ts` + `fixtures/`: parser tests on recorded responses (`bun test`)
