# Accessibility

Preserve accessibility on every edit. Use the existing design system and native
controls before custom widgets. Web examples apply to web; use native
accessibility APIs and platform interaction conventions in React Native.

## Core

- Actions and navigation need the correct native role, accessible name and
  keyboard path. Visible labels must agree with accessible names; decorative
  content must not hide meaningful or focusable controls.
- Preserve visible focus, logical traversal and appropriate activation keys.
  Modals move focus inside, contain it while modal, make the background inert
  and restore focus on close.
- Label inputs visibly, use appropriate input/autocomplete semantics and allow
  paste. Place actionable errors by their fields and associate them for
  assistive technology. Disabled state must actually block the action.
- Announce non-urgent dynamic updates politely; reserve urgent alerts for urgent
  information. Keep actionable/error messages available long enough to use.
- Do not rely on color alone. Check the rendered contrast pair against the
  applicable requirement; preserve project colors unless remediation is in scope.
- Keep targets large enough or correctly spaced under the applicable standard;
  expanded targets must not overlap.
- Respect reduced motion; provide pause controls for autoplay and preserve
  meaningful static feedback. Never disable user zoom.
- Maintain usable text resizing, reflow, landmarks and reading order. Alt text
  conveys an image's purpose; decorative images have empty alternatives.

## Read the affected domain

- [focus-and-keyboard.md](focus-and-keyboard.md): overlays, focus or widget keys.
- [semantics-and-aria.md](semantics-and-aria.md): roles, names, structure or disabled states.
- [forms.md](forms.md): inputs, validation or form announcements.
- [screen-readers.md](screen-readers.md): dynamic updates, image alternatives or SVG.
- [hit-areas.md](hit-areas.md): target dimensions, exceptions or spacing.
- [motion-and-zoom.md](motion-and-zoom.md): animation, timing, text resizing or reflow.
- Use [color guidance](../color/core.md) for contrast
  measurement/remediation; do not load unrelated typography, layout or polish
  guidance by default.

## Verification and output

Exercise the affected interaction by keyboard and inspect names/roles/states.
Use screen-reader or automated checks where they establish the required
behavior; report untested coverage honestly. Reuse unchanged verified components
rather than claiming the whole app was re-audited.

Keep implementation reporting brief. For a requested audit, use
[review.md](../review.md).
