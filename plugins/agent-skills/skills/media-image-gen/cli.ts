#!/usr/bin/env -S npx tsx
/**
 * Codex Images 2.5 CLI for agents and scripts outside Codex.
 *
 * Every image goes through native Codex image generation (codex-image.mjs) on the
 * ChatGPT plan; there is no API-key route. Size and quality are prompt guidance;
 * --aspect post-processes the result to an exact ratio by centre-cropping.
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse as parsePath } from "node:path";

import { Command, Option } from "commander";
import sharp from "sharp";

import { centerCropBox, parseAspect } from "./aspect.mjs";
import { codexBinary, codexEnvironment, codexLoginStatus, generateNativeImage } from "./codex-image.mjs";

const LOG_PATH = join(homedir(), ".config", "image-gen", "usage.jsonl");
const QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"];
const FORMATS = ["png", "jpeg", "webp"];
const BACKGROUNDS = ["auto", "transparent", "opaque"];

type Format = "png" | "jpeg" | "webp";

interface ImageJob {
  mode: "generate" | "edit";
  prompt: string;
  refs: string[];
  size: string;
  quality: string;
  background: string;
  fmt: Format;
  aspect?: string;
  out?: string;
  n: number;
}

function err(msg: string): void {
  process.stderr.write(msg + "\n");
}

function die(msg: string, code = 1): never {
  err(msg);
  process.exit(code);
}

function validateChoice(name: string, value: string, choices: string[]): void {
  if (!choices.includes(value)) die(`Error: invalid ${name} '${value}'. Choose from: ${choices.join(", ")}`, 2);
}

function validateSize(size: string): void {
  if (size === "auto") return;
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m || !Number(m[1]) || !Number(m[2])) die(`Error: invalid size '${size}'. Use auto or WxH, e.g. 1024x1536.`, 2);
}

function validateAspect(aspect: string | undefined): void {
  if (aspect === undefined) return;
  try {
    parseAspect(aspect);
  } catch (e) {
    die(`Error: ${(e as Error).message}`, 2);
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
}

function targetPath(job: ImageJob, index: number): string {
  if (job.out && job.n === 1) return job.out;
  if (!job.out) {
    const d = new Date();
    const p = (v: number) => String(v).padStart(2, "0");
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    return join(process.cwd(), `${ts}-${slugify(job.prompt)}${job.n > 1 ? `-${index + 1}` : ""}.${job.fmt}`);
  }
  const p = parsePath(job.out);
  return join(p.dir, `${p.name}-${index + 1}${p.ext}`);
}

async function writeOutput(source: string, target: string, job: ImageJob): Promise<string> {
  let image = sharp(source);
  let note = "";
  if (job.aspect) {
    const { width = 0, height = 0 } = await image.metadata();
    const box = centerCropBox(width, height, parseAspect(job.aspect));
    image = image.extract(box);
    note = ` (${width}x${height} -> ${box.width}x${box.height})`;
  }
  if (job.fmt === "jpeg") image = image.flatten({ background: "#ffffff" });
  mkdirSync(dirname(target), { recursive: true });
  await image.toFormat(job.fmt).toFile(target);
  return note;
}

async function runJob(job: ImageJob): Promise<{ saved: string[]; elapsed: number }> {
  const t0 = Date.now();
  const saved: string[] = [];
  const threads: string[] = [];
  for (let i = 0; i < job.n; i++) {
    const result = await generateNativeImage({
      prompt: job.prompt,
      refs: job.refs,
      size: job.size,
      quality: job.quality,
      background: job.background,
    });
    const target = targetPath(job, i);
    const note = await writeOutput(result.paths[0], target, job);
    if (note) err(`  aspect ${job.aspect}${note}`);
    saved.push(target);
    threads.push(String(result.thread_id));
  }
  const elapsed = (Date.now() - t0) / 1000;
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(
    LOG_PATH,
    JSON.stringify({
      ts: new Date().toISOString(),
      mode: job.mode,
      auth: "codex-chatgpt",
      image_model: "codex-managed",
      threads,
      size_requested: job.size,
      quality_requested: job.quality,
      aspect: job.aspect ?? null,
      format: job.fmt,
      n: saved.length,
      refs: job.refs,
      elapsed_s: Math.round(elapsed * 100) / 100,
      prompt_preview: job.prompt.slice(0, 200),
      out_files: saved,
    }) + "\n",
  );
  return { saved, elapsed };
}

function openFile(path: string): void {
  try {
    spawn("open", [path], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* best effort */
  }
}

