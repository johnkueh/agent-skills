// Small pure helpers shared by the parsers, analysis, and CLI.

const TRACKING_PARAM = /^(utm_[a-z]+|gclid|fbclid|srsltid|ref)$/i;

/** Canonical form for a cited URL: lowercase host, no tracking params, no fragment. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    let out = u.toString();
    if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
    return out;
  } catch {
    return trimmed;
  }
}

/** Registrable-ish host for display and matching: lowercase, no leading www. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Accepts "Example.com", "https://www.example.com/path" → "example.com". */
export function cleanDomain(input: string): string {
  const s = input.trim().toLowerCase();
  const host = s.includes("://") ? hostOf(s) : s.split("/")[0] ?? "";
  return host.replace(/^www\./, "");
}

/** True when host is the tracked domain or one of its subdomains. */
export function domainMatches(host: string, tracked: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return h === tracked || h.endsWith(`.${tracked}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive whole-term match ("Acme" matches "Acme's", not "Acmeville"). */
export function mentions(text: string, term: string): boolean {
  if (!term.trim()) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term.trim())}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return re.test(text);
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0] ?? {});
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\n")}\n`;
}

export function pct(n: number, d: number): string {
  if (d === 0) return "-";
  return `${Math.round((100 * n) / d)}%`;
}

export function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Fixed-width text table for terminal output. */
export function table(headers: string[], rows: (string | number)[][]): string {
  const cells = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, i) => Math.max(...cells.map((r) => (r[i] ?? "").length)));
  const fmt = (r: string[]) => r.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return [fmt(headers), fmt(widths.map((w) => "-".repeat(w))), ...rows.map((r) => fmt(r.map(String)))].join("\n");
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}
