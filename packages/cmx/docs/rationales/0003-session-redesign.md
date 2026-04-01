# 0003: Session Redesign — Eliminate Systematic Integration Bugs

## Problem

`session.ts` is a hand-rolled state machine coordinating two resolvers (command + slot), two phase transitions, layer propagation, matcher forwarding, slot source lifecycle, and effect building. Every Codex review finds new bugs because:

1. **Layer propagation is opt-in per code path.** `buildCombinedResolution` wraps effects with layers, but `maybeTransitionToSlots` returns raw `CommandResolver` resolutions that skip it. Any code path that returns without going through `buildCombinedResolution` drops layers.

2. **Matcher is forked at phase transition.** `Session.create` receives a matcher, passes it to `CommandResolver`, but `SlotResolver.create` is called without it. Slot candidates use substring matching while commands use fuzzy matching.

3. **Slot source lifecycle is ad-hoc.** Fuzzy sources are eager-loaded with `runSyncExit` (no layer provision, no async). Search sources are never triggered. The session has no way to re-query sources when the query changes.

4. **Phase transition logic is scattered.** Six methods each contain `if (state.phase === 'slot')` branches. Adding a method means remembering to check phase in both paths.

5. **Resolution is built differently per code path.** Some paths call `buildCombinedResolution`, others return `CommandResolver` output directly, others spread and override fields. No single "all resolutions go through here" funnel.

These aren't independent bugs. They're the same architectural flaw: **the session doesn't enforce its invariants structurally**.

## Proposed Architecture

### Principle: every resolution exits through one funnel

Replace the current pattern (multiple `return resolution` sites) with a single `finalizeResolution` function that ALL code paths must use. This function:
- Always wraps effects with layers
- Always sets slot state fields
- Always includes the correct matcher context

No raw `CommandResolver` resolution is ever returned to the caller.

### Principle: matcher is injected once, used everywhere

`Session.create` stores the matcher on state. `SlotResolver` receives it at creation. No default matcher inside `SlotResolver.create` — the caller must provide one.

```typescript
// Before: matcher forked
state.slotResolver = SlotResolver.create(cmd.capability.slots)

// After: matcher forwarded
state.slotResolver = SlotResolver.create(cmd.capability.slots, state.matcher)
```

### Principle: slot sources are session-managed

The session owns the slot source lifecycle. When entering slot phase:
- Fuzzy slots: run source with session layers, inject candidates
- Search slots: expose a `requestSearchResults(slotName, query)` method that the consumer calls; session injects results via `setCandidates`

The consumer's contract: call `requestSearchResults` when the resolution has `choicesLoading: true` and a `focusedSlot` of kind `Search`. The session doesn't run the source itself — it returns the source Effect for the consumer to run in their own runtime (preserving async, services, cancellation).

```typescript
interface SessionApi {
  // ... existing methods ...

  /** Get the source Effect for the focused Search slot, if any.
   * Consumer runs this in their runtime and calls setSearchResults with the output. */
  getSearchSource: (query: string) => Effect.Effect<SearchResults> | null

  /** Inject search results from the consumer's runtime. */
  setSearchResults: (slotName: string, results: SlotCandidate[]) => void
}
```

### Principle: phase is a discriminated union, not a string

```typescript
type SessionPhase =
  | { readonly _tag: 'command' }
  | { readonly _tag: 'slot'; readonly resolver: SlotResolverApi; readonly command: CommandLeaf | CommandHybrid }
```

When in command phase, `slotResolver` and `resolvedCommand` don't exist — they're not nullable fields, they're absent. This eliminates every `if (state.slotResolver)` null check and makes it impossible to access slot state in command phase.

### Principle: `maybeTransitionToSlots` always returns through the funnel

```typescript
const maybeTransitionToSlots = (commandResolution: CommandResolution): Resolution => {
  const cmd = findResolvedCommand(commands, commandResolution)
  if (cmd && cmd.capability.slots.length > 0) {
    state.phase = { _tag: 'slot', resolver: createSlotResolver(cmd), command: cmd }
  }
  // ALWAYS go through finalizeResolution — never return raw commandResolution
  return finalizeResolution(state)
}
```

### Principle: layers are built once, cached until invalidated

```typescript
// Before: layers rebuilt on every resolution
const buildCombinedLayers = (state: SessionState): AnyLayer | undefined => {
  const layers = [...state.scopeLayers, ...Object.values(state.dynamicLayers)]
  if (layers.length === 0) return undefined
  return layers.reduce((acc, layer) => Layer.merge(acc, layer))
}

// After: cached, invalidated on setDynamicLayers
let cachedLayers: AnyLayer | undefined = undefined
let layersDirty = true

const getLayers = (): AnyLayer | undefined => {
  if (layersDirty) {
    const all = [...state.scopeLayers, ...Object.values(state.dynamicLayers)]
    cachedLayers = all.length > 0 ? all.reduce((acc, l) => Layer.merge(acc, l)) : undefined
    layersDirty = false
  }
  return cachedLayers
}

const setDynamicLayers = (layers: Record<string, AnyLayer>): void => {
  state.dynamicLayers = layers
  layersDirty = true
}
```

## What This Fixes

| Codex Finding | Root Cause | How This Fixes It |
|---|---|---|
| No-slot executions lose layers | `maybeTransitionToSlots` returns raw CommandResolver resolution | All paths go through `finalizeResolution` which always wraps with layers |
| Fuzzy sources fail with services | `runSyncExit` with no layers | Fuzzy sources run with session layers provided |
| Search sources never triggered | No lifecycle management | Session exposes `getSearchSource` for consumer-driven execution |
| Slot matcher is substring not fuzzy | `SlotResolver.create` uses own default | Matcher forwarded from session to slot resolver |
| Composite SlotValues not scoped | All steps see all values | `finalizeResolution` scopes values per step when building composite effects |

## What This Doesn't Change

- `CommandResolver` and `SlotResolver` APIs stay the same
- `handle-key.ts` dispatch logic stays the same
- `Resolution` interface stays the same
- All existing tests continue to pass

## Migration

This is a rewrite of `session.ts` only. The public `Session.create` API stays the same (same parameters, same return type). The internal implementation changes but the contract is preserved. All session tests should pass without modification — if they don't, the rewrite has a bug.

## File Changes

| File | Change |
|---|---|
| `session.ts` | Rewrite: phase union, single resolution funnel, matcher forwarding, layer caching |
| `slot-resolver.ts` | Remove default matcher parameter — require caller to provide one |
| `session.test.ts` | Add tests for: layers on no-slot execution, matcher consistency, search source lifecycle |

## Estimated Scope

~200 lines of session.ts rewritten. SlotResolver change is 1 line (remove default). 3-5 new tests.
