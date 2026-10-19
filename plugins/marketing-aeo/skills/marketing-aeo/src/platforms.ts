// One entry per answer surface: how to call it and how to read citations back.
// Request builders and parsers are pure so they can be tested against recorded
// fixtures; auth headers are added by `callPlatform` from environment variables.

import { hostOf, normalizeUrl } from "./util.ts";

export type CitationKind = "source" | "retrieved";

export interface Citation {
  url: string;
  domain: string;
  title: string | null;
  position: number;
  kind: CitationKind;
}

export interface Parsed {
  answerText: string;
  answerPresent: boolean;
  citations: Citation[];
  model: string | null;
  costUsd: number;
  meta: Record<string, unknown>;
}

export interface RunConfig {
  country: string; // ISO 3166-1 alpha-2, e.g. "US"
  locationCode: number; // DataForSEO location code
  languageCode: string; // e.g. "en"
  models: Record<string, string>;
  chatgptForceWebSearch: boolean;
}

type Provider = "dataforseo" | "openai" | "gemini" | "anthropic";

export interface PlatformDef {
  id: string;
  label: string;
  provider: Provider;
  envVar: string;
  /** Rough per-check USD used by `run --dry-run` until real history exists. Verified 2026-10-19. */
  estimateUsd: number;
  defaultModel: string | null;
  how: string;
  request(query: string, cfg: RunConfig): { url: string; body: unknown };
  /** Body for the retry attempt, when a simpler request is more likely to succeed. */
  retryRequest?(query: string, cfg: RunConfig): { url: string; body: unknown };
  parse(json: unknown): Parsed;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** What the failed call was still billed (DataForSEO bills some task errors). */
    readonly costUsd = 0,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Pricing (USD). Verified 2026-10-19 against each provider's pricing page.

/** Per-1M-token rates for the native providers' default models. */
export const TOKEN_RATES: Record<string, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};
export const OPENAI_WEB_SEARCH_PER_CALL = 0.01; // $10 / 1k calls
export const GEMINI_SEARCH_PER_QUERY = 0.014; // $14 / 1k after 5,000 free/month (Gemini 3+)
export const ANTHROPIC_WEB_SEARCH_PER_CALL = 0.01; // $10 / 1k searches

