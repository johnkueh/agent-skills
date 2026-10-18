# Image prompting

Distilled from [OpenAI image prompting](https://developers.openai.com/api/docs/guides/image-prompting)
for GPT Image 2.5, reviewed October 2026. Use it for every generation or edit, including
briefs handed over by another agent.

## Core guidance

- Order the prompt: subject, composition, style and lighting, constraints. Say what the
  image is for (product photo, ad, diagram, comic panel) and who it's for. Readable prose
  or short labelled lines both work; keyword stuffing doesn't.
- Replace vague praise ("clean", "high quality", "moody") with visible properties:
  medium, materials, texture, lighting, colour, scale.
- Photos: describe the photographic look, viewpoint and believable texture. Camera terms
  suggest a look; they don't simulate a lens. "Studio", "cinematic" or "movie poster"
  push toward a stylised result.
- Describe poses, gaze and how people handle objects when it matters.
- Keep tool controls (size, quality, transparency, aspect) as flags, not prose.

## Text in the image

- Quote the exact copy and give its position, hierarchy, typography and how many times
  it appears.
- Spell unusual words, brand names and drug names letter by letter
  (`"Tirzepatide" — T-I-R-Z-E-P-A-T-I-D-E`).
- End with "no extra text" so the model doesn't add captions or labels.
- Use `--quality high` and a landscape size for text-dense slides and diagrams.
- Small text and exact placement are still imperfect. Check spelling and legibility in
  every output.

## References and edits

- Number every reference and give each a role: "Image 1 is the subject. Image 2 is the
  style reference only; do not copy its subject." Then say how they combine. Up to 4.
- Edits: say "change only X" and list what must stay (identity, geometry, layout,
  lighting, labels, framing).
- Make one change per turn. Feed the previous output back as the reference and restate
  the constraints every turn; the model doesn't remember earlier edits.
- Prompts can't guarantee pixel-identical regions. When a region must not change (a
  logo, a chart, UI text), composite the edited area onto the original afterwards.

## Series and recurring characters

Recurring characters and layout-sensitive composition are known weak spots, so carry
the consistency in the prompt:

- Write one appearance block (face, hair, build, clothing, colours, art style) and paste
  it verbatim into every slide or panel prompt.
- Add "Do not redesign the character."
- Chain the previous approved output (or a character sheet) as Image 1 for the next
  slide.
- Hold style, palette and lighting wording constant across the series.
- Comics: one concrete visual beat per panel.

## Aspect ratio

Native output is often slightly off the requested ratio (e.g. 1092×1440 for a 3:4 ask).
State the orientation in the prompt, keep important content away from the edges, and
pass `--aspect W:H` so the CLI centre-crops to the exact ratio.

## Quick shapes

- **Logo:** brand name, what they do, personality, use case. Simple vector shapes,
  strong silhouette, flat, single centred mark, plain background. Use `--transparent`
  and inspect the edges.
- **Illustration:** lead with the medium, then subject, setting, 2–4 specific style
  cues, framing, mood, exclusions.
- **Photoreal:** subject, action, setting, real texture (skin, fabric wear,
  imperfections), framing, light, depth of field, natural colour.
- **Ad:** a creative brief (positioning, audience, concept, composition, exact tagline
  in quotes), then let the model make taste calls inside that.
- **Interface:** describe it as a shipped product with real, usable elements and
  hierarchy.
- **Diagram or infographic:** supply the actual labels and relationships, list every
  required component, and verify accuracy in the output.

## Working conventions

Preserve the user's choices. A detailed brief needs structure, not new creative
requirements. For an open brief, add only art direction that serves the intended use.
Don't invent product claims, statistics, brand assets or a real person's likeness.

Check the whole output, including unwanted additions and the alpha edge (hair, glass,
shadows) when transparency matters.

The Codex image service picks its own model. Naming an API model in the prompt doesn't
pin it.

## Comparing prompts

Save the shared brief, both full prompts and the judging criteria before generating.
Keep references, attempts and controls equal. Keep first outputs, failures, timings and
real dimensions. One pair per topic is exploratory, not statistical evidence.