const collect = (v: string, acc: string[]) => [...acc, v];

function imageCommand(name: "generate" | "edit", description: string): Command {
  const cmd = new Command(name)
    .description(description)
    .requiredOption("-p, --prompt <text>", "Final prompt (see PROMPTING.md).");
  if (name === "edit") cmd.requiredOption("--ref <path>", "Reference image. Repeat for several (up to 4).", collect, []);
  else cmd.option("--ref <path>", "Reference image. Repeat for several (up to 4).", collect, []);
  return cmd
    .option("--size <size>", "auto or WxH, e.g. 1024x1536 (prompt guidance only).", "auto")
    .option("--quality <q>", QUALITIES.join("|"), "high")
    .option("--format <fmt>", FORMATS.join("|"), "png")
    .option("--background <bg>", BACKGROUNDS.join("|"), "auto")
    .option("--aspect <W:H>", "Centre-crop the output to this exact ratio, e.g. 4:5, 2:3, 9:16, 1:1.")
    .option("--n <n>", "Images to generate (1-10), one Codex call each.", (v) => parseInt(v, 10), 1)
    .option("-o, --out <path>", "Output path (default: cwd/<ts>-<slug>.<fmt>).")
    .option("-t, --transparent", "Native transparent background; forces PNG.")
    .option("--dry-run", "Print the request and exit.")
    .option("--no-open", "Don't open the result.")
    .addOption(new Option("--chatgpt-auth", "No-op; the ChatGPT plan is the only route.").hideHelp())
    .action(async (opts) => {
      const job: ImageJob = {
        mode: name,
        prompt: opts.prompt,
        refs: opts.ref,
        size: opts.size,
        quality: opts.quality,
        background: opts.transparent ? "transparent" : opts.background,
        fmt: opts.transparent ? "png" : opts.format,
        aspect: opts.aspect,
        out: opts.out,
        n: opts.n,
      };
      for (const r of job.refs) if (!existsSync(r)) die(`Error: ref not found: ${r}`, 2);
      validateSize(job.size);
      validateChoice("quality", job.quality, QUALITIES);
      validateChoice("format", job.fmt, FORMATS);
      validateChoice("background", job.background, BACKGROUNDS);
      validateAspect(job.aspect);
      if (job.background === "transparent" && job.fmt === "jpeg") die("Transparency requires PNG or WebP.", 2);
      if (!Number.isInteger(job.n) || job.n < 1 || job.n > 10) die("n must be between 1 and 10.", 2);

      err(`Prompt (${job.prompt.length} chars):\n${job.prompt}`);
      if (opts.dryRun) {
        const { prompt: _prompt, fmt: format, ...rest } = job;
        console.log(JSON.stringify({ dry_run: true, auth: "codex-chatgpt", ...rest, format }, null, 2));
        return;
      }
      const { saved, elapsed } = await runJob(job);
      err(`  done (${elapsed.toFixed(1)}s)`);
      for (const s of saved) console.log(s);
      if (saved.length && opts.open) openFile(saved[0]);
    });
}

const program = new Command();
program.name("image-gen").description("Codex Images 2.5 on the ChatGPT plan: generate, edit and batch.");
program.addCommand(imageCommand("generate", "Text (plus optional references) to image."));
program.addCommand(imageCommand("edit", "Edit one or more reference images."));

