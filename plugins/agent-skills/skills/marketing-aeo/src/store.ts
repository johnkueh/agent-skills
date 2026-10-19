// Per-project local store: <project>/.aeo/aeo.sqlite + gzipped raw responses.

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PLATFORMS, type Citation, type RunConfig } from "./platforms.ts";

export const COUNTRY_LOCATION: Record<string, number> = {
  US: 2840,
  GB: 2826,
  AU: 2036,
  CA: 2124,
  NZ: 2554,
  IE: 2372,
  IN: 2356,
  SG: 2702,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  NL: 2528,
  BR: 2076,
  JP: 2392,
};

export interface ProjectConfig {
  country: string;
  location_code: number;
  language_code: string;
  platforms: string[];
  models: Record<string, string>;
  chatgpt_force_web_search: boolean;
  concurrency: number;
}

export function defaultConfig(country = "US", language = "en"): ProjectConfig {
  const c = country.toUpperCase();
  return {
    country: c,
    location_code: COUNTRY_LOCATION[c] ?? 2840,
    language_code: language,
    platforms: [...DEFAULT_PLATFORMS],
    models: {},
    chatgpt_force_web_search: false,
    concurrency: 4,
  };
}

export function runConfig(c: ProjectConfig): RunConfig {
  return {
    country: c.country,
    locationCode: c.location_code,
    languageCode: c.language_code,
    models: c.models,
    chatgptForceWebSearch: c.chatgpt_force_web_search,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL UNIQUE,
  tag TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('own','competitor')),
  brands TEXT NOT NULL DEFAULT '[]',
  added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  platforms TEXT NOT NULL,
  estimate_usd REAL,
  cost_usd REAL,
  checks INTEGER,
  errors INTEGER
);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id),
  ts TEXT NOT NULL,
  query TEXT NOT NULL,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  country TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok','error')),
  error TEXT,
  answer_present INTEGER NOT NULL DEFAULT 0,
  answer_text TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  raw_path TEXT,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_checks_ts ON checks(ts);
