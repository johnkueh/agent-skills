# Layout

Use the project's existing styling system, spacing tokens and density. For native
apps, translate the principle into native layout primitives; do not apply web CSS
literally. Preserve intentional compact tools and platform chrome.

## Core

- Group related content with space before adding separators. Distinguish gaps
  within a group from gaps between groups; align controls to shared edges.
- Make controls distinguishable from static content. Keep primary information
  and actions reachable in the reading order.
- Use logical leading/trailing layout for localizable surfaces. Keep physical
  coordinates only when the geometry is genuinely physical.
- Hidden or scrollable content needs a discoverable cue. Use the existing
  disclosure pattern rather than adding a new interaction.
- Keep targets distinct and prevent expanded hit areas from overlapping.
  Preserve safe areas around controls, text and sticky actions; media may bleed.
- Let content determine breakpoints. Prefer component-level adaptation where
  supported. Avoid text containers whose fixed dimensions clip translations,
  longer values or resized text.
- Treat numeric examples in the references as starting points, not reasons to
  replace an established usable density system.

## Read only what the change needs

- [grouping-and-alignment.md](grouping-and-alignment.md): hierarchy, alignment,
  separators or direction-dependent structure.
- [spacing-and-adaptivity.md](spacing-and-adaptivity.md): responsive behavior,
  safe areas, localization growth, disclosure or target spacing.
- Read [accessibility guidance](../accessibility/core.md) when changing hit
  targets, keyboard/reading order, focus or reflow behavior; retain those
  requirements for every edit.
- Typography is needed for changed text rendering, not because a row has a
  label. UI polish and color guidance apply only to their changed surfaces.

## Verification and output

Inspect the affected component with realistic content at the narrowest relevant
width and its expanded state. Check zoom, RTL or translated growth when that
behavior is affected. Prefer a focused existing check or rendered inspection;
do not start a full app build or new test suite solely for spacing.

Report what changed and the proof observed. Do not produce a separate layout
report for routine implementation. For a requested review, use
[review.md](../review.md).
