# Interface and product writing

Use this reference for interface strings and practical product content such as
settings, onboarding, errors, empty states, guides, and downloads. The editorial
rules are distilled from the
[Mailchimp Content Style Guide](https://styleguide.mailchimp.com/).

## Start with the interaction

Inspect nearby interface copy, the product's terminology, localization
conventions, and any voice or content style guide. Confirm the action,
consequence, reversibility, and reachable states before polishing words. Copy
cannot repair unclear behavior: if the same error keeps firing for many people,
redesign the interaction instead of rewording it.

Preserve intentional brand character when it stays clear and appropriate to the
stakes. Treat a difference from generic plain language as a problem only when it
creates inconsistency, ambiguity, translation risk, or the wrong tone.

## One voice, flexible tone

The product has one voice, established by its existing system rather than
invented during a local edit. Keep terms consistent: if it's "Archive" in the
menu, it isn't "Move to storage" in the toast. Tone flexes with the stakes:

| Situation | Tone |
| --- | --- |
| Onboarding and empty states | Warm, encouraging, and practical |
| Success | Brief; light celebration at most |
| Routine actions and settings | Neutral and minimal |
| Errors | Calm, specific, and helpful; no playfulness |
| Destructive actions | Sober, direct, and explicit |
| Data loss and security | Serious and unambiguous |
| Legal, privacy, and billing | Plain, precise, and unambiguous |
| Education and guidance | Patient, structured, and concrete |

Write in a plainspoken, genuine voice. Explain technical concepts as if to a
smart person outside the field. Dry, subtle humor can work when the brand
supports it, the moment is low-stakes, and the meaning survives translation.
Never force a joke, use slang as personality, or make light of a problem.

## Address the reader

- Address the reader as "you" in instructional copy, not "the user".
- Use "we" only when the product or team is genuinely the actor. Avoid it in
  errors when it diffuses responsibility: prefer "Unable to load content" over
  "We're having trouble loading this content". An established first-person brand
  voice can stay in low-stakes contexts.
- Use possessives sparingly ("Favorites" over "Your favorites") and never switch
  perspective accidentally.
- Prefer active voice. Passive is fine when the result matters more than the
  actor, or the actor is unknown.
- Frame instructions around what someone can do: "Save to continue" rather than
  "You can't continue without saving"; "Available on Pro" rather than "Not
  available on Free".
- Match the input device only when known: "tap" on touch, "click" with a
  pointer, "select" when both are possible.

## Buttons, flows, and settings

- Start a button with a verb that names the action: "Save draft", "Send invite",
  "Delete account". Aim for one to three words; use four only when needed.
- Never "OK!", "Let's go!", or bare "Yes"/"No" on a consequential action.
  Confirmations repeat the consequence so the dialog is answerable without
  reading the body: "Delete this project?" offers "Delete project" and "Cancel".
- Keep flow vocabulary stable: one entry label, then "Continue" or "Next" (pick
  one) to advance, and "Done" to finish.
- Label toggles for the on state: "Send read receipts", never "Don't send read
  receipts".
- Link directly to a referenced setting instead of describing the path to it.

## Links

Link text makes sense out of context, because screen-reader users navigate by a
list of links. Use "Read the billing guide", not "Click here", and qualify a
repeated generic link: "Learn more about exports".

## Forms and placeholders

- Every field keeps a visible label, placed above the field when the layout
  allows. Placeholders show an example or format (`name@example.com`), never the
  only label.
- Mark required fields consistently with `*` or "Required". Do not mark only
  optional fields unless most fields are required.
- Phrase hints positively ("Use only letters", not "Don't use numbers") and show
  them before a likely mistake.

## Errors

An error is an instruction, placed next to the failing field. State what
happened and what the person can do next. No blame, "oops", jokes, exclamation
marks, or unsupported certainty. Keep diagnostic codes out of the main message;
put them in optional details when troubleshooting requires them.

| Weak | Better |
| --- | --- |
| "Invalid password" | "Choose a password with at least 8 characters" |
| "Oops! Something went wrong." | "Unable to save. Check your connection and try again." |
| "You entered an invalid name" | "Use only letters for your name" |

## Confirmations and status

Confirm a completed result briefly in the past tense: "Recipe saved", "Invite
sent". Do not add "successfully" when the state already proves success. Avoid
"Yay" and exclamation marks. For long-running work, name what is happening and
whether the person can leave the screen.

## Empty states

Say what belongs in the empty area and offer one useful next action, for example
"No projects yet", then "Projects keep your tasks and files together.", then
"Create a project". Do not apologize for an expected first-use state. Search and
filter empty states name the query and offer a way out: "No results for
'quarterly'. Clear filters". Never park persistent guidance only in an empty
state; it disappears once content exists.

## Headings, descriptions, and guides

- Give each page or screen one main topic. Headings name what the section
  contains or helps the reader do, front-loaded, so a reader can scan headings
  alone to find the right section.
- Descriptions name the actual contents; instructions name the relevant objects
  and action. Replace a slogan or vague promise with a supported detail.
- Warmth comes from useful choices and natural language. Avoid reassurance that
  raises a concern the reader has not expressed.
- Avoid directional instructions such as "on the right" or "above".
- Use numbered lists for steps and bullets for unordered items; keep items
  grammatically parallel.

## Write about people with care

- Use singular "they" when a person's pronouns are unknown, and the pronouns a
  person has communicated when they are known.
- Avoid gendered collective terms such as "guys". Skip unnecessary gender:
  "Subscribers can post recipes", not "his or her recipes".
- Mention age, disability, or medical conditions only when relevant. Prefer
  person-first language unless the person or community prefers identity-first.
- Capitalize racial and ethnic identities such as Black, Asian, and Indigenous;
  do not hyphenate dual-heritage identities. Use identity terms as modifiers,
  not nouns for groups.
- Describe audiences as people, customers, or readers, not data points.
- Do not use "suffers from" or "victim of", or "crazy", "insane", "lame", or
  "addicted to" as casual intensifiers.

## Capitalization, names, numbers, and punctuation

- Apply one capitalization policy per element type; sentence case is the default
  (see the house style in SKILL.md). "Save Changes" beside "Discard changes"
  reads as sloppiness. Preserve official product names and proper nouns.
- Write "website", "internet", "online", and "email" in lowercase. Refer to a
  company as "it" unless you mean its people.
- Spell out one through nine in prose and use numerals for 10 and above. Always
  use numerals for times, dates, measurements, percentages, money, and ordinals.
- Use an en dash for numeric ranges, `am`/`pm` in lowercase with a space after
  the time, and a time zone when a time could be ambiguous.
- Use `&` only in official names or established space-constrained patterns.
  Use ellipses and semicolons sparingly, and at most one exclamation mark on a
  screen, never in an error or stressful state.
- A locale's own date, time, number, and currency formats override these house
  conventions.

## Localization

- Build complete, pluralized strings with variables; never concatenate
  fragments around values (`"You have " + n + " new messages"`).
- Avoid idioms, wordplay, double negatives, and culture-specific metaphors.
- Spell out abbreviations on first use unless the audience broadly knows them.
- Prefer clarity over extreme brevity; translations grow, so leave room.
- When visible control text changes, keep the accessible name in agreement.

## Interface check

- Would a stranger understand the copy on the first read?
- Does each label name the action or destination?
- Does consequential copy state the consequence and reversibility?
- Does each error explain the problem and offer recovery?
- Are terminology, capitalization, numbers, and product names consistent
  across the whole flow?
- Will every string stay clear when translated or pluralized?
