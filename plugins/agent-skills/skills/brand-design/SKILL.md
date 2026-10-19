---
name: brand-design
description: "Design, build, and review polished UI/UX: screens, dashboards, layouts, components, typography, color, contrast, spacing, dark mode, motion, icons, accessibility, mobile patterns, or generic-looking UI. Includes a consolidated interface review."
---

# Product design guidance

Design the requested surface around the user's task. Preserve the existing
component library, typography, tokens, and product conventions unless redesign
is in scope. Numerical examples in the references are starting points, not
universal rules.

## Principles

1. Identify the primary user action and make its state and consequence clear.
   Reveal secondary controls when useful instead of crowding the primary flow.
2. Create hierarchy through grouping, spacing, type, and placement. Use the
   product's spacing scale and breakpoints where its actual content stops fitting.
   Respect reading direction, localization, narrow screens, and text resizing.
3. Keep typography legible and consistent. Use installed or licensed fonts and
   the existing type scale. Do not introduce a typeface to satisfy a checklist.
4. Choose color by role and measure rendered pairs against the applicable
   contrast requirement. Use redundant cues for state, visible focus, and
   accessible control names.
5. Match icons and visual density to the product. Prefer one coherent family;
   preserve recognizable brand marks. Never use decoration to hide weak
   hierarchy or replace meaningful labels.
6. Make interactions work across keyboard, pointer, and touch. Use native
   controls, handle loading, empty, and error states, preserve user input, and
   explain recovery. Optimistic updates need a reliable rollback and must fit the
   action's consequences.
7. Animate only when feedback or continuity benefits. Use the existing motion
   language, keep interactions interruptible, and honor reduced motion.
8. Select charts, pricing layouts, navigation, and card structures from the
   information and decision the user needs. Do not force a fixed number of
   plans, KPIs, colors, or sections.

## Read only the domains the change touches

Each domain has a short `core.md` and topic references it links to.

- [Layout](references/layout/core.md): grouping, spacing, alignment, responsive
  structure, safe areas, RTL.
- [Typography](references/typography/core.md): fonts, type scale, wrapping,
  truncation, numeric stability, text rendering.
- [Color](references/color/core.md): tokens, palettes, themes, dark mode, gamut,
  measured contrast.
- [UI polish](references/ui/core.md): surfaces, radius, shadows, icons,
  interaction feedback, motion.
- [Accessibility](references/accessibility/core.md): semantics, names, focus,
  keyboard, forms, target sizes, motion, reflow. Preserve it on every edit,
  whichever domain is loaded.
- [Signals](references/signals.md): quick prompts for spotting generic or
  unfinished UI.
- [Review](references/review.md): the format for any requested design or
  interface review, single-domain or holistic.

A small UI edit does not need every domain. Interface wording belongs to
`brand-copy`; supply realistic string lengths and let it own the words.

## Verify and report

Verify the changed flow and the states the task touches. Inspect rendered output
when appearance determines correctness and provide useful visual proof. A visual
task does not automatically require publishing a canvas or waiting for approval
of routine design choices. Report evidence, material limitations, and specific
findings without padding to a quota.
