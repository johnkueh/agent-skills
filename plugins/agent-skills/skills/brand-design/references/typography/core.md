# Typography

Keep the project's fonts, type scale, styling system and intentional density.
Match the platform: web CSS recipes are not native APIs. Judge text with actual
content, not only source code.

## Core

- Use a small coherent scale and clear visual hierarchy. Choose semantic
  headings independently from their CSS size; preserve meaningful emphasis.
- Load only the intended faces and weights. Prefer standard font properties
  over raw variation/feature tags when an equivalent exists. Do not disable
  synthesis until emphasis works across the fallback stack.
- Match line-height and measure to the role: short headings can be tight;
  wrapped body text needs comfortable spacing and a bounded reading width.
- Balance short headings and handle long words/URLs without overflow. Do not
  force essential text into nowrap or truncation without an accessible way to
  reach the full value.
- Keep changing numeric values stable using tabular figures when supported.
- Preserve selection, zoom and text resizing. On mobile web, input text should
  avoid unwanted iOS zoom without disabling user zoom.
- Keep language/direction metadata and mixed-direction values correct.
  Spatial mirroring belongs to layout, not punctuation.
- Preserve accessible contrast. Measurement or remediation uses
  [color guidance](../color/core.md)
  only when that work is in scope; the presence of text does not require a
  complete color audit.

## Read only the relevant reference

- [choosing-fonts.md](choosing-fonts.md): selecting/pairing typefaces or formats.
- [variable-fonts-and-opentype.md](variable-fonts-and-opentype.md): axes, features,
  weights or numeric alignment.
- [spacing-and-sizing.md](spacing-and-sizing.md): hierarchy, measure or text spacing.
- [wrapping-and-punctuation.md](wrapping-and-punctuation.md): wrapping,
  truncation, punctuation or bidirectional text.
- [details-and-accessibility.md](details-and-accessibility.md): input sizing,
  selection, underlines or decorative type.
- [css-cheat-sheet.md](css-cheat-sheet.md): a specific CSS/Tailwind lookup.

Use `brand-copy` for changed words, not automatically alongside every font
change. New semantics or interaction patterns need accessibility guidance.

## Verification and output

Inspect realistic strings at the affected sizes and widths. Check fallback
fonts, loading, resizing or changing values when relevant. Existing focused
checks and rendered evidence are sufficient for a narrow text-style edit;
do not bootstrap a new test suite or typography specimen page by default.

For a requested review, use [review.md](../review.md). Otherwise briefly
report changes, observed proof and remaining limits.
