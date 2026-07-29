#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  constants,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const pluginsRoot = join(root, "plugins");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const marketplaceName = "johnkueh-agent-skills";
const bundleName = "agent-skills";

function frontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Missing YAML frontmatter");
  return match[1];
}

function frontmatterField(markdown, key) {
  const block = frontmatter(markdown);
  const line = block.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!line) throw new Error(`Missing ${key}`);
  const raw = line[1].trim();
  if (!/^[>|]-?$/.test(raw)) return raw.replace(/^["']|["']$/g, "");
  const after = block.slice(line.index + line[0].length).split(/\r?\n/).slice(1);
  const values = [];
  for (const value of after) {
    if (!/^\s+/.test(value)) break;
    values.push(value.trim());
  }
  return values.join(" ").trim();
}

function titleCase(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function manifest(name, description) {
  return {
    name,
    version,
    description,
    author: { name: "John Kueh", url: "https://github.com/johnkueh" },
    repository: "https://github.com/johnkueh/agent-skills",
  };
}

function codexManifest(name, description) {
  const displayName = titleCase(name);
  return {
    ...manifest(name, description),
    skills: "./skills/",
    interface: {
      displayName,
      shortDescription: `Use the ${displayName} skill collection`,
      longDescription: description,
      developerName: "John Kueh",
      category: "Developer Tools",
      capabilities: ["Interactive", "Write"],
      websiteURL: "https://github.com/johnkueh/agent-skills",
      defaultPrompt: [`Use $${name} to help with this request.`],
    },
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function copyDirectory(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    mode: constants.COPYFILE_FICLONE,
    preserveTimestamps: false,
  });
}

const sharedModules = [
  {
    canonical: "scripts/shared/dataforseo.py",
    targets: [
      "skills/marketing-keyword-data/dataforseo.py",
      "skills/marketing-serp/dataforseo.py",
    ],
  },
];

for (const { canonical, targets } of sharedModules) {
  const content = readFileSync(join(root, canonical), "utf8");
  const header =
    `# GENERATED FILE — synced from ${canonical} by scripts/build-packages.mjs.\n` +
    "# Edit the canonical file, then run `pnpm build`.\n";
  for (const target of targets) {
    writeFileSync(join(root, target), header + content);
  }
}

const skillNames = execFileSync("git", ["ls-files", "skills/*/SKILL.md"], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((path) => path.split("/")[1])
  .sort();

if (skillNames.length === 0) throw new Error("No committed skills found");

const descriptions = new Map();
for (const name of skillNames) {
  const skillDir = join(skillsRoot, name);
  const markdown = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const skillName = frontmatterField(markdown, "name");
  if (skillName !== name) throw new Error(`${name}: frontmatter name mismatch`);
  const description = frontmatterField(markdown, "description");
  if (!description) throw new Error(`${name}: empty description`);
  descriptions.set(name, description);

  const displayName = titleCase(name);
  mkdirSync(join(skillDir, "agents"), { recursive: true });
  writeFileSync(
    join(skillDir, "agents", "openai.yaml"),
    [
      "interface:",
      `  display_name: ${JSON.stringify(displayName)}`,
      `  short_description: ${JSON.stringify(`Use the ${displayName} workflow`)}`,
      `  default_prompt: ${JSON.stringify(`Use $${name} to help with this request.`)}`,
      "policy:",
      "  allow_implicit_invocation: true",
      "",
    ].join("\n"),
  );
}

rmSync(pluginsRoot, { recursive: true, force: true });
mkdirSync(pluginsRoot, { recursive: true });

const bundleRoot = join(pluginsRoot, bundleName);
for (const name of skillNames) {
  copyDirectory(join(skillsRoot, name), join(bundleRoot, "skills", name));
}
const bundleDescription =
  "Cross-agent skills for engineering, research, communications, media, design, data, and macOS operations.";
writeJson(join(bundleRoot, ".claude-plugin", "plugin.json"), manifest(bundleName, bundleDescription));
writeJson(join(bundleRoot, ".codex-plugin", "plugin.json"), codexManifest(bundleName, bundleDescription));
writeJson(join(bundleRoot, "skills.json"), { skills: skillNames });

const marketplacePlugins = [
  { name: bundleName, description: bundleDescription, source: `./plugins/${bundleName}` },
];

for (const name of skillNames) {
  const pluginRoot = join(pluginsRoot, name);
  copyDirectory(join(skillsRoot, name), join(pluginRoot, "skills", name));
  const description = descriptions.get(name);
  writeJson(join(pluginRoot, ".claude-plugin", "plugin.json"), manifest(name, description));
  writeJson(join(pluginRoot, ".codex-plugin", "plugin.json"), codexManifest(name, description));
  marketplacePlugins.push({ name, description, source: `./plugins/${name}` });
}

const marketplace = {
  name: marketplaceName,
  owner: { name: "John Kueh", url: "https://github.com/johnkueh" },
  metadata: {
    description: "John Kueh's cross-agent skill collection for Claude, Codex, and Grok.",
  },
  plugins: marketplacePlugins,
};
writeJson(join(root, ".claude-plugin", "marketplace.json"), marketplace);
writeJson(join(root, ".agents", "plugins", "marketplace.json"), marketplace);

console.log(`Materialized ${skillNames.length} skills into one bundle and ${skillNames.length} single-skill plugins`);
