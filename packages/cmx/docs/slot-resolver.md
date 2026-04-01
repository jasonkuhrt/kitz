# Slot Resolver

How the Resolver resolves slot values. This is a distinct subsystem from the [Command Resolver](./command-resolver.md) -- when a slot is reached, the Resolver switches from navigating the command tree to matching against slot candidates.

For the SDK surface (capabilities, commands, AppMap), see [README.md](../README.md).

## Overview

When a command has slots, the Resolver enters slot resolution after the command path is fully resolved. The [choices](../README.md#choices) changes from showing command children to showing valid slot values. The query is matched against slot candidates using a strategy determined by the slot's kind.

From the consumer's perspective, command resolution and slot resolution feel the same -- type and see matching results. The slot kind determines the matching strategy.

## Slot Kinds

### Slot.Enum

Candidates are known at definition time, derived from the slot's Schema. Fuzzy-matched like commands.

```typescript
Cmx.Slot.Enum.make({
  name: 'format',
  schema: S.Literal('json', 'yaml'),
})
```

Choices: `[json, yaml]`. Typing `j` narrows to `[json]`. Pure -- no I/O.

### Slot.Fuzzy

Source provides a candidate list. The [Matcher](../../fuzzy/README.md) fuzzy-matches against the query client-side. Good for bounded lists where all candidates can be loaded into memory (emails, projects, branches, users).

```typescript
Cmx.Slot.Fuzzy.make({
  name: 'email',
  source: Effect.gen(function*() {
    const emails = yield* EmailService
    return yield* emails.list()
  }),
})
```

The source is called when the slot is first focused (lazy -- not at setup time). The Resolver caches the result for the duration of the session. The query is scored against cached candidates using the shared [Matcher](../../fuzzy/README.md).

Choices: ranked by match score. Typing narrows and reranks. The source provides DATA, the Matcher provides MATCHING.

### Slot.Search

Source handles matching server-side. Good for unbounded data where the full candidate list can't be loaded client-side (full filesystem, all records in a large database).

```typescript
Cmx.Slot.Search.make({
  name: 'file',
  source: (query: string) => Effect.gen(function*() {
    const files = yield* FileService
    return yield* files.search(query)
  }),
})
```

The source is a function from the current query to an Effect producing choices items. The Resolver calls it when the slot is focused (query = `""`) and re-calls it (debounced) as the query changes.

Choices: whatever the source returns. The source owns both data and matching. The Resolver owns display, ranking integration, and the resolution lifecycle.

## Source Protocol

A slot source is an Effect that produces an array of candidate items. The `value` type is generic over the slot's schema — if the schema is `EmailId`, candidates carry `value: EmailId`:

```typescript
type SlotCandidate<V> = {
  value: V             // typed by the slot's schema
  label: string        // display text in the choices
  description?: string
}
```

For **Slot.Fuzzy**, the source has no parameters -- it returns all candidates:

```typescript
// If slot schema is EmailId:
source: Effect<SlotCandidate<EmailId>[]>
```

For **Slot.Search**, the source receives the current query:

```typescript
source: (query: string) => Effect<SlotCandidate<FilePath>[]>
```

Sources are Effects -- they can depend on any services in the Resolver's dependency graph. The AppMap's layers are available, so a source at a `workspace` node can depend on `WorkspaceContext` to filter candidates to the current workspace.

## Loading States

Dynamic slots (Slot.Fuzzy and Slot.Search) involve I/O. The Resolution includes a loading indicator:

| Field | Purpose |
| --- | --- |
| `choicesLoading` | `true` while the source Effect is running |

Surfaces render this as a spinner or skeleton in the choices area. The choices may be empty while loading (initial fetch) or stale (re-query in progress with previous results still displayed).

## Slot.Text

Free-form text input. No candidates, no matching, no dead-end prevention. The query IS the value.

```typescript
Cmx.Slot.Text.make({
  name: 'name',
  description: 'Name for the new project',
  placeholder: 'Enter a name...',
  schema: S.String.pipe(S.minLength(1), S.maxLength(100)),
})
```

Space is literal (not auto-advance). Any character is accepted. Enter (`confirm`) submits the current query as the slot value. Tab (`complete`) also submits for Slot.Text — there are no candidates to complete against, so it behaves the same as confirm. The schema validates on submit — `CmxSlotValidationFailure` if validation fails. If validation fails, the query is preserved and the slot stays focused.

## Multi-Slot Lifecycle

When a command has multiple slots, the Resolver fills them left-to-right as declared.

```
Command: "Config export" with slots [format (required), destination (optional)]

Step 1: format slot focused
  choices: [json, yaml]
  focusedSlot: "format"

  → take "json"

Step 2: destination slot focused (optional)
  choices: (source-provided destinations)
  focusedSlot: "destination"

  → Enter with no value: skip (optional)
  → OR take a destination

Step 3: executable
  all required slots filled
  resolution.executable: true
```

**Slot-level preTakeQuery.** Each filled slot stores the query that was active when the value was taken — the same `preTakeQuery` mechanism used for command tokens. On undo, the query is restored to what the user typed, not the full selected value.

**Undo across slot boundaries:**

| State | `query.undo()` (empty query) | `choice.undo()` |
| --- | --- | --- |
| Second slot focused, has value | Un-fill this slot, restore its preTakeQuery | Un-fill this slot, go back to previous slot |
| Second slot focused, no value | Go back to previous slot (restore its preTakeQuery) | Go back to previous slot |
| First slot focused, has value | Un-fill this slot, restore its preTakeQuery | Un-accept the command, return to command choices |
| First slot focused, no value | Un-accept the command, return to command choices | Un-accept the command, return to command choices |

**Optional slots and executability.** A command with only optional slots becomes executable as soon as the command path is resolved — the user can execute without filling any optional slots. When an optional slot is focused and the user presses confirm/complete with no value, the slot is skipped and the next slot (or execution) follows. `resolution.executable` can be true even while an optional slot is focused.

**Skipping optional slots:** Confirm/Complete with an optional slot focused and no value skips to the next slot. If no more required slots remain, the resolution becomes executable.

## Matching

Slot.Enum and Slot.Fuzzy kinds use the shared [Matcher](../../fuzzy/README.md) -- the same pluggable scoring subsystem used by the [Command Resolver](./command-resolver.md). See that document for the scoring contract, default implementation (@kitz/fuzzy), and how to plug in a custom Matcher.

## Worked Examples

### Enum slot

```
(after taking "Config export")
slots: [{ name: "format", kind: "Enum", value: null }]
focusedSlot: "format"
choices: [json, yaml]

resolver.query.push('j') -> query: "j", choices: [json]
resolver.choice.takeTop() -> slot "format" filled with "json"
                              executable: true
```

### Fuzzy slot

```
(after taking "Email open")
slots: [{ name: "email", kind: "Fuzzy", value: null }]
focusedSlot: "email"
choicesLoading: true   (source fetching email list)

... source completes ...

choicesLoading: false
choices: [
  { label: "Weekly standup notes", value: "email-123" },
  { label: "Q4 planning", value: "email-456" },
  { label: "Welcome to the team", value: "email-789" },
]

resolver.query.push('w') -> fuzzy match on "w"
                              choices: [
                                { label: "Weekly standup notes", value: "email-123" },
                                { label: "Welcome to the team", value: "email-789" },
                              ]

resolver.query.push('e') -> fuzzy match on "we"
resolver.query.push('l') -> fuzzy match on "wel"
                              choices: [
                                { label: "Welcome to the team", value: "email-789" },
                                { label: "Weekly standup notes", value: "email-123" },
                              ]
                              (reranked — "Welcome" scores higher for "wel")

resolver.choice.takeTop() -> slot "email" filled with "email-789"
                              executable: true
```

### Search slot

```
(after taking "File open")
slots: [{ name: "path", kind: "Search", value: null }]
focusedSlot: "path"
choicesLoading: true   (source querying with "")

... source completes with recent files ...

resolver.query.push('R') -> query: "R"
                              source re-queried (debounced) with "R"
                              choicesLoading: true (briefly)

... source completes ...

choices: [
  { label: "README.md", value: "/project/README.md" },
  { label: "RELEASE.md", value: "/project/RELEASE.md" },
]

resolver.query.push('E') -> query: "RE"
                              source re-queried with "RE"
                              (previous results still displayed until new results arrive)

resolver.choice.takeTop() -> slot "path" filled with top choice
                              executable: true
```
