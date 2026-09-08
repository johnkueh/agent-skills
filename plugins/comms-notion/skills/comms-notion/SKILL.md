---
name: comms-notion
description: "Read a Notion page from its URL or ID and return its title, metadata, and body. Use for Notion links or requests to read, summarize, fetch, or extract a Notion document."
---

# Notion Page

Fetch a Notion page's title and body content as markdown via the Notion API.

## Setup

Requires a Notion internal integration token in the environment or a gitignored
`.env` in the working directory. Do not store credentials in the skill package:

```
NOTION_TOKEN=ntn_...
```

The page must be **shared with the integration**: open the page in Notion → `Share` → `Connections` → add the integration. Without sharing, the API returns 404 even though the page exists.

Dependencies install on first run via `uv` (notion-client, python-dotenv).

## Commands

Run from this skill's base directory.

### Read a page (JSON output, default)

```bash
uv run python cli.py "<notion-page-url>"
```

### Read a page (markdown output)

```bash
uv run python cli.py "<url-or-id>" --format md
```

### Truncate large pages

```bash
uv run python cli.py "<url-or-id>" --max-chars 20000
```

Accepts: full URL, dashed page ID (`<dashed-page-id>`), or bare 32-char hex (`<page-id>`).

### Image handling

By default the page's signed S3 image URLs are kept inline (each is several KB of query-string noise — bad for context). Pick a different mode:

```bash
# Download images to results/<page>/images/ and rewrite markdown to relative paths.
# Best mode for agent use: agent gets local paths, can `Read` any image on demand.
uv run python cli.py "<url-or-id>" --images download

# Inline images as data: URLs. Self-contained but bloats context massively
# (a 7-image page becomes ~600K tokens). Use only if you need a single artifact.
uv run python cli.py "<url-or-id>" --images base64

# Replace every image with `[image]` placeholder. Smallest output.
uv run python cli.py "<url-or-id>" --images strip

# Custom output directory for --images=download
uv run python cli.py "<url-or-id>" --images download --out-dir /tmp/notion-export
```

When `--images=download`, output also includes `page.md` and `images/img_<hash>.<ext>` next to each other, so the markdown's relative paths resolve.

## JSON output shape

```json
{
  "url": "https://www.notion.so/...",
  "page_id": "<page-id>",
  "title": "Example project specification",
  "created_time": "2026-...",
  "last_edited_time": "2026-...",
  "content": "## Heading\n\nBody as markdown...",
  "content_length": 4823,
  "truncated": false,
  "images_mode": "download",
  "output_dir": "results/<page-id>_<timestamp>",
  "markdown_path": "results/.../page.md",
  "images": [
    {"path": ".../img_aa209471db1f.png", "relative": "images/img_aa209471db1f.png", "size": 223152, "mime": "image/png", "source_url": "..."}
  ]
}
```

The `images` array and output paths only appear when `--images=download`.

## Block coverage

Headings (1–3), paragraphs, bulleted/numbered lists, to-dos, toggles, quotes, callouts, code (with language), dividers, bookmarks/embeds, images/video/files/pdfs, tables, equations, child pages, child databases. Nested children render with indentation. Unsupported block types emit `<!-- unsupported block: <type> -->` so nothing disappears silently.

## Troubleshooting

- **404 / "object_not_found"** — the integration isn't added to the page. Share → Connections → add it.
- **"NOTION_TOKEN not set"** — inject the variable or use a gitignored `.env` in the working directory, outside the skill package.
