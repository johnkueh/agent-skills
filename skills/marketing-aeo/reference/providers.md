# Providers, prices, and why

Checked 2026-10-19 against each provider's docs and pricing pages. Re-verify
anything here older than ~6 months before quoting it.

## Default: one DataForSEO key

| Surface | Endpoint | Price (live) | Citations come from |
|---|---|---|---|
| ChatGPT app | `POST /v3/ai_optimization/chat_gpt/llm_scraper/live/advanced` | $0.004/result (standard queue $0.0012, priority $0.0024) | `result.sources[]` (cited) and `result.search_results[]` (retrieved) |
| Gemini app | `POST /v3/ai_optimization/gemini/llm_scraper/live/advanced` | same as ChatGPT scraper | `result.sources[]`, `items[].sources[]` |
| Perplexity | `POST /v3/ai_optimization/perplexity/llm_responses/live`, `model_name: sonar` | $0.0006/task + LLM cost (observed ~$0.006 total) | `items[type=message].sections[].annotations[]` |
| Claude | `POST /v3/ai_optimization/claude/llm_responses/live`, `web_search: true` | $0.0006/task + LLM cost (observed ~$0.023 with `claude-haiku-4-5`) | same shape as Perplexity |
| Google AI Overview | `POST /v3/serp/google/organic/live/advanced`, `load_async_ai_overview: true`, `depth: 10` | $0.002 base; docs say async AIO doubles it to $0.004, observed $0.002 | `items[type=ai_overview]`, `references[]` at every nesting level |
| Google AI Mode | `POST /v3/serp/google/ai_mode/live/advanced` | $0.004 (standard $0.0012, priority $0.0024) | same as AI Overview |

Notes:

- LLM Responses standard (task) mode costs $0.0002/task + a $0.01 refundable
  advance; Perplexity is live-only. Live is used everywhere for simplicity.
- The LLM Scraper returns what the consumer app shows (the ChatGPT result above
  reported model `gpt-6`, Gemini `3.5 Flash-Lite`), which is what buyers see.
  This replaced the old Firecrawl scrape of chatgpt.com / perplexity.ai, which
  timed out under concurrency and needed a second LLM pass to extract citations.
- Model lists are free: `GET /v3/ai_optimization/<platform>/llm_responses/models`.
  Balance check (free): `GET /v3/appendix/user_data`.
- Limits: 2,000 calls/min; 30 concurrent live tasks per platform.
- Some tasks fail with `40101 Internal SE Server Error` and are still billed.
- DataForSEO also sells **LLM Mentions** (`/v3/ai_optimization/llm_mentions/...`,
  from $0.10/task + $0.001/row): an aggregate database of where a domain or brand
  is mentioned. It answers "how visible are we overall", not "what does ChatGPT
  say to this exact question today", so it is not used here.

## Optional native APIs

| id | API | Price | Notes |
|---|---|---|---|
| `chatgpt-api` | OpenAI Responses + `web_search` tool, default `gpt-5-mini` | $10/1k search calls + tokens ($0.25 in / $2.00 out per 1M) | `url_citation` annotations = cited; `include: ["web_search_call.action.sources"]` gives retrieved. Observed ~$0.015/check. |
| `gemini-api` | Gemini `generateContent` + `google_search`, default `gemini-3.5-flash-lite` | 5,000 searches/month free across Gemini 3+, then $14/1k; tokens $0.30 in / $2.50 out per 1M | `groundingMetadata.groundingChunks[].web` (`uri` is a redirect, `title` the domain). Gemini 2.5 models are closed to new users. |
| `claude-api` | Anthropic Messages + `web_search_20250305`, default `claude-haiku-4-5` | $10/1k searches + tokens ($1 in / $5 out per 1M) | text-block `citations[]` = cited; `web_search_tool_result` = retrieved. `max_uses: 3`. |

Perplexity has no native provider: Sonar Chat Completions support ended
2026-09-27 and its replacement, the Agent API, runs third-party models with a
`web_search` tool ($2.50/1k), so it is not "the Perplexity answer". DataForSEO's
`perplexity/llm_responses` still serves Sonar models.

Override any default model with `aeo config set model.<platform> <model>`.
Unknown models fall back to the default model's token rates for cost estimates.
