# @kitz/cmx

Semantic command system with safety invariants and scope-aware visibility for any application with a typed action vocabulary.

Every application with enough features eventually needs a way for users to discover and invoke actions -- a command palette, a toolbar, keyboard shortcuts, a context menu. These are all surfaces over the same underlying question: "what can the user do right now, and in what order should we present it?" cmx answers that question.

## Problem

Most applications treat command entry as a raw string submission path. The command palette shows a flat list. Ordering is alphabetical or static. There is no concept of "these commands are only relevant in this context." Every surface (palette, toolbar, sidebar) discovers and ranks commands independently, so they disagree about what exists and what matters.

## Solution

cmx replaces flat command lists with a structured vocabulary. The consumer defines [capabilities](#capability) (what runs), [commands](#command) (what users see, organized into namespaces), and an [AppMap](#appmap) (where commands are available, with [keybindings](#keybinding)). cmx connects these into a single source of truth.

__Context-aware visibility.__ The [AppMap](#appmap) determines which commands exist at any given moment. Commands bound to a `thread` node appear when the user is in a thread and disappear when they navigate away. No manual show/hide logic -- visibility follows structure.

__Proximity-based ranking.__ Commands closer to the user's current position in the AppMap rank higher. Thread commands outrank workspace commands outrank global commands. Ordering reflects where the user is, not alphabetical accident.

__One handler, every key.__ The consumer wires one key handler. cmx routes all keys -- keybindings, palette input, slot filling -- and returns a discriminated result the surface renders. No routing logic in the consumer.

__Safety invariants.__ cmx refuses to execute nonexistent commands, namespaces, or commands with unfilled [slots](#slot). Dead-end prevention blocks input that would produce zero matches. Auto-advance collapses single-item choices during typing.

## Quickstart

```typescript
import { Cmx } from '@kitz/cmx'
import { Effect } from 'effect'

// 1. Define capabilities
const reload = Cmx.Capability.make({
  name: 'reload',
  execute: Effect.gen(function*() {
    const config = yield* ConfigService
    yield* config.reload()
  }),
})

// 2. Define commands — returns namespace + leaf handles
const { namespace: ConfigCommands, commands: { reload: reloadCmd } } = Cmx.Command.Namespace
  .fromCapabilities({
    name: 'Config',
    capabilities: { reload },
  })

// 3. Build an AppMap with keybindings
const appMap = Cmx.AppMap.make({
  commands: [ConfigCommands],
  keybindings: [
    { key: 'r', command: reloadCmd },
  ],
})

// 4. Wire cmx — yield inside Effect.gen, one key handler
const program = Effect.gen(function*() {
  const cmx = yield* Cmx

  onKeyDown((key) =>
    Effect.gen(function*() {
      const result = yield* cmx.handleKey(key, {
        path: currentPath(),
        layers: currentLayers(),
      })

      if (result._tag === 'Nil') return
      if (result._tag === 'Execute') {
        yield* result.effect
        return closeUI()
      }
      if (result._tag === 'Close') return closeUI()
      if (result._tag === 'BeginPalette') return showPalette(result)
      if (result._tag === 'BeginShortcut') {
        if (result.executable) return yield* result.effect
        return showSlotPrompt(result)
      }
      if (result._tag === 'Resolution') return updateUI(result)
    })
  )
})
```

All key routing goes through cmx. The surface matches on the result and renders. No routing logic in the consumer.

## Concepts

### Command

```typescript
const reloadCommand = Cmx.Command.Leaf.make({
  name: 'reload',
  capability: reloadCapability,
  description: 'Reload configuration from disk',
  detail:
    'Reads the config file and applies changes without restarting. Active connections are preserved.',
  warning: 'Unsaved config changes will be lost',
  confirmation: true,
  aliases: ['refresh', 'rl'],
  tags: ['configuration'],
  examples: ['Config reload'],
  related: ['Config export', 'Config reset'],
})

const exportCommand = Cmx.Command.Leaf.make({
  name: 'export',
  capability: exportCapability,   // slots inherited from capability
  description: 'Export configuration to a file',
  examples: ['Config export json', 'Config export yaml'],
})

// Namespace -- non-executable grouping with children
const configCommands = Cmx.Command.Namespace.make({
  name: 'Config',
  description: 'Configuration management',
  icon: 'settings',
  children: [reloadCommand, exportCommand],
})
```

Alternative: generate from capabilities (returns namespace + leaf handles):

```typescript
const { namespace: configCommands, commands: configLeaves } = Cmx.Command.Namespace
  .fromCapabilities({
    name: 'Config',
    description: 'Configuration management',
    capabilities: { reload, export: exportCap },
  })
// configLeaves.reload and configLeaves.export are the generated Command.Leaf objects
// Use them for keybindings, related, deprecation replacements, etc.
```

Alternative: generate from an Effect RPC group:

```typescript
const { namespace: configCommands, commands: configLeaves } = Cmx.Command.Namespace
  .fromRpcGroup({
    name: 'Config',
    rpcs: ConfigRpcs,
  })

// Deprecated command
const oldReload = Cmx.Command.Leaf.make({
  name: 'refresh',
  capability: reloadCapability,
  deprecated: { replacement: 'Config reload' },
})

// Nested namespaces
const lspCommands = Cmx.Command.Namespace.make({
  name: 'Lsp',
  description: 'Language server operations',
  children: [
    Cmx.Command.Leaf.make({
      name: 'references',
      capability: references,
      description: 'Find all references',
    }),
    Cmx.Command.Namespace.make({
      name: 'refactor',
      description: 'Code refactoring',
      children: [
        Cmx.Command.Leaf.make({ name: 'rename', capability: rename, description: 'Rename symbol' }),
        Cmx.Command.Leaf.make({
          name: 'extract',
          capability: extract,
          description: 'Extract to variable',
        }),
      ],
    }),
  ],
})

const lazyHybrid = Cmx.Command.Hybrid.make({
  name: 'Lazy',
  capability: lazyOpenCapability,
  description: 'Plugin manager',
  children: [
    Cmx.Command.Leaf.make({
      name: 'reload',
      capability: lazyReload,
      description: 'Reload plugins',
    }),
    Cmx.Command.Leaf.make({
      name: 'health',
      capability: lazyHealth,
      description: 'Run health check',
    }),
  ],
})
```

A command is what users see -- the names that appear in the palette, that users type or select. Each kind is a discriminated type (`_tag`):

* __`Command.Leaf`__ -- executable terminal. Selecting it runs something. Example: `Config reload`.
* __`Command.Namespace`__ -- non-executable grouping. Carries children. Selecting it shows its children. Example: `Config`. The namespace tree is built by nesting commands. Convenience constructors `.fromCapabilities` and `.fromRpcGroup` generate a namespace of leaf commands from capabilities or Effect RPC definitions.
* __`Command.Hybrid`__ -- executable with children. Example: `Lazy` (bare execution opens the UI, but it also has children like `Lazy reload`). Disambiguation: Confirm (Enter) executes the hybrid. Complete (Tab) drills into its children. This applies in both flat and tree mode.

Each leaf and hybrid references a [capability](#capability). Commands inherit [slots](#slot) from their capability -- if the capability has required slots, the command is incomplete until all values are provided.

#### Inline Documentation

Commands carry metadata that surfaces use for display, discovery, and safety feedback:

| Field          | Purpose                                                             | When shown                                                |
| -------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `description`  | Short text (a few words) shown next to the command in the choices   | Always, in the choices list                               |
| `detail`       | Longer explanation for preview/detail panes                         | When the command is highlighted or selected               |
| `icon`         | Visual identifier for surfaces that support it                      | In the choices list, toolbar, etc.                        |
| `badge`        | Category/origin indicator                                           | In the choices list (e.g., "Git", "Debug")                |
| `examples`     | Usage examples with slot values filled in                           | In the detail pane                                        |
| `related`      | Related commands for discovery                                      | In the detail pane                                        |
| `warning`      | Notice about destructive/irreversible consequences                  | Before execution, in the detail pane                      |
| `confirmation` | Requires explicit user confirmation before `resolution.effect` runs | Surface must show a confirm step when `true`              |
| `aliases`      | Alternative names the [Matcher](#matcher) can match against         | During matching (invisible to user, improves findability) |
| `tags`         | Categorical metadata for filtering and grouping                     | In help overlays, search filters                          |
| `deprecated`   | Deprecation notice with replacement command                         | In the choices list and detail pane                       |
| `group`        | Visual grouping within a namespace's choices                        | Surfaces render a separator between groups                |

All fields are optional. Commands work with just `name` and `capability`.

Commands are reusable values -- bind the same command tree to multiple [AppMap](#appmap) nodes if needed.

__Namespace uniqueness:__ Namespace names must be unique within the visible scope. If two different namespaces with the same name are both visible from the active AppMap position, cmx rejects this at setup time.

### Choices

```typescript
for (const choice of resolution.choices) {
  render(choice.token, choice.kind, choice.description, choice.keybinding)
}

if (resolution.topChoice) {
  highlightFirst(resolution.topChoice.token)
}
```

The choices are the list of valid next options at any point during resolution. It is what a [surface](#surface) renders as autocomplete suggestions, menu items, or palette entries.

cmx operates in two modes that determine what the choices contain:

__Flat mode (default -- discovery).__ All reachable executable commands (leaves and hybrids) shown as full paths: "Config reload", "Lsp refactor rename", "Lazy". Matched against the full path with term-level reordering -- typing "reload config" matches "Config reload." Namespaces do not appear in flat mode -- they are a tree-mode concept. This is where cmx starts. The user sees everything executable and types to narrow.

__Tree mode (focused -- namespace browsing).__ Only the current namespace's children: "reload", "export" (inside Config). Single-token matching. Entered via `?` toggle from flat mode (starts at root namespace). `choice.undo()` navigates to the parent namespace within tree mode. `?` toggles back to flat mode. Cancel (Escape) closes the session.

Toggle between modes with `?` -- a special character cmx interprets (like space for auto-advance). In flat mode, `?` switches to tree mode scoped to the current namespace or root. In tree mode, `?` switches back to flat.

During slot resolution, the choices contain slot value candidates matched by the slot's strategy (fuzzy or search). Mode does not apply to slot resolution.

Each choice carries:

| Field         | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `token`       | The text for this choice                                       |
| `kind`        | `leaf`, `namespace`, or `hybrid` (commands) or `value` (slots) |
| `executable`  | Whether taking this choice produces an executable state        |
| `description` | Short description from the command or slot                     |
| `detail`      | Longer explanation for preview panes                           |
| `icon`        | Visual identifier                                              |
| `badge`       | Category/origin indicator                                      |
| `keybinding`  | Key bound to this command at the current scope, if any         |
| `warning`     | Destructive action notice, if any                              |
| `deprecated`  | Deprecation info with replacement, if any                      |
| `group`       | Visual grouping identifier                                     |

The __top choice__ is the best candidate for the current query. When the query exactly matches a choice, the resolution is `complete`.

Choice ordering is determined by [ranking](#ranking).

### Capability

```typescript
// Capability with no slots
const reload = Cmx.Capability.make({
  name: 'reload',
  execute: Effect.gen(function*() {
    const config = yield* ConfigService
    yield* config.reload()
  }),
})

// Capability with slots — slots are parameters of the execution
const exportCap = Cmx.Capability.make({
  name: 'export',
  slots: [
    Cmx.Slot.Enum.make({ name: 'format', schema: S.Literal('json', 'yaml') }),
  ],
  execute: Effect.gen(function*() {
    const { format } = yield* Cmx.SlotValues   // provided by cmx at resolution time
    yield* exportToFile(format)
  }),
})
```

A capability is the smallest executable unit in cmx -- a stable, globally addressable function that actually runs when invoked. Capabilities never appear in the command palette directly. They exist as the substrate that [commands](#command) reference.

Capabilities own their [slots](#slot) -- the typed parameters they need to run. Commands inherit slots from their capability. Composites aggregate slots from their steps. This means cmx always knows what parameters a capability needs, whether it appears as a standalone command, part of a composite, or behind a keybinding.

**Slot value access.** At execution time, cmx provides filled slot values through a capability-scoped `Cmx.SlotValues` Effect service. The service type is derived from the capability's slot declarations — if a capability declares `slots: [formatSlot]` where `formatSlot` has `schema: S.Literal('json', 'yaml')`, then `yield* Cmx.SlotValues` returns `{ format: 'json' | 'yaml' }`. Each capability sees only the slots it declared, not other capabilities' slots.

**Composite aggregation.** Slots are keyed by a stable slot `name`. If two steps in a composite declare the same slot name, cmx rejects this at setup time (`CmxDuplicateSlot` error). Each step receives only the subset of slot values it declared — not the full aggregate.

A capability's execute function is an Effect with service dependencies in the `R` channel. This means capabilities can depend on app services and scope-provided context without manual wiring -- if the [AppMap](#appmap) provides a `ThreadContext` layer, a capability that depends on `ThreadContext` automatically receives it.

Capabilities and commands are separate because the grammar should evolve independently from the execution. Renaming a command, adding an alias, or restructuring a namespace never touches execution code. Multiple commands can reference the same capability -- `Config reload` and a keybinding both invoke the same function without duplicating it. Composite capabilities compose at the execution layer without the command grammar knowing.

### Slot

```typescript
// Slot.Enum -- static candidates from Schema
const formatSlot = Cmx.Slot.Enum.make({
  name: 'format',
  description: 'Output format',
  detail: 'The serialization format for the exported configuration',
  schema: S.Literal('json', 'yaml'),
})

// Slot.Fuzzy -- source provides candidates, Matcher matches
const emailSlot = Cmx.Slot.Fuzzy.make({
  name: 'email',
  description: 'Email to open',
  schema: EmailId,
  source: Effect.gen(function*() {
    const emails = yield* EmailService
    return yield* emails.list()
  }),
})

// Slot.Search -- source handles matching server-side
const fileSlot = Cmx.Slot.Search.make({
  name: 'file',
  description: 'File path',
  detail: 'Search by filename or path fragment',
  schema: FilePath,
  source: (query: string) =>
    Effect.gen(function*() {
      const files = yield* FileService
      return yield* files.search(query)
    }),
})

// Slot.Text -- free-form text input, no candidates
const nameSlot = Cmx.Slot.Text.make({
  name: 'name',
  description: 'Name for the new project',
  placeholder: 'Enter a name...',
  schema: S.String.pipe(S.minLength(1), S.maxLength(100)),
})
```

A slot is a typed argument position on a [capability](#capability). Slots are owned by capabilities, inherited by commands, and aggregated by composites. When a capability has required slots, its command is incomplete until all values are provided, and cmx refuses to execute incomplete commands.

Each kind is a discriminated type (`_tag`) with its own constructor and fields:

* __`Slot.Enum`__ -- candidates known at definition time, derived from Schema. Matched like commands.
* __`Slot.Fuzzy`__ -- source provides a candidate list, [Matcher](#matcher) matches client-side.
* __`Slot.Search`__ -- source handles matching server-side (for unbounded data).
* __`Slot.Text`__ -- free-form text input. No candidates, no matching, no dead-end prevention. Space is literal. Schema validates on submit.

Every slot carries a `schema` that types the value. For Slot.Enum, the schema generates candidates. For Slot.Fuzzy/Search, the schema types values from the source. For Slot.Text, the schema validates what the user typed. `CmxSlotValidationFailure` fires when a submitted value doesn't match the schema — primarily relevant for Slot.Text where the user enters free-form input.

#### Slot Documentation

Slots carry lighter metadata than commands -- enough for surfaces to label and explain the current input position:

| Field         | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `description` | Short label shown when the slot is focused ("Output format", "File path")    |
| `detail`      | Longer explanation for preview panes ("Search by filename or path fragment") |
| `placeholder` | Hint text shown in the input area when the slot has no value yet             |
| `required`    | Whether the slot must be filled before execution (default: `true`)           |

All documentation fields are optional.

See [CONTRIBUTING.md](CONTRIBUTING.md) for internals on how slot resolution works.

### AppMap

```typescript
const appMap = Cmx.AppMap.make({
  commands: [NavigationCommands, SearchCommands],
  layer: Layer.succeed(AppConfig, { theme: 'dark' }),
  children: [
    Cmx.AppMap.Node.make({
      name: 'workspace',
      commands: [WorkspaceCommands],
      keybindings: [
        { key: 'n', command: newThreadCommand },
      ],
      children: [
        Cmx.AppMap.Node.make({
          name: 'thread',
          commands: [ThreadCommands],
          keybindings: [
            { key: 'r', command: replyCommand },
            { key: 'e', command: exportCommand }, // has slots — triggers slot prompt
          ],
        }),
      ],
    }),
  ],
})
```

The AppMap is the application's information architecture for commands -- which commands are available where, and which keybindings are active. The consumer builds the map, binds [commands](#command) and [keybindings](#keybinding) to nodes. The root is implicit -- `AppMap.make` takes commands, keybindings, layers, and children directly. Root-level commands are always visible regardless of which node is active.

__Scope:__ The commands in scope are the union of all commands from the active node up to the root, deepest-first. When the active node changes, the scope changes immediately.

__Proximity:__ Commands bound to closer nodes appear higher in the [choices](#choices).

__Layers__ come in two forms:

* __Static layers__ -- set in `AppMap.Node.make({ layer })` for context that never changes.
* __Dynamic layers__ -- provided on each `cmx.handleKey` call for context that changes on navigation.

The map structure is built once and never reconstructed. Only the dynamic context changes.

__Capability dependencies__ are satisfied by the scope chain. If a visible capability's service dependencies are not satisfied, cmx treats this as an error.

### Keybinding

```typescript
Cmx.AppMap.Node.make({
  name: 'panel',
  commands: [PanelCommands],
  keybindings: [
    { key: 'q', command: panelCloseCommand }, // Key type — autocomplete, static validation
    { key: 'Mod+E', command: panelExportCommand }, // Hotkey type — modifier combos
    { key: '?', command: panelHelpCommand },
  ],
})
```

A keybinding is a direct key-to-command mapping registered at an [AppMap](#appmap) node. Keybindings follow the same visibility rules as commands -- a keybinding is active when its node is on the path from the active node to the root. Closer keybindings shadow farther ones if they bind the same key.

The `key` field is typed as `Key | Hotkey` from [`@tanstack/hotkeys`](https://github.com/TanStack/hotkeys) -- full IDE autocomplete for key names and modifier combos (`Mod+S`, `Control+Alt+Delete`), static rejection of invalid key names. The `command` field references actual command objects -- type-safe, not string-typed. All types are on the definition side; consumers write string literals and inference handles the rest.

__Keybindings vs Controls.__ Keybindings map keys to __commands__ -- they are domain-level, scope-aware, and registered on AppMap nodes. [Controls](#controls) map keys to __operations__ (open palette, confirm, cancel) -- they are infrastructure-level, not scope-aware, and provided as an Effect service. __Precedence in Tier 1 (no session):__ Controls are checked first for the `openPalette` key, then keybindings. __Precedence in Tier 2 (active session):__ Controls take precedence -- `?` means toggleMode, not a keybinding. Outside a session, `?` fires the keybinding normally. This means the same key can serve both purposes without conflict.

When a keybinding is triggered via `cmx.handleKey`, cmx returns:

* __`BeginShortcut` with `executable: true`__ -- if the command has no slots. The surface runs `resolution.effect` immediately.
* __`BeginShortcut` with `executable: false`__ -- if the command has unfilled slots. The surface shows a slot-filling prompt. Subsequent keys produce `Resolution` updates until the command is complete.

Keybinding hints appear on [choices](#choices) via the `keybinding` field -- surfaces can render the key next to the command name.

The AppMap exposes keybinding queries:

```typescript
// Inside Effect.gen:
const bindings = yield* appMap.getActiveKeybindings(['workspace', 'thread'])
// all active keybindings from thread → workspace → root, grouped by scope level
```

### handleKey

```typescript
const program = Effect.gen(function*() {
  const cmx = yield* Cmx

  onKeyDown((key) =>
    Effect.gen(function*() {
      const result = yield* cmx.handleKey(key, {
        path: currentPath(),
        layers: currentLayers(),
      })

      if (result._tag === 'Nil') return
      if (result._tag === 'Execute') {
        yield* result.effect
        return closeUI()
      }
      if (result._tag === 'Close') return closeUI()
      if (result._tag === 'BeginPalette') return showPalette(result)
      if (result._tag === 'BeginShortcut') {
        if (result.executable) return yield* result.effect
        return showSlotPrompt(result)
      }
      if (result._tag === 'Resolution') return updateUI(result)
    })
  )
})
```

`handleKey` is the consumer's single entry point. Every key goes through it. cmx tracks internal session state and routes keys to the right subsystem.

__Tier 1 results__ (no active session):

| Result          | When                           | Surface action                                                |
| --------------- | ------------------------------ | ------------------------------------------------------------- |
| `Nil`           | Key is not claimed by cmx      | Pass through                                                  |
| `BeginPalette`  | Palette-open key (`;`) pressed | Show palette UI, render the Resolution                        |
| `BeginShortcut` | Keybinding matched a command   | If executable: run effect. If slots needed: show slot prompt. |

__Tier 2 results__ (session active -- palette or shortcut with slots):

| Result       | When                           | Surface action                              |
| ------------ | ------------------------------ | ------------------------------------------- |
| `Resolution` | Key advanced the session state | Update the UI with new choices, query, etc. |
| `Execute`    | Command fully resolved         | Run `resolution.effect`, close the UI       |
| `Close`      | User cancelled (Escape)        | Close the UI                                |

cmx caches the session. Once `BeginPalette` or `BeginShortcut` fires, subsequent keys return Tier 2 results until `Execute` or `Close`. The surface never manages session lifecycle.

__Path and layers__ are passed on each `handleKey` call -- not fixed at creation. cmx computes scope lazily, caching internally and recomputing only when the path changes. The consumer provides the current path from whatever source it uses (router, Ref, React state).

__Controls__ determine how keys map to internal operations (which key opens the palette, which key confirms, etc.). Provided as an Effect service via the dependency graph, not passed to `handleKey`. Key fields are typed as `Key` from `@tanstack/hotkeys` -- write string literals, get autocomplete:

```typescript
const program = pipe(
  myProgram,
  Effect.provide(Cmx.Controls.of({
    ...Cmx.Controls.defaults,
    openPalette: ';',
    confirm: 'Enter',
    complete: 'Tab',
    cancel: 'Escape',
    backspace: 'Backspace',
    toggleMode: '?',
  })),
)
// Type error on typos like 'Tabb' — inferred from Key union
```

### Resolution

```typescript
// Resolution is the state snapshot carried by handleKey results
// (not runnable on its own — these are field access examples)
resolution.acceptedTokens // [{ token: "Config", preTakeQuery: "C" }]
resolution.query          // "r"
resolution.choices        // [{ token: "reload", kind: "leaf", ... }]
resolution.topChoice      // { token: "reload", ... }
resolution.executable     // false
resolution._tag           // "None" (partial match, not yet resolved)

// When executable, the consumer runs the effect:
// yield* resolution.effect  (inside Effect.gen)
```

A Resolution is the state snapshot carried by `BeginPalette`, `BeginShortcut`, `Resolution`, and `Execute` results. It carries everything a [surface](#surface) needs to render.

| Field            | Type                                          | Purpose                                                                                                                                                                |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`           | `'flat' \| 'tree'`                            | Current resolution mode                                                                                                                                                |
| `acceptedTokens` | `AcceptedToken[]`                             | Tokens locked in via choice selection or auto-advance. Each carries `token` (the canonical name) and `preTakeQuery` (what was typed before taking — restored on undo). |
| `query`          | `string`                                      | Characters not yet taken as a choice                                                                                                                                   |
| `_tag`           | `"Leaf" \| "Namespace" \| "Hybrid" \| "None"` | Discriminated union tag for the resolved position                                                                                                                      |
| `executable`     | `boolean`                                     | Whether the command is fully resolved                                                                                                                                  |
| `effect`         | `Effect \| null`                              | Pre-built Effect to run when executable (capability + slots wired)                                                                                                     |
| `complete`       | `boolean`                                     | Whether the query exactly matches a choice                                                                                                                             |
| `topChoice`      | `Choice \| null`                              | Best candidate for the current query                                                                                                                                   |
| `choices`        | `Choice[]`                                    | Current valid next choices, ranked                                                                                                                                     |
| `choicesLoading` | `boolean`                                     | Whether a dynamic slot source is being fetched                                                                                                                         |
| `slots`          | `SlotState[]`                                 | Typed argument positions and their current values                                                                                                                      |
| `focusedSlot`    | `SlotId \| null`                              | Which slot is currently being edited                                                                                                                                   |

__Safety invariants__ (hard rules, not preferences):

* Never execute a nonexistent command
* Never execute a namespace
* Never execute an incomplete command (missing required slots)
* Never hide a command that is in the visible scope

### Surface

```typescript
// React example — one handler, if/else chain
function CommandLayer() {
  const path = useCurrentPath()
  const layers = useCurrentLayers()
  const cmx = useCmx()
  const [ui, setUI] = useState(null)

  useKeyDown((key) =>
    Effect.gen(function*() {
      const r = yield* cmx.handleKey(key, { path, layers })

      if (r._tag === 'Nil') return
      if (r._tag === 'Execute') {
        yield* r.effect
        return setUI(null)
      }
      if (r._tag === 'Close') return setUI(null)
      if (r._tag === 'BeginPalette') return setUI({ kind: 'palette', resolution: r })
      if (r._tag === 'BeginShortcut') {
        if (r.executable) return yield* r.effect
        return setUI({ kind: 'slot', resolution: r })
      }
      if (r._tag === 'Resolution') return setUI(prev => ({ ...prev, resolution: r }))
    })
  )

  if (!ui) return null
  if (ui.kind === 'palette') return <Palette resolution={ui.resolution} />
  if (ui.kind === 'slot') return <SlotPrompt resolution={ui.resolution} />
}
```

A surface is any UI that consumes [Resolution](#resolution). Since cmx handles all key routing via `handleKey`, surfaces have a simple job:

1. Forward all key events to `cmx.handleKey(key, { path, layers })`
2. Match on the result tag
3. Render the Resolution when a session is active
4. Run `resolution.effect` on `Execute`

The surface manages its own selection state (Ctrl+J/K cursor position) but cmx handles everything else.

See [CONTRIBUTING.md](CONTRIBUTING.md) for internals on how key events are routed.

### Composite Capability

```typescript
const saveAndExport = Cmx.Capability.Composite.make({
  name: 'save-and-export',
  steps: [
    { capability: bufferWrite },     // no slots
    { capability: exportCap },        // has format slot
  ],
})
// saveAndExport.slots = [formatSlot] — aggregated from steps automatically

// Command inherits the aggregated slots
const quickExport = Cmx.Command.Leaf.make({
  name: 'quickexport',
  capability: saveAndExport,          // format slot comes along
  description: 'Save and export',
})
```

A composite capability is a [capability](#capability) whose execution is an ordered sequence of other capabilities. Slots are aggregated from all steps -- if any step has slots, the composite inherits them. Commands referencing the composite inherit the aggregated slots. cmx provides `Cmx.SlotValues` to each step at execution time.

Each step executes in sequence. If a step fails, the composite stops and the error propagates.

### Ranking

```typescript
// Default: score = match quality + proximity boost (no configuration needed)

// Custom: provide a Ranker via Effect layer for signals beyond matching
const program = pipe(
  myProgram,
  Effect.provide(Cmx.Ranker.of({
    rank: (choices, context) =>
      Effect.succeed(
        choices.toSorted((a, b) => myScore(b, context) - myScore(a, context)),
      ),
  })),
)
```

cmx passes proximity as a `boost` on each candidate to `@kitz/fuzzy`. The Matcher returns a single score that folds match quality and proximity together. Choices are then sorted by score, with alphabetical as a tiebreaker:

1. __Score__ -- match quality + proximity boost (closer commands get a higher boost)
2. __Alphabetical__ -- tiebreaker when scores are equal

When the query is empty, match scores are zero and the proximity boost dominates -- closer commands appear first naturally.

Proximity is a boost, not a hard precedence. A strong match on a far-away command outranks a weak match on a close command. This is the right behavior for flat mode where the user is searching across all commands.

__Matching__ is provided by [`@kitz/fuzzy`](../fuzzy/README.md). cmx wraps it as a pluggable [Matcher](#matcher) Effect service. `Fuzzy.match` accepts `{ text: string, boost?: number }` -- cmx computes the boost from AppMap proximity and passes it through.

__Ranking extension:__ cmx accepts an optional [Ranker](#ranker) for reordering choices beyond what the Matcher provides (e.g., a future `@kitz/cmx-learning` package adding frecency). The default ranking is just "sort by Matcher score." The Ranker is only needed for signals the Matcher can't express.

## Error Model

All errors are defined with `Err.TaggedContextualError` from `@kitz/core`.

### Errors

| Error                           | Phase   | Context                                               |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `CmxDuplicateNamespace`         | Setup   | `{ namespace: string, nodeA: string, nodeB: string }` |
| `CmxDuplicateSlot`              | Setup   | `{ slot: string, capabilityA: string, capabilityB: string }` |
| `CmxInvalidAppMap`              | Setup   | `{ detail: string }`                                  |
| `CmxInvalidPath`                | Runtime | `{ path: string[] }`                                  |
| `CmxMissingLayer`               | Runtime | `{ nodeId: string, service: string }`                 |
| `CmxSlotValidationFailure`      | Runtime | `{ slot: string, command: string, value: unknown }`   |
| `CmxCapabilityExecutionFailure` | Runtime | `{ capability: string, cause: unknown }`              |

```typescript
import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'cmx'] as const

export const CmxDuplicateNamespace = Err.TaggedContextualError(
  'CmxDuplicateNamespace',
  baseTags,
  {
    context: S.Struct({
      namespace: S.String,
      nodeA: S.String,
      nodeB: S.String,
    }),
    message: (ctx) =>
      `Namespace "${ctx.namespace}" is visible from both "${ctx.nodeA}" and "${ctx.nodeB}"`,
  },
)
```

Setup errors fail fast at AppMap construction. Runtime errors are in the Effect error channel -- never thrown.

## API Overview

| Export       | Purpose                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `Cmx`        | Singleton Effect service — `yield* Cmx` then `cmx.handleKey(key, { path, layers })`           |
| `Capability` | Define executable units with `.make()` or `.Composite.make()`                                 |
| `Slot`       | Define typed arguments with `.Enum.make()`, `.Fuzzy.make()`, `.Search.make()`, `.Text.make()` |
| `Command`    | Define user-facing grammar with `.Leaf.make()`, `.Namespace.make()`, `.Hybrid.make()`         |
| `AppMap`     | Define where commands are available with `.make()` and `.Node.make()`                         |
| `Controls`   | Pluggable key-to-operation mapping (Effect service)                                           |
| `Matcher`    | Pluggable scoring service (Effect service, default: @kitz/fuzzy)                              |
| `Ranker`     | Pluggable choice ordering service (Effect service)                                            |

## Glossary

#### AppMap

The application's information architecture for commands -- where commands are available, with keybindings and contextual layers. The root is implicit.

#### AppMap.Node

A region in the AppMap carrying commands, keybindings, and optional Effect Layers (static or dynamic) for contextual data.

#### capability

A stable executable unit -- the substrate that commands reference. Never appears in the palette directly.

#### choice

A single entry in the choices list. Carries token, kind, description, keybinding, and other metadata.

#### choices

The current valid set of next options. In flat mode: all reachable leaf commands as full paths. In tree mode: current namespace's children. During slot resolution: slot value candidates.

#### Cmx

The singleton Effect service. `yield* Cmx` to get the instance. Exposes `handleKey` as the consumer's single entry point.

#### command

User-facing grammar that appears in the palette. References a capability. Discriminated as `Command.Leaf`, `Command.Namespace`, or `Command.Hybrid`.

#### composite capability

A capability whose execution is an ordered sequence of other capabilities. Slots are aggregated from all steps. Created with `Capability.Composite.make()`.

#### Controls

Pluggable Effect service that maps key events to internal operations (which key opens the palette, confirms, cancels, etc.). Not the same as keybindings.

#### flat mode

The default resolution mode. All reachable executable commands (leaves + hybrids) shown as full paths. Namespaces do not appear. Matched with term-level reordering. Toggle to tree mode with `?`.

#### handleKey

The consumer's single entry point. Takes a `Key` (from `@tanstack/hotkeys`) and the current application path. Returns a discriminated result (Nil, BeginPalette, BeginShortcut, Resolution, Execute, Close). cmx handles all routing internally.

#### keybinding

A direct key-to-command mapping registered at an AppMap node. `key` is typed as `Key | Hotkey` from `@tanstack/hotkeys`. `command` references actual command objects. Closer bindings shadow farther ones.

#### Matcher

The shared scoring subsystem. Provided by [`@kitz/fuzzy`](../fuzzy/README.md) (fzy DP + fzf bonuses). Case-insensitive matching with exact-case scoring bonus. Pluggable.

#### namespace

A grouping level in the command tree, created by `Command.Namespace`. Non-executable -- selecting it shows its children.

#### query

The characters the user has typed that have not yet been taken as a choice. Filters the choices via matching.

#### Ranker

Pluggable service for reordering choices beyond what the Matcher provides. Default ranking is just "sort by Matcher score." Only needed for signals like learning/frecency.

#### Resolution

The state snapshot carried by handleKey results. Contains accepted tokens, query, choices, mode, executability, effect, and slot state.

#### scope

What's visible from the active AppMap position -- the runtime result of the AppMap structure plus the current path.

#### slot

A typed argument position on a capability. Inherited by commands, aggregated by composites. Discriminated as `Slot.Enum`, `Slot.Fuzzy`, `Slot.Search`, or `Slot.Text`. Every slot carries a schema that types its value.

#### surface

Any UI that forwards key events to `cmx.handleKey` and renders the resulting state.

#### top choice

The best candidate for the current query.

#### tree mode

Focused resolution mode showing only the current namespace's children. Entered by taking a namespace choice. `choice.undo()` navigates to parent within tree mode. `?` toggles back to flat mode. Cancel closes the session.
