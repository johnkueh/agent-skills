---
name: comms-whatsapp
description: "Read, search, and send WhatsApp messages with wacli. Use to find a WhatsApp discussion, check what someone said, summarize a chat, list chats, groups, or contacts, download media, or send a message the user explicitly asked to send."
---

# WhatsApp with wacli

[`wacli`](https://github.com/steipete/wacli) pairs to the user's WhatsApp as a
linked device, syncs messages into a local SQLite store (`~/.wacli` on macOS,
`~/.local/state/wacli` on Linux), and reads from that store.

Two phases matter:

- **Sync** writes new messages into the store. Messages only arrive while a sync runs.
- **Read** (`messages`, `chats`, `contacts`) queries the local store. It is only as
  fresh as the last sync.

Reads are the default. Send, mark read, change groups, or delete only when the user
explicitly asks for that exact action.

## Setup

Check first: `wacli doctor` or `wacli auth status`. If it says `AUTHENTICATED true`,
do not run `wacli auth` again; that creates another linked device. On a shared
machine every agent uses the same session and store.

```bash
brew install steipete/tap/wacli
wacli auth                                   # QR → phone → Linked Devices
wacli sync --once --idle-exit 30s            # initial catch-up
```

Never commit the store directory. It holds session keys and messages.

## Freshness and the store lock

Start a read with one bounded catch-up, unless the user wants an offline snapshot:

```bash
wacli sync --once --refresh-groups --refresh-contacts --idle-exit 45s
```

The store has a single-writer lock. If it is locked, check only the reported PID's
executable name and status. If the owner is a live `wacli` on the same store, leave it
running and read with `wacli --read-only …`. For any other owner, stop and report it.
Never kill a process, delete a lock file, or break the lock to finish a read. Never
start an unmanaged `sync --follow` on a shared store.

Always report whether catch-up ran, the newest local message time in the chat, and
whether the requested window is covered. Local results prove only what the store has.
Older history needs `wacli history backfill --chat <jid> --count 50 --requests 3`,
which is best-effort and needs the phone online.

## Find the chat

Most commands take a JID: `614…@s.whatsapp.net` for a person, `…@g.us` for a group.

```bash
wacli --read-only chats list --json
wacli --read-only contacts search "Alice" --json
```

Prefer an exact, case-insensitive name match. With no exact match, run one bounded
search and continue when it yields one clear candidate. Ask only when the identity is
still ambiguous; never guess from a phone number.

## Read and search

Always pass `--json`. Output is an envelope; the rows are under `.data`
(`.data.messages[]` for messages, with `ChatJID`, `ChatName`, `SenderJID`,
`Timestamp`, `FromMe`, `Text`, `DisplayText`, `MediaType`).

```bash
# Search inside a known chat
wacli --read-only messages search "<query>" --chat <jid> --limit 50 --json

# Topic only: one global search, then scope follow-up reads to the matching chat
wacli --read-only messages search "<query>" --limit 30 --json

# Context around a hit
wacli --read-only messages context --chat <jid> --id <message-id> --before 10 --after 10 --json

# A time window (--before is exclusive)
wacli --read-only messages list --chat <jid> --after 2026-04-01 --limit 500 --json
```

When a 500-row page fills before the window is covered, page from its last timestamp
and dedupe by message ID. If you can't reach the window, say it is truncated.

An empty search does not prove nobody said it. Fall back once: list the exact chat for
the requested window and match each message's own `Text`. Don't scan unrelated chats
or start broad backfills unless asked.

## Who said what

Getting attribution wrong is the most damaging mistake here.

- **`FromMe` decides direction.** `true` is the account owner; `false` is the other
  party in a DM. Never infer the speaker from `SenderJID` (a raw `@lid` that varies by
  device) or from the human-formatted output.
- **`Text` is the message's own words.** `DisplayText` and `Snippet` include quoted
  replies, so a search can pin someone's words on the person who replied. Match
  phrases against `Text` only.
- In groups, resolve senders with `wacli contacts show --jid <jid> --json` and say so
  plainly when a sender stays unresolved.

A clean transcript:

```bash
wacli --read-only messages list --chat <jid> --limit 200 --json \
  | jq -r '.data.messages[] | select(.Text != "")
           | (if .FromMe then "ME  " else "THEM" end) + " | " + .Timestamp + " | " + .Text'
```

Return only the relevant excerpts, dates, chat name, attribution, and coverage limits.
Don't expose JIDs, phone numbers, session data, or unrelated conversations.

## Media

```bash
wacli media download --chat <jid> --id <message-id> --output /tmp/media
```

## Send (explicit request only)

A send needs the store lock. If a bounded sync holds it, wait. If a managed follower
holds it, pause only that store's follower through its supervisor and restore it
afterwards, including on failure. If ownership is unclear, report the blocker.

```bash
wacli send text --to 61400000000 --message "text"          # digits only, no + or spaces
wacli send file --to <jid> --file /abs/path.png --caption "look"
```

Resolve a name to exactly one recipient before sending:

```bash
TO=$(wacli contacts search "Alice" --json \
  | jq -er 'if (.data | length) == 1 then .data[0].JID else error("ambiguous") end')
```

Send to the `@s.whatsapp.net` form, never an `@lid` taken from message metadata.

## Groups

```bash
wacli groups list --json
wacli groups info --jid <group-jid>
wacli groups refresh
```

Joining, leaving, and changing participants (`groups join|leave|participants`) are
explicit-request actions.

## Diagnostics

```bash
wacli doctor              # store path, lock, auth, FTS5 availability
wacli doctor --connect    # live connection; needs the lock free
```

`FTS5 false` on stock macOS SQLite means search falls back to slower `LIKE` matching.
Every command accepts `--store <dir>` and `--timeout <duration>`.
