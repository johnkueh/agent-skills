# UI polish

Work within the existing component library, tokens, density and motion language.
Use platform-appropriate APIs; web CSS recipes are not React Native APIs. Do not
introduce dependencies or redesign adjacent surfaces merely to apply a preference.

## Core

- Align optically where geometric centering looks wrong. Nested radii should
  account for padding; preserve deliberate shapes.
- Use shadows for elevation and borders for structure or state. Keep image edges
  subtle and neutral; use the established appearance tokens.
- Keep feedback visible without motion. Avoid decorative animation on frequent
  interactions. Respect reduced motion and intentional first-render behavior.
- Prefer interruptible transitions for interactive states and keyframes for
  one-off sequences. Specify transitioned properties; add will-change only for
  observed performance problems.
- Reuse the existing icon family and optical weight. Use currentColor for web
  state changes; distinguish selected states without relying on color alone.
- Keep controls semantic, named and keyboard-operable with visible focus.
  Substantial new screens or changed interaction semantics also need the relevant
  accessibility guidance; merely containing text does not require typography.

## Read only what the change needs

- [surfaces.md](surfaces.md): radius, shadows, image outlines or optical alignment.
- [animations.md](animations.md): when adding/changing motion, including the
  established press and icon-transition recipes.
- [icons.md](icons.md): icon selection, stroke, state or direction changes.
- [performance.md](performance.md): transition/compositing performance issues.
- Use [layout guidance](../layout/core.md) for changed layout,
  [typography guidance](../typography/core.md) for changed text rendering,
  [color guidance](../color/core.md) for palette/contrast work, and
  `brand-copy` for copy. Do not load every domain automatically.

## Verification and output

Inspect the changed surface and affected states at useful viewports. Slow motion
down when diagnosing an animation; do not replay unrelated flows for an isolated
surface edit. Reuse valid checks until their inputs change. Static checks support,
but do not replace, rendered evidence when visual correctness matters.

For implementation, report the outcome, actual proof and remaining limitations
briefly. Do not create a review artifact by default. For a requested review,
use [review.md](../review.md).
