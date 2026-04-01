# Effect-Native Session Design

## Problem

`session.ts` is imperative mutation inside closures. It uses `let` variables, mutable Maps, manual layer merging, and `runSyncExit` to hack around the fact that slot sources are Effects. It has 8 systemic bugs, all caused by fighting Effect instead of using it.

## First Principles

In Effect, the idiomatic patterns are:

- **State** → `Ref<T>` — not `let` variables
- **Shared context** → `ServiceMap.Service` — not parameters threaded through functions
- **External I/O** → service dependencies — not inline `yield*` calls
- **Resource lifecycle** → `Scope` — not manual cleanup
- **State projection** → pure functions of `Ref.get` — not reading mutable internals
- **Dependency composition** → `Layer` provided declaratively — not `layers.reduce(Layer.merge)`

The session should be an Effect program, not an imperative program that returns Effects.

## Design

### Session is a Service

```typescript
export class Session extends ServiceMap.Service<Session, SessionApi>()('cmx/Session') {}

interface SessionApi {
  readonly queryPush: (char: string) => Effect<Resolution>
  readonly queryUndo: () => Effect<Resolution>
  readonly choiceTakeTop: () => Effect<Resolution>
  readonly choiceTake: (choice: Choice) => Effect<Resolution>
  readonly toggleMode: () => Effect<Resolution>
  readonly confirm: () => Effect<Resolution>
  readonly getResolution: () => Effect<Resolution>
}
```

Consumers depend on `Session` through Effect's service provision. Test doubles swap the implementation via `Layer.succeed(Session)(mockApi)`.

### State is a Ref

```typescript
interface SessionState {
  readonly phase: SessionPhase
  readonly commandChoices: ReadonlyArray<Choice>
  readonly slotState: SlotPhaseState | null
  readonly query: string
}

type SessionPhase = 'command' | 'slot'

interface SlotPhaseState {
  readonly command: CommandLeaf | CommandHybrid
  readonly slots: ReadonlyArray<AnySlot>
  readonly focusedIndex: number
  readonly values: ReadonlyMap<string, { value: unknown; preTakeQuery: string }>
  readonly candidates: ReadonlyMap<string, ReadonlyArray<SlotCandidate>>
  readonly loading: ReadonlySet<string>
}
```

All state transitions go through `Ref.update`. No mutable Maps, no `let` variables, no `state.slotResolver.someMethod()` — the resolver's state IS the session state.

### Resolution is a pure projection

```typescript
const projectResolution = (state: SessionState): Resolution => {
  // Pure function. No side effects. No reading from mutable internals.
  // Just transforms SessionState → Resolution.
}
```

Every session method: `Ref.get` → compute → `Ref.set` → `projectResolution`. One pattern, every method.

### Matcher is a Service

```typescript
export class SessionMatcher extends ServiceMap.Service<SessionMatcher, MatcherService>()(
  'cmx/SessionMatcher',
) {}
```

Not a parameter passed through 5 functions. Not a default on `SlotResolver.create`. A service that the session depends on. The consumer provides the implementation:

```typescript
const live = Layer.succeed(SessionMatcher)(Matcher.fuzzy())
```

Slot resolution and command resolution both access the same matcher through the service. No forking possible.

### Slot sources are service calls

Fuzzy sources run on phase transition. Search sources run on query change. Both are Effects that participate in the session's dependency graph:

```typescript
// Phase transition: load fuzzy candidates
const loadFuzzyCandidates = (slots: ReadonlyArray<AnySlot>) =>
  Effect.forEach(
    slots.filter(s => s._tag === 'Fuzzy'),
    slot => Effect.map(
      slot.source,
      candidates => [slot.name, candidates] as const,
    ),
    { concurrency: 'unbounded' },
  )
```

Because `slot.source` is an `Effect`, it automatically gets whatever layers the consumer provides at the execution boundary. No `runSyncExit`. No manual layer provision. The consumer's runtime handles async, services, cancellation.

### Search source lifecycle with versioning

```typescript
// In queryPush, when focused slot is Search:
const runSearchQuery = (slotName: string, query: string, version: number) =>
  Effect.gen(function*() {
    const candidates = yield* focusedSlot.source(query)
    // Only apply results if this is still the latest query
    yield* Ref.update(stateRef, state => {
      const slot = state.slotState
      if (!slot || slot.queryVersion !== version) return state // stale, ignore
      return { ...state, slotState: { ...slot, candidates: slot.candidates.set(slotName, candidates), loading: slot.loading.delete(slotName) } }
    })
  })
```

`queryVersion` increments on every `queryPush`. Stale results are ignored by comparing versions at write time.

### Layers are declarative

No `buildCombinedLayers`. No `layers.reduce(Layer.merge)`. No session-stored dynamic layers.

The consumer provides layers when running the Effect:

