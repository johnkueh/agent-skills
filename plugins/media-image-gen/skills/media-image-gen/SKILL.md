---
name: media-image-gen
description: Generate and edit visual assets with Codex Images 2.5 on the included ChatGPT plan. Inside Codex use the built-in image tool; elsewhere use this skill's CLI for generate, edit, reference images, batch scripts and exact aspect ratios.
---

# Image generation

**Inside Codex:** use the built-in `image_gen` tool directly. Never call this CLI from Codex.

**Elsewhere** (other agents, shell scripts, batch jobs): use this skill's CLI. It runs the installed Codex CLI with your ChatGPT login and the native image tool, on the included plan allowance. There is no API-key route. Login, quota and generation errors stop the request.

Write every prompt with [PROMPTING.md](PROMPTING.md).

## Setup

From this skill directory: `pnpm install`, install a current Codex CLI, run `codex login` with the ChatGPT account, then check with:

```bash
node --import tsx cli.ts doctor
```

The wrapper uses `$CODEX_BIN`, then `~/.local/bin/codex`, then `codex` on PATH.

## Commands

```bash
node --import tsx cli.ts generate --no-open --out ./lemon.png \
  -p "A watercolor lemon on a plain white background, no text"

node --import tsx cli.ts edit --no-open --out ./lime.png \
  --ref ./lemon.png -p "Change only the lemon to a lime. Keep everything else."

node --import tsx cli.ts generate --no-open --out ./slide.png \
  --size 1024x1536 --quality high --aspect 4:5 -p "..."

node --import tsx cli.ts batch --manifest ./images.json --concurrency 2 --skip-existing
```

- `--ref <path>` attaches a reference; repeat for several (up to 4). Works on `generate` and `edit`.
- `--size` is `auto` or any `WxH`, and `--quality` is `low|medium|high|xhigh|max|auto`. Both are prompt guidance only, so the model may not hit the exact pixels.
- `--aspect W:H` (e.g. `4:5`, `2:3`, `9:16`, `1:1`) post-processes the output to that exact ratio. It centre-crops to the largest box with that ratio and never pads or upscales. Native output is often a little off-aspect (e.g. 1092×1440). Leave margin near the edges for anything that must not be cropped.
- `--format png|jpeg|webp` converts locally. `--transparent` asks for native alpha and forces PNG.
- `--n` makes several images through separate calls. `--dry-run` prints the request without generating.
- Batch manifests are JSON arrays of `{ "prompt", "out", "size"?, "quality"?, "format"?, "aspect"? }`.

Each call appends a line (mode, thread IDs, requested settings, output files) to `~/.config/image-gen/usage.jsonl`.