CREATE INDEX IF NOT EXISTS idx_checks_query ON checks(query, platform, ts);
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY,
  check_id INTEGER NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('source','retrieved')),
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT
);
CREATE INDEX IF NOT EXISTS idx_citations_check ON citations(check_id);
CREATE INDEX IF NOT EXISTS idx_citations_domain ON citations(domain);
`;

export interface QueryRow {
  id: number;
  text: string;
  tag: string | null;
  active: number;
}
export interface DomainRow {
  id: number;
  domain: string;
  role: "own" | "competitor";
  brands: string[];
}
export interface CheckRow {
  id: number;
  run_id: number | null;
  ts: string;
  query: string;
  platform: string;
  provider: string;
  model: string | null;
  country: string | null;
  status: "ok" | "error";
  error: string | null;
  answer_present: number;
  answer_text: string | null;
  cost_usd: number;
  latency_ms: number | null;
  raw_path: string | null;
  meta: string | null;
}
export interface CitationRow extends Citation {
  check_id: number;
}

export class Store {
  readonly db: Database;
  readonly dir: string;

  private constructor(dir: string) {
    this.dir = dir;
    this.db = new Database(join(dir, "aeo.sqlite"));
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
  }

  static dirFor(cwd: string): string {
    return join(cwd, ".aeo");
  }

  static init(cwd: string, config: ProjectConfig): Store {
    const dir = Store.dirFor(cwd);
    mkdirSync(join(dir, "raw"), { recursive: true });
    const cfgPath = join(dir, "config.json");
    if (!existsSync(cfgPath)) writeFileSync(cfgPath, `${JSON.stringify(config, null, 2)}\n`);
    const gi = join(dir, ".gitignore");
    if (!existsSync(gi)) writeFileSync(gi, "*\n");
    return new Store(dir);
  }

  static open(cwd: string): Store {
    const dir = Store.dirFor(cwd);
    if (!existsSync(join(dir, "config.json"))) {
      throw new Error(`No .aeo/ project in ${cwd}. Run \`aeo init\` here first.`);
    }
    return new Store(dir);
  }

  config(): ProjectConfig {
    const raw = JSON.parse(readFileSync(join(this.dir, "config.json"), "utf8"));
    return { ...defaultConfig(raw.country ?? "US", raw.language_code ?? "en"), ...raw };
  }

  saveConfig(c: ProjectConfig): void {
    writeFileSync(join(this.dir, "config.json"), `${JSON.stringify(c, null, 2)}\n`);
  }

  // --- queries & domains ----------------------------------------------------

  addQuery(text: string, tag: string | null): boolean {
    const r = this.db
      .query("INSERT OR IGNORE INTO queries (text, tag, added_at) VALUES (?, ?, ?)")
      .run(text, tag, new Date().toISOString());
    return r.changes > 0;
  }

  queries(includeInactive = false): QueryRow[] {
    return this.db
      .query(`SELECT id, text, tag, active FROM queries ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id`)
      .all() as QueryRow[];
  }

  removeQuery(idOrText: string): number {
    const asId = /^\d+$/.test(idOrText) ? Number(idOrText) : -1;
    return this.db.query("DELETE FROM queries WHERE id = ? OR text = ?").run(asId, idOrText).changes;
  }

  addDomain(domain: string, role: "own" | "competitor", brands: string[]): void {
    this.db
      .query(
        `INSERT INTO domains (domain, role, brands, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(domain) DO UPDATE SET role = excluded.role, brands = excluded.brands`,
      )
      .run(domain, role, JSON.stringify(brands), new Date().toISOString());
  }

  domains(): DomainRow[] {
    const rows = this.db.query("SELECT id, domain, role, brands FROM domains ORDER BY role DESC, domain").all() as {
      id: number;
      domain: string;
      role: "own" | "competitor";
      brands: string;
    }[];
    return rows.map((r) => ({ ...r, brands: JSON.parse(r.brands) as string[] }));
  }

  removeDomain(domain: string): number {
    return this.db.query("DELETE FROM domains WHERE domain = ?").run(domain).changes;
  }

  // --- runs & checks ----------------------------------------------------------

  startRun(platforms: string[], estimateUsd: number): number {
    const r = this.db
      .query("INSERT INTO runs (started_at, platforms, estimate_usd) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), platforms.join(","), estimateUsd);
    return Number(r.lastInsertRowid);
  }

  finishRun(id: number): void {
    this.db
      .query(
        `UPDATE runs SET finished_at = ?,
           cost_usd = (SELECT COALESCE(SUM(cost_usd),0) FROM checks WHERE run_id = ?),
           checks = (SELECT COUNT(*) FROM checks WHERE run_id = ?),
           errors = (SELECT COUNT(*) FROM checks WHERE run_id = ? AND status = 'error')
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), id, id, id, id);
  }

  /** Write the raw request/response (gzipped JSON) and return its path relative to .aeo/. */
  writeRaw(ts: string, platform: string, query: string, payload: unknown): string {
    const day = ts.slice(0, 10);
    mkdirSync(join(this.dir, "raw", day), { recursive: true });
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
    const rel = join("raw", day, `${ts.replace(/[:.]/g, "")}-${platform}-${slug}.json.gz`);
    writeFileSync(join(this.dir, rel), Bun.gzipSync(Buffer.from(JSON.stringify(payload))));
    return rel;
  }

  readRaw(rel: string): unknown {
    return JSON.parse(Buffer.from(Bun.gunzipSync(readFileSync(join(this.dir, rel)))).toString("utf8"));
  }

  insertCheck(c: Omit<CheckRow, "id">, citations: Citation[]): number {
    const insert = this.db.transaction(() => {
      const r = this.db
        .query(
          `INSERT INTO checks (run_id, ts, query, platform, provider, model, country, status, error,
             answer_present, answer_text, cost_usd, latency_ms, raw_path, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          c.run_id,
          c.ts,
          c.query,
          c.platform,
          c.provider,
          c.model,
          c.country,
          c.status,
          c.error,
          c.answer_present,
          c.answer_text,
          c.cost_usd,
          c.latency_ms,
          c.raw_path,
          c.meta,
        );
      const id = Number(r.lastInsertRowid);
      const ins = this.db.query(
        "INSERT INTO citations (check_id, kind, position, url, domain, title) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const cit of citations) ins.run(id, cit.kind, cit.position, cit.url, cit.domain, cit.title);
      return id;
    });
    return insert() as number;
  }

  checksSince(sinceIso: string, filter: { platform?: string[]; query?: string } = {}): CheckRow[] {
    const where = ["ts >= ?"];
    const args: (string | number)[] = [sinceIso];
    if (filter.platform?.length) {
      where.push(`platform IN (${filter.platform.map(() => "?").join(",")})`);
      args.push(...filter.platform);
    }
    if (filter.query) {
      where.push("query = ?");
      args.push(filter.query);
    }
    return this.db.query(`SELECT * FROM checks WHERE ${where.join(" AND ")} ORDER BY ts`).all(...args) as CheckRow[];
  }

  citationsFor(checkIds: number[]): Map<number, CitationRow[]> {
    const out = new Map<number, CitationRow[]>();
    for (let i = 0; i < checkIds.length; i += 500) {
      const chunk = checkIds.slice(i, i + 500);
      if (!chunk.length) continue;
      const rows = this.db
        .query(
          `SELECT check_id, kind, position, url, domain, title FROM citations
           WHERE check_id IN (${chunk.map(() => "?").join(",")}) ORDER BY check_id, kind, position`,
        )
        .all(...chunk) as CitationRow[];
      for (const r of rows) {
        const list = out.get(r.check_id) ?? [];
        list.push(r);
        out.set(r.check_id, list);
      }
    }
    return out;
  }

  check(id: number): CheckRow | null {
    return (this.db.query("SELECT * FROM checks WHERE id = ?").get(id) as CheckRow | null) ?? null;
  }

  /** Mean actual cost per check for each platform, from successful history. */
  avgCostByPlatform(): Map<string, number> {
    const rows = this.db
      .query("SELECT platform, AVG(cost_usd) AS avg FROM checks WHERE status = 'ok' GROUP BY platform")
      .all() as { platform: string; avg: number }[];
    return new Map(rows.map((r) => [r.platform, r.avg]));
  }
}
