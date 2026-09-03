# Interface copy

Use this reference for text embedded in a product interface. The copy should
help someone understand the current state, choose an action, or recover from a
problem without making them decode the product team's internal language.

## Start with the interaction

Confirm the action, consequence, reversibility, and reachable states before
polishing words. Copy cannot repair an interaction whose behavior is unclear.
Use the product's existing terminology and localization conventions.

## Core patterns

### Buttons and actions

- Start with a verb that names the action: “Save draft”, “Send invite”, “Delete account”.
- Repeat the consequence in confirmation actions. Use “Delete project”, not “Yes”.
- Keep vocabulary stable across a flow. Pick “Continue” or “Next”; do not alternate.
- Label toggles for the on state: “Send read receipts”, not “Don't hide read receipts”.

### Links

Describe the destination so the label makes sense out of context. Use “Read the
billing guide”, not “Click here”. Qualify repeated generic links: “Learn more
about exports”.

### Errors

State what happened and what the person can do next. Put field errors beside the
field. Avoid blame, jokes, exclamation marks, and unsupported certainty.

| Weak | Better |
| --- | --- |
| “Invalid password” | “Use at least 8 characters” |
| “Something went wrong” | “Unable to save. Check your connection and try again.” |
| “You entered an invalid name” | “Use letters only” |

If the same error affects many people, inspect the interaction instead of only
rewriting the message.

### Empty states

Explain what belongs here and provide one useful next action. Search and filter
empty states should name the query or filter and offer a way out. Do not put
persistent guidance only in an empty state; it disappears when content exists.

### Success and status messages

Confirm the result briefly: “Recipe saved” or “Invite sent”. Do not add
“successfully” when the state already proves success. For long-running work,
name what is happening and whether the person can leave the screen.

### Forms and placeholders

Keep visible labels. Use placeholders for examples or formats, never as the only
label. Phrase guidance positively and show it before a likely mistake. Build
complete localizable strings rather than concatenating fragments around values.

## Mechanics

- Address the reader as “you” when direct instruction helps.
- Prefer active voice unless the actor is unknown or irrelevant.
- Use sentence case by default and follow the product's established convention.
- Use contractions when they sound natural.
- Use numerals for measurements, money, dates, times, and percentages.
- Use punctuation sparingly; never depend on punctuation alone to communicate state.
- Match the input device only when known. Use “select” when copy spans touch and pointer input.

## Accessibility and translation

- Front-load the important information.
- Avoid directional language such as “on the right”.
- Give meaningful images useful alt text and decorative images empty alt text.
- Make link labels unique and understandable outside the surrounding sentence.
- Do not rely on color alone to communicate state.
- Avoid idioms, slang, double negatives, and unnecessary abbreviations.
- Leave room for translated text to expand.
- Use complete pluralized messages instead of assembling sentence fragments.

## Interface check

- Does the label name the action or destination?
- Does consequential copy state the consequence and reversibility?
- Does an error offer a real recovery path?
- Is terminology consistent across the complete flow?
- Will the string still work with assistive technology and translation?
