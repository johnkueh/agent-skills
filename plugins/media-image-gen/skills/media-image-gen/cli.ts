#!/usr/bin/env -S npx tsx
/**
 * GPT Image 2.5 generation CLI with cost logging.
 *
 * Two auth routes:
 *   - API key (--api or exact mask): calls OpenAI's /v1/images/generations & /v1/images/edits
 *     with model=gpt-image-2.5-flare. Estimates cost pre-flight, logs actual usage.
 *   - ChatGPT plan (default): native codex exec image generation using
 *     the included plan allowance; no OAuth proxy or API key.
 *
 * Pricing (per 1M tokens):  text in $5 (cached $1.25), image in $8 (cached $2),
 * image out $30.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, appendFileSync } from "node:fs";
import { codexBinary, codexEnvironment, codexLoginStatus, generateNativeImage } from "./codex-image.mjs";
import { homedir } from "node:os";
import { dirname, join, parse as parsePath } from "node:path";

import { Command, Option } from "commander";
import sharp from "sharp";

const API_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-image-2.5-flare";
const CONFIG_DIR = join(homedir(), ".config", "image-gen");
const LOG_PATH = join(CONFIG_DIR, "usage.jsonl");
const CONFIG_ENV = join(CONFIG_DIR, "env");

const PRICE = {
  text_in: 5.0 / 1_000_000,
  text_in_cached: 1.25 / 1_000_000,
  image_in: 8.0 / 1_000_000,
  image_in_cached: 2.0 / 1_000_000,
  image_out: 30.0 / 1_000_000,
};

// Output image token counts by (size, quality). The API returns the real count
// in usage.output_tokens, so this is only used for pre-flight estimates.
const OUTPUT_TOKEN_TABLE: Record<string, number> = {
  "1024x1024|low": 272,
  "1024x1024|medium": 1056,
  "1024x1024|high": 4160,
  "1024x1536|low": 408,
  "1024x1536|medium": 1584,
  "1024x1536|high": 6240,
  "1536x1024|low": 400,
  "1536x1024|medium": 1568,
  "1536x1024|high": 6208,
};

const SIZES = ["auto", "1024x1024", "1024x1536", "1536x1024"];
const QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"];
const FORMATS = ["png", "jpeg", "webp"];
const BACKGROUNDS = ["auto", "transparent", "opaque"];

// ── ChatGPT-plan (Codex OAuth) route ────────────────────────────────────────
const OAUTH_DEFAULT_PORT = 10531;
const OAUTH_MODELS = ["gpt-6-astra"];
const OAUTH_REASONING = ["none", "low", "medium", "high", "xhigh"];
// ── helpers ──────────────────────────────────────────────────────────────────
function err(msg: string): void {
  process.stderr.write(msg + "\n");
}

function die(msg: string, code = 1): never {
  err(msg);
  process.exit(code);
}

function loadApiKey(): string {
  let key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key && existsSync(CONFIG_ENV)) {
    for (const raw of readFileSync(CONFIG_ENV, "utf8").split("\n")) {
      const line = raw.trim();
      const m = line.match(/^(?:export\s+)?OPENAI_API_KEY=(.*)$/);
      if (m) {
        key = m[1].trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
  if (!key) {
    die(
      "Error: OPENAI_API_KEY not set. Put it in ~/.config/image-gen/env as " +
        "`export OPENAI_API_KEY=sk-...` or export it in your shell. " +
        "(Or use --chatgpt-auth to bill against your ChatGPT plan instead.)",
      2,
    );
  }
  return key;
}

async function countTextTokens(text: string): Promise<number> {
  try {
    const { encode } = await import("gpt-tokenizer/model/gpt-4o");
    return encode(text).length;
  } catch {
    return Math.max(1, Math.floor(text.length / 4));
  }
}

function estimateImageInputTokens(refPath: string): number {
  let kb: number;
  try {
    kb = statSync(refPath).size / 1024;
  } catch {
    return 1500;
  }
  return Math.round(Math.min(4000, Math.max(500, 800 + kb * 1.5)));
}

interface Estimate {
  text_in_tokens: number;
  image_in_tokens_est: number;
  output_tokens_est: number;
  cost_text_in: number;
  cost_image_in: number;
  cost_image_out: number;
  total_cost_est: number;
  assumed_size: string;
  assumed_quality: string;
}

async function estimateCost(
  prompt: string,
  size: string,
  quality: string,
  n = 1,
  refs: string[] = [],
): Promise<Estimate> {
  const textTok = await countTextTokens(prompt);
  const imgInTok = refs.reduce((s, p) => s + estimateImageInputTokens(p), 0);
  const effSize = size !== "auto" ? size : "1024x1536";
  const effQuality = quality !== "auto" ? quality : "high";
  err("Pre-flight estimate uses legacy token counts; GPT Image 2.5 consumption differs. Actual usage determines cost.");
  const perImgOut = OUTPUT_TOKEN_TABLE[`${effSize}|${effQuality}`] ?? 4160;
  const outTok = perImgOut * n;

  const costText = textTok * PRICE.text_in;
  const costImgIn = imgInTok * PRICE.image_in;
  const costImgOut = outTok * PRICE.image_out;
  return {
    text_in_tokens: textTok,
    image_in_tokens_est: imgInTok,
    output_tokens_est: outTok,
    cost_text_in: costText,
    cost_image_in: costImgIn,
    cost_image_out: costImgOut,
    total_cost_est: costText + costImgIn + costImgOut,
    assumed_size: effSize,
    assumed_quality: effQuality,
  };
}

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
    cached_tokens?: number;
  };
}

function computeActualCost(usage: Usage) {
  const details = usage.input_tokens_details || {};
  let textIn = details.text_tokens || 0;
  const imgIn = details.image_tokens || 0;
  const cachedIn = details.cached_tokens || 0;
  if (!textIn && !imgIn && usage.input_tokens) textIn = usage.input_tokens;
  const out = usage.output_tokens || 0;

  const textInBillable = Math.max(0, textIn - cachedIn);
  const cost =
    textInBillable * PRICE.text_in +
    cachedIn * PRICE.text_in_cached +
    imgIn * PRICE.image_in +
    out * PRICE.image_out;
  return {
    text_in_tokens: textIn,
    image_in_tokens: imgIn,
    cached_in_tokens: cachedIn,
    output_tokens: out,
    total_tokens: usage.total_tokens ?? textIn + imgIn + out,
    cost_usd: round(cost, 6),
    breakdown: {
      text_in: round(textInBillable * PRICE.text_in, 6),
      cached_in: round(cachedIn * PRICE.text_in_cached, 6),
      image_in: round(imgIn * PRICE.image_in, 6),
      image_out: round(out * PRICE.image_out, 6),
    },
  };
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function logUsage(record: Record<string, unknown>): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(record) + "\n");
}

function slugify(text: string, maxLen = 40): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, maxLen) || "image";
}

function timestamp(): string {
  // 20060102-150405 local time, matching the Python default_out_path.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function defaultOutPath(prompt: string, fmt: string): string {
  return join(process.cwd(), `${timestamp()}-${slugify(prompt)}.${fmt}`);
}

function targetPath(
  out: string | undefined,
  prompt: string,
  fmt: string,
  index: number,
  count: number,
): string {
  if (out && count === 1) return out;
  if (!out) return defaultOutPath(prompt, fmt);
  const p = parsePath(out);
  return join(p.dir, `${p.name}-${index + 1}${p.ext}`);
}

function openFile(path: string): void {
  try {
    spawn("open", [path], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* best effort */
  }
}