function rateFor(model: string, fallback: string): { input: number; output: number } {
  const key = Object.keys(TOKEN_RATES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  return TOKEN_RATES[key ?? fallback] ?? { input: 0, output: 0 };
}

function tokenCost(model: string, fallback: string, input: number, output: number): number {
  const r = rateFor(model, fallback);
  return (input / 1e6) * r.input + (output / 1e6) * r.output;
}

// ---------------------------------------------------------------------------
// Helpers

type J = Record<string, any>;

function asObj(x: unknown): J {
  return x && typeof x === "object" ? (x as J) : {};
}

function arr(x: unknown): any[] {
  return Array.isArray(x) ? x : [];
}

class CitationList {
  private seen = new Map<string, Citation>();

  add(rawUrl: unknown, title: unknown, kind: CitationKind, domainHint?: unknown): void {
    if (typeof rawUrl !== "string" || !/^https?:\/\//i.test(rawUrl)) return;
    const url = normalizeUrl(rawUrl);
    const existing = this.seen.get(url);
    if (existing) {
      if (existing.kind === "retrieved" && kind === "source") existing.kind = "source";
      return;
    }
    const domain = hostOf(url) || (typeof domainHint === "string" ? domainHint.replace(/^www\./, "") : "");
    this.seen.set(url, {
      url,
      domain,
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      position: 0,
      kind,
    });
  }

  list(): Citation[] {
    const all = [...this.seen.values()];
    // Positions are 1-based within each kind, in first-seen order.
    for (const kind of ["source", "retrieved"] as const) {
      let i = 0;
      for (const c of all) if (c.kind === kind) c.position = ++i;
    }
    return all;
  }
}

/** Unwrap the DataForSEO envelope: returns the task, its first result, and the billed cost. */
// 40101 internal SE error, 40202 rate limit, 5xxxx server errors: worth one retry.
const dfsRetryable = (code: number) => code >= 50000 || code === 40101 || code === 40202;

function dfsTask(json: unknown): { task: J; result: J | null; cost: number } {
  const root = asObj(json);
  if (root.status_code !== 20000) {
    const code = Number(root.status_code);
    throw new ProviderError(`dataforseo ${code}: ${root.status_message ?? "error"}`, dfsRetryable(code));
  }
  const task = asObj(arr(root.tasks)[0]);
  const code = Number(task.status_code);
  const cost = Number(task.cost ?? root.cost ?? 0) || 0;
  // 40102 = "No Search Results": a valid, billed-or-free empty answer.
  if (code === 40102) return { task, result: null, cost };
  if (code !== 20000) {
    throw new ProviderError(`dataforseo ${code}: ${task.status_message ?? "task error"}`, dfsRetryable(code), cost);
  }
  return { task, result: arr(task.result)[0] ? asObj(arr(task.result)[0]) : null, cost };
}

function empty(model: string | null, cost: number, meta: Record<string, unknown> = {}): Parsed {
  return { answerText: "", answerPresent: false, citations: [], model, costUsd: cost, meta };
}

// --- DataForSEO LLM Scraper (ChatGPT, Gemini consumer UIs) -----------------

export function parseDfsScraper(json: unknown): Parsed {
  const { result, cost } = dfsTask(json);
  if (!result) return empty(null, cost);
  const cites = new CitationList();
  for (const s of arr(result.sources)) cites.add(s.url, s.title, "source", s.domain);
  for (const item of arr(result.items)) for (const s of arr(item.sources)) cites.add(s.url, s.title, "source", s.domain);
  for (const s of arr(result.search_results)) cites.add(s.url, s.title, "retrieved", s.domain);
  const answerText = typeof result.markdown === "string" ? result.markdown : "";
  return {
    answerText,
    answerPresent: answerText.trim().length > 0,
    citations: cites.list(),
    model: typeof result.model === "string" ? result.model : null,
    costUsd: cost,
    meta: {
      fan_out_queries: result.fan_out_queries ?? null,
      brand_entities: arr(result.brand_entities).map((b) => b.title).filter(Boolean),
      check_url: result.check_url ?? null,
    },
  };
}

// --- DataForSEO LLM Responses (Perplexity, Claude) -------------------------

export function parseDfsLlmResponses(json: unknown): Parsed {
  const { result, cost } = dfsTask(json);
  if (!result) return empty(null, cost);
  const cites = new CitationList();
  const parts: string[] = [];
  for (const item of arr(result.items)) {
    if (item.type !== "message") continue;
    for (const section of arr(item.sections)) {
      if (typeof section.text === "string") parts.push(section.text);
      for (const a of arr(section.annotations)) cites.add(a.direct_url ?? a.url, a.title, "source");
    }
  }
  const answerText = parts.join("");
  return {
    answerText,
    answerPresent: answerText.trim().length > 0,
    citations: cites.list(),
    model: typeof result.model_name === "string" ? result.model_name : null,
    costUsd: cost,
    meta: {
      web_search: result.web_search ?? null,
      fan_out_queries: result.fan_out_queries ?? null,
      input_tokens: result.input_tokens ?? null,
      output_tokens: result.output_tokens ?? null,
    },
  };
}

// --- DataForSEO SERP: Google AI Overview / AI Mode -------------------------

function collectReferences(node: unknown, cites: CitationList): void {
  if (Array.isArray(node)) {
    for (const n of node) collectReferences(n, cites);
    return;
  }
  const o = asObj(node);
  for (const ref of arr(o.references)) cites.add(ref.url, ref.title, "source", ref.domain);
  for (const [k, v] of Object.entries(o)) {
    if (k !== "references" && v && typeof v === "object") collectReferences(v, cites);
  }
}

export function parseDfsAiOverview(json: unknown): Parsed {
  const { result, cost } = dfsTask(json);
  if (!result) return empty(null, cost, { ai_overview_present: false });
  const overviews = arr(result.items).filter((i) => i.type === "ai_overview");
  const cites = new CitationList();
  for (const ov of overviews) collectReferences(ov, cites);
  const answerText = overviews
    .map((o) => (typeof o.markdown === "string" ? o.markdown : ""))
    .join("\n\n")
    .trim();
  return {
    answerText,
    answerPresent: overviews.length > 0,
    citations: cites.list(),
    model: null,
    costUsd: cost,
    meta: { ai_overview_present: overviews.length > 0, item_types: result.item_types ?? null },
  };
}

// --- OpenAI Responses API + web_search -------------------------------------

export function parseOpenAI(json: unknown): Parsed {
  const r = asObj(json);
  if (r.error) throw new ProviderError(`openai: ${asObj(r.error).message ?? "error"}`, false);
  const cites = new CitationList();
  const parts: string[] = [];
  let searchCalls = 0;
  for (const out of arr(r.output)) {
    if (out.type === "web_search_call") {
      searchCalls += 1;
      for (const s of arr(asObj(out.action).sources)) cites.add(s.url, s.title, "retrieved");
    }
    if (out.type !== "message") continue;
    for (const c of arr(out.content)) {
      if (c.type !== "output_text") continue;
      parts.push(String(c.text ?? ""));
      for (const a of arr(c.annotations)) if (a.type === "url_citation") cites.add(a.url, a.title, "source");
    }
  }
  const reported = Number(asObj(asObj(r.tool_usage).web_search).num_requests);
  if (Number.isFinite(reported) && reported > 0) searchCalls = reported;
  const usage = asObj(r.usage);
  const model = String(r.model ?? "");
  const costUsd =
    tokenCost(model, "gpt-5-mini", Number(usage.input_tokens ?? 0), Number(usage.output_tokens ?? 0)) +
    searchCalls * OPENAI_WEB_SEARCH_PER_CALL;
  const answerText = parts.join("\n").trim();
  return {
    answerText,
    answerPresent: answerText.length > 0,
    citations: cites.list(),
    model: model || null,
    costUsd,
    meta: { web_search_calls: searchCalls, input_tokens: usage.input_tokens ?? null, output_tokens: usage.output_tokens ?? null },
  };
}

// --- Gemini API + Google Search grounding ----------------------------------

const GEMINI_REDIRECT_HOST = "vertexaisearch.cloud.google.com";

/** Unresolved grounding redirects carry the source domain in the chunk title. */
function applyTitleDomains(citations: Citation[]): void {
  for (const c of citations) {
    if (hostOf(c.url) === GEMINI_REDIRECT_HOST && c.title && /^[\w.-]+\.[a-z]{2,}$/i.test(c.title)) {
      c.domain = c.title.toLowerCase().replace(/^www\./, "");
    }
  }
}

export function parseGemini(json: unknown): Parsed {
  const r = asObj(json);
  if (r.error) {
    const e = asObj(r.error);
    throw new ProviderError(`gemini ${e.code ?? ""}: ${e.message ?? "error"}`.trim(), Number(e.code) >= 500);
  }
  const cand = asObj(arr(r.candidates)[0]);
  const parts = arr(asObj(cand.content).parts)
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean);
  const gm = asObj(cand.groundingMetadata);
  const cites = new CitationList();
  for (const chunk of arr(gm.groundingChunks)) {
    const web = asObj(chunk.web);
    // web.uri is a vertexaisearch redirect; web.title is usually the source domain.
    cites.add(web.uri, web.title, "source", web.title);
  }
  const queries = arr(gm.webSearchQueries);
  const usage = asObj(r.usageMetadata);
  const model = String(r.modelVersion ?? "");
  const output = Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0);
  const costUsd =
    tokenCost(model, "gemini-3.5-flash-lite", Number(usage.promptTokenCount ?? 0), output) +
    queries.length * GEMINI_SEARCH_PER_QUERY;
  const answerText = parts.join("").trim();
  const citations = cites.list();
  applyTitleDomains(citations);
  return {
    answerText,
    answerPresent: answerText.length > 0,
    citations,
    model: model || null,
    costUsd,
    meta: { web_search_queries: queries },
  };
}

