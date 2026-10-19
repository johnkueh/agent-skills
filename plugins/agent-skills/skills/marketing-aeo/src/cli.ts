#!/usr/bin/env bun
/**
 * aeo: track whether AI answer engines cite or mention a site for a set of
 * buyer questions. Data lives in <project>/.aeo/ (SQLite + gzipped raw responses).
 *
 * Run from the project directory: `aeo <command>`; `aeo help` lists commands.
 * Secrets come only from environment variables (see `aeo platforms`).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { buildReport, checkRecord } from "./analyze.ts";
import { DEFAULT_PLATFORMS, PLATFORMS, callPlatform, platformById, type PlatformDef } from "./platforms.ts";
import { COUNTRY_LOCATION, defaultConfig, runConfig, Store, type CheckRow } from "./store.ts";
import { cleanDomain, mapLimit, pct, table, toCsv, usd } from "./util.ts";

const HELP = `aeo: AI answer-engine citation tracking (data in ./.aeo/)

  init [--country US] [--language en]       create .aeo/ here
  doctor                                    check keys with free API pings
  platforms                                 list surfaces, providers, env vars, est. cost
  config show | config set <key> <value>    country, language_code, location_code, platforms,
                                            concurrency, chatgpt_force_web_search, model.<platform>
  query add <text> [--tag t] | list | remove <id|text> | import <file>
  domain add <domain> --own|--competitor [--brand "Name"]... | list | remove <domain>
  run [--platform a,b] [--query <text|id>] [--dry-run] [--max-cost 1.00] [--concurrency 4]
  report [--days 7] [--platform a,b] [--json]
  competitors [--days 30] [--limit 20] [--json]
  history --query <text|id> [--days 30] [--platform a,b] [--json]
  cost [--days 30] [--by platform|day|provider] [--json]
  export [--what checks|citations] [--format jsonl|csv] [--days 30] [-o file]
  raw <check_id>                            print the stored raw request/response
`;

const cwd = process.cwd();
const [cmd, ...rest] = process.argv.slice(2);

function opts<const O extends ParseArgsOptionsConfig>(args: string[], options: O) {
  return parseArgs({ args, options, allowPositionals: true, strict: true });
}

function sinceDays(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function splitList(v: string | undefined): string[] | undefined {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
}

function resolveQuery(store: Store, v: string): string {
  if (/^\d+$/.test(v)) {
    const q = store.queries(true).find((x) => x.id === Number(v));
    if (q) return q.text;
  }
  return v;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function print(json: boolean, data: unknown, text: () => string): void {
  console.log(json ? JSON.stringify(data, null, 2) : text());
}

// ---------------------------------------------------------------------------

async function cmdInit(args: string[]) {
  const { values } = opts(args, { country: { type: "string" }, language: { type: "string" } });
  const country = (values.country ?? "US").toUpperCase();
  if (!COUNTRY_LOCATION[country]) {
    console.error(`note: no built-in DataForSEO location for ${country}; set it with \`aeo config set location_code <code>\`.`);
  }
  const existed = existsSync(`${Store.dirFor(cwd)}/config.json`);
  Store.init(cwd, defaultConfig(country, values.language ?? "en"));
  console.log(existed ? "Already initialized: .aeo/ (left config as is)" : `Initialized .aeo/ (country ${country}). It ignores itself in git.`);
  console.log("Next: aeo doctor, then aeo domain add <yours> --own, aeo query add \"...\", aeo run --dry-run");
}

async function ping(url: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: (e as Error).message } };
  }
}

async function cmdDoctor() {
  let failed = false;
  const line = (ok: boolean | null, label: string, detail: string) => {
    if (ok === false) failed = true;
    console.log(`${ok === null ? "SKIP" : ok ? "OK  " : "FAIL"}  ${label.padEnd(18)} ${detail}`);
  };
  line(true, "bun", Bun.version);
  let enabled = DEFAULT_PLATFORMS;
  if (existsSync(`${Store.dirFor(cwd)}/config.json`)) {
    const store = Store.open(cwd);
    const c = store.config();
    enabled = c.platforms;
    line(true, "project", `.aeo/ country=${c.country} location=${c.location_code} platforms=${c.platforms.join(",")}`);
    line(store.queries().length > 0, "queries", `${store.queries().length} active`);
    line(store.domains().some((d) => d.role === "own"), "own domain", store.domains().filter((d) => d.role === "own").map((d) => d.domain).join(", ") || "none: aeo domain add <domain> --own");
  } else {
    line(null, "project", "no .aeo/ here (aeo init)");
  }
  const needed = new Set(enabled.map((id) => platformById(id)?.envVar).filter(Boolean));
  const check = async (envVar: string, label: string, fn: (key: string) => Promise<[boolean, string]>) => {
    const key = process.env[envVar];
    if (!key) {
      line(needed.has(envVar) ? false : null, label, `${envVar} not set${needed.has(envVar) ? " (needed by enabled platforms)" : " (optional)"}`);
      return;
    }
    const [ok, detail] = await fn(key);
    line(ok, label, detail);
  };
  await check("DATAFORSEO_API_KEY", "dataforseo", async (k) => {
    const r = await ping("https://api.dataforseo.com/v3/appendix/user_data", { Authorization: `Basic ${k}` });
    const bal = r.json?.tasks?.[0]?.result?.[0]?.money?.balance;
    return r.json?.status_code === 20000 ? [true, `balance $${Number(bal).toFixed(2)}`] : [false, `auth failed (${r.json?.status_message ?? r.status}); value must be base64("login:password")`];
  });
  await check("OPENAI_API_KEY", "openai", async (k) => {
    const r = await ping("https://api.openai.com/v1/models", { Authorization: `Bearer ${k}` });
    return r.ok ? [true, "key valid"] : [false, `HTTP ${r.status}`];
  });
  await check("GEMINI_API_KEY", "gemini", async (k) => {
    const r = await ping("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { "x-goog-api-key": k });
    return r.ok ? [true, "key valid (billing/credits not checked)"] : [false, `HTTP ${r.status}`];
  });
  await check("ANTHROPIC_API_KEY", "anthropic", async (k) => {
    const r = await ping("https://api.anthropic.com/v1/models?limit=1", { "x-api-key": k, "anthropic-version": "2023-06-01" });
    return r.ok ? [true, "key valid"] : [false, `HTTP ${r.status}`];
  });
  process.exit(failed ? 1 : 0);
}

function cmdPlatforms() {
  const store = existsSync(`${Store.dirFor(cwd)}/config.json`) ? Store.open(cwd) : null;
  const enabled = new Set(store?.config().platforms ?? DEFAULT_PLATFORMS);
  const models = store?.config().models ?? {};
  console.log(
    table(
      ["platform", "on", "provider", "env var", "model", "est/check", "how"],
      PLATFORMS.map((p) => [p.id, enabled.has(p.id) ? "yes" : "", p.provider, p.envVar, models[p.id] ?? p.defaultModel ?? "-", usd(p.estimateUsd), p.how]),
    ),
  );
}

function cmdConfig(args: string[]) {
  const store = Store.open(cwd);
  const [sub, key, ...valueParts] = args;
  const c = store.config();
  if (!sub || sub === "show") {
    console.log(JSON.stringify(c, null, 2));
    return;
  }
  if (sub !== "set" || !key || valueParts.length === 0) fail("usage: aeo config set <key> <value>");
  const value = valueParts.join(" ");
  if (key.startsWith("model.")) {
    const id = key.slice(6);
    if (!platformById(id)) fail(`unknown platform ${id}`);
    c.models[id] = value;
  } else if (key === "platforms") {
    const list = splitList(value) ?? [];
    for (const id of list) if (!platformById(id)) fail(`unknown platform ${id}`);
    c.platforms = list;
  } else if (key === "country") {
    c.country = value.toUpperCase();
    c.location_code = COUNTRY_LOCATION[c.country] ?? c.location_code;
  } else if (key === "location_code" || key === "concurrency") {
    c[key] = Number(value);
  } else if (key === "language_code") {
    c.language_code = value;
  } else if (key === "chatgpt_force_web_search") {
    c.chatgpt_force_web_search = value === "true" || value === "1";
  } else {
    fail(`unknown key ${key}`);
  }
  store.saveConfig(c);
  console.log(JSON.stringify(c, null, 2));
}

function cmdQuery(args: string[]) {
  const store = Store.open(cwd);
  const [sub, ...more] = args;
  if (sub === "add") {
    const { values, positionals } = opts(more, { tag: { type: "string" } });
    const text = positionals.join(" ").trim();
    if (!text) fail("usage: aeo query add <text>");
    console.log(store.addQuery(text, values.tag ?? null) ? `added: ${text}` : `exists: ${text}`);
  } else if (sub === "import") {
    const file = more[0];
    if (!file) fail("usage: aeo query import <file> (one query per line)");
    let n = 0;
    for (const l of readFileSync(file, "utf8").split("\n")) if (l.trim() && !l.startsWith("#") && store.addQuery(l.trim(), null)) n++;
    console.log(`added ${n} queries`);
  } else if (sub === "remove") {
    const v = more.join(" ");
    console.log(store.removeQuery(v) ? `removed ${v}` : `not found: ${v}`);
  } else {
    const qs = store.queries();
    console.log(qs.length ? table(["id", "tag", "query"], qs.map((q) => [q.id, q.tag ?? "", q.text])) : "no queries: aeo query add \"...\"");
  }
}

function cmdDomain(args: string[]) {
  const store = Store.open(cwd);
  const [sub, ...more] = args;
  if (sub === "add") {
    const { values, positionals } = opts(more, {
      own: { type: "boolean" },
      competitor: { type: "boolean" },
      brand: { type: "string", multiple: true },
    });
    const domain = cleanDomain(positionals[0] ?? "");
    if (!domain || values.own === values.competitor) fail("usage: aeo domain add <domain> --own|--competitor [--brand Name]");
    store.addDomain(domain, values.own ? "own" : "competitor", values.brand ?? []);
    console.log(`${values.own ? "own" : "competitor"}: ${domain}${values.brand?.length ? ` (brands: ${values.brand.join(", ")})` : ""}`);
  } else if (sub === "remove") {
    const d = cleanDomain(more[0] ?? "");
    console.log(store.removeDomain(d) ? `removed ${d}` : `not found: ${d}`);
  } else {
    const ds = store.domains();
    console.log(ds.length ? table(["role", "domain", "brand terms"], ds.map((d) => [d.role, d.domain, d.brands.join(", ")])) : "no domains: aeo domain add <domain> --own");
  }
}

function estimateFor(p: PlatformDef, history: Map<string, number>): number {
  return history.get(p.id) ?? p.estimateUsd;
}

async function cmdRun(args: string[]) {
  const { values } = opts(args, {
    platform: { type: "string", short: "p" },
    query: { type: "string", short: "q" },
    "dry-run": { type: "boolean" },
    "max-cost": { type: "string" },
    concurrency: { type: "string" },
  });
  const store = Store.open(cwd);
  const cfg = store.config();
  const ids = splitList(values.platform) ?? cfg.platforms;
  const platforms = ids.map((id) => platformById(id) ?? fail(`unknown platform ${id} (see aeo platforms)`));
  const queries = values.query ? [resolveQuery(store, values.query)] : store.queries().map((q) => q.text);
  if (!queries.length) fail("no queries: aeo query add \"...\"");
  if (!store.domains().some((d) => d.role === "own")) console.error("warning: no own domain set; citations are stored but nothing is scored as yours");

  const history = store.avgCostByPlatform();
  const perQuery = platforms.reduce((s, p) => s + estimateFor(p, history), 0);
  const estimate = perQuery * queries.length;
  const breakdown = platforms.map((p) => [p.id, p.provider, usd(estimateFor(p, history)), history.has(p.id) ? "history" : "list price"]);
  if (values["dry-run"]) {
    console.log(table(["platform", "provider", "est/check", "basis"], breakdown));
    console.log(`\n${queries.length} queries x ${platforms.length} platforms = ${queries.length * platforms.length} checks, est. ${usd(estimate)}`);
    const missing = [...new Set(platforms.map((p) => p.envVar))].filter((v) => !process.env[v]);
    if (missing.length) console.log(`missing env: ${missing.join(", ")}`);
    return;
  }
  const max = values["max-cost"] ? Number(values["max-cost"]) : null;
  if (max !== null && estimate > max) fail(`estimate ${usd(estimate)} exceeds --max-cost ${usd(max)}; narrow with --platform/--query`);
  for (const v of new Set(platforms.map((p) => p.envVar))) if (!process.env[v]) fail(`${v} is not set (needed by ${platforms.filter((p) => p.envVar === v).map((p) => p.id).join(", ")})`);

  const runId = store.startRun(ids, estimate);
  const rc = runConfig(cfg);
  const jobs = queries.flatMap((q) => platforms.map((p) => ({ q, p })));
  const domains = store.domains();
  const concurrency = Number(values.concurrency ?? process.env.AEO_CONCURRENCY ?? cfg.concurrency) || 4;
  console.error(`run ${runId}: ${jobs.length} checks, est. ${usd(estimate)}, concurrency ${concurrency}`);

  const rows = await mapLimit(jobs, concurrency, async ({ q, p }) => {
    const ts = new Date().toISOString();
    const base = { run_id: runId, ts, query: q, platform: p.id, provider: p.provider, country: cfg.country };
    try {
      const r = await callPlatform(p, q, rc);
      const raw_path = store.writeRaw(ts, p.id, q, { platform: p.id, query: q, request: r.request, response: r.response });
      const id = store.insertCheck(
        {
          ...base,
          model: r.parsed.model ?? cfg.models[p.id] ?? p.defaultModel,
          status: "ok",
          error: null,
          answer_present: r.parsed.answerPresent ? 1 : 0,
          answer_text: r.parsed.answerText,
          cost_usd: r.parsed.costUsd,
          latency_ms: r.latencyMs,
          raw_path,
          meta: JSON.stringify(r.parsed.meta),
        },
        r.parsed.citations,
      );
      const c = store.check(id) as CheckRow;
      const rec = checkRecord(c, store.citationsFor([id]).get(id) ?? [], domains);
      console.error(`  ${p.id.padEnd(15)} ${rec.own_cited ? "CITED" : rec.own_mentioned ? "named" : "  -  "}  ${rec.source_count} sources  ${usd(c.cost_usd)}  ${q.slice(0, 60)}`);
      return rec;
    } catch (e) {
      const err = e as Error & { request?: unknown; response?: unknown; spentUsd?: number };
      const raw_path = store.writeRaw(ts, p.id, q, { platform: p.id, query: q, request: err.request ?? null, response: err.response ?? null, error: err.message });
      const id = store.insertCheck(
        { ...base, model: cfg.models[p.id] ?? p.defaultModel, status: "error", error: err.message, answer_present: 0, answer_text: null, cost_usd: err.spentUsd ?? 0, latency_ms: null, raw_path, meta: null },
        [],
      );
      console.error(`  ${p.id.padEnd(15)} ERROR  ${err.message.slice(0, 120)}  ${q.slice(0, 40)}`);
      return checkRecord(store.check(id) as CheckRow, [], domains);
    }
  });
  store.finishRun(runId);
  const cost = rows.reduce((s, r) => s + r.cost_usd, 0);
  const errors = rows.filter((r) => r.status === "error").length;
  console.log(`run ${runId}: ${rows.length} checks, ${rows.filter((r) => r.own_cited).length} cited, ${rows.filter((r) => r.own_mentioned).length} named, ${errors} errors, cost ${usd(cost)}`);
  if (errors === rows.length) process.exit(1);
}

function loadReport(days: number, platform?: string[], query?: string) {
  const store = Store.open(cwd);
  const since = sinceDays(days);
  const checks = store.checksSince(since, { platform, query });
  const cits = store.citationsFor(checks.map((c) => c.id));
  const domains = store.domains();
  return { store, since, checks, cits, domains, report: buildReport(checks, cits, domains, days, since) };
}

function cmdReport(args: string[]) {
  const { values } = opts(args, { days: { type: "string" }, platform: { type: "string" }, json: { type: "boolean" } });
  const days = Number(values.days ?? 7);
  const { report } = loadReport(days, splitList(values.platform));
  print(Boolean(values.json), report, () => {
    if (!report.cells.length) return `no checks in the last ${days} days: aeo run`;
    const out: string[] = [`Last ${days} days. cited = own domain in the answer's sources; named = brand/domain in the answer text.\n`];
    out.push(
      table(
        ["query", "platform", "checks", "cited", "named", "retrieved only", "answer shown", "top competitor", "errors"],
        report.cells.map((c) => [c.query.slice(0, 50), c.platform, c.checks, `${c.cited} (${pct(c.cited, c.checks)})`, `${c.mentioned} (${pct(c.mentioned, c.checks)})`, c.retrievedNotCited, `${c.answered}/${c.checks}`, c.topCompetitor ?? "", c.errors]),
      ),
    );
    if (report.domains.length) {
      out.push("\nTracked domains (share of all successful checks):");
      out.push(table(["role", "domain", "cited", "named"], report.domains.map((d) => [d.role, d.domain, `${d.cited}/${d.checks} (${pct(d.cited, d.checks)})`, `${d.mentioned}/${d.checks} (${pct(d.mentioned, d.checks)})`])));
    }
    out.push(report.ownUrls.length ? "\nYour URLs that got cited:" : "\nNone of your URLs were cited in this window.");
    if (report.ownUrls.length) out.push(table(["times", "platforms", "url"], report.ownUrls.map((u) => [u.count, u.platforms.join(","), u.url])));
    out.push(`\nSpend in window: ${usd(report.costUsd)}`);
    return out.join("\n");
  });
}

function cmdCompetitors(args: string[]) {
  const { values } = opts(args, { days: { type: "string" }, limit: { type: "string" }, json: { type: "boolean" } });
  const days = Number(values.days ?? 30);
  const limit = Number(values.limit ?? 20);
  const { report } = loadReport(days);
  const top = report.topDomains.slice(0, limit);
  print(Boolean(values.json), { days, tracked: report.domains, top }, () =>
    [
      `Most-cited domains across your queries, last ${days} days (checks = answers citing it at least once):`,
      table(["domain", "checks", "citations", "tracked"], top.map((t) => [t.domain, t.checks, t.citations, t.tracked ?? ""])),
      "\nAdd one to track: aeo domain add <domain> --competitor",
    ].join("\n"),
  );
}

function cmdHistory(args: string[]) {
  const { values } = opts(args, { query: { type: "string", short: "q" }, days: { type: "string" }, platform: { type: "string" }, json: { type: "boolean" } });
  if (!values.query) fail("usage: aeo history --query <text|id>");
  const store = Store.open(cwd);
  const q = resolveQuery(store, values.query);
  const { checks, cits, domains } = loadReport(Number(values.days ?? 30), splitList(values.platform), q);
  const recs = checks.map((c) => checkRecord(c, cits.get(c.id) ?? [], domains));
  print(Boolean(values.json), recs, () =>
    recs.length
      ? table(["id", "ts", "platform", "status", "cited", "named", "sources", "own urls / error"], recs.map((r) => [r.check_id, r.ts.slice(0, 16), r.platform, r.status, r.own_cited ? "yes" : "", r.own_mentioned ? "yes" : "", r.source_count, r.status === "ok" ? r.own_urls.join(" ") : (r.error ?? "").slice(0, 60)]))
      : `no checks for "${q}"`,
  );
}

function cmdCost(args: string[]) {
  const { values } = opts(args, { days: { type: "string" }, by: { type: "string" }, json: { type: "boolean" } });
  const days = Number(values.days ?? 30);
  const by = values.by ?? "platform";
  const col = by === "day" ? "substr(ts, 1, 10)" : by === "provider" ? "provider" : by === "platform" ? "platform" : fail("--by platform|day|provider");
  const store = Store.open(cwd);
  const rows = store.db
    .query(`SELECT ${col} AS k, COUNT(*) AS checks, SUM(cost_usd) AS usd FROM checks WHERE ts >= ? GROUP BY k ORDER BY k`)
    .all(sinceDays(days)) as { k: string; checks: number; usd: number }[];
  const total = rows.reduce((s, r) => s + r.usd, 0);
  print(Boolean(values.json), { days, by, rows, total }, () =>
    `${table([by, "checks", "usd", "per check"], rows.map((r) => [r.k, r.checks, usd(r.usd), usd(r.usd / r.checks)]))}\n\nTotal last ${days} days: ${usd(total)}`,
  );
}

function cmdExport(args: string[]) {
  const { values } = opts(args, { what: { type: "string" }, format: { type: "string" }, days: { type: "string" }, output: { type: "string", short: "o" } });
  const what = values.what ?? "checks";
  const format = values.format ?? "jsonl";
  const { checks, cits, domains } = loadReport(Number(values.days ?? 3650));
  const byId = new Map(checks.map((c) => [c.id, c]));
  let rows: Record<string, unknown>[];
  if (what === "checks") rows = checks.map((c) => checkRecord(c, cits.get(c.id) ?? [], domains));
  else if (what === "citations")
    rows = [...cits.values()].flat().map((x) => {
      const c = byId.get(x.check_id);
      return { check_id: x.check_id, ts: c?.ts, query: c?.query, platform: c?.platform, kind: x.kind, position: x.position, domain: x.domain, url: x.url, title: x.title };
    });
  else fail("--what checks|citations");
  const body = format === "csv" ? toCsv(rows) : format === "jsonl" ? rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "") : fail("--format jsonl|csv");
  if (values.output) {
    writeFileSync(values.output, body);
    console.error(`wrote ${rows.length} ${what} rows to ${values.output}`);
  } else process.stdout.write(body);
}

function cmdRaw(args: string[]) {
  const store = Store.open(cwd);
  const c = store.check(Number(args[0]));
  if (!c?.raw_path) fail(`no raw response for check ${args[0]}`);
  console.log(JSON.stringify(store.readRaw(c.raw_path), null, 2));
}

const commands: Record<string, (args: string[]) => unknown> = {
  init: cmdInit,
  setup: cmdInit,
  doctor: cmdDoctor,
  platforms: cmdPlatforms,
  config: cmdConfig,
  query: cmdQuery,
  queries: cmdQuery,
  domain: cmdDomain,
  domains: cmdDomain,
  run: cmdRun,
  report: cmdReport,
  competitors: cmdCompetitors,
  history: cmdHistory,
  cost: cmdCost,
  export: cmdExport,
  raw: cmdRaw,
};

const handler = cmd ? commands[cmd] : undefined;
if (!handler) {
  console.log(HELP);
  process.exit(cmd && !["help", "--help", "-h"].includes(cmd) ? 1 : 0);
}
try {
  await handler(rest);
} catch (e) {
  fail((e as Error).message);
}
