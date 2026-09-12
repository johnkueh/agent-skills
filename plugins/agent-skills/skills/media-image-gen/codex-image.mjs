import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function codexBinary() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const installed = join(homedir(), ".local", "bin", "codex");
  return existsSync(installed) ? installed : "codex";
}

export function codexEnvironment() {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.OPENAI_BASE_URL;
  return env;
}

export function codexLoginStatus() {
  const result = spawnSync(codexBinary(), ["login", "status"], {
    encoding: "utf8",
    env: codexEnvironment(),
    timeout: 15_000,
  });
  return result.status === 0 && /logged in using chatgpt/i.test(`${result.stdout}\n${result.stderr}`);
}

export function nativePrompt({ prompt, refs = [], size = "auto", quality = "high", background = "auto" }) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("A non-empty image prompt is required.");
  return [
    "Use only your built-in image generation tool to produce exactly ONE image with Codex Images 2.5.",
    "Do not call a CLI image wrapper, an OAuth proxy, a paid API, or an image-generation script. Do not generate the image in code.",
    "The image model is selected by the Codex service. Do not substitute an API model or claim a verified backend model ID.",
    refs.length ? "Edit the attached reference image(s). Preserve their subject and style unless the brief requests a change." : "Generate a new image from the brief below.",
    `Requested dimensions: ${size}. Requested quality: ${quality}. Requested background: ${background}.`,
    "Treat dimensions and quality as visual instructions, not invented tool parameters. For a transparent background, preserve native alpha.",
    "Keep the generated original in the tool's output location. Do not move, delete, or convert it. Return only its absolute path.",
    "Image brief:",
    prompt,
  ].join("\n\n");
}

function validImage(path) {
  if (!statSync(path).isFile()) return false;
  const bytes = readFileSync(path);
  return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
}

export async function generateNativeImage(request) {
  const prompt = nativePrompt(request);
  const refs = (request.refs ?? []).map((path) => resolve(path));
  for (const path of refs) {
    if (!validImage(path)) throw new Error(`Reference is not a PNG, JPEG or WebP image: ${path}`);
  }
  if (!codexLoginStatus()) throw new Error("Codex needs a ChatGPT login. Run `codex login`. No API fallback was attempted.");
  const workdir = mkdtempSync(join(tmpdir(), "codex-image-"));
  const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), ".codex"));
  const args = [
    "exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check",
    "--sandbox", "workspace-write", "--cd", workdir,
    "--model", "gpt-6-astra", "--config", 'model_reasoning_effort="medium"',
    "--config", 'forced_login_method="chatgpt"', "--enable", "image_generation", "--json",
    ...refs.flatMap((path) => ["--image", path]), "-",
  ];
  let threadId;
  let usage;
  let completed = false;
  let failure;
  let stderr = "";
  let pending = "";
  const timeoutMs = request.timeoutMs ?? 600_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 1_800_000) {
    rmSync(workdir, { recursive: true, force: true });
    throw new Error("timeoutMs must be between 1000 and 1800000.");
  }
  try {
    await new Promise((accept, reject) => {
      const child = spawn(codexBinary(), args, { env: codexEnvironment(), stdio: ["pipe", "pipe", "pipe"] });
      let killTimer;
      const timeout = setTimeout(() => {
        failure = "Codex image generation timed out. No API fallback was attempted.";
        child.kill("SIGTERM");
        killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
      }, timeoutMs);
      const event = (line) => {
        if (!line.trim()) return;
        let value;
        try { value = JSON.parse(line); } catch { return; }
        if (value.type === "thread.started") threadId = value.thread_id;
        if (value.type === "turn.completed") { completed = true; usage = value.usage; }
        if (value.type === "turn.failed" || value.type === "error") failure = value.error?.message ?? value.message ?? "Codex failed.";
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        pending += chunk;
        let end;
        while ((end = pending.indexOf("\n")) !== -1) {
          event(pending.slice(0, end));
          pending = pending.slice(end + 1);
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-8000); });
      child.stdin.on("error", () => {});
      child.once("error", (error) => { clearTimeout(timeout); clearTimeout(killTimer); reject(error); });
      child.once("close", (code) => {
        clearTimeout(timeout);
        clearTimeout(killTimer);
        event(pending);
        if (failure || code !== 0 || !completed) reject(new Error(failure || `Codex exited ${code}: ${stderr.slice(-1500)}`));
        else accept();
      });
      child.stdin.end(prompt);
    });
    if (!/^[a-f0-9-]{36}$/i.test(threadId ?? "")) throw new Error("Codex returned no valid generation thread ID.");
    const generated = join(codexHome, "generated_images", threadId);
    let paths;
    try {
      paths = readdirSync(generated).filter((name) => /\.(png|jpe?g|webp)$/i.test(name)).map((name) => join(generated, name)).filter(validImage);
    } catch {
      paths = [];
    }
    if (paths.length !== 1) throw new Error(`Expected one generated image in this Codex thread; found ${paths.length}. No API fallback was attempted.`);
    return { paths, thread_id: threadId, usage, auth: "codex-chatgpt", image_model: "codex-managed", plan_quota: true, api_cost_usd: 0 };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const result = await generateNativeImage(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