function formatCost(c: number): string {
  return c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(3)}`;
}

function printEstimate(est: Estimate, n: number): void {
  const imgIn = est.image_in_tokens_est ? `, img_in≈${est.image_in_tokens_est} tok` : "";
  const times = n > 1 ? ` × ${n}` : "";
  err(
    `  est: ${formatCost(est.total_cost_est)}  (text_in≈${est.text_in_tokens} tok${imgIn}, ` +
      `out≈${est.output_tokens_est} tok${times}, quality=${est.assumed_quality}, size=${est.assumed_size})`,
  );
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").toUpperCase();
  if (h.length !== 6 || !/^[0-9A-F]{6}$/.test(h)) {
    die(`Expected 6-digit hex (e.g. FF00FF), got: ${hex}`, 2);
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

interface ChromaOpts {
  tLo?: number; // magenta-coverage at/below which a pixel is fully opaque
  tHi?: number; // magenta-coverage at/above which a pixel is fully transparent
  despill?: number; // 0..1 strength of residual-tint removal on opaque pixels
}

/**
 * Strip a uniform magenta background → clean transparent PNG, with anti-aliased
 * edges and no colored fringe. Three steps per pixel:
 *
 *  1. Magenta coverage  m = clamp01((min(R,B) − G) / 255).  m=1 for pure magenta,
 *     ~0 for white / green / brown / yellow (G not far below min(R,B)).
 *  2. Soft matte: m≤tLo → opaque, m≥tHi → transparent, between → partial alpha.
 *     A hard threshold leaves a hard pink ring; the ramp anti-aliases it.
 *  3. Decontaminate transition pixels by un-mixing the known background:
 *     observed = α·fg + (1−α)·key  ⇒  fg = (observed − (1−α)·key) / α.
 *     This recovers the true edge colour (e.g. the white sticker border) instead
 *     of leaving magenta-tinted pixels. Opaque-but-tinted pixels get a despill.
 *
 * Returns [clearedCount, totalCount] where cleared = pixels driven fully clear.
 */
async function chromaKeyFile(
  inPath: string,
  outPath: string,
  keyRgb: [number, number, number] = [255, 0, 255],
  opts: ChromaOpts = {},
): Promise<[number, number]> {
  const tLo = opts.tLo ?? 0.18;
  const tHi = opts.tHi ?? 0.55;
  const despill = opts.despill ?? 0.8;
  const [kr, kg, kb] = keyRgb;
  const { data, info } = await sharp(inPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let cleared = 0;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const m = Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));
    let a = m <= tLo ? 1 : m >= tHi ? 0 : (tHi - m) / (tHi - tLo);
    if (a < 0.06) a = 0; // floor: avoid near-zero-alpha division noise / speckle

    if (a === 0) {
      data[i + 3] = 0;
      cleared++;
    } else if (a < 1) {
      // Un-mix the known magenta background to kill the colored fringe.
      data[i] = clamp255((r - (1 - a) * kr) / a);
      data[i + 1] = clamp255((g - (1 - a) * kg) / a);
      data[i + 2] = clamp255((b - (1 - a) * kb) / a);
      data[i + 3] = Math.round(a * 255);
    } else {
      // Fully opaque: shave any residual magenta cast (R,B elevated above G).
      const spill = Math.min(r, b) - g;
      if (spill > 0 && despill > 0) {
        data[i] = clamp255(r - spill * despill);
        data[i + 2] = clamp255(b - spill * despill);
      }
      data[i + 3] = 255;
    }
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(outPath);
  return [cleared, width * height];
}

// ── ChatGPT-plan helpers ──────────────────────────────────────────────────────
function codexAuthPresent(): boolean {
  return codexLoginStatus();
}

function runCodexLogin(): void {
  const result = spawnSync(codexBinary(), ["login"], { stdio: "inherit", env: codexEnvironment() });
  if (result.status !== 0 || !codexAuthPresent()) die("Codex ChatGPT login failed. Run `codex login`.");
}

interface ChatgptAuthOpts {
  mode: "generate" | "edit";
  prompt: string;
  size: string;
  quality: string;
  model: string;
  webSearch: boolean;
  refs: string[];
  fmt: string;
  out?: string;
  transparent: boolean;
  background?: string;
  n?: number;
  open: boolean;
  oauthPort: number;
  dryRun: boolean;
  reasoning: string;
}

async function chatgptAuthImageCore(o: ChatgptAuthOpts): Promise<{ saved: string[]; elapsed: number }> {
  const t0 = Date.now();
  const saved: string[] = [];
  const count = o.n ?? 1;
  const threads: string[] = [];
  for (let i = 0; i < count; i++) {
    const result = await generateNativeImage({
      prompt: o.prompt,
      refs: o.refs,
      size: o.size,
      quality: o.quality,
      background: o.background ?? "auto",
    });
    const target = targetPath(o.out, o.prompt, o.fmt, i, count);
    mkdirSync(dirname(target), { recursive: true });
    let output = sharp(result.paths[0]);
    if (o.fmt === "jpeg") output = output.flatten({ background: "#ffffff" });
    await output.toFormat(o.fmt as "png" | "jpeg" | "webp").toFile(target);
    saved.push(target);
    threads.push(result.thread_id);
  }
  const elapsed = (Date.now() - t0) / 1000;
  logUsage({
    ts: new Date().toISOString(), mode: o.mode, auth: "codex-chatgpt",
    model: "gpt-6-astra", image_model: "codex-managed", threads,
    size_requested: o.size, quality_requested: o.quality, format: o.fmt,
    n: saved.length, refs: o.refs, elapsed_s: round(elapsed, 2),
    prompt_preview: o.prompt.slice(0, 200), out_files: saved,
    plan_quota: true, cost_usd: 0.0,
  });
  return { saved, elapsed };
}

async function chatgptAuthImage(o: ChatgptAuthOpts): Promise<void> {
  err(`Prompt (${o.prompt.length} chars):`);
  err(o.prompt);
  err(
    `  auth: ChatGPT plan quota (no $ charge). model=${o.model}, ` +
      `reasoning=${o.reasoning}, web_search=${o.webSearch}`,
  );
  if (o.dryRun) {
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          auth: "codex-chatgpt",
          model: o.model,
          image_model: "codex-managed",
          n: o.n ?? 1,
          reasoning: o.reasoning,
          size: o.size,
          quality: o.quality,
          web_search: o.webSearch,
          mode: o.mode,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await chatgptAuthImageCore(o);

  err(`  done: plan quota (${result.elapsed.toFixed(1)}s)`);
  for (const s of result.saved) console.log(s);
  if (result.saved.length && o.open) openFile(result.saved[0]);
}

function validateChoice(name: string, value: string, choices: string[]): string {
  if (!choices.includes(value)) {
    die(`Error: invalid ${name} '${value}'. Choose from: ${choices.join(", ")}`, 2);
  }
  return value;
}

// ── doctor (shared) ───────────────────────────────────────────────────────────
async function doctorCheck(_port: number): Promise<boolean> {
  const version = spawnSync(codexBinary(), ["--version"], { encoding: "utf8", env: codexEnvironment() });
  const loggedIn = codexAuthPresent();
  err(`  Codex CLI: ${version.status === 0 ? version.stdout.trim() : "not installed"}`);
  err(`  ChatGPT login: ${loggedIn ? "ready" : "run codex login"}`);
  err("  Local generation uses native Codex Images 2.5. API-only workflows use Flare.");
  return version.status === 0 && loggedIn;
}

const program = new Command();
program.name("image-gen").description("GPT Image 2.5 CLI — generate, edit, and track cost.");

const collect = (v: string, acc: string[]) => {
  acc.push(v);
  return acc;
};

program
  .command("generate")
  .description("Text → image via /v1/images/generations (or the ChatGPT plan with --chatgpt-auth).")
  .requiredOption("-p, --prompt <text>", "Final, cookbook-shaped prompt.")
  .option("--size <size>", "auto|1024x1024|1024x1536|1536x1024", "auto")
  .option("--quality <q>", "low|medium|high|xhigh|max|auto", "high")
  .option("--format <fmt>", "png|jpeg|webp", "png")
  .option("--background <bg>", "auto|transparent|opaque", "auto")
  .option("--n <n>", "Images to generate (1-10).", (v) => parseInt(v, 10), 1)
  .option("-o, --out <path>", "Output path (default: cwd/<ts>-<slug>.<fmt>).")
  .option(
    "--ref <path>",
    "Reference image(s) to condition on (style/subject bible → coherence, anti-drift). Repeat for multi-image input; routes through the image-edit path.",
    collect,
    [],
  )
  .option("--compression <pct>", "0-100, jpeg/webp only.", (v) => parseInt(v, 10))
  .option("-t, --transparent", "Generate with a native transparent background; forces PNG.")
  .option("--dry-run", "Print estimate and exit.")
  .option("--no-open", "Don't auto-open result in Preview.")
  .option("--chatgpt-auth", "Bill against your ChatGPT plan quota instead of an API key.")
  .option("--api", "Force the OpenAI API-key path even when ChatGPT-plan auth is available.")
  .addOption(
    new Option("--model <model>", "Reasoning model for --chatgpt-auth (default gpt-6-astra).")
      .choices(OAUTH_MODELS)
      .default("gpt-6-astra"),
  )
  .addOption(
    new Option("--reasoning <effort>", "Reasoning effort for --chatgpt-auth (higher = better planning, more quota).")
      .choices(OAUTH_REASONING)
      .default("medium"),
  )
  .option("--web-search", "Allow web_search on --chatgpt-auth (off by default; burns more quota).")
  .option("--oauth-port <port>", "Deprecated compatibility option; native Codex does not use a proxy.", (v) => parseInt(v, 10), OAUTH_DEFAULT_PORT)
  .action(async (opts) => {
    let { prompt, size, quality, format: fmt, background } = opts;
    const refs: string[] = opts.ref ?? [];
    for (const r of refs) if (!existsSync(r)) die(`Error: ref not found: ${r}`, 2);
    validateChoice("size", size, SIZES);
    validateChoice("quality", quality, QUALITIES);
    validateChoice("format", fmt, FORMATS);
    validateChoice("background", background, BACKGROUNDS);
    if (background === "transparent" && fmt === "jpeg") die("Native transparency requires PNG or WebP.");
    if (!Number.isInteger(opts.n) || opts.n < 1 || opts.n > 10) die("n must be between 1 and 10.");

    if (opts.transparent) {
      fmt = "png";
      background = "transparent";
    }

    // Codex is the default; explicit API requests and exact edit masks use Flare.
    const useChatgpt = !opts.api && !opts.mask;
    if (useChatgpt) {
      err("auth: native Codex Images 2.5 using the ChatGPT plan.");

      await chatgptAuthImage({
        mode: "generate",
        prompt,
        size,
        quality,
        model: opts.model,
        webSearch: !!opts.webSearch,
        refs,
        fmt,
        out: opts.out,
        transparent: !!opts.transparent,
        background,
        n: opts.n,
        open: opts.open,
        oauthPort: opts.oauthPort,
        dryRun: !!opts.dryRun,
        reasoning: opts.reasoning,
      });
      return;
    }

    if (opts.mask) err("Exact edit masks require the Image API; using gpt-image-2.5-flare.");
    const est = await estimateCost(prompt, size, quality, opts.n, refs);
    err(`Prompt (${prompt.length} chars)${refs.length ? `, refs: ${refs.map((r) => parsePath(r).base)}` : ""}:`);
    err(prompt);
    err("");
    printEstimate(est, opts.n);
    if (opts.dryRun) {
      console.log(JSON.stringify({ dry_run: true, estimate: est }, null, 2));
      return;
    }

    const t0 = Date.now();
    let resp: Response;
    if (refs.length) {
      // The /images/generations endpoint can't take input images; refs go through /images/edits (mirrors `edit`).
      const form = new FormData();
      form.set("model", MODEL);
      form.set("prompt", prompt);
      form.set("n", String(opts.n));
      form.set("size", size);
      form.set("quality", quality);
      form.set("output_format", fmt);
      form.set("background", background);
      if (refs.length === 1) {
        form.append("image", new Blob([readFileSync(refs[0])], { type: "image/png" }), parsePath(refs[0]).base);
      } else {
        for (const r of refs) {
          form.append("image[]", new Blob([readFileSync(r)], { type: "image/png" }), parsePath(r).base);
        }
      }
      resp = await fetch(`${API_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${loadApiKey()}` },
        body: form,
      });
    } else {
      const body: Record<string, unknown> = {
        model: MODEL,
        prompt,
        n: opts.n,
        size,
        quality,
        output_format: fmt,
        background,
      };
      if (opts.compression != null && (fmt === "jpeg" || fmt === "webp")) {
        body.output_compression = opts.compression;
      }
      resp = await fetch(`${API_BASE}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${loadApiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const elapsed = (Date.now() - t0) / 1000;
    if (!resp.ok) die(`API error ${resp.status}: ${await resp.text()}`);

    const data: any = await resp.json();
    const actual = computeActualCost(data.usage || {});
    const saved = await saveB64Images(data.data || [], prompt, fmt, opts.out, false);

    logUsage({
      ts: new Date().toISOString(),
      mode: refs.length ? "edit" : "generate",
      model: MODEL,
      size: data.size ?? size,
      quality: data.quality ?? quality,
      format: data.output_format ?? fmt,
      background: data.background ?? background,
      n: opts.n,
      ...(refs.length ? { refs } : {}),
      elapsed_s: round(elapsed, 2),
      prompt_preview: prompt.slice(0, 200),
      out_files: saved,
      ...actual,
    });

    err(`  actual: ${formatCost(actual.cost_usd)} (${actual.output_tokens} out tok, ${elapsed.toFixed(1)}s)`);
    for (const s of saved) console.log(s);
    if (saved.length && opts.open) openFile(saved[0]);
  });

