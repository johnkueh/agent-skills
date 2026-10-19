import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeCheck, buildReport, proseOnly } from "./analyze.ts";
import {
  parseAnthropic,
  parseDfsAiOverview,
  parseDfsLlmResponses,
  parseDfsScraper,
  parseGemini,
  parseOpenAI,
  PLATFORMS,
  ProviderError,
  type Parsed,
} from "./platforms.ts";
import { defaultConfig, runConfig, Store, type CheckRow, type CitationRow, type DomainRow } from "./store.ts";
import { cleanDomain, domainMatches, mentions, normalizeUrl, toCsv } from "./util.ts";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "fixtures", `${name}.json`), "utf8"));
const sources = (p: Parsed) => p.citations.filter((c) => c.kind === "source");
const retrieved = (p: Parsed) => p.citations.filter((c) => c.kind === "retrieved");

describe("citation parsers (recorded responses)", () => {
  test("DataForSEO ChatGPT scraper: cited sources vs retrieved search results, utm stripped", () => {
    const p = parseDfsScraper(fixture("dfs_chatgpt_scraper"));
    expect(p.model).toBe("gpt-6");
    expect(p.answerPresent).toBe(true);
    expect(p.costUsd).toBe(0.004);
    expect(sources(p).length).toBe(7);
    expect(retrieved(p).length).toBe(11);
    expect(sources(p)[0]).toMatchObject({ url: "https://asic.gov.au", domain: "asic.gov.au", position: 1 });
    expect(p.citations.some((c) => c.url.includes("utm_source"))).toBe(false);
  });

  test("DataForSEO Gemini scraper", () => {
    const p = parseDfsScraper(fixture("dfs_gemini_scraper"));
    expect(p.model).toBe("3.5 Flash-Lite");
    expect(sources(p).map((c) => c.domain)).toContain("insolvencynotices.com.au");
    expect(retrieved(p).length).toBe(0);
  });

  test("DataForSEO Perplexity LLM Responses", () => {
    const p = parseDfsLlmResponses(fixture("dfs_perplexity_llm_responses"));
    expect(p.model).toBe("sonar");
    expect(sources(p).length).toBe(10);
    expect(p.costUsd).toBeCloseTo(0.005912, 6);
    expect(p.answerText.length).toBeGreaterThan(1000);
  });

  test("DataForSEO Claude LLM Responses: sections joined, annotations deduped", () => {
    const p = parseDfsLlmResponses(fixture("dfs_claude_llm_responses"));
    expect(p.model).toBe("claude-haiku-4-5-20251001");
    expect(sources(p).map((c) => c.domain)).toEqual([
      "arita.com.au",
      "worrells.net.au",
      "asicpublishednotices.au",
      "wynnadvisory.com.au",
    ]);
    expect(p.meta.fan_out_queries).toEqual(["monitor company insolvency notices Australia"]);
  });

  test("DataForSEO Google AI Overview: nested references collected", () => {
    const p = parseDfsAiOverview(fixture("dfs_google_aio_present"));
    expect(p.answerPresent).toBe(true);
    expect(sources(p).length).toBe(10);
    expect(sources(p).map((c) => c.domain)).toContain("medical.lilly.com");
  });

  test("DataForSEO Google SERP without an AI Overview is a valid empty answer", () => {
    const p = parseDfsAiOverview(fixture("dfs_google_aio_absent"));
    expect(p.answerPresent).toBe(false);
    expect(p.citations).toEqual([]);
    expect(p.costUsd).toBe(0.002);
  });

  test("DataForSEO Google AI Mode", () => {
    const p = parseDfsAiOverview(fixture("dfs_google_ai_mode"));
    expect(p.answerPresent).toBe(true);
    expect(sources(p).map((c) => c.domain)).toEqual([
      "publishednotices.asic.gov.au",
      "asic.gov.au",
      "insolvencynotices.com.au",
      "ggadvisory.com.au",
    ]);
  });

  test("OpenAI Responses web_search: url_citation = source, action.sources = retrieved, cost from usage", () => {
    const p = parseOpenAI(fixture("openai_responses_web_search"));
    expect(p.model).toBe("gpt-5-mini-2025-08-07");
    expect(sources(p).length).toBe(4);
    expect(retrieved(p).length).toBe(22);
    expect(p.meta.web_search_calls).toBe(1);
    // 8853 in * $0.25/M + 1666 out * $2/M + 1 search * $0.01
    expect(p.costUsd).toBeCloseTo(0.0155453, 6);
  });

  test("Gemini grounding: redirect URLs keep the chunk-title domain", () => {
    const p = parseGemini(fixture("gemini_generate_grounded"));
    expect(sources(p).map((c) => c.domain)).toEqual(["asic.gov.au", "example-alerts.com"]);
    expect(p.answerText).toContain("Example Alerts");
    expect(p.meta.web_search_queries).toHaveLength(2);
  });

  test("Anthropic web_search: text citations = source, tool results = retrieved", () => {
    const p = parseAnthropic(fixture("anthropic_messages_web_search"));
    expect(sources(p).map((c) => c.url)).toEqual(["https://en.wikipedia.org/wiki/Claude_Shannon"]);
    expect(retrieved(p).map((c) => c.domain)).toEqual(["britannica.com"]);
    expect(p.costUsd).toBeCloseTo((6039 * 1 + 931 * 5) / 1e6 + 0.01, 6);
  });

  test("provider errors surface as ProviderError", () => {
    expect(() => parseDfsScraper({ status_code: 40100, status_message: "You are not authorized" })).toThrow(ProviderError);
    expect(() =>
      parseDfsScraper({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field" }] }),
    ).toThrow("40501");
    try {
      parseDfsAiOverview({ status_code: 20000, tasks: [{ status_code: 40101, status_message: "Internal SE Server Error.", cost: 0.002 }] });
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as ProviderError).retryable).toBe(true);
      expect((e as ProviderError).costUsd).toBe(0.002); // DataForSEO still bills this
    }
    expect(() => parseGemini({ error: { code: 402, message: "credits depleted" } })).toThrow("402");
    expect(() => parseOpenAI({ error: { message: "bad key" } })).toThrow("bad key");
  });
});

