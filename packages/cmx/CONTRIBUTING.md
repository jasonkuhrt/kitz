# Contributing to @kitz/cmx

## Getting Started

Clone the repo (or `git worktree add`). The `prepare` script configures hooks automatically after install.

## Codebase Map

```
packages/cmx/
├── README.md                        # SDK surface — what you build with
├── CONTRIBUTING.md                  # This file
├── docs/
│   ├── command-resolver.md          # Command Resolver subsystem
│   ├── slot-resolver.md             # Slot Resolver subsystem
│   └── rationales/                  # Architecture decision records
│       └── 0001-*.md
└── src/                             # Implementation (TBD)
```

Related packages:

| Package | Role |
| --- | --- |
| `@kitz/fuzzy` | Fuzzy matching algorithm (fzy DP + fzf bonuses). Used by the Resolver's Matcher service. |
| `@kitz/cmx-ui` | Command palette UI components (future). |
| `@kitz/cmx-learning` | Adaptive learning/ranking (future). |

## Boundaries

The public API is `Cmx` -- a singleton Effect service the consumer yields once. `cmx.handleKey(key, { path, layers })` is the single entry point. Everything below is internal.

### Internal Architecture

`handleKey` routes keys through a two-tier dispatch:

**Tier 1 (no active session):** Checks Controls first for `openPalette`, then checks keybindings against the AppMap at the given path. If the key matches `openPalette`, creates a session in flat mode (BeginPalette). If the key matches a keybinding, creates a session pre-positioned at that command (BeginShortcut). Otherwise returns Nil.

**Tier 2 (active session):** Routes keys to the Resolver -- the internal stateful engine that manages the command/slot resolution lifecycle. The Resolver coordinates two subsystems:

- **[Command Resolver](docs/command-resolver.md)** -- navigates the command tree. Fuzzy matching on flat paths (flat mode) or single tokens (tree mode). Auto-advance, dead-end prevention, space handling. Calls the Matcher for scoring.
- **[Slot Resolver](docs/slot-resolver.md)** -- resolves slot values. Enum/fuzzy slots call the Matcher for scoring. Search slots call the slot source (effectful). Switches in when a slot is focused.

Both subsystems produce the same output: [choices](README.md#choices) ranked inside a [Resolution](README.md#resolution). The Resolver switches between them transparently.

**Matcher** is a shared subsystem provided by [`@kitz/fuzzy`](../fuzzy/README.md). cmx wraps it as a pluggable `Matcher` Effect service. Both command and slot resolution call through the same service -- matching logic is never duplicated.

**AppMap** owns visibility, proximity, and keybinding resolution. The Resolver reads scope from the AppMap at the session's path.

**Slot value wiring.** Capabilities access filled slot values via `yield* Cmx.SlotValues` — a capability-scoped Effect service whose type is derived from the capability's slot declarations. Each capability sees only the slots it declared. Composites aggregate slots by name — duplicate slot names across steps are rejected at setup time (`CmxDuplicateSlot`). Each composite step sees only its own subset.

**preTakeQuery.** Both accepted command tokens and filled slot values store the query that was active when the value was taken. On undo, the query is restored to what the user typed, not the full token/value text. This is the backspace-across-boundary behavior.

**Execution is not cmx's concern.** cmx resolves input into a fully-qualified command (capability + slot values). The `Resolution.effect` field is a pre-built Effect the consumer runs — `Cmx.SlotValues` is provided inside this effect. cmx never executes capabilities.

**Session lifecycle.** `handleKey` creates sessions on BeginPalette/BeginShortcut and destroys them on Execute/Close. Session state (accepted tokens, query, slot values, mode) is cached between calls. The consumer never manages sessions directly.

## Extension Points

| Extension | Service | Purpose |
| --- | --- | --- |
| Scoring algorithm | `Matcher` | Swap the matching algorithm. Default: `@kitz/fuzzy`. |
| Choice ordering | `Ranker` | Reorder choices beyond what the Matcher provides. Default: sort by Matcher score (which includes proximity boost). |
| Key-to-operation mapping | `Controls` | Customize which keys trigger which operations. |
| Slot data source | `Slot.Fuzzy.source` / `Slot.Search.source` | Per-slot Effect that provides candidates. |

Adding a new slot kind would mean adding a new `Slot.*` discriminated type and teaching the internal Slot Resolver to handle it.

Adding a new command kind would mean adding a new `Command.*` discriminated type, updating the internal Command Resolver's navigation logic, and updating the surface interaction pattern doc.

Adding a new handleKey result type would mean adding a variant to the Tier 1 or Tier 2 dispatch and documenting it in the README.

## Key Decisions

| # | Decision | Why | Rejected |
| --- | --- | --- | --- |
| [0001](docs/rationales/0001-effect-on-hot-path.md) | Effect on every Resolver operation | ~1 us overhead per keystroke is 0.01% of 120Hz frame budget; uniform API beats split sync/async | Split API: pure operations return plain values, effectful operations return Effect |
| [0002](docs/rationales/0002-custom-fuzzy-package.md) | Custom @kitz/fuzzy over uFuzzy | uFuzzy has no composite score, always case-insensitive, regex-based scoring limits granularity | uFuzzy, fuse.js (wrong algorithm family), fzf-for-js (stale npm) |

## Common Tasks

**Add a new command kind:** Define the `Command.*` discriminated type in the command module. Update Command Resolver navigation (how `choice.takeTop`/`choice.take` and `choice.undo` behave for this kind). Update the surface interaction pattern doc. Add worked examples.

**Add a new slot kind:** Define the `Slot.*` discriminated type in the slot module. Implement resolution logic in the Slot Resolver (how `query.push` and `choice.takeTop` work for this kind). Update the Slot Resolver doc with a worked example.

**Change scoring constants:** The scoring constants live in `@kitz/fuzzy`, not in cmx. Update them there; the Resolver picks them up through the Matcher service.

**Add an architecture decision:** Write a rationale file at `docs/rationales/NNNN-slug.md` (Context, Decision, Result). Add a row to the Key Decisions table above.
