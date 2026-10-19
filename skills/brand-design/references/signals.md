# Signals worth checking

Quick prompts for spotting generic or unfinished UI. Each is a question to ask
of the actual product, not a rule. Numbers are starting points; the project's
tokens, type scale, and motion language win when they exist.

- **Many accents on one surface.** Five accent colors on a file list usually
  means no hierarchy. Try one accent plus neutrals ([color](color/color-usage.md)).
- **Flat white on white.** A pure-white card on a pure-white page with a hard
  border often reads as unfinished. Tint the surfaces or rely on spacing
  ([surfaces](ui/surfaces.md)).
- **Equal nested radii.** The inner corner looks pinched. Derive it from the
  outer radius minus the padding ([surfaces](ui/surfaces.md)).
- **Default tracking on huge display type.** Large headings often need slightly
  negative letter-spacing; check the face rather than applying one value
  ([spacing and sizing](typography/spacing-and-sizing.md)).
- **Identical linear easing everywhere.** Use the product's motion curves or an
  interruptible transition that fits the interaction ([animations](ui/animations.md)).
- **A row of buttons on every list item.** Consider moving secondary actions
  into an overflow menu or revealing them on focus, if the actions stay
  discoverable ([layout](layout/core.md)).
- **One long settings page.** Eleven ungrouped fields usually want grouping by
  the reader's task ([grouping](layout/grouping-and-alignment.md)).
- **Decorative badges that do nothing.** A non-functional "Current plan" badge on
  a pricing card adds noise. Remove it or make it meaningful.
- **Infinite scroll that hides the footer.** Offer "Load more" or move footer
  content somewhere reachable.
- **Marketing-sized type in a dashboard.** A 64px heading competes with the data.
  Size headings to the product's scale.
- **Emoji as icons in a product UI.** Use the product's icon family
  ([icons](ui/icons.md)).
- **Loud large backgrounds.** Large areas recede; let accents carry emphasis.
- **Dark mode by inversion.** `invert()` or a reversed light scale is not a dark
  theme. Tune it independently ([palette generation](color/palette-generation.md)).
- **Tooltips that fire instantly on hover.** A short delay avoids flicker while
  the pointer passes; keep keyboard focus behavior intact
  ([focus and keyboard](accessibility/focus-and-keyboard.md)).
- **Cramped mobile padding.** Touch surfaces usually need more space, not less
  ([spacing and adaptivity](layout/spacing-and-adaptivity.md)).