describe("request builders", () => {
  const cfg = runConfig(defaultConfig("AU"));
  test("every platform builds a JSON body with the query in it", () => {
    for (const p of PLATFORMS) {
      const { url, body } = p.request("best crm for agencies", cfg);
      expect(url.startsWith("https://")).toBe(true);
      expect(JSON.stringify(body)).toContain("best crm for agencies");
    }
  });
  test("country flows into DataForSEO location and native user_location", () => {
    const aio = PLATFORMS.find((p) => p.id === "google-aio")?.request("q", cfg).body as { location_code: number }[];
    expect(aio[0]?.location_code).toBe(2036);
    const oa = PLATFORMS.find((p) => p.id === "chatgpt-api")?.request("q", cfg).body as { tools: { user_location: { country: string } }[] };
    expect(oa.tools[0]?.user_location.country).toBe("AU");
  });
});

describe("matching and analysis", () => {
  test("url and domain helpers", () => {
    expect(normalizeUrl("https://WWW.Example.com/a?utm_source=chatgpt.com&id=2#x")).toBe("https://www.example.com/a?id=2");
    expect(cleanDomain("https://www.Example.com/pricing")).toBe("example.com");
    expect(domainMatches("blog.example.com", "example.com")).toBe(true);
    expect(domainMatches("notexample.com", "example.com")).toBe(false);
    expect(mentions("Try Acme's tracker", "Acme")).toBe(true);
    expect(mentions("Acmeville is a town", "Acme")).toBe(false);
    expect(proseOnly("see [docs](https://acme.com/x) or https://acme.com")).not.toContain("acme.com");
    expect(toCsv([{ a: 'x,"y"', b: [1] }])).toBe('a,b\n"x,""y""",[1]\n');
  });

  const domains: DomainRow[] = [
    { id: 1, domain: "acme.com", role: "own", brands: ["Acme"] },
    { id: 2, domain: "rival.io", role: "competitor", brands: [] },
  ];
  const check = (id: number, platform: string, text: string): CheckRow => ({
    id, run_id: 1, ts: new Date().toISOString(), query: "best tool", platform, provider: "dataforseo", model: null,
    country: "US", status: "ok", error: null, answer_present: 1, answer_text: text, cost_usd: 0.004, latency_ms: 1,
    raw_path: null, meta: null,
  });
  const cit = (check_id: number, url: string, kind: "source" | "retrieved" = "source"): CitationRow => ({
    check_id, url, domain: new URL(url).hostname.replace(/^www\./, ""), title: null, position: 1, kind,
  });

  test("cited vs named vs retrieved-only", () => {
    const a = analyzeCheck(check(1, "chatgpt", "Acme is good. See [rival](https://rival.io)."), [cit(1, "https://docs.acme.com/x"), cit(1, "https://rival.io")], domains);
    expect(a.ownCited).toBe(true);
    expect(a.ownMentioned).toBe(true);
    expect(a.ownUrls).toEqual(["https://docs.acme.com/x"]);
    expect([...a.cited].sort()).toEqual(["acme.com", "rival.io"]);
    const b = analyzeCheck(check(2, "chatgpt", "Use something else."), [cit(2, "https://acme.com/p", "retrieved")], domains);
    expect(b.ownCited).toBe(false);
    expect(b.ownRetrieved).toBe(true);
  });

  test("report aggregates per query x platform", () => {
    const checks = [check(1, "chatgpt", "Acme"), check(2, "chatgpt", "nothing"), check(3, "perplexity", "x")];
    const cits = new Map([[1, [cit(1, "https://acme.com/a")]], [2, [cit(2, "https://rival.io/b")]], [3, []]]);
    const r = buildReport(checks, cits, domains, 7, "");
    const gpt = r.cells.find((c) => c.platform === "chatgpt");
    expect(gpt).toMatchObject({ checks: 2, cited: 1, mentioned: 1, topCompetitor: "rival.io (1)" });
    expect(r.ownUrls).toEqual([{ url: "https://acme.com/a", count: 1, platforms: ["chatgpt"], queries: ["best tool"] }]);
    expect(r.costUsd).toBeCloseTo(0.012, 6);
  });
});

