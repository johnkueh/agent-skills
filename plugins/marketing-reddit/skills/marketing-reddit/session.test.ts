import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("browser startup and cleanup stay within each caller's session", () => {
  const dir = mkdtempSync(join(tmpdir(), "reddit-session-test-"));
  try {
    const log = join(dir, "calls.jsonl");
    writeFileSync(join(dir, "agent-browser"), `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(process.env.TEST_BROWSER_LOG, JSON.stringify(args) + "\\n");
if (args.includes("get")) console.log("r/test");
if (args.includes("eval")) console.log(JSON.stringify({data:{result:JSON.stringify({s:200,t:JSON.stringify({data:{children:[]}}),ts:0})}}));
`, { mode: 0o755 });
    const sessions: string[] = [];
    for (const requested of ["caller-one", "caller-two", undefined, undefined]) {
      writeFileSync(log, "");
      const env = { ...process.env, HOME: dir, PATH: `${dir}:${process.env.PATH}`, REDDIT_PROXY: "", TEST_BROWSER_LOG: log };
      delete env.REDDIT_MINER_SESSION;
      if (requested) env.REDDIT_MINER_SESSION = requested;
      const result = spawnSync(process.execPath, [join(import.meta.dir, "cli.ts"), "posts", "--subreddit", "test", "--no-proxy"], { env, encoding: "utf8", timeout: 15000 });
      expect(result.status, result.stderr).toBe(0);
      const calls: string[][] = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
      const session = calls[0][1];
      sessions.push(session);
      if (requested) expect(session).toBe(requested);
      expect(calls.length).toBeGreaterThan(4);
      expect(calls.every(args => args[0] === "--session" && args[1] === session && !args.includes("--all"))).toBe(true);
      expect(calls.filter(args => args[2] === "close").length).toBe(2);
      expect(JSON.parse(result.stdout).posts).toEqual([]);
    }
    expect(new Set(sessions).size).toBe(4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