// --- Anthropic Messages API + web_search -----------------------------------

export function parseAnthropic(json: unknown): Parsed {
  const r = asObj(json);
  if (r.type === "error" || r.error) {
    const e = asObj(r.error);
    throw new ProviderError(`anthropic ${e.type ?? ""}: ${e.message ?? "error"}`.trim(), e.type === "overloaded_error");
  }
  const cites = new CitationList();
  const parts: string[] = [];
  for (const block of arr(r.content)) {
    if (block.type === "text") {
      parts.push(String(block.text ?? ""));
      for (const c of arr(block.citations)) cites.add(c.url, c.title, "source");
    } else if (block.type === "web_search_tool_result") {
      for (const res of arr(block.content)) cites.add(res.url, res.title, "retrieved");
    }
  }
  const usage = asObj(r.usage);
  const searches = Number(asObj(usage.server_tool_use).web_search_requests ?? 0);
  const model = String(r.model ?? "");
  const costUsd =
    tokenCost(model, "claude-haiku-4-5", Number(usage.input_tokens ?? 0), Number(usage.output_tokens ?? 0)) +
    searches * ANTHROPIC_WEB_SEARCH_PER_CALL;
  const answerText = parts.join("").trim();
  return {
    answerText,
    answerPresent: answerText.length > 0,
    citations: cites.list(),
    model: model || null,
    costUsd,
    meta: { web_search_requests: searches, stop_reason: r.stop_reason ?? null },
  };
}

