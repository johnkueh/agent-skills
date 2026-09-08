# Instruction audit — 8 September 2026

Reviewed all 22 canonical skill entrypoints against baseline `ad4b3834ce3307e537656f7a437552d5d2c26dd5`, plus their applicable repository instructions and targeted workflow references. Generated plugin copies are rebuilt from canonical source. This is an instruction audit, not a certification of every external API, model, product price, or bundled script.

The review follows [OpenAI’s Astra guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra): make authorized progress, ask about material ambiguity, keep preparation concrete, and use proportional verification. [OpenAI’s skill guidance](https://learn.chatgpt.com/docs/build-skills) supports narrow triggers, concise entrypoints, and loading detail when needed. These principles guide the edits; domain requirements remain where they protect correctness.

## Decisions

- User intent and existing authorization take precedence over generic workflow gates. Approval remains necessary for uncovered external scope.
- Keep real constraints: credentials, account and artifact identity, concurrent work, data integrity, accessibility, and honest evidence.
- Remove fixed output quotas, forced tools/models, unnecessary review rounds, and workflows that silently expand the task.
- Use relevant checks and reuse valid results. A successful checklist is not a substitute for observing the requested outcome.

## Coverage

| Skill | Disposition | Finding or retained contract |
| --- | --- | --- |
| [brand-copy](../skills/brand-copy/SKILL.md) | Updated | Load humanizing guidance only when relevant; align the reference with the entrypoint. |
| [brand-design](../skills/brand-design/SKILL.md) | Updated | Replace an oversized rigid checklist with compact domain guidance; correct normal-text contrast threshold. |
| [comms-notion](../skills/comms-notion/SKILL.md) | Updated | Keep credentials outside skill packages. |
| [comms-slack](../skills/comms-slack/SKILL.md) | Updated | Check credential presence without printing the token. |
| [comms-whatsapp](../skills/comms-whatsapp/SKILL.md) | Updated | Avoid broad process kills, preserve shared sync, and reject ambiguous recipient selection. |
| [data-digest](../skills/data-digest/SKILL.md) | Updated | Resolve takeaway contradiction; avoid global account switching and manufactured source recency. |
| [dev-instantdb](../skills/dev-instantdb/SKILL.md) | Updated | Preserve existing stack/version and legitimate external URLs; repair broken import examples. |
| [drafty-proof-canvas](../skills/drafty-proof-canvas/SKILL.md) | Updated | Make publication and monitoring scoped actions; remove personal anecdotes and automatic deletion. |
| [marketing-aeo](../skills/marketing-aeo/SKILL.md) | Updated | Remove private account metadata, mandatory optional-provider stops, redundant approval, and assumed scheduler commands. |
| [marketing-ai-crawler](../skills/marketing-ai-crawler/SKILL.md) | Retained | Retain scoped crawler verification and content access guidance. |
| [marketing-keyword-data](../skills/marketing-keyword-data/SKILL.md) | Updated | Remove private credential project identifiers and compulsory paid calls. |
| [marketing-reddit](../skills/marketing-reddit/SKILL.md) | Updated | Remove private account metadata; honor host browser policy and session-only restart behavior. |
| [marketing-serp](../skills/marketing-serp/SKILL.md) | Updated | Remove private credential project identifiers and compulsory paid calls. |
| [marketing-x](../skills/marketing-x/SKILL.md) | Updated | Separate setup from credential uploads, acknowledge shared-state races, and use requested host scheduling. |
| [marketing-youtube-mine](../skills/marketing-youtube-mine/SKILL.md) | Updated | Replace personal checkout paths with skill-relative invocation. |
| [marketing-youtube-transcribe](../skills/marketing-youtube-transcribe/SKILL.md) | Retained | Retain captions-first flow, explicit audio fallback, and output provenance. |
| [media-icon-search](../skills/media-icon-search/SKILL.md) | Retained | Retain installed-package scoping, exact imports, and optional preview. |
| [media-image-gen](../skills/media-image-gen/SKILL.md) | Updated | Generate sufficient briefs directly; remove magic-keyword rules and align transparency guidance. |
| [media-video-gen](../skills/media-video-gen/SKILL.md) | Updated | Label costs as estimates, avoid assuming timeout billing, and keep a visible reduced-motion fallback. |
| [system-disk-cleanup](../skills/system-disk-cleanup/SKILL.md) | Updated | Replace unsafe blanket deletion recipes with ownership, exact scope, and measured free-space change. |
| [system-memory-cleanup](../skills/system-memory-cleanup/SKILL.md) | Updated | Replace broad process kills and RSS-as-physical-memory claims with pressure and PID ownership checks. |
| [wendy](../skills/wendy/SKILL.md) | Updated | Make coaching opt-in, use metaphors rather than diagnoses, and respect user corrections and requested work. |

## Repository and publication boundary

`AGENTS.md` already establishes canonical sources, generated-package rules, pnpm, and portable instructions. `CLAUDE.md` already points to it; both are retained. This explicitly requested public curation removes private details rather than introducing a new private workflow. Native tools remain host-selected. No live credentials, schedules, browser sessions, or external content were changed.

## Validation

Run `pnpm test` to rebuild and validate canonical and generated packages. The private suite additionally exercises machine sync, the branch-warning regression, and the existing runtime adapters. Live provider actions are intentionally outside this instruction change.
