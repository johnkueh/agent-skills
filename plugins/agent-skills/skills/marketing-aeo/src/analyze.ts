// Turns stored checks + citations into citation / mention metrics.
// Runs at report time against the current domain list, so adding a competitor
// later re-scores every stored answer.

import type { CheckRow, CitationRow, DomainRow } from "./store.ts";
import { domainMatches, mentions } from "./util.ts";

export interface CheckAnalysis {
  ownCited: boolean;
  ownMentioned: boolean;
  ownRetrieved: boolean;
  ownUrls: string[];
  cited: Set<string>; // tracked domains cited
  mentioned: Set<string>; // tracked domains mentioned in the answer text
}

/** Answer text with URLs removed, so a link isn't counted as a brand mention. */
export function proseOnly(text: string): string {
  return text
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ");
}

export function brandTerms(d: DomainRow): string[] {
  return [d.domain, ...d.brands].filter((t, i, a) => t && a.indexOf(t) === i);
}

export function analyzeCheck(check: CheckRow, cits: CitationRow[], domains: DomainRow[]): CheckAnalysis {
  const prose = proseOnly(check.answer_text ?? "");
  const out: CheckAnalysis = {
    ownCited: false,
    ownMentioned: false,
    ownRetrieved: false,
    ownUrls: [],
    cited: new Set(),
    mentioned: new Set(),
  };
  for (const d of domains) {
    const src = cits.filter((c) => c.kind === "source" && domainMatches(c.domain, d.domain));
    const ret = cits.some((c) => c.kind === "retrieved" && domainMatches(c.domain, d.domain));
    const named = brandTerms(d).some((t) => mentions(prose, t));
    if (src.length) out.cited.add(d.domain);
    if (named) out.mentioned.add(d.domain);
    if (d.role === "own") {
      if (src.length) {
        out.ownCited = true;
        out.ownUrls.push(...src.map((c) => c.url));
      }
      if (named) out.ownMentioned = true;
      if (ret) out.ownRetrieved = true;
    }
  }
  return out;
}

export interface Cell {
  query: string;
  platform: string;
  checks: number;
  answered: number;
  cited: number;
  mentioned: number;
  retrievedNotCited: number;
  errors: number;
  topCompetitor: string | null;
}

export interface Report {
  days: number;
  since: string;
  cells: Cell[];
  domains: { domain: string; role: string; checks: number; cited: number; mentioned: number }[];
  ownUrls: { url: string; count: number; platforms: string[]; queries: string[] }[];
  topDomains: { domain: string; citations: number; checks: number; tracked: string | null }[];
  costUsd: number;
}

export function buildReport(
  checks: CheckRow[],
  cits: Map<number, CitationRow[]>,
  domains: DomainRow[],
  days: number,
  since: string,
): Report {
  const cells = new Map<string, Cell & { comp: Map<string, number> }>();
  const domainStats = new Map(domains.map((d) => [d.domain, { domain: d.domain, role: d.role, checks: 0, cited: 0, mentioned: 0 }]));
  const urls = new Map<string, { url: string; count: number; platforms: Set<string>; queries: Set<string> }>();
  const top = new Map<string, { citations: number; checks: Set<number> }>();
  let costUsd = 0;

  for (const c of checks) {
    costUsd += c.cost_usd;
    const key = `${c.query}\u0000${c.platform}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { query: c.query, platform: c.platform, checks: 0, answered: 0, cited: 0, mentioned: 0, retrievedNotCited: 0, errors: 0, topCompetitor: null, comp: new Map() };
      cells.set(key, cell);
    }
    if (c.status !== "ok") {
      cell.errors++;
      continue;
    }
    const list = cits.get(c.id) ?? [];
    const a = analyzeCheck(c, list, domains);
    cell.checks++;
    if (c.answer_present) cell.answered++;
    if (a.ownCited) cell.cited++;
    if (a.ownMentioned) cell.mentioned++;
    if (a.ownRetrieved && !a.ownCited) cell.retrievedNotCited++;
    for (const d of domains) {
      const s = domainStats.get(d.domain);
      if (!s) continue;
      s.checks++;
      if (a.cited.has(d.domain)) s.cited++;
      if (a.mentioned.has(d.domain)) s.mentioned++;
      if (d.role === "competitor" && a.cited.has(d.domain)) cell.comp.set(d.domain, (cell.comp.get(d.domain) ?? 0) + 1);
    }
    for (const u of a.ownUrls) {
      const e = urls.get(u) ?? { url: u, count: 0, platforms: new Set(), queries: new Set() };
      e.count++;
      e.platforms.add(c.platform);
      e.queries.add(c.query);
      urls.set(u, e);
    }
    for (const cit of list) {
      if (cit.kind !== "source" || !cit.domain) continue;
      const t = top.get(cit.domain) ?? { citations: 0, checks: new Set<number>() };
      t.citations++;
      t.checks.add(c.id);
      top.set(cit.domain, t);
    }
  }

  const trackedOf = (host: string) => domains.find((d) => domainMatches(host, d.domain))?.role ?? null;
  return {
    days,
    since,
    cells: [...cells.values()]
      .map(({ comp, ...cell }) => {
        const best = [...comp.entries()].sort((x, y) => y[1] - x[1])[0];
        return { ...cell, topCompetitor: best ? `${best[0]} (${best[1]})` : null };
      })
      .sort((x, y) => x.query.localeCompare(y.query) || x.platform.localeCompare(y.platform)),
    domains: [...domainStats.values()],
    ownUrls: [...urls.values()]
      .map((u) => ({ url: u.url, count: u.count, platforms: [...u.platforms].sort(), queries: [...u.queries] }))
      .sort((x, y) => y.count - x.count),
    topDomains: [...top.entries()]
      .map(([domain, t]) => ({ domain, citations: t.citations, checks: t.checks.size, tracked: trackedOf(domain) }))
      .sort((x, y) => y.checks - x.checks || y.citations - x.citations),
    costUsd,
  };
}

/** Flat per-check record for export (JSONL/CSV) and history. */
export function checkRecord(c: CheckRow, list: CitationRow[], domains: DomainRow[]) {
  const a = c.status === "ok" ? analyzeCheck(c, list, domains) : null;
  const sources = list.filter((x) => x.kind === "source");
  return {
    check_id: c.id,
    run_id: c.run_id,
    ts: c.ts,
    query: c.query,
    platform: c.platform,
    provider: c.provider,
    model: c.model,
    country: c.country,
    status: c.status,
    error: c.error,
    answer_present: Boolean(c.answer_present),
    own_cited: a?.ownCited ?? null,
    own_mentioned: a?.ownMentioned ?? null,
    own_retrieved: a?.ownRetrieved ?? null,
    own_urls: a?.ownUrls ?? [],
    tracked_cited: a ? [...a.cited] : [],
    tracked_mentioned: a ? [...a.mentioned] : [],
    source_count: sources.length,
    source_domains: [...new Set(sources.map((x) => x.domain))],
    cost_usd: c.cost_usd,
    latency_ms: c.latency_ms,
    raw_path: c.raw_path,
  };
}
