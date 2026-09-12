# Common design misses

- Five accent colors on a file list. Pick one accent plus neutral.
- Pure-white card on pure-white background with a hard border. Tint the surfaces.
- Same corner radius nested. Apply `inner = outer − padding`.
- Default kerning on a 96px hero. Tighten to `-3%`.
- Linear easing on every entrance animation. Use a spring or a curve.
- Three-button row on every list card. Use a kebab menu.
- Settings page with 11 fields and no tabs. Group into Usage, Billing, and Account.
- "Successfully created" toast. Use "Created" or the noun.
- Pricing card with a non-functional "Current Plan" badge. Delete it.
- Infinite scroll that makes the footer unreachable. Use a "Load more" button.
- Dashboard hero typography at 64px. Reduce it to 20–24px.
- Emoji icon in a B2B SaaS sidebar. Use a real icon set.
- Bright color for a 1200×800 background. Backgrounds recede; accents pop.
- Dark mode implemented with `invert()`. Build the palette from scratch.
- Tooltip that appears instantly. Delay it by about 1000ms.
- Card padding of 8px on mobile. Mobile needs more space, not less.
