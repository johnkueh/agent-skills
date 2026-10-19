# Editing pass

Use this pass to edit existing writing, for "unslop", "humanize", or "remove AI
tells" requests, and as the final pass on any substantive copy change. It makes
writing specific, natural, and useful while preserving facts, intent, voice, and
the details the reader needs. It is an editing pass, not a replacement for an
author's voice or the strategy behind a piece.

The pattern catalogue is adapted from the MIT-licensed
[blader/humanizer](https://github.com/blader/humanizer), which builds on
Wikipedia's community-maintained "Signs of AI writing" guidance.

## Choose the target

- Use the text, file, or artifact named in the request first.
- A bare "unslop" applies to the draft currently being discussed. If the last
  substantive reply is the obvious target, rewrite it. Do not search unrelated
  work, and do not treat a bare request as a repository-wide copy audit.
- If several targets are equally plausible, ask which one.

Honor the requested mode: edit, review only, or show the difference. Edit the
named source when editing is in scope; return a rewrite for text in the chat.
Sending or publishing is a separate action that needs its own authorization.
Keep existing author-voice, audience, and format guidance. For fiction, personal
writing, or deliberately playful copy, keep intentional character and rhythm.

## Read for the reader's job

Identify what the reader needs to learn, choose, or do. Read the headings on
their own: can someone find the right section without reading every paragraph?
Then read each paragraph for the fact, instruction, choice, or relevant
reassurance it contributes. If a sentence contributes none of these, remove it.
If removing it loses something useful, rewrite it.

Use two tests while editing:

- Could this sentence fit almost any product, guide, email, or article? Replace
  it with a known fact about this one, or remove it. Do not invent specifics to
  make the copy sound concrete.
- Is the label doing a different job from the paragraph? Use familiar nouns for
  destinations, action phrases for instructions, and full sentences where the
  reader needs an explanation. Do not force every heading to start with a verb.

## Replace the pattern, not just the words

| Pattern | Before | After | Reason |
| --- | --- | --- | --- |
| Slogan as a section heading | One list, fewer loose ends | Shopping list | Names what the reader will find |
| Vague promise | A week you can rearrange | Seven days of lunches and dinners | States the actual contents, when the plan supports it |
| Abstract nouns hiding an instruction | Serve the elements separately if that makes the plate easier to approach. | Serve the fish, mash, and greens separately if you prefer. | Names the food and action |
| Reassurance that raises an unasked concern | The toast is part of the recipe, not an extra you need to earn. | The nutrition estimate includes the toast. | Answers a practical question without assuming guilt |
| Generic sentence after a complete description | Tofu, edamame, and brown rice with ginger-soy dressing. A plant-based dinner with distinct textures. | Tofu, edamame, and brown rice with ginger-soy dressing. | The second sentence adds nothing |
| Roundabout instruction | Put the remainder in the fridge promptly rather than leaving it beside you. | Refrigerate the rest promptly. | Gives the action directly |

These are examples of decisions, not banned phrases. Reassurance is useful when
the context supports the concern. Keep distinctive voice, humor, or sensory
detail when it serves the audience.

## High-signal patterns

Treat patterns as evidence in combination, not banned tokens. A single em dash,
formal word, short sentence, or three-item list can be natural. Voice guidance
and deliberate style outrank this list when clarity holds. Prioritize structural
problems over isolated vocabulary.

1. **Authority crutches:** "the point is", "what really matters", "at its core". State the claim.
2. **Aphorism formulas:** "X is the Y of Z" metaphors that replace explanation. Give the concrete relationship.
3. **Manufactured punchlines:** stacks of fragments or slogans. Keep the one line that earns emphasis.
4. **Forced symmetry:** automatic triples, matching sections, repeated sentence shapes. Use the structure the content needs.
5. **Signposting:** "Here's what you need to know", "Let's dive in". Start with the information.
6. **Negative parallelism:** repeated "not X, but Y" or "not just X" pivots. Make the positive claim directly.
7. **Punctuation tics:** dense em dashes, dramatic colons, decorative ellipses. Keep punctuation that clarifies.
8. **Filler and hedging:** "in order to", "at this time", "it is important to note", stacked "could potentially". Cut it or choose the accurate qualifier.
9. **Puffery:** "groundbreaking", "renowned", "vibrant", "pivotal", "testament". State what happened or what the product does.
10. **Inflated diction and copula avoidance:** "utilize", "serves as", "stands as", "boasts". Prefer "use", "is", or "has".
11. **Vague authority:** "experts argue", "studies show". Name and cite the source or remove the claim.
12. **Name-dropping:** lists of people or outlets without relevance. Keep the source that supports the point.
13. **Dangling participles:** "highlighting", "showcasing", "ensuring" clauses that add no fact. Delete or make the relationship explicit.
14. **Generic adversity:** "Despite challenges, the project continues to thrive." Give the actual constraint and result.
15. **AI-associated vocabulary clusters:** additionally, crucial, delve, enhance, foster, garner, interplay, intricate, landscape, showcase, tapestry, underscore. Replace only when the word is generic rather than precise.
16. **Synonym cycling:** several terms for one concept. Choose one and repeat it.
17. **False ranges:** "from X to Y" when the endpoints are not a scale. List the items.
18. **Decorative formatting:** title-case headings, excess bold, emoji as structure. Let hierarchy and prose do the work.
19. **Chatbot residue:** "Certainly!", "I hope this helps", praise before the answer. Remove it from the deliverable.
20. **Generic conclusions:** "The future looks bright." End with the implication, decision, or next step.
21. **Abstract jargon:** substrate, wedge, vector, primitive, surface, scaffolding, paradigm, flywheel. Use the concrete object or action.
22. **Unexplained feelings:** "simple", "intuitive", "easy" without the mechanism. Show what creates that property.
23. **Dense sentences:** several independent ideas in one polished sentence. Split or drop the weaker clause.
24. **Passive default:** missing actors when the actor matters. Name who or what acts.
25. **Weak verbs plus adverbs:** "significantly improves". Give the measured change or a stronger accurate verb.

## Add specificity before personality

Removing bad habits is half the edit; sterile prose also feels generated.
Replace vague reactions with the concrete fact or consequence, let the writer
take a position the source supports, vary sentence and paragraph length, and
keep asymmetry when ideas do not deserve matching sections. Prefer complete,
natural sentences over clipped fragments, noun piles, or invented compound
labels. Never invent anecdotes, quirks, slang, or opinions to simulate a person.

## Preserve meaning and keep versions aligned

Check each replacement against its source. Quantities, conditions, qualifiers,
uncertainty, exceptions, safety instructions, quotations, code, names, and
stated limits stay the same. For interface copy, never change established
capitalization or terminology solely to satisfy this pass.

Follow the affected copy into related surfaces: page headings, navigation,
cards, metadata, and downloads. Update the maintained source and regenerate
affected artifacts when they are part of the deliverable. Inspect rendered
changes for wrapping and truncation when applicable, and do not claim
consistency with a format you did not check.

## Workflow and output

1. Read once for meaning and voice before marking patterns.
2. Audit for repeated structures and clusters, not isolated words.
3. Rewrite the smallest span that fixes the problem.
4. Restore specificity, rhythm, or stance where cutting left the prose sterile.
5. Re-read the result without the original: does it still explain the task,
   sound natural, and give any necessary next step?

Stop when nothing actionable remains. Shorter is useful only when it is clearer;
do not optimize toward a word count, score, or pattern count. If you report a
word-count change, say whether it covers edited passages or the whole document.

For a rewrite, lead with the revised text and show a few key changes when
useful. For a review-only request, propose replacements without modifying the
source, using the review table in SKILL.md. A writing review does not certify
factual or expert approval.
