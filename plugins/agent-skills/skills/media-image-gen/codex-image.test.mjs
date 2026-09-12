import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateNativeImage } from "./codex-image.mjs";

test("native generation uses ChatGPT auth and only accepts an image from its own thread", async () => {
  const root = mkdtempSync(join(tmpdir(), "test-codex-image-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const original = { ...process.env };
  writeFileSync(join(bin, "codex"), `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
if (process.argv[2] === "login") {
  console.log(process.env.FAKE_NO_LOGIN ? "Logged in using an API key" : "Logged in using ChatGPT");
  process.exit(0);
}
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  fs.writeFileSync(path.join(process.env.CODEX_HOME, "request.json"), JSON.stringify({
    args: process.argv.slice(2), prompt: input,
    apiKeyPresent: Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY),
  }));
  const id = "11111111-1111-4111-8111-111111111111";
  const output = path.join(process.env.CODEX_HOME, "generated_images", id);
  fs.mkdirSync(output, { recursive: true });
  if (!process.env.FAKE_NO_IMAGE) fs.writeFileSync(path.join(output, "result.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=", "base64"));
  console.log(JSON.stringify({ type: "thread.started", thread_id: id }));
  console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "/tmp/not-a-generated-image.png" } }));
  console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10 } }));
});
`, { mode: 0o755 });
  process.env.PATH = `${bin}:${original.PATH}`;
  process.env.CODEX_HOME = root;
  process.env.CODEX_BIN = join(bin, "codex");
  process.env.OPENAI_API_KEY = "test-sentinel";
  process.env.CODEX_API_KEY = "test-sentinel";
  try {
    const result = await generateNativeImage({ prompt: "A blue circle", background: "transparent", size: "1024x1024" });
    assert.equal(result.auth, "codex-chatgpt");
    assert.equal(result.api_cost_usd, 0);
    assert.equal(result.paths.length, 1);
    const request = JSON.parse(readFileSync(join(root, "request.json")));
    assert.equal(request.apiKeyPresent, false);
    assert.ok(request.args.includes('forced_login_method="chatgpt"'));
    assert.ok(request.args.includes("workspace-write"));
    assert.ok(request.args.includes("image_generation"));
    assert.ok(!request.args.includes("--dangerously-bypass-approvals-and-sandbox"));
    assert.match(request.prompt, /transparent/);
    rmSync(join(root, "generated_images"), { recursive: true });
    process.env.FAKE_NO_IMAGE = "1";
    await assert.rejects(generateNativeImage({ prompt: "A circle" }), /found 0/);
    delete process.env.FAKE_NO_IMAGE;
    process.env.FAKE_NO_LOGIN = "1";
    await assert.rejects(generateNativeImage({ prompt: "A circle" }), /ChatGPT login/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
    rmSync(root, { recursive: true, force: true });
  }
});
