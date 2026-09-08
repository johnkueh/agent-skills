---
name: brand-copy
description: >-
  Write and edit product and marketing copy, including interface strings,
  landing pages, headlines, CTAs, emails, release notes, and de-slopping an
  existing draft. Use for brand voice and conversion copy, not personal essays
  or product-behavior decisions. Triggers on "write the copy", "landing page
  copy", "fix this CTA", "rewrite this headline", "humanize this", "remove AI
  tells", "error message", "empty state", and "make this sound less generic".
---

# Brand copy

Write clear, specific copy that sounds like the product has a point of view.
Preserve accurate claims, established terminology, and the reader's ability to
understand what happens next.

## Load the guidance

For interface text, first check the available skills:

- If `better-writing` is available, use it for interface patterns and review
  format. Also read [references/interface-copy.md](references/interface-copy.md)
  for the complementary Mailchimp-derived voice and editorial rules.
- If `better-writing` is unavailable, read both
  [references/interface-copy.md](references/interface-copy.md) and
  [references/interface-patterns.md](references/interface-patterns.md). The
  latter is the portable fallback, so do not load it alongside `better-writing`.

For a homepage, landing page, sales page, hero, headline, benefit, testimonial,
objection, or conversion request, read
[references/landing-pages.md](references/landing-pages.md).

Use installed companion skills by ownership:

| Concern | Owner when available | `brand-copy` role |
| --- | --- | --- |
| Interface wording and UX-writing review | `better-writing` | Brand voice, editorial style, claim integrity, and humanizing |
| Conversion structure and customer evidence | `brand-copy` | Primary owner |
| Text rendering, wrapping, and truncation | `better-typography` | Supply final copy and realistic content lengths |
| Semantics, accessible names, error wiring, and announcements | `better-accessibility` | Supply clear labels and messages |
| Text expansion and spatial RTL | `better-layout` | Supply complete localizable strings |
| Rendered contrast and semantic color | `better-colors` | Supply a textual state cue when color is not enough |
| Visual polish and motion | `better-ui` | Do not let visual treatment rewrite the meaning |

Load a companion only when the request touches its concern. If an environment
provides a broader design or interface orchestrator, let it coordinate the
specialist findings and output format; do not produce duplicate parallel
reviews. Do not assume that a skill named `better-design` exists—inspect the
available skill list.

Use [references/humanizing.md](references/humanizing.md) for longer brand copy or
a humanizing request. For a small label or factual correction, apply the relevant
voice rules directly without an unrelated editorial pass.

Load interface and landing-page guidance together only when the request
genuinely crosses both surfaces.

## Establish the brief

Before writing, settle what the available context can answer:

1. **Purpose:** the one action or understanding the copy should produce.
2. **Reader:** who they are, what they know, and what state they are in.
3. **Product:** what it does and the concrete outcome it enables.
4. **Proof:** verified facts, examples, constraints, testimonials, and numbers.
5. **Voice:** existing voice guidance and nearby shipped copy.

Inspect supplied files and existing copy before inventing a voice. Infer missing
details when the risk is low and name consequential assumptions. Ask only when a
wrong assumption would make the result unusable or unsafe.

Never invent a customer quote, result, statistic, capability, guarantee, or
deadline. Mark placeholders clearly when evidence is missing.

## Shared standards

- **Clear:** use familiar words and make the main point easy to find.
- **Useful:** include what helps the reader decide or act; cut the rest.
- **Specific:** describe the mechanism, consequence, or measured outcome.
- **Consistent:** reuse the product's established terms instead of cycling synonyms.
- **Appropriate:** adjust tone to the stakes without changing the underlying voice.
- **Human:** vary rhythm and preserve intentional personality without manufacturing quirks.

Voice stays consistent across surfaces. Tone changes with the reader's state;
use the selected surface guidance or installed owner rather than applying a
second generic tone matrix.

## Deliver the result

Match the output to the request. A button needs a replacement and a short
rationale, not a brand manifesto. A page may need several genuinely different
directions. When alternatives help, vary the premise or structure rather than
swapping adjectives.

For a standalone review, report the following unless an installed specialist
skill defines the review format for its domain:

1. the most important findings, with exact before-and-after copy;
2. the revised copy; and
3. unresolved factual or product questions.

For a direct writing request, lead with the finished copy.

## Final check

- Does every claim have support?
- Can the reader understand the action or outcome on first read?
- Does the copy use one term for each concept?
- Is the tone appropriate to the stakes?
- Did any framework become visible in the prose?
- Does it still sound like the established brand after editing?
- Did the applicable editorial pass catch repeated structures and generic phrasing?