```typescript
// In the consumer (React, CLI, etc.):
const result = Effect.runPromise(
  cmx.handleKey(key, context).pipe(
    Effect.provide(scopeLayer),
    Effect.provide(dynamicLayer),
  ),
)
```

`handle-key.ts` computes scope layers from the AppMap path and provides them to the session Effect. Dynamic layers come from the consumer's context. Both flow through Effect's native `provide` — no manual merging.

### Composite scoping

When building the execution Effect for a composite capability, each step gets only its declared slots:

```typescript
const buildCompositeExecution = (
  composite: CapabilityComposite,
  allValues: ReadonlyMap<string, unknown>,
): Effect<void> =>
  Effect.forEach(
    composite.steps,
    step => {
      const scopedValues = filterByDeclaredSlots(step.capability.slots, allValues)
      return Effect.provide(
        step.capability._tag === 'Capability'
          ? step.capability.execute
          : buildCompositeExecution(step.capability, allValues),
        makeSlotValuesLayer(scopedValues),
      )
    },
    { discard: true },
  )
```

### SlotResolver becomes pure functions

The current `SlotResolver` is a mutable object with methods. In the Effect-native design, slot resolution logic becomes pure functions operating on `SlotPhaseState`:

```typescript
const slotChoices = (state: SlotPhaseState, matcher: MatcherService): ReadonlyArray<Choice> => { ... }
const slotConfirm = (state: SlotPhaseState): SlotPhaseState => { ... }
const slotQueryPush = (state: SlotPhaseState, char: string, matcher: MatcherService): SlotPhaseState => { ... }
const slotQueryUndo = (state: SlotPhaseState): SlotPhaseState => { ... }
```

No mutable internal state. No `create` factory. Just functions that transform `SlotPhaseState`. The session's `Ref.update` calls these functions.

### Optional Text fix

`slotConfirm` handles all slot kinds in one function:

```typescript
const slotConfirm = (state: SlotPhaseState, schema: AnySlot['schema']): SlotPhaseState => {
  const slot = state.slots[state.focusedIndex]
  if (!slot) return state

  // Optional + empty → skip
  if (slot.required === false && state.query === '') {
    return advanceToNextSlot(state)
  }

  // Text → validate through schema
  if (slot._tag === 'Text') {
    const result = Schema.decodeUnknownOption(schema)(state.query)
    if (Option.isNone(result)) return state // validation failed
    return advanceToNextSlot(setValue(state, slot.name, result.value))
  }

  // Non-text → take top choice
  const choices = slotChoices(state, matcher)
  if (choices.length === 0) return state
  return advanceToNextSlot(setValue(state, slot.name, choices[0].token))
}
```

One function. No branching in Session. No `submitText` vs `takeTop` vs `skipOptional` split.

### handleKey and CmxService

```typescript
// cmx.ts
export class Cmx extends ServiceMap.Service<Cmx, CmxApi>()('cmx/Cmx') {}

interface CmxApi {
  readonly handleKey: (key: string, context: HandleKeyContext) => Effect<HandleKeyResult>
}

// Live implementation
export const CmxLive = Layer.effect(Cmx)(
  Effect.gen(function*() {
    const session = yield* Session
    const appMap = yield* AppMapService
    const controls = yield* ControlsService
    // ... wire up handleKey using session, appMap, controls
  }),
)
```

The entire cmx is a service graph. Test the session by providing mock layers. Test handleKey by providing a mock session. Test the full pipeline by composing all live layers.

## File changes

| File | Change |
|---|---|
| `session.ts` | Rewrite: `Ref<SessionState>`, pure projection, service-based matcher, Effect-returning methods |
| `slot-resolver.ts` | Replace with pure functions on `SlotPhaseState` |
| `handle-key.ts` | Returns `Effect<HandleKeyResult>`. Layer provision at execution boundary. |
| `cmx.ts` | `Cmx` service with `CmxLive` layer. |
| `slot-values.ts` | Simplified — `buildExecutableEffect` removed, layer provision moves to execution boundary |
| `resolution.ts` | No change |
| `handle-key-result.ts` | No change |
| `matcher.ts` | `SessionMatcher` service added |
| All test files | Updated to run Effects and provide layers |

## What this fixes

| Bug | How |
|---|---|
| Layers dropped | Layers provided at execution boundary, not at resolution-build. Structurally impossible to forget. |
| Matcher forked | Matcher is a service. One instance. No forking possible. |
| Fuzzy sources broken | Sources are Effects composed in the pipeline. Consumer's runtime provides layers. |
| Search sources dead | `queryPush` yields the source Effect. Consumer's runtime handles async. |
| Composite unscoped | `buildCompositeExecution` filters values per step explicitly. |
| Dynamic layers stale | No session-stored layers. Computed fresh from context at execution boundary. |
| Optional Text submits "" | `slotConfirm` handles all kinds in one function. Optional + empty = skip. |
| choicesLoading never true | `loading` set in `Ref.update` before yielding source Effect. |
