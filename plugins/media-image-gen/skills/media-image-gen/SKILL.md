---
name: media-image-gen
description: Generate and edit visual assets with Codex Images 2.5 using the included ChatGPT plan. Supports reference images and local batch scripts, with GPT Image 2.5 Flare for workflows that require the Image API.
---

# Image generation

In a Codex session, use Codex's built-in `image_gen` tool when available. From other agents or local callable scripts, use this skill's CLI: it invokes the installed Codex CLI with a ChatGPT login and the native image tool. The Codex service selects the image model; do not pretend an API model ID pins the included service.

Use GPT Image 2.5 Flare (`gpt-image-2.5-flare`) only for workflows that cannot use native Codex, such as an exact edit mask or a hosted application. The local CLI's `--api` flag explicitly selects that route. Authentication, quota, and generation errors on the native route stop the request; they do not silently trigger paid retries.

## Setup

Install the skill's dependencies with `pnpm install`. Install a current Codex CLI and run `codex login` with the ChatGPT account. The wrapper prefers `~/.local/bin/codex`, then the PATH executable; `CODEX_BIN` can select another installation. Run `node --import tsx cli.ts doctor` to verify the CLI and login. No API key or OAuth proxy is needed for native generation.

For API-only work, provide `OPENAI_API_KEY` through the environment or the existing `~/.config/image-gen/env` store. Never print credentials.

## Prompting

Use `PROMPTING.md` for the visual brief. Describe the scene, subject, composition, details, and constraints. Quote exact text and specify what must remain unchanged in edits. Use reference images for identity or style continuity. Resolve a complete brief directly; ask only when missing information would materially change the result.

## Local commands

Run commands from this skill directory. `--chatgpt-auth` remains a compatibility alias for the default native route.

```bash
node --import tsx cli.ts generate \
  --prompt "A watercolor lemon on a plain white background, no text" \
  --out ./lemon.png --no-open

node --import tsx cli.ts edit \
  --ref ./lemon.png --prompt "Change only the lemon to a lime" \
  --out ./lime.png --no-open

node --import tsx cli.ts generate \
  --prompt "A single watercolor lemon sticker, no text" \
  --transparent --out ./sticker.png --no-open

node --import tsx cli.ts batch \
  --manifest ./images.json --concurrency 2 --skip-existing
```

Batch manifests are JSON arrays of `{ "prompt": "...", "out": "...", "size": "auto", "quality": "high", "format": "png" }`. Size, quality, and format are optional. `generate --ref` also accepts references; repeat `--ref` for multiple images. `--n` generates multiple images through separate native calls. Use `--dry-run` to inspect routing without generating an image.

On the native route, `--size` and `--quality` are prompt guidance, not hard API controls. Inspect the resulting dimensions if exact output matters. File formats are converted locally while preserving alpha for PNG/WebP. `--transparent` requests native transparency; the standalone `chroma-key` utility remains available for existing assets.

## API-only commands

```bash
node --import tsx cli.ts generate --api \
  --prompt "A watercolor lemon" --out ./lemon.png --no-open

node --import tsx cli.ts edit \
  --ref ./photo.png --mask ./mask.png \
  --prompt "Replace only the masked background with pale blue" \
  --out ./edited.png --no-open
```

An exact `--mask` automatically selects the Flare API and reports the reason. API quality values are `low`, `medium`, `high`, `xhigh`, `max`, and `auto`. Native transparent API output needs PNG/WebP. Use API `--dry-run` to inspect a request first. Pre-flight cost estimates use legacy token counts and are approximate; actual response usage determines API cost.

The usage log remains at `~/.config/image-gen/usage.jsonl`. Native calls record `auth: codex-chatgpt`, `image_model: codex-managed`, the generation thread, and zero separate API cost. This uses the included plan allowance, not unlimited usage.

Release: https://openai.com/index/introducing-chatgpt-images-2-5/
API controls: https://developers.openai.com/api/docs/guides/image-generation
