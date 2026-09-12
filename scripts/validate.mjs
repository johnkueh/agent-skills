#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "skills");
const bundleRoot = join(root, "plugins", "agent-skills", "skills");
const errors = [];
const forbidden = [
  ["Claude config path", /(?:~\/|\/)\.claude\//],
  ["Claude plugin root", /\bCLAUDE_PLUGIN_ROOT\b/],
  ["Claude interactive question tool", /\bAskUserQuestion\b/],
  ["Claude file delivery tool", /\bSendUserFile\b/],
  ["Claude session cron", /\bCronCreate\s*\(/],
  ["Claude workflow invocation", /\bWorkflow\s*\{/],
  ["Claude task polling", /\bTaskGet\b/],
];

function filesUnder(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`Symlink is not allowed: ${relative(root, path)}`);
    } else if (entry.isDirectory()) {
      files.push(...filesUnder(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function relativeFiles(directory) {
  return filesUnder(directory).map((path) => relative(directory, path)).sort();
}

function compareTrees(source, destination, label) {
  const sourceFiles = relativeFiles(source);
  const destinationFiles = relativeFiles(destination);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(destinationFiles)) {
    errors.push(`${label}: file list differs from canonical skill`);
    return;
  }
  for (const path of sourceFiles) {
    if (hash(join(source, path)) !== hash(join(destination, path))) {
      errors.push(`${label}: content differs at ${path}`);
    }
  }
}

const skillNames = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && statSync(join(sourceRoot, entry.name, "SKILL.md"), { throwIfNoEntry: false }))
  .map((entry) => entry.name)
  .sort();

for (const name of skillNames) {
  const skillDir = join(sourceRoot, name);
  const skillPath = join(skillDir, "SKILL.md");
  const markdown = readFileSync(skillPath, "utf8");
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) {
    errors.push(`${name}: missing YAML frontmatter`);
    continue;
  }
  const nameMatch = block[1].match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  if (!nameMatch || nameMatch[1].trim() !== name) {
    errors.push(`${name}: frontmatter name must equal directory name`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    errors.push(`${name}: invalid Agent Skills name`);
  }
  if (markdown.trimEnd().split(/\r?\n/).length > 500) {
    errors.push(`${name}: SKILL.md exceeds 500 lines`);
  }
  const interfacePath = join(skillDir, "agents", "openai.yaml");
  if (!statSync(interfacePath, { throwIfNoEntry: false })) {
    errors.push(`${name}: missing agents/openai.yaml`);
  } else if (!readFileSync(interfacePath, "utf8").includes(`$${name}`)) {
    errors.push(`${name}: openai.yaml must name $${name}`);
  }
  for (const [label, pattern] of forbidden) {
    if (pattern.test(markdown)) errors.push(`${name}: portable core contains ${label}`);
  }

  compareTrees(skillDir, join(bundleRoot, name), `bundle/${name}`);
  compareTrees(skillDir, join(root, "plugins", name, "skills", name), `single/${name}`);
}

for (const path of filesUnder(join(root, "plugins"))) {
  if (lstatSync(path).isSymbolicLink()) {
    errors.push(`Unexpected symlink: ${relative(root, path)}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const bundleClaude = JSON.parse(readFileSync(join(root, "plugins/agent-skills/.claude-plugin/plugin.json"), "utf8"));
const bundleCodex = JSON.parse(readFileSync(join(root, "plugins/agent-skills/.codex-plugin/plugin.json"), "utf8"));
if (packageJson.version !== bundleClaude.version || packageJson.version !== bundleCodex.version) {
  errors.push("Workspace, Claude, and Codex bundle versions must match");
}

for (const manifest of [
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
]) {
  try {
    JSON.parse(readFileSync(join(root, manifest), "utf8"));
  } catch (error) {
    errors.push(`${manifest}: invalid JSON (${error.message})`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${skillNames.length} canonical, bundle, and single-skill packages`);
