# Image prompting

Distilled from [OpenAI image prompting](https://developers.openai.com/api/docs/guides/image-prompting),
reviewed September 2026. Use it for every generation or edit, including briefs handed
over by another agent. Refresh the official page only when the question is about current
models or controls.

## Core guidance

- Say what the image is for: deliverable, audience, subject, framing, aspect ratio, and
  any placement constraints. Readable prose or short labeled lines both work; syntax is
  not a quality trick.
- Replace vague praise ("clean", "high quality") with visible properties: medium,
  materials, texture, lighting, color, scale.
- Photos: describe the photographic look, viewpoint, and believable texture. Camera
  terms suggest a look; they don't simulate a lens. Words like "studio", "cinematic", or
  "movie poster" push toward a stylized result.
- Describe poses, gaze, and how people interact with objects when it matters.
- Text in the image: quote it exactly and give its placement, hierarchy, and how many
  times it appears. Check spelling and legibility afterwards.
- Reference images: give each one a role ("Image 1 is the style, Image 2 is the
  subject") and say how they relate.
- Edits: separate what may change from what must stay (identity, geometry, text,
  framing, surroundings). Make one focused change at a time and restate what must stay
  on every turn; the model doesn't remember previous edits.
- Comics and panels: one concrete action per panel, re-describe each character every
  panel, hold style and palette constant.
- Interfaces: describe it as a shipped product with real, usable elements and hierarchy.
- Diagrams and infographics: supply the actual labels and relationships, list every
  required component, and verify accuracy in the output.
- Check the whole output, including unwanted additions and the alpha edge when
  transparency matters. A prompt can't guarantee pixel preservation.
- Keep tool controls (size, quality, transparency) as flags, not prose.

## Working conventions

Preserve the user's choices. A detailed brief needs structure, not new creative
requirements. For an open brief, add only art direction that serves the intended use.
Don't invent product claims, statistics, brand assets, or a real person's likeness.

Don't force every field into every prompt; a good brief often fits in one paragraph.
Existing references and real layout requirements beat generic templates.

The native Codex image service picks its own model. Report what it exposes; naming an
API model in the prompt doesn't pin it.

## Quick shapes

- **Logo:** brand name, what they do, personality, use case. Simple vector shapes,
  strong silhouette, balanced negative space, flat, single centered mark, plain
  background. Use `--transparent` and inspect the edges.
- **Illustration:** lead with the medium, then subject, setting, 2–4 specific style
  cues, framing, mood, exclusions.
- **Photoreal:** subject, action, setting, real texture (skin, fabric wear,
  imperfections), framing, light, depth of field, natural color.
- **Ad:** a creative brief — brand positioning, audience, concept, composition, exact
  tagline in quotes — then let the model make taste calls inside that.

## Comparing prompts

When asked to compare prompts, save the shared brief, both full prompts, and the judging
criteria before generating. Keep format, route, references, attempts, and controls
equal. Keep first outputs, failures, timings, and real dimensions. Separate hard
requirements from taste.

A concise-versus-expanded comparison measures prompt shaping, nothing more; note any
extra art direction the expanded prompt added. One pair per topic is exploratory, not
statistical evidence.
