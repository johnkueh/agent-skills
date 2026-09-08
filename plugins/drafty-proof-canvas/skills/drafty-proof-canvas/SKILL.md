---
name: drafty-proof-canvas
description: "Publish visual verification screenshots to a private Drafty canvas. Use at the end of UI, layout, component, email-render, chart, or design work that John must inspect; skip text-only changes."
---

# Proof canvas

Use this workflow when the user requests a private Drafty proof canvas or has
already authorized that delivery. For ordinary visual work, native screenshot
attachments or local artifacts may be sufficient. Publication is not implied by
loading this skill.

Capture the states needed to judge correctness: the changed state, useful
before/after comparisons, and responsive states where applicable. Inspect the
screenshots and exclude unrelated private information before uploading.

```sh
"<this-skill-dir>/scripts/push-proof.sh" \
  --title "Proof: <feature>" \
  --project <project> \
  --meta "branch <branch> · commit <sha> · <verification context>" \
  [--story notes.html] \
  shot.png "<strong>Changed state.</strong> What this proves."
```

The script publishes privately, requires `--project`, adds the `proof` tag, and
prints the URL. Captions accept HTML. Use `--story` for useful context beyond the
captions; `<div class="paste">` or `<pre>` provides copyable text. Portrait shots
render at phone width and landscape shots full width. Keep images reasonably
small for delivery without obscuring details.

For authorized iterations of the same proof, pass `--slug <existing>` to update
it in place. Deliver a linked canvas URL and relevant native image attachments.
Watch for later comments, post replies, or archive old canvases only when those
actions are requested or covered by existing authorization.
