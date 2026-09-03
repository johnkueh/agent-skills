# Interface editorial style

This reference preserves the editorial guidance distilled from the
[Mailchimp Content Style Guide](https://styleguide.mailchimp.com/). It
complements interface-pattern guidance; it does not replace interaction,
accessibility, typography, or layout expertise.

When `better-writing` is active, let it own voice reconnaissance, interface
patterns, and standalone review format. Treat the rules below as the additional
Mailchimp-derived house-style layer, not as a second pass over the same rules.

## Mailchimp standards

Mailchimp frames its guidance as **Clear, Useful, Friendly, and Appropriate**.
The shared `brand-copy` standards already implement clear, useful, and
appropriate writing. “Friendly” adds one decision: sound human and respectful
without forcing warmth or humor. When the standards compete, prioritize
usefulness and clarity.

## Voice and tone

Write in a plainspoken, genuine voice. Translate technical concepts as if
explaining them to a smart person outside the field. Prefer active, positive
language. A small grammar break is fine when it makes a line more natural
without making it less clear.

Dry, subtle humor can work when the established brand supports it, the moment
is low-stakes, and the meaning will survive translation. Never force a joke,
use slang as personality, or make light of a problem.

Adjust tone to the situation:

| Situation | Tone |
| --- | --- |
| Onboarding and empty states | Warm, encouraging, and practical |
| Success | Brief and lightly celebratory |
| Routine actions and settings | Neutral and minimal |
| Errors | Calm, specific, and helpful |
| Destructive actions | Sober, direct, and explicit |
| Data loss and security | Serious and unambiguous |
| Marketing surfaces | Confident and benefit-led |
| Legal, privacy, and billing | Plain, precise, and unambiguous |
| Education and guidance | Patient, structured, and concrete |

## Write about people with care

- Use singular “they” when a person's pronouns are unknown. Use the pronouns a
  person has communicated when they are known; ask when that is appropriate.
- Avoid gendered collective terms such as “guys” or “girls”. Use neutral job
  terms unless a person uses a different title for themself.
- Mention age, disability, or medical conditions only when they are relevant.
- Prefer person-first language unless the person or community prefers
  identity-first language.
- Capitalize racial and ethnic identities such as Black, Asian, and Indigenous;
  use lowercase “white”. Do not hyphenate dual-heritage identities.
- Use identity terms as modifiers, not as nouns describing groups of people.
- Describe audiences as people, customers, readers, or another relevant human
  group—not as data points.
- Do not use “suffers from” or “victim of”. Avoid “handicapped” except in an
  established phrase such as “handicapped parking”. Do not use “lame”, “crazy”,
  “insane”, or “addicted to” as casual intensifiers or metaphors.

## Voice and pronouns

- Address the reader as “you” when direct instruction helps.
- Use “we” only when the product or team is genuinely the actor. Avoid it in
  errors when it diffuses responsibility or obscures the recovery path.
- Avoid the impersonal “one” and the royal “we” that pretends to include the
  reader.
- Prefer active voice. Passive voice is fine when the action or result matters
  more than the actor, or the actor is unknown.
- Frame instructions around what someone can do, not what they cannot do:
  “Save to continue” rather than “You can't continue without saving”; “Available
  on Pro” rather than “Not available on Free”.

## Capitalization and names

- Use sentence case for headings, titles, labels, menu items, and options by
  default.
- Preserve title case for proper nouns, official product names, and established
  navigation conventions.
- Buttons may use title case only when that is the product-wide convention.
  Choose one convention and apply it consistently.
- Write “website”, “internet”, “online”, and “email” in lowercase. Preserve the
  capitalization of URLs and email addresses.
- Use the official spelling and capitalization of companies and products.
- Refer to a company as “it”, not “they”, unless referring to its people.

## Contractions

Use natural contractions such as “you'll”, “we're”, and “can't”. Expand them
when precision or emphasis calls for it, especially in legal or consequential
copy.

## Numbers, dates, and times

- Spell out one through nine in ordinary prose; use numerals for 10 and above.
- Always use numerals for times, dates, measurements, percentages, money, and
  ordinals.
- Use a comma in numbers of four digits or more.
- Spell out simple fractions in prose.
- Use the `%` symbol with a numeral outside prose headlines.
- Use an en dash for numeric ranges.
- Spell out the day and month when space allows.
- Write `am` and `pm` in lowercase, with a space after the time.
- Show times in the person's local time when possible. Include a time zone when
  the time could otherwise be ambiguous.

Use local formats when the product supports them. These house conventions must
not override a locale's established date, time, number, or currency format.

## Punctuation and editorial formatting

- Use the Oxford comma.
- Use an em dash without surrounding spaces, and use it sparingly.
- Hyphenate compound modifiers when needed for clarity.
- Use an en dash for ranges.
- Use `&` only when it is part of an official name or an established,
  space-constrained interface pattern.
- Use ellipses and semicolons sparingly.
- Put commas and periods inside quotation marks in US English.
- Use exclamation marks rarely: no more than one on a screen, and never in an
  error or other stressful state.
- Use one space after punctuation.
- Use italics for referenced interface elements, publication titles, or rare
  emphasis when the product supports it. Do not stack emphasis styles.

Rendered alignment, underlines, smart punctuation, wrapping, and truncation are
typography concerns. Use `better-typography` when it is available and those
details are in scope. When it is unavailable, keep body copy left-aligned,
never underline non-links, and verify that emphasis, punctuation, wrapping, and
truncation do not change the meaning.

## Confirmations and status

Confirm a completed result in the past tense and keep it brief: “Recipe saved”
or “Invite sent”. Do not add “successfully” when the state already proves
success. Avoid “Yay” and exclamation marks. For long-running work, name what is
happening and whether the person can leave the screen.

## Lists

- Use numbered lists for steps or sequences.
- Use bullets for unordered items.
- Keep every item grammatically parallel.

## Translation and localization

- Prefer active voice and direct sentence structures.
- Avoid double negatives, idioms, slang, clichés, wordplay, and culture-specific
  or sports metaphors.
- Use one term for each concept throughout a flow.
- Minimize abbreviations. Spell them out on first use unless the audience
  broadly understands them, such as API, URL, or HTML for technical readers.
- Prefer clarity over extreme brevity.
- Build complete pluralized messages instead of concatenating fragments around
  values.

Let `better-layout` own physical text expansion and spatial RTL behavior when it
is available. Otherwise, leave room for strings to grow, avoid fixed text
containers, and keep actions reachable when copy wraps.

Let `better-accessibility` own semantic heading structure, accessible names,
announcements, alt-text requirements, and non-color state cues when it is
available. Otherwise:

- keep heading levels in logical order;
- write useful alt text for meaningful images and empty alt text for decorative
  images;
- describe a functional image by what it does, not only what it looks like;
- caption video and provide transcripts for audio; and
- do not rely on color, position, or punctuation alone to communicate state;
  add a label, text explanation, or another meaningful cue.

Use `better-ui` only for visual polish and motion, not to rewrite copy.
Use `better-colors` for rendered contrast and semantic-color decisions when
color is in scope; never infer contrast from a color name or token alone.

## Editorial check

- Would a stranger understand the copy on the first read?
- Is the main point front-loaded, with the most important word among the first
  three when the format allows?
- Is the tone appropriate to the stakes?
- Are terminology, capitalization, numbers, dates, punctuation, and product
  names consistent?
- Does the copy refer to people respectfully and inclusively?
- Will every string remain clear when translated or pluralized?
- Have filler, jargon, generic reassurance, and unsupported claims been removed?
- Read it aloud. Does it sound like a person?