// ---------------------------------------------------------------------------
// Platform table

const DFS = "https://api.dataforseo.com/v3";

function model(cfg: RunConfig, id: string, fallback: string): string {
  return cfg.models[id] || fallback;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "chatgpt",
    label: "ChatGPT (chatgpt.com answer)",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.004,
    defaultModel: null,
    how: "DataForSEO LLM Scraper, live",
    request: (q, cfg) => ({
      url: `${DFS}/ai_optimization/chat_gpt/llm_scraper/live/advanced`,
      body: [
        {
          keyword: q,
          location_code: cfg.locationCode,
          language_code: cfg.languageCode,
          ...(cfg.chatgptForceWebSearch ? { force_web_search: true } : {}),
        },
      ],
    }),
    parse: parseDfsScraper,
  },
  {
    id: "perplexity",
    label: "Perplexity (Sonar)",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.006,
    defaultModel: "sonar",
    how: "DataForSEO LLM Responses, live",
    request: (q, cfg) => ({
      url: `${DFS}/ai_optimization/perplexity/llm_responses/live`,
      body: [{ user_prompt: q.slice(0, 500), model_name: model(cfg, "perplexity", "sonar"), web_search_country_iso_code: cfg.country }],
    }),
    parse: parseDfsLlmResponses,
  },
  {
    id: "gemini",
    label: "Gemini (gemini.google.com answer)",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.004,
    defaultModel: null,
    how: "DataForSEO LLM Scraper, live",
    request: (q, cfg) => ({
      url: `${DFS}/ai_optimization/gemini/llm_scraper/live/advanced`,
      body: [{ keyword: q, location_code: cfg.locationCode, language_code: cfg.languageCode }],
    }),
    parse: parseDfsScraper,
  },
  {
    id: "claude",
    label: "Claude (API model + web search)",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.025,
    defaultModel: "claude-haiku-4-5",
    how: "DataForSEO LLM Responses, live, web_search on",
    request: (q, cfg) => ({
      url: `${DFS}/ai_optimization/claude/llm_responses/live`,
      body: [{ user_prompt: q.slice(0, 500), model_name: model(cfg, "claude", "claude-haiku-4-5"), web_search: true }],
    }),
    parse: parseDfsLlmResponses,
  },
  {
    id: "google-aio",
    label: "Google AI Overview",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.002,
    defaultModel: null,
    how: "DataForSEO Google Organic SERP, live, load_async_ai_overview",
    request: (q, cfg) => ({
      url: `${DFS}/serp/google/organic/live/advanced`,
      body: [{ keyword: q, location_code: cfg.locationCode, language_code: cfg.languageCode, depth: 10, load_async_ai_overview: true }],
    }),
    // Some queries fail with 40101 only when async AI Overview loading is on; retry without it.
    retryRequest: (q, cfg) => ({
      url: `${DFS}/serp/google/organic/live/advanced`,
      body: [{ keyword: q, location_code: cfg.locationCode, language_code: cfg.languageCode, depth: 10 }],
    }),
    parse: parseDfsAiOverview,
  },
  {
    id: "google-ai-mode",
    label: "Google AI Mode",
    provider: "dataforseo",
    envVar: "DATAFORSEO_API_KEY",
    estimateUsd: 0.004,
    defaultModel: null,
    how: "DataForSEO Google AI Mode SERP, live",
    request: (q, cfg) => ({
      url: `${DFS}/serp/google/ai_mode/live/advanced`,
      body: [{ keyword: q, location_code: cfg.locationCode, language_code: cfg.languageCode }],
    }),
    parse: parseDfsAiOverview,
  },
  {
    id: "chatgpt-api",
    label: "OpenAI API + web_search (optional)",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    estimateUsd: 0.015,
    defaultModel: "gpt-5-mini",
    how: "OpenAI Responses API, web_search tool",
    request: (q, cfg) => ({
      url: "https://api.openai.com/v1/responses",
      body: {
        model: model(cfg, "chatgpt-api", "gpt-5-mini"),
        input: q,
        tools: [{ type: "web_search", user_location: { type: "approximate", country: cfg.country } }],
        include: ["web_search_call.action.sources"],
        reasoning: { effort: "low" },
        store: false,
      },
    }),
    parse: parseOpenAI,
  },
  {
    id: "gemini-api",
    label: "Gemini API + Google Search grounding (optional)",
    provider: "gemini",
    envVar: "GEMINI_API_KEY",
    estimateUsd: 0.02,
    defaultModel: "gemini-3.5-flash-lite",
    how: "Gemini generateContent, google_search tool",
    request: (q, cfg) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model(cfg, "gemini-api", "gemini-3.5-flash-lite")}:generateContent`,
      body: { contents: [{ role: "user", parts: [{ text: q }] }], tools: [{ google_search: {} }] },
    }),
    parse: parseGemini,
  },
  {
    id: "claude-api",
    label: "Anthropic API + web_search (optional)",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    estimateUsd: 0.03,
    defaultModel: "claude-haiku-4-5",
    how: "Anthropic Messages API, web_search_20250305 tool",
    request: (q, cfg) => ({
      url: "https://api.anthropic.com/v1/messages",
      body: {
        model: model(cfg, "claude-api", "claude-haiku-4-5"),
        max_tokens: 2048,
        messages: [{ role: "user", content: q }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: cfg.country } }],
      },
    }),
    parse: parseAnthropic,
  },
];

export const DEFAULT_PLATFORMS = ["chatgpt", "perplexity", "gemini", "claude", "google-aio", "google-ai-mode"];

export function platformById(id: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

function authHeaders(p: PlatformDef): Record<string, string> {
  const key = process.env[p.envVar] ?? "";
  if (!key) throw new ProviderError(`${p.envVar} is not set`, false);
  switch (p.provider) {
    case "dataforseo":
      return { Authorization: `Basic ${key}` };
    case "openai":
      return { Authorization: `Bearer ${key}` };
    case "gemini":
      return { "x-goog-api-key": key };
    case "anthropic":
      return { "x-api-key": key, "anthropic-version": "2023-06-01" };
    default:
      return {};
  }
}

/** Follow Gemini grounding redirects (free HEAD/GET, no body) to the real source URL. */
async function resolveRedirects(parsed: Parsed): Promise<void> {
  await Promise.all(
    parsed.citations.map(async (c) => {
      if (hostOf(c.url) !== GEMINI_REDIRECT_HOST) return;
      try {
        const res = await fetch(c.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000) });
        const loc = res.headers.get("location");
        if (loc && /^https?:\/\//.test(loc)) {
          c.url = normalizeUrl(loc);
          c.domain = hostOf(c.url) || c.domain;
        }
      } catch {
        // keep the redirect URL; domain already falls back to the chunk title
      }
    }),
  );
  applyTitleDomains(parsed.citations);
}

export interface CallResult {
  request: unknown;
  response: unknown;
  parsed: Parsed;
  latencyMs: number;
}

export async function callPlatform(p: PlatformDef, query: string, cfg: RunConfig): Promise<CallResult> {
  const headers = { "Content-Type": "application/json", ...authHeaders(p) };
  const started = Date.now();
  let lastError: unknown;
  let lastBody: unknown = null;
  let lastResponse: unknown = null;
  let spent = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { url, body } = attempt > 0 && p.retryRequest ? p.retryRequest(query, cfg) : p.request(query, cfg);
    lastBody = body;
    if (attempt > 0) await Bun.sleep(3000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        lastResponse = { http_status: res.status, body: text.slice(0, 2000) };
        throw new ProviderError(`${p.provider}: HTTP ${res.status} non-JSON body`, res.status >= 500 || res.status === 429);
      }
      lastResponse = json;
      if (!res.ok && p.provider !== "dataforseo") {
        // Let the parser turn the provider's error body into a message, then mark retryability by status.
        try {
          p.parse(json);
        } catch (e) {
          throw new ProviderError((e as Error).message, res.status >= 500 || res.status === 429);
        }
        throw new ProviderError(`${p.provider}: HTTP ${res.status}`, res.status >= 500 || res.status === 429);
      }
      const parsed = p.parse(json);
      parsed.costUsd += spent;
      if (p.provider === "gemini") await resolveRedirects(parsed);
      return { request: body, response: json, parsed, latencyMs: Date.now() - started };
    } catch (e) {
      lastError = e;
      if (e instanceof ProviderError) spent += e.costUsd;
      const retryable = e instanceof ProviderError ? e.retryable : true; // network errors / timeouts
      if (!retryable) break;
    }
  }
  const err = lastError instanceof Error ? lastError : new Error(String(lastError));
  throw Object.assign(err, { request: lastBody, response: lastResponse, spentUsd: spent });
}
