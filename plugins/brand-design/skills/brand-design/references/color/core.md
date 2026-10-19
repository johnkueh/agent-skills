# Color systems and contrast

Keep the existing token system and notation. Use OKLCH for a new color system or
requested conversion, not an isolated migration inside a hex/RGB project.
Apply native equivalents when working outside web CSS.

## Core

- Reuse semantic tokens by role, not merely by matching their numeric values.
  Keep color meaning consistent across surfaces and appearances.
- Preserve project branding and established primary/secondary action hierarchy.
  A palette review does not authorize unrelated redesign.
- Status and interactive affordances must have a non-color cue.
- Measure actual foreground/background pairs, including alpha compositing,
  states and appearances. Lightness heuristics are not contrast evidence.
- Distinguish WCAG contrast requirements from APCA design guidance; do not
  report an APCA score as WCAG conformance.
- In a read-only review, report the pair, requirement and measurement. When
  remediation is requested, adjust the smallest relevant token, preserve hue
  and chroma where practical, then measure again.
- High chroma may exceed the target display gamut. Supply supported fallbacks
  and check the result rather than assuming a valid CSS value is displayable.
- Tune dark mode independently; reversing a light scale is not verification.

## Read only the relevant reference

- [color-conversion.md](color-conversion.md): conversion mathematics and notation.
- [palette-generation.md](palette-generation.md): perceptual scales, multi-hue
  palettes and light/dark variants.
- [accessibility-contrast.md](accessibility-contrast.md): measuring contrast,
  applicable thresholds, APCA/WCAG distinctions and remediation.
- [gamut-and-tailwind.md](gamut-and-tailwind.md): sRGB/P3 fallbacks, clamping
  and Tailwind theme integration.
- [color-usage.md](color-usage.md): semantic roles and action emphasis.

Read [accessibility guidance](../accessibility/core.md) if the task also
changes control semantics, focus or non-color cues; a token adjustment does not
need every design domain.

## Verification and output

Inspect the changed tokens where consumed, including relevant states and
appearances. Use the existing measurement tools or a focused deterministic
check. Do not create a palette website or rewrite unrelated themes for a narrow
fix. Report measured results and any unsupported target or untested state.

For a requested review, use [review.md](../review.md). For normal
implementation, report the result without a separate review document.