program
  .command("batch")
  .description("Generate images from a JSON manifest in parallel (up to 8 Codex sessions).")
  .requiredOption("--manifest <file>", 'JSON array of { "prompt", "out", "size"?, "quality"?, "format"?, "aspect"? }.')
  .option("--concurrency <n>", "Parallel generations, 1-8.", (v) => parseInt(v, 10), 4)
  .option("--quality <q>", "Default quality when an item omits it.", "high")
  .option("--size <size>", "Default size when an item omits it.", "auto")
  .option("--format <fmt>", "Default format when an item omits it.", "png")
  .option("--aspect <W:H>", "Default aspect when an item omits it.")
  .option("--skip-existing", "Skip items whose out file already exists.")
  .option("--dry-run", "Print the plan and exit.")
  .action(async (opts) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(opts.manifest, "utf8"));
    } catch (e) {
      die(`Cannot read manifest ${opts.manifest}: ${(e as Error).message}`, 2);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) die("Manifest must be a non-empty JSON array.", 2);
    const items: ImageJob[] = parsed.map((it: any, i: number) => {
      if (!it || typeof it.prompt !== "string" || typeof it.out !== "string") {
        die(`manifest[${i}] must have string "prompt" and "out".`, 2);
      }
      const job: ImageJob = {
        mode: "generate",
        prompt: it.prompt,
        refs: [],
        size: it.size ?? opts.size,
        quality: it.quality ?? opts.quality,
        background: "auto",
        fmt: it.format ?? opts.format,
        aspect: it.aspect ?? opts.aspect,
        out: it.out,
        n: 1,
      };
      validateSize(job.size);
      validateChoice("quality", job.quality, QUALITIES);
      validateChoice("format", job.fmt, FORMATS);
      validateAspect(job.aspect);
      return job;
    });

    const conc = Math.min(8, Math.max(1, Number.isNaN(opts.concurrency) ? 1 : opts.concurrency));
    const work = opts.skipExisting ? items.filter((it) => !existsSync(it.out!)) : items;
    err(`batch: ${work.length}/${items.length} image(s), concurrency ${conc}`);
    if (opts.dryRun || work.length === 0) {
      console.log(JSON.stringify({ dry_run: !!opts.dryRun, count: work.length, concurrency: conc, outs: work.map((w) => w.out) }, null, 2));
      return;
    }
    if (!codexLoginStatus()) die("Codex needs a ChatGPT login. Run `codex login`.", 2);

    let ok = 0;
    const failures: Array<{ out: string; error: string }> = [];
    let idx = 0;
    const runner = async () => {
      while (idx < work.length) {
        const it = work[idx++];
        try {
          const { saved, elapsed } = await runJob(it);
          ok++;
          err(`  [${ok + failures.length}/${work.length}] ok ${saved[0]} (${elapsed.toFixed(1)}s)`);
        } catch (e) {
          const msg = String((e as Error)?.message ?? e);
          failures.push({ out: it.out!, error: msg });
          err(`  [${ok + failures.length}/${work.length}] failed ${it.out}: ${msg.slice(0, 140)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(conc, work.length) }, runner));
    err(`batch done: ${ok} ok, ${failures.length} failed. Re-run with --skip-existing to retry failures.`);
    console.log(JSON.stringify({ ok, failed: failures.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  });

program
  .command("doctor")
  .description("Check the installed Codex CLI and ChatGPT login.")
  .action(() => {
    const version = spawnSync(codexBinary(), ["--version"], { encoding: "utf8", env: codexEnvironment() });
    const loggedIn = codexLoginStatus();
    err(`  Codex CLI: ${version.status === 0 ? version.stdout.trim() : "not installed"}`);
    err(`  ChatGPT login: ${loggedIn ? "ready" : "run codex login"}`);
    if (version.status !== 0 || !loggedIn) process.exit(1);
  });

program.parseAsync().catch((e) => die(`Error: ${e?.message ?? e}`));
