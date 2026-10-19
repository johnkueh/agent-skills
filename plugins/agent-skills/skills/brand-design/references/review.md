# Interface review

Use this format whenever a design, UI, or interface review is requested, from a
single domain ("review the typography") to a holistic one ("review the whole
interface"). A strong review is not six audits stapled together: inspect the
experience, apply each domain's guidance, then consolidate the evidence into
one prioritized verdict.

## Scope and mode

Infer the screen, flow, feature, or repository scope from the request and
workspace, and state it. Use `full` when no mode is given and the request is
holistic; a single-domain request covers only that domain.

| Mode | Coverage | Finding cap |
| --- | --- | --- |
| `quick` | Primary user path and highest-traffic states; only `HIGH` and `MEDIUM` | 5 |
| `full` | Entire requested scope and every domain below, including empty, loading, error, and narrow-width states when present | 15 |

For a large scope, inspect in bounded passes and preserve the requested
coverage. State progress and remaining surfaces; never silently shrink a full
audit.

## Recon before judgment

Identify the framework, styling system, component library, design tokens,
supported viewports, and available preview or test commands. Follow the
project's established conventions.

## Domains, in order

Review in this order so foundational failures are not hidden by polish:

1. Accessibility: [accessibility/core.md](accessibility/core.md)
2. Layout: [layout/core.md](layout/core.md)
3. Copy: the `brand-copy` skill's interface guidance
4. Typography: [typography/core.md](typography/core.md)
5. Color: [color/core.md](color/core.md)
6. UI polish and motion: [ui/core.md](ui/core.md)

Load each domain's core file and only the topic references the evidence needs.
If `brand-copy` is not installed, mark Copy `Not reviewed` rather than
recreating its rules from memory. When two domains seem to cover one issue,
assign it to the domain that owns the underlying rule, mention secondary effects
in **Why**, and report it once.

## Evidence and ranking

Every finding cites `path/to/file:line` and shows the current implementation;
without source files, cite the exact screen and component. Do not report a
code-level finding from appearance alone, or a visual finding from source alone
when runtime behavior decides it.

- `HIGH`: blocks a task, misleads, hides content or controls, risks data loss,
  or is a repeated systemic failure.
- `MEDIUM`: meaningfully harms comprehension, efficiency, adaptability, or
  consistency.
- `LOW`: isolated polish. Include only in `full` mode.

Within a severity, rank by reach: a token or shared-component fix outranks the
same symptom in one leaf component. One root cause is one finding, listing every
confirmed location. Do not pad to the cap; a short review is a valid result.

Run safe, relevant checks and inspect the rendered interface when visual
judgment matters. If a check cannot run, label it **Not verified**; never turn a
verification gap into a finding. A review is read-only unless implementation
was also requested; then the report is the change scope and checks re-run after.

## Output

### Scope and coverage

State the mode, exact scope, stack, and any boundary, then:

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Files, components, states, or checks | Findings count or `Clear` |

`Clear` means inspected with no actionable finding; `Not reviewed` explains why.

### Findings

| # | Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Accessibility | `src/Dialog.tsx:42` | `<button><XIcon /></button>` | Add `aria-label="Close"` and hide the icon from the accessibility tree | The icon-only control has no accessible name |

With no findings, omit the table and write "No actionable interface findings."

### Considered but rejected

Optional. Real candidates you inspected and kept, when they clarify the review:

| Location | Candidate | Rejected because |
| --- | --- | --- |
| `src/Card.tsx:28` | Increase the shadow | Matches the shared surface token; changing one card reduces consistency |

### Verification

Each check or interaction, the exact command or steps, and the observed result.
Separate passed checks from **Not verified** ones.

### Verdict

End with exactly one: `Block` (a `HIGH` finding remains), `Needs changes` (only
`MEDIUM` or `LOW` remain), or `Approve` (nothing actionable and the claimed
coverage was verified).
