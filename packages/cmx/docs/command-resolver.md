# Command Resolver (Internal)

Internal architecture for how cmx navigates the command tree. This document covers the character-level input model, auto-advance, dead-end prevention, and the control-to-operation mapping. Consumers interact with `cmx.handleKey` — this doc describes what happens inside.

For the consumer API, see [README.md](../README.md).
For the Slot Resolver, see [slot-resolver.md](./slot-resolver.md).

## Character-Level Input

The Resolver receives individual characters and manages the full input state. Surfaces forward events and render the resulting Resolution -- they do not maintain their own text buffers or matching logic.

The Resolver's input state consists of:

- **Accepted tokens** -- command path segments that have been locked in (e.g., `["Config"]`)
- **Query** -- characters received via `query.push()` that have not yet been taken as a choice (e.g., `"re"`)

The query is fuzzy-matched against the current [choices](../README.md#choices) using the shared [Matcher](../../fuzzy/README.md) subsystem. As characters accumulate, the choices narrows and reranks by match score.

## Operations

| Operation | Behavior |
| --- | --- |
| `query.push(char)` | Append character to query. Refilter choices by fuzzy match. See [Space](#space), [Dead-End Prevention](#dead-end-prevention), and [Auto-Advance](#auto-advance) for special behaviors. |
| `query.undo()` | Remove last character from query. If query is empty and accepted tokens exist, undo the last choice -- its text becomes the new query (editable). Refilter choices. Does not trigger auto-advance. |
| `choice.takeTop()` | Accept the top-ranked choice. If query exactly matches a choice, accept it. If query is partial with a top choice, accept the top choice. If query is empty, accept the top choice. Clear query. Recompute choices to children of the taken choice. Does not trigger auto-advance. |
| `choice.take(choice)` | Accept a specific choice (e.g., one the surface selected via keyboard navigation). Clear query. Recompute choices to children of the taken choice. Does not trigger auto-advance. |
| `choice.undo()` | Clear query. If accepted tokens exist, remove the last one. Recompute choices to the parent level. Does not trigger auto-advance. |

Every operation returns a [Resolution](../README.md#resolution).

## Space

Space is not a valid character in command tokens. The Resolver interprets `query.push(' ')` as "take the current top choice":

- If the query has a top choice (exact or partial), take that choice, clear query, recompute choices.
- If query is empty at a namespace level, no-op.

This is Resolver-level behavior, not a surface convention. The surface forwards space like any other character; the Resolver handles it.

Note: in a free-form [slot](./slot-resolver.md) position, space is literal (slot values can contain spaces).

## Auto-Advance

When `query.push(char)` narrows the choices to exactly 1 item, that item is automatically taken. The user never sees a choices of 1 during active typing -- it collapses into the next level.

**Only `query.push(char)` triggers auto-advance.** The other operations (`choice.takeTop`, `choice.take`, `query.undo`, `choice.undo`) never auto-advance. If `choice.takeTop()` enters a namespace with 1 child, the user sees that child and navigates explicitly. If `query.undo()` returns to a choices of 1, the user stays there.

This rule prevents loops: `query.undo()` cannot return to a state that immediately auto-advances forward again.

### Example

```
choices: [Config, Buffer, Lsp]     (3 items)

query.push('C'):
  query "C" narrows choices to [Config] (1 item)
  → auto-advance "Config"
  → accepted: ["Config"], query: ""
  → choices: [reload, export]      (2 items — no auto-advance)

query.push('r'):
  query "r" narrows choices to [reload] (1 item)
  → auto-advance "reload"
  → accepted: ["Config", "reload"], query: ""
  → executable: true
```

## Internal Safety Invariants

These are defensive assertions inside the Resolver. They should never be reachable through `handleKey` — the input model prevents them. They exist to catch implementation bugs.

| Invariant | Prevented by |
| --- | --- |
| Never execute a nonexistent command | Dead-end prevention blocks unreachable paths |
| Never execute a namespace | Controls map Enter to `choice.take` (enters namespace), not execute |
| Never execute an incomplete command | Slot resolution blocks execution until all required slots are filled |
| Never hide a command that is in scope | AppMap visibility is computed, not filtered |

## Dead-End Prevention

If `query.push(char)` would produce zero matches on a non-executable state, the character is rejected. The Resolver never enters a dead end -- the choices always has at least one item during active typing, or the state is already executable.

Combined with auto-advance (choices can't stay at 1), this means the choices is always 0 (executable) or 2+ during active input.

## Internal Control-to-Operation Mapping

These are the internal operations that Controls map key events to. The consumer never calls these directly — `handleKey` routes through Controls.

| Control | Resolution state | Internal operation |
| --- | --- | --- |
| `confirm` | executable | build Execute result with `resolution.effect` |
| `confirm` | exact hybrid | build Execute result (Enter executes hybrids) |
| `confirm` | partial with top match | `choice.takeTop()` |
| `confirm` | incomplete (missing slots) | `choice.takeTop()` — never execute |
| `complete` | exact namespace/hybrid | `choice.takeTop()` (Tab drills into children) |
| `complete` | partial with top match | `choice.takeTop()` — never execute |
| `complete` | exact executable leaf | no-op |
| space | any | `query.push(' ')` — auto-advance top match |
| `toggleMode` | any | toggle flat/tree mode |
| `backspace` | any | `query.undo()` |
| `cancel` | any | build Close result |
| printable char | any | `query.push(char)` |

A command palette might map: Enter=Confirm, Tab=Complete, Space=Separator, Backspace=Delete, Escape=Back. A toolbar might map: Click=Confirm. The Resolver is agnostic.

## Worked Examples

### Typing with auto-advance

```
resolver.query.push('C') -> query "C", choices [Config] (1)
                              auto-advance → accepted ["Config"]
                              choices: [reload, export]

resolver.query.push('r') -> query "r", choices [reload] (1)
                              auto-advance → accepted ["Config", "reload"]
                              executable: true
```

### Explicit navigation (Tab through)

```
resolver.choice.takeTop() -> take top choice "Config"
                              accepted: ["Config"]
                              choices: [reload, export]

resolver.choice.takeTop() -> take top choice "reload"
                              accepted: ["Config", "reload"]
                              executable: true

-- if Config had only 1 child, choice.takeTop() would NOT auto-drill --
-- the user sees the single child and tabs again --
```

### Backspace across token boundary

```
(starting from: accepted ["Config", "reload"], executable)

resolver.query.undo()    -> query empty, undo choice "reload"
                              accepted: ["Config"], query: "reload"
                              choices: [reload]  (no auto-advance)

resolver.query.undo()    -> query: "reloa", choices: [reload]
...
resolver.query.undo()    -> query: "", choices: [reload, export]
```

### Space as take top choice

```
choices: [Config, Buffer, Lsp]

resolver.query.push('C') -> auto-advance "Config" (choices was 1)
                              choices: [reload, export]

resolver.query.push('r') -> auto-advance "reload" (choices was 1)
                              executable: true

-- or with space explicitly: --

resolver.query.push('C') -> auto-advance "Config"
resolver.query.push(' ') -> query empty at namespace, no-op
                              (already taken by auto-advance on 'C')
```