async function saveB64Images(
  items: Array<{ b64_json?: string }>,
  prompt: string,
  fmt: string,
  out: string | undefined,
  transparent: boolean,
): Promise<string[]> {
  const { writeFileSync } = await import("node:fs");
  const withData = items.filter((it) => it.b64_json);
  const saved: string[] = [];
  for (let i = 0; i < withData.length; i++) {
    const target = targetPath(out, prompt, fmt, i, withData.length);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(withData[i].b64_json!, "base64"));
    if (transparent) {
      const [cleared, total] = await chromaKeyFile(target, target);
      err(`  chroma-key: α=0 on ${cleared}/${total} px (${((100 * cleared) / total).toFixed(1)}%)  → ${target}`);
    }
    saved.push(target);
  }
  return saved;
}

program
  .command("batch")
  .description(
    "Generate many images in parallel on the ChatGPT plan from a JSON manifest " +
      "(concurrency up to 8, native Codex sessions). Uses your included plan allowance.",
  )
  .requiredOption(
    "--manifest <file>",
    'JSON array of items: { "prompt": "...", "out": "path.png", "size"?, "quality"?, "format"? }.',
  )
  .option("--concurrency <n>", "Parallel generations, 1-8 (default 4).", (v) => parseInt(v, 10), 4)
  .option("--quality <q>", "Default quality when an item omits it.", "high")
  .option("--size <size>", "Default size when an item omits it.", "auto")
  .option("--format <fmt>", "Default format when an item omits it.", "png")
  .option("--skip-existing", "Skip items whose out file already exists (resume a partial run).")
  .addOption(
    new Option("--model <model>", "Reasoning model (default gpt-6-astra).")
      .choices(OAUTH_MODELS)
      .default("gpt-6-astra"),
  )
  .addOption(
    new Option("--reasoning <effort>", "Reasoning effort (higher = better planning).")
      .choices(OAUTH_REASONING)
      .default("medium"),
  )
  .option("--web-search", "Allow web_search (off by default).")
  .option("--oauth-port <port>", "Deprecated compatibility option; native Codex does not use a proxy.", (v) => parseInt(v, 10), OAUTH_DEFAULT_PORT)
  .option("--dry-run", "Print the plan and exit.")
  .action(async (opts) => {
    if (!opts.dryRun && !codexAuthPresent()) {
      die("batch runs on the ChatGPT plan path. Run `image-gen setup` to sign in first.", 2);
    }

    let raw: string;
    try {
      raw = readFileSync(opts.manifest, "utf8");
    } catch {
      die(`Cannot read manifest: ${opts.manifest}`, 2);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      die(`Manifest is not valid JSON: ${opts.manifest}`, 2);
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      die("Manifest must be a non-empty JSON array of { prompt, out } items.", 2);
      return;
    }

    const items = (parsed as any[]).map((it, i) => {
      if (!it || typeof it.prompt !== "string" || typeof it.out !== "string") {
        die(`manifest[${i}] must have string "prompt" and "out".`, 2);
      }
      const size = it.size ?? opts.size;
      const quality = it.quality ?? opts.quality;
      const fmt = it.format ?? opts.format;
      validateChoice("size", size, SIZES);
      validateChoice("quality", quality, QUALITIES);
      validateChoice("format", fmt, FORMATS);
      return { prompt: it.prompt as string, out: it.out as string, size, quality, fmt };
    });

    let conc = opts.concurrency;
    if (Number.isNaN(conc) || conc < 1) conc = 1;
    if (conc > 8) {
      err("concurrency capped at 8.");
      conc = 8;
    }

    const work = opts.skipExisting ? items.filter((it) => !existsSync(it.out)) : items;
    err(
      `batch: ${work.length}/${items.length} image(s) · concurrency ${conc} · ` +
        "ChatGPT plan (no $ charge)",
    );
    if (work.length === 0) {
      console.log(JSON.stringify({ ok: 0, failed: 0, skipped: items.length, failures: [] }, null, 2));
      return;
    }
    if (opts.dryRun) {
      console.log(
        JSON.stringify(
          { dry_run: true, count: work.length, concurrency: conc, outs: work.map((w) => w.out) },
          null,
          2,
        ),
      );
      return;
    }


    let ok = 0;
    let fail = 0;
    const failures: Array<{ out: string; error: string }> = [];
    {
      let idx = 0;
      const runner = async () => {
        while (idx < work.length) {
          const it = work[idx++];
          try {
            const { saved, elapsed } = await chatgptAuthImageCore({
              mode: "generate",
              prompt: it.prompt,
              size: it.size,
              quality: it.quality,
              model: opts.model,
              webSearch: !!opts.webSearch,
              refs: [],
              fmt: it.fmt,
              out: it.out,
              transparent: false,
              open: false,
              oauthPort: opts.oauthPort,
              dryRun: false,
              reasoning: opts.reasoning,
            });
            ok++;
            err(`  [${ok + fail}/${work.length}] ✓ ${saved[0]} (${elapsed.toFixed(1)}s)`);
          } catch (e) {
            fail++;
            const msg = String((e as Error)?.message ?? e);
            failures.push({ out: it.out, error: msg });
            err(`  [${ok + fail}/${work.length}] ✗ ${it.out} — ${msg.slice(0, 140)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, work.length) }, runner));
    }

    err(`batch done: ${ok} ok, ${fail} failed. Re-run with --skip-existing to retry failures.`);
    console.log(JSON.stringify({ ok, failed: fail, failures }, null, 2));
    if (fail > 0) process.exitCode = 1;
  });

program
  .command("edit")
  .description("Image(s) + prompt → image via /v1/images/edits (or the ChatGPT plan with --chatgpt-auth).")
  .requiredOption("-p, --prompt <text>", "Edit instruction (cookbook-shaped).")
  .requiredOption("--ref <path>", "Reference image(s). Repeat for multi-image input.", collect, [])
  .option("--mask <path>", "Optional mask PNG (transparent = editable area).")
  .option("--size <size>", "auto|1024x1024|1024x1536|1536x1024", "auto")
  .option("--quality <q>", "low|medium|high|xhigh|max|auto", "high")
  .option("--format <fmt>", "png|jpeg|webp", "png")
  .option("--background <bg>", "auto|transparent|opaque", "auto")
  .option("--n <n>", "Images to generate.", (v) => parseInt(v, 10), 1)
  .option("-o, --out <path>", "Output path.")
  .option("--dry-run", "Print estimate and exit.")
  .option("--no-open", "Don't auto-open result in Preview.")
  .option("--chatgpt-auth", "Use the default Codex ChatGPT route. Exact masks require the Flare API.")
  .option("--api", "Force the OpenAI API-key path even when ChatGPT-plan auth is available.")
  .addOption(
    new Option("--model <model>", "Reasoning model for --chatgpt-auth (default gpt-6-astra).")
      .choices(OAUTH_MODELS)
      .default("gpt-6-astra"),
  )
  .addOption(
    new Option("--reasoning <effort>", "Reasoning effort for --chatgpt-auth (higher = better planning, more quota).")
      .choices(OAUTH_REASONING)
      .default("medium"),
  )
  .option("--web-search", "Allow web_search on --chatgpt-auth (off by default; burns more quota).")
  .option("--oauth-port <port>", "Deprecated compatibility option; native Codex does not use a proxy.", (v) => parseInt(v, 10), OAUTH_DEFAULT_PORT)
  .action(async (opts) => {
    const { prompt, size, quality, format: fmt, background } = opts;
    const refs: string[] = opts.ref;
    validateChoice("size", size, SIZES);
    validateChoice("quality", quality, QUALITIES);
    validateChoice("format", fmt, FORMATS);
    validateChoice("background", background, BACKGROUNDS);
    if (background === "transparent" && fmt === "jpeg") die("Native transparency requires PNG or WebP.");
    if (!Number.isInteger(opts.n) || opts.n < 1 || opts.n > 10) die("n must be between 1 and 10.");
    for (const r of refs) if (!existsSync(r)) die(`Error: ref not found: ${r}`, 2);

    // Codex is the default; explicit API requests and exact edit masks use Flare.
    const useChatgpt = !opts.api && !opts.mask;
    if (useChatgpt) {
      err("auth: native Codex Images 2.5 using the ChatGPT plan.");


      await chatgptAuthImage({
        mode: "edit",
        prompt,
        size,
        quality,
        model: opts.model,
        webSearch: !!opts.webSearch,
        refs,
        fmt,
        out: opts.out,
        transparent: false,
        background,
        n: opts.n,
        open: opts.open,
        oauthPort: opts.oauthPort,
        dryRun: !!opts.dryRun,
        reasoning: opts.reasoning,
      });
      return;
    }

    if (opts.mask) err("Exact edit masks require the Image API; using gpt-image-2.5-flare.");
    const est = await estimateCost(prompt, size, quality, opts.n, refs);
    err(`Prompt (${prompt.length} chars), refs: ${refs.map((r) => parsePath(r).base)}`);
    err(prompt);
    err("");
    printEstimate(est, opts.n);
    if (opts.dryRun) {
      console.log(JSON.stringify({ dry_run: true, estimate: est }, null, 2));
      return;
    }

    const form = new FormData();
    form.set("model", MODEL);
    form.set("prompt", prompt);
    form.set("n", String(opts.n));
    form.set("size", size);
    form.set("quality", quality);
    form.set("output_format", fmt);
    form.set("background", background);
    if (refs.length === 1) {
      form.append("image", new Blob([readFileSync(refs[0])], { type: "image/png" }), parsePath(refs[0]).base);
    } else {
      for (const r of refs) {
        form.append("image[]", new Blob([readFileSync(r)], { type: "image/png" }), parsePath(r).base);
      }
    }
    if (opts.mask) {
      form.append("mask", new Blob([readFileSync(opts.mask)], { type: "image/png" }), parsePath(opts.mask).base);
    }

    const t0 = Date.now();
    const resp = await fetch(`${API_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${loadApiKey()}` },
      body: form,
    });
    const elapsed = (Date.now() - t0) / 1000;
    if (!resp.ok) die(`API error ${resp.status}: ${await resp.text()}`);

    const data: any = await resp.json();
    const actual = computeActualCost(data.usage || {});
    const saved = await saveB64Images(data.data || [], prompt, fmt, opts.out, false);

    logUsage({
      ts: new Date().toISOString(),
      mode: "edit",
      model: MODEL,
      size: data.size ?? size,
      quality: data.quality ?? quality,
      format: data.output_format ?? fmt,
      background: data.background ?? background,
      n: opts.n,
      refs,
      elapsed_s: round(elapsed, 2),
      prompt_preview: prompt.slice(0, 200),
      out_files: saved,
      ...actual,
    });

    err(`  actual: ${formatCost(actual.cost_usd)} (${actual.output_tokens} out tok, ${elapsed.toFixed(1)}s)`);
    for (const s of saved) console.log(s);
    if (saved.length && opts.open) openFile(saved[0]);
  });

program
  .command("cost")
  .description("Summarize usage.jsonl: total spend, per-day, per-mode.")
  .option("--tail <n>", "Show last N calls.", (v) => parseInt(v, 10), 0)
  .option("--days <n>", "Restrict summary to last N days.", (v) => parseInt(v, 10), 0)
  .action((opts) => {
    if (!existsSync(LOG_PATH)) {
      console.log("No usage log yet.");
      return;
    }
    let records = readFileSync(LOG_PATH, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));

    if (opts.days) {
      const cutoff = Date.now() - opts.days * 86_400_000;
      records = records.filter((r) => new Date(r.ts).getTime() >= cutoff);
    }

    if (opts.tail) {
      for (const r of records.slice(-opts.tail)) {
        console.log(
          `${r.ts}  ${(r.mode || "?").padEnd(8)} ${String(r.size ?? "?").padStart(9)} ` +
            `${String(r.quality ?? "?").padStart(6)}  ${formatCost(r.cost_usd ?? 0).padStart(8)}  ` +
            `${(r.prompt_preview ?? "").slice(0, 60)}`,
        );
      }
      return;
    }

    const byDay: Record<string, number> = {};
    const byMode: Record<string, number> = {};
    let total = 0;
    for (const r of records) {
      const day = String(r.ts).slice(0, 10);
      const c = r.cost_usd ?? 0;
      byDay[day] = (byDay[day] || 0) + c;
      byMode[r.mode] = (byMode[r.mode] || 0) + c;
      total += c;
    }
    console.log(`Total spend (${records.length} calls): ${formatCost(total)}`);
    console.log("\nBy mode:");
    for (const [m, c] of Object.entries(byMode).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${m.padEnd(8)}  ${formatCost(c)}`);
    }
    console.log("\nBy day:");
    for (const [d, c] of Object.entries(byDay).sort().slice(-14)) {
      console.log(`  ${d}  ${formatCost(c)}`);
    }
  });

program
  .command("chroma-key")
  .description("Strip a uniform magenta background → transparent PNG (soft matte + despill).")
  .argument("<input>", "Input image path.")
  .option("-o, --output <path>", "Output path. Default: <input-stem>-transparent.png.")
  .option("--key-color <hex>", "Hex of the background color to strip.", "FF00FF")
  .option("--lo <n>", "Magenta-coverage at/below which a pixel stays opaque (0-1). Raise to keep more.", (v) => parseFloat(v), 0.18)
  .option("--hi <n>", "Magenta-coverage at/above which a pixel goes transparent (0-1). Lower to cut more.", (v) => parseFloat(v), 0.55)
  .option("--despill <n>", "Residual-tint removal strength on opaque edge pixels (0-1).", (v) => parseFloat(v), 0.8)
  .action(async (input, opts) => {
    if (!existsSync(input)) die(`Error: input not found: ${input}`, 2);
    const p = parsePath(input);
    const output = opts.output || join(p.dir, `${p.name}-transparent.png`);
    const [cleared, total] = await chromaKeyFile(input, output, parseHexColor(opts.keyColor), {
      tLo: opts.lo,
      tHi: opts.hi,
      despill: opts.despill,
    });
    console.log(`  cleared ${cleared}/${total} px (${((100 * cleared) / total).toFixed(1)}%)  → ${output}`);
  });

program
  .command("setup")
  .description("One-time setup for --chatgpt-auth: sign in with ChatGPT, then doctor.")
  .option("--oauth-port <port>", "Deprecated compatibility option; native Codex does not use a proxy.", (v) => parseInt(v, 10), OAUTH_DEFAULT_PORT)
  .option("--force-login", "Re-run the ChatGPT login even if already authed.")
  .action(async (opts) => {
    if (opts.forceLogin || !codexAuthPresent()) runCodexLogin();
    else err("  ✓ already signed in (~/.codex/auth.json present)");
    err("\nRunning doctor …");
    const ok = await doctorCheck(opts.oauthPort);
    if (ok) {
      err("\n✓ Ready. Use `--chatgpt-auth` on generate/edit to bill against your ChatGPT plan.");
    } else {
      err("\n✗ Setup incomplete — fix the ✗ items above and re-run `setup`.");
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("Check the installed Codex CLI and ChatGPT login.")
  .option("--oauth-port <port>", "Deprecated compatibility option; native Codex does not use a proxy.", (v) => parseInt(v, 10), OAUTH_DEFAULT_PORT)
  .action(async (opts) => {
    if (!(await doctorCheck(opts.oauthPort))) process.exit(1);
  });

program.parseAsync().catch((e) => {
  die(`Error: ${e?.message ?? e}`);
});
