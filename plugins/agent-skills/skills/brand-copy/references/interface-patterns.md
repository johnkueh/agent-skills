# Interface patterns fallback

Read this reference only when `better-writing` is unavailable. It keeps
`brand-copy` portable without duplicating the installed specialist during a
task.

## Start with the interaction

Inspect nearby interface copy, terminology, localization conventions, and any
voice guide. Confirm the action, consequence, reversibility, and reachable
states before polishing words. Copy cannot repair unclear behavior.

## Buttons, flows, and settings

- Start a button with a verb that names the action: “Save draft”, “Send invite”,
  or “Delete account”. Aim for one to three words and use four only when needed.
- Repeat the consequence in confirmation actions. Use “Delete project”, not
  “Yes”. Name the object in a destructive action.
- Keep flow vocabulary stable. Pick “Continue” or “Next”; do not alternate.
- Label toggles for the on state: “Send read receipts”, not “Don't hide read
  receipts”.
- Link directly to a setting instead of describing a navigation path when the
  product supports it.

## Links

Describe the destination so the label makes sense out of context. Use “Read the
billing guide”, not “Click here”. Qualify repeated generic links, such as “Learn
more about exports”.

## Forms and placeholders

- Keep a visible label for every field and place it above the field when the
  layout allows; use placeholders only for examples or formats.
- Mark required fields consistently with `*` or “Required”. Do not mark only
  optional fields unless most fields are required.
- Phrase guidance positively and show it before a likely mistake.
- Put a field error beside the field and state both the problem and the fix.
- Use complete, pluralized localization strings rather than concatenating
  fragments around values.

## Errors

State what happened and what the person can do next. Avoid blame, jokes,
exclamation marks, and unsupported certainty. Keep diagnostic codes out of the
main message; put them in optional details when troubleshooting requires them.

| Weak | Better |
| --- | --- |
| “Invalid password” | “Choose a password with at least 8 characters” |
| “Something went wrong” | “Unable to save. Check your connection and try again.” |
| “You entered an invalid name” | “Use only letters for your name” |

If the same error affects many people, inspect the interaction instead of only
rewriting the message.

## Empty states

Explain what belongs in the empty area and provide one useful next action. Do
not apologize for an expected first-use state. Search and filter empty states
should name the query or filter and offer a way out. Do not put persistent
guidance only in an empty state; it disappears when content exists.

## Page structure

- Give each page or screen one main topic.
- Use a descriptive, front-loaded heading.

## Instruction language

- Front-load important information and use plain words.
- Avoid directional instructions such as “on the right” or “above”.
- Match the input device only when known. Use “select” when copy spans touch,
  keyboard, and pointer input.

## Interface check

- Does each label name the action or destination?
- Does consequential copy state the consequence and reversibility?
- Does each error explain the problem and offer a recovery path?
- Is terminology consistent across the complete flow?
