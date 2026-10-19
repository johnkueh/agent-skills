---
name: brand-copy
description: >-
  Write and edit product and marketing copy, including interface strings,
  landing pages, headlines, CTAs, emails, release notes, guides, and de-slopping
  an existing draft. Use for brand voice, interface writing, and conversion copy,
  not personal essays or product-behavior decisions. Triggers on "write the
  copy", "landing page copy", "fix this CTA", "rewrite this headline", "unslop",
  "humanize this", "remove AI tells", "error message", "empty state", and "make
  this sound less generic".
---

# Brand copy

Write clear, specific copy that sounds like the product has a point of view.
Preserve accurate claims, established terminology, and the reader's ability to
understand what happens next.

## Load only what the request needs

- Interface strings, settings, errors, empty states, onboarding, or a product
  guide: read [references/interface.md](references/interface.md).
- Homepage, landing page, sales page, hero, headline, benefit, testimonial,
  objection, or other conversion copy: read
  [references/landing-pages.md](references/landing-pages.md).
- Editing an existing draft, a "humanize", "unslop", or "remove AI tells"
  request, or the final pass on any substantive copy change: read
  [references/editing.md](references/editing.md). A label or a one-line fix
  does not need the full pass.

Load interface and landing-page guidance together only when the request
genuinely crosses both surfaces. Visual treatment, wrapping, contrast, and
accessible semantics belong to `brand-design`; supply final copy and realistic
string lengths for it, and do not let visual treatment change the meaning.

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
- **Faithful:** a style edit never changes quantities, conditions, exceptions,
  uncertainty, safety guidance, or other facts. Verify a needed factual
  correction separately and say so.

## House style

The project's own locale and style guide win. When a project has none:

- Use sentence case for headings, buttons, labels, and menu items.
- Follow the project's English variant for spelling and punctuation; do not
  convert between US and UK/AU conventions in an unrelated edit.
- Avoid em dashes in product copy; use a comma, colon, or a new sentence.
- Pick one list-comma convention per project and apply it consistently.
- Use natural contractions, except where legal or consequential copy needs
  precision.

## Deliver the result

Match the output to the request. A button needs a replacement and a short
rationale, not a brand manifesto. A page may need several genuinely different
directions. When alternatives help, vary the premise or structure rather than
swapping adjectives.

For a direct writing request, lead with the finished copy. For a review, or when
showing what changed, use one format:

| Location | Before | After | Why |
| --- | --- | --- | --- |

Quote exact source text and complete replacements. Add a severity column
(`HIGH` misleads or blocks recovery, `MEDIUM` makes a task harder, `LOW` is
polish) when it helps prioritize a larger review. Consolidate a repeated issue
into one row listing every location. Separate applied edits from unresolved
findings, and list open factual or product questions last. When another review
skill is coordinating the work, use its format instead.

## Final check

- Does every claim have support?
- Can the reader understand the action or outcome on first read?
- Does the copy use one term for each concept?
- Is the tone appropriate to the stakes?
- Did any framework become visible in the prose?
- Does it still sound like the established brand after editing?
