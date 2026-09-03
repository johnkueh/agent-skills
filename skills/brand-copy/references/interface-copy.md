# Interface copy

Use this reference for text embedded in a product interface. It preserves the
product-writing guidance distilled from the
[Mailchimp Content Style Guide](https://styleguide.mailchimp.com/), adapted into
a portable working guide and extended with interaction, accessibility, and
localization checks.

Copy should help someone understand the current state, choose an action, or
recover from a problem without decoding the product team's internal language.

## Start with the interaction

Confirm the action, consequence, reversibility, and reachable states before
polishing words. Copy cannot repair an interaction whose behavior is unclear.
Use the product's established terminology and localization conventions.

## Four standards

- **Clear:** Prefer familiar, concrete words and short, direct sentences.
- **Useful:** Know the purpose, the audience, and the one thing they need. Cut
  everything else.
- **Friendly:** Sound human and respectful without forcing warmth or humor.
- **Appropriate:** Match the seriousness, emotion, and consequence of the moment.

When the standards compete, prioritize usefulness and clarity.

## Voice and tone

Write in a plainspoken, genuine voice. Act as a translator between the product
and the person using it. Prefer active, positive language. Dry, subtle humor can
work in low-stakes moments, but never let a joke obscure instructions or make
light of a problem. A small grammar break is fine when it makes the line more
natural without making it less clear.

Avoid forced jokes, slang, jargon, passive constructions, and enthusiasm the
interface has not earned.

Adjust tone to the situation:

| Situation | Tone |
| --- | --- |
| Onboarding and empty states | Warm, encouraging, and practical |
| Success | Brief and lightly celebratory |
| Errors | Calm, specific, and helpful |
| Destructive actions | Sober, direct, and explicit |
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

## Mechanics

### Voice and pronouns

- Address the reader as “you” when direct instruction helps.
- Use “we” for the product or the team responsible for it, not as a royal “we”
  that pretends to include the reader.
- Avoid the impersonal “one”.
- Prefer active voice. Use passive voice only when the action or result matters
  more than the actor, or the actor is unknown.
- Frame instructions around what someone can do, not what they cannot do.

Positive framing makes the path forward easier to see: “Save to continue” is
clearer than “You can't continue without saving”; “Available on Pro” is clearer
than “Not available on Free”.

### Capitalization and names

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

### Contractions

Use natural contractions such as “you'll”, “we're”, and “can't”. Expand them
when precision or emphasis calls for it, especially in legal or consequential
copy.

### Numbers

- Spell out one through nine in ordinary prose; use numerals for 10 and above.
- Always use numerals for times, dates, measurements, percentages, money, and
  ordinals.
- Use a comma in numbers of four digits or more.
- Spell out simple fractions in prose.
- Use the `%` symbol with a numeral outside prose headlines.
- Use an en dash for numeric ranges.

### Dates and times

- Spell out the day and month when space allows.
- Write `am` and `pm` in lowercase, with a space after the time.
- Show times in the person's local time when possible.
- Include a time zone when the time could otherwise be ambiguous.

### Punctuation

- Use the Oxford comma.
- Use an em dash without surrounding spaces, and use it sparingly.
- Hyphenate compound modifiers when needed for clarity.
- Use an en dash for ranges.
- Use `&` only when it is part of an official name or a space-constrained,
  established interface pattern.
- Use ellipses and semicolons sparingly.
- Put commas and periods inside quotation marks in US English.
- Use exclamation marks rarely: no more than one on a screen, and never in an
  error or other stressful state.

### Formatting

- Left-align body copy.
- Use one space after punctuation.
- Use italics for referenced interface elements, publication titles, or rare
  emphasis when the product supports it.
- Do not combine emphasis styles.
- Never underline text that is not a link.

## Interface patterns

### Page structure and headings

- Give each page or screen one main topic.
- Use a descriptive, front-loaded heading.
- Follow a logical heading hierarchy such as H1, H2, then H3. Do not skip
  levels to achieve a visual style.

### Buttons and actions

- Start with a verb that names the action: “Save draft”, “Send invite”, or
  “Delete account”. Aim for one to three words and use four only when needed.
- Repeat the consequence in a confirmation action. Use “Delete project”, not
  “Yes”.
- Name the object in a destructive action.
- Keep vocabulary stable across a flow. Pick “Continue” or “Next”; do not
  alternate.
- Label toggles for the on state: “Send read receipts”, not “Don't hide read
  receipts”.

### Links

Describe the destination so the label makes sense out of context. Use “Read the
billing guide”, not “Click here”. Qualify repeated generic links, such as “Learn
more about exports”.

### Forms and placeholders

- Put visible labels above their fields when the layout allows.
- Mark required fields consistently with `*` or “Required”. Do not mark only
  optional fields unless most fields are required.
- Use placeholders for examples or formats, never as the only label.
- Phrase guidance positively and show it before a likely mistake.
- Put a field error beside the field and state both the problem and the fix.
- Build complete localizable strings instead of concatenating fragments around
  values.

### Errors

State what happened and what the person can do next. Avoid blame, jokes,
exclamation marks, and unsupported certainty. Keep diagnostic codes out of the
main message; put them in optional details when support or troubleshooting
requires them.

| Weak | Better |
| --- | --- |
| “Invalid password” | “Use at least 8 characters” |
| “Something went wrong” | “Unable to save. Check your connection and try again.” |
| “You entered an invalid name” | “Use letters only” |

If the same error affects many people, inspect the interaction instead of only
rewriting the message.

### Empty states

Explain what belongs in the empty area and provide one useful next action. Do
not apologize for an expected first-use state. Search and filter empty states
should name the query or filter and offer a way out. Do not put persistent
guidance only in an empty state; it disappears when content exists.

### Confirmations and status messages

Confirm the completed result in the past tense and keep it brief: “Recipe saved”
or “Invite sent”. Do not add “successfully” when the state already proves
success. Avoid “Yay” and exclamation marks. For long-running work, name what is
happening and whether the person can leave the screen.

### Lists

- Use numbered lists for steps or sequences.
- Use bullets for unordered items.
- Keep every item grammatically parallel.

## Accessibility

- Front-load the important information.
- Use plain words that work for people with cognitive disabilities, people
  reading in a second language, and people who are tired or distracted.
- Avoid directional instructions such as “on the right” or “above”.
- Spell out abbreviations on first use unless they are broadly understood in the
  audience, such as API, URL, or HTML for a technical audience.
- Give meaningful images useful alt text. Give decorative images empty alt text.
  Describe a functional image by what it does, not only what it looks like.
- Caption video and provide transcripts for audio.
- Make link labels unique and understandable outside the surrounding sentence.
- Do not rely on color, position, or punctuation alone to communicate state.
  Add a label, text explanation, or another meaningful cue.
- Match the input device only when known. Use “select” when copy spans touch,
  keyboard, and pointer input.

## Translation and localization

- Prefer active voice and direct sentence structures.
- Avoid double negatives, idioms, slang, clichés, wordplay, and culture-specific
  or sports metaphors.
- Use one term for each concept throughout a flow.
- Minimize abbreviations.
- Prefer clarity over extreme brevity.
- Leave room for translated text to expand.
- Use complete pluralized messages rather than assembling sentence fragments.
- Use local date, time, number, and currency formats where the product supports
  them.

## Recurring fixes

| Avoid | Usually write |
| --- | --- |
| “Please” as automatic filler | A direct, respectful instruction |
| “Successfully” when success is already visible | The completed result |
| “In order to” | “To” |
| “At this time” | “Now” or nothing |
| “Utilize” | “Use” |
| “Click here” | The destination or action |
| “Something went wrong” | The actual problem and a recovery path |
| Unsupported superlatives | A specific, provable benefit |

## Interface check

- Is the main point or action front-loaded?
- Would a stranger understand it on the first read?
- Is the most important word among the first three when the format allows?
- Does the label name the action or destination?
- Does consequential copy state the consequence and reversibility?
- Does an error explain the problem and offer a real recovery path?
- Is the tone appropriate for the stakes?
- Is terminology consistent across the complete flow?
- Are capitalization, numbers, dates, punctuation, and product names consistent?
- Does the copy refer to people respectfully and inclusively?
- Will links, headings, images, and state changes make sense with assistive
  technology?
- Will each string remain clear when translated, pluralized, or expanded?
- Have filler, jargon, generic reassurance, and unsupported claims been removed?
- Read it aloud. Does it sound like a person?
