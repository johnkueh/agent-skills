# marketing-aeo

Track whether ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews, and Google
AI Mode cite or mention your site for the questions your buyers ask. One
DataForSEO key covers every default surface; results live in `./.aeo/` (SQLite +
raw responses) and export to JSONL or CSV.

```bash
export DATAFORSEO_API_KEY=...        # base64 of login:password
alias aeo='<this-skill-dir>/aeo'     # needs bun
aeo init --country US
aeo domain add example.com --own --brand "Example"
aeo query add "best invoicing tool for agencies"
aeo run --dry-run && aeo run
aeo report --days 7
```

See [SKILL.md](SKILL.md) for the full workflow and
[reference/providers.md](reference/providers.md) for endpoints and prices.
