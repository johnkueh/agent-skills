---
name: brand-design
description: "Design and review polished UI/UX using task-focused design principles. Use for app or web screens, dashboards, layouts, components, typography, color, spacing, dark mode, motion, mobile patterns, or generic-looking UI."
---

# Product design guidance

Design the requested surface around the user's task. Preserve the existing
component library, typography, tokens, and product conventions unless redesign
is in scope. Numerical examples are starting points, not universal rules.

Use the relevant specialist when available: `better-layout` for structure,
`better-ui` for visual details, `better-typography` for type, `better-colors` for
color, `better-accessibility` for interaction, and `better-writing` for interface
copy. Load only the domains needed; avoid duplicate reviews. If a specialist is
unavailable, apply the principles below and state any verification gap.

1. Identify the primary user action and make its state and consequence clear.
   Reveal secondary controls when useful instead of crowding the primary flow.
2. Create hierarchy through grouping, spacing, type, and placement. Use the
   product's spacing scale and breakpoints where its actual content stops fitting.
   Respect reading direction, localization, narrow screens, and text resizing.
3. Keep typography legible and consistent. Use installed or licensed fonts and
   the existing type scale. Do not introduce a typeface to satisfy a checklist.
4. Choose color by role and verify rendered pairs. WCAG AA normal text requires
   4.5:1; large text requires 3:1. Relevant non-text controls require 3:1. Apply
   the criterion's actual scope and exceptions; 4.05:1 does not pass normal text.
   Use redundant cues for state, visible focus, and accessible control names.
5. Match icons and visual density to the product. Prefer one coherent family;
   preserve recognizable brand marks where needed. Never use decoration to hide
   weak hierarchy or replace meaningful labels.
6. Make interactions work across keyboard, pointer, and touch. Use native
   controls, handle loading/empty/error states, preserve user input, and explain
   recovery. Optimistic updates need a reliable rollback and must fit the action's
   consequences; do not apply them indiscriminately to irreversible actions.
7. Animate only when feedback or continuity benefits. Use the existing motion
   language, keep interactions interruptible, and honor reduced motion. There is
   no universal spring, scale, blur, or duration for every product.
8. Select charts, pricing layouts, navigation, and card structures from the
   information and decision the user needs. Do not force a fixed number of
   plans, KPIs, colors, or sections.

Verify the changed flow and states appropriate to the task. Inspect rendered
output when appearance determines correctness and provide useful visual proof.
A visual task does not automatically require publishing a canvas or waiting for
approval of routine design choices. Report evidence, material limitations, and
specific findings without padding to a quota.