describe("store", () => {
  test("init, queries, domains, checks, raw round-trip", () => {
    const dir = mkdtempSync(join(tmpdir(), "aeo-test-"));
    try {
      const store = Store.init(dir, defaultConfig("GB"));
      expect(store.config().location_code).toBe(2826);
      expect(store.addQuery("best crm", null)).toBe(true);
      expect(store.addQuery("best crm", null)).toBe(false);
      store.addDomain("acme.com", "own", ["Acme"]);
      const ts = new Date().toISOString();
      const raw = store.writeRaw(ts, "chatgpt", "best crm", { hello: "world" });
      const id = store.insertCheck(
        { run_id: null, ts, query: "best crm", platform: "chatgpt", provider: "dataforseo", model: "m", country: "GB", status: "ok", error: null, answer_present: 1, answer_text: "Acme", cost_usd: 0.004, latency_ms: 5, raw_path: raw, meta: null },
        [{ url: "https://acme.com", domain: "acme.com", title: null, position: 1, kind: "source" }],
      );
      expect(store.readRaw(raw)).toEqual({ hello: "world" });
      expect(store.citationsFor([id]).get(id)?.length).toBe(1);
      expect(store.avgCostByPlatform().get("chatgpt")).toBeCloseTo(0.004, 6);
      store.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
