# 0003: Session Redesign — Architecture Review

**Reviewer**: Claude (Opus 4.6)
**Date**: 2026-03-31
**Verdict**: The problem diagnosis is accurate. The prescription is overscoped. Three of five bugs are one-line fixes. The rewrite addresses a sixth problem (structural enforcement) that doesn't yet exist in a 370-line module with 7 callers.

---

## 1. Phase Discriminated Union: Does It Prevent Bugs or Move Null Checks?

**It moves them.**

The proposal replaces:
```typescript
phase: 'command' | 'slot'
slotResolver: SlotResolverApi | null
resolvedCommand: (CommandLeaf | CommandHybrid) | null
```

with:
```typescript
type SessionPhase =
  | { _tag: 'command' }
  | { _tag: 'slot'; resolver: SlotResolverApi; command: CommandLeaf | CommandHybrid }
```

This eliminates `if (state.slotResolver)` null checks — but those null checks aren't the bug class. The current code **never** accesses `slotResolver` in command phase without checking first. Every method already gates on `state.phase === 'slot' && state.slotResolver`. The `&& state.slotResolver` is redundant type narrowing, not a bug source.

The actual bugs the proposal identifies are:
1. Layer dropping (resolution returned without layer wrapping)
2. Matcher forking (SlotResolver gets default matcher)
3. Source lifecycle (eager load without layers, Search never triggered)
4. Scattered phase checks (maintenance burden)
5. Multiple resolution return sites (no funnel)

Of these, **none are caused by the phase being a string instead of a DU**. Bug #1 is caused by `maybeTransitionToSlots` returning raw `CommandResolver` output. Bug #2 is a missing parameter. Bug #3 is incomplete lifecycle code. Bug #4 is subjective (6 methods × 1 branch each in a 370-line file). Bug #5 is the only one where structural enforcement helps — and the funnel alone fixes it without the DU.

**The DU solves a problem the codebase doesn't have** (accessing slot state in command phase) while leaving the actual problems to other parts of the proposal.

**Cost**: Every method that reads `state.phase` now needs pattern matching or narrowing. `getPhase()` must map the DU back to `'command' | 'slot'` to preserve the public API. The DU ripples through `maybeTransitionToSlots`, `queryPush`, `queryUndo`, `choiceTakeTop`, `choiceTake`, `toggleMode`, and `confirm` — 7 methods rewritten for type-level safety that the current code already satisfies at runtime.

**Recommendation**: Skip the DU. Keep the string phase. The funnel is the real fix.

---

## 2. Single Resolution Funnel: Right Pattern, But How Much Does It Cost?

**The funnel is the strongest part of the proposal.** It's the right fix for the layer-dropping bug and the resolution-consistency bug.

### Current problem (real)

`maybeTransitionToSlots` at line 234 of session.ts:
```typescript
return resolution  // ← raw CommandResolver output, no layer wrapping
```

This is the line that drops layers for no-slot commands. It bypasses `buildCombinedResolution` entirely.

### Performance concern: rebuilding resolution on every return

The proposal says all paths go through `finalizeResolution`. But `buildCombinedResolution` is **already called on every keystroke** — every `queryPush`, `queryUndo`, `choiceTakeTop`, `choiceTake`, `toggleMode`, and `confirm` already ends with `return buildCombinedResolution(state)`. The one exception is the early return in `maybeTransitionToSlots`.

So the funnel doesn't add resolution rebuilds. It removes the one path that skips it. **No performance regression.**

### But: a funnel is 5 lines, not a rewrite

The entire layer-dropping bug is fixed by changing `maybeTransitionToSlots`:

```typescript
// Before (buggy)
return resolution

// After (fixed)
return buildCombinedResolution(state)
```

That's it. One line. The "funnel" concept is just "always return through `buildCombinedResolution`" — which the code already does everywhere except this one path.

The proposal frames this as a new `finalizeResolution` abstraction. In reality, `buildCombinedResolution` is already the funnel. The bug is a single missed call site.

**Recommendation**: Fix the one line. Add a comment: `// INVARIANT: all public methods return through buildCombinedResolution`. No new abstraction needed.

---

## 3. Search Slot Lifecycle: Right Direction, Underspecified

The `getSearchSource` / `setSearchResults` API is the right shape — exposing the source Effect for the consumer to run preserves async, cancellation, and service provision. But the proposal leaves critical gaps:

### Missing: loading state transitions

The proposal mentions `choicesLoading: true` as a signal to the consumer, but never specifies when loading is set to `true`. Currently in slot-resolver.ts, `state.loading` starts `false`, gets set `false` in `setCandidates`, and is **never set to `true`** after initialization. The proposal doesn't fix this.

The lifecycle should be:
1. Consumer calls `getSearchSource(query)` → session sets loading = true
2. Consumer runs the Effect in their runtime
3. Consumer calls `setSearchResults(slotName, results)` → session sets loading = false

Without step 1, `choicesLoading` is always false and the consumer has no signal to show a spinner.

### Missing: debouncing

If the consumer calls `getSearchSource` on every keystroke, and each keystroke triggers a new source Effect, the consumer needs to debounce. The proposal says "the consumer handles this" — fair, but the API should make it easy to do correctly.

Consider: should `getSearchSource` return a stable reference when the query hasn't changed? Should it include a debounce hint (e.g., `minQueryLength`, `debounceMs`)? These aren't session concerns per se, but the proposal should acknowledge the consumer-side complexity it creates.

### Missing: cancellation on slot change

What happens when the user fills the Search slot (taking a choice) while a search is in-flight? What happens when the user undoes past the Search slot? The consumer's running Effect becomes stale. The proposal should specify that `setSearchResults` is a no-op if the focused slot has changed, or that the consumer should use a cancellation token.

### Missing: Search candidates are query-dependent

Unlike Fuzzy sources (which return all candidates, filtered by the matcher), Search sources return **query-specific results**. The current `setCandidates` API doesn't distinguish — it just caches results by slot name. If the user types "fo", gets results, then types "foo", the old "fo" results are still cached until new results arrive. The proposal should specify whether stale results are shown or cleared.

**Recommendation**: The Search lifecycle needs a mini-design of its own. The two-method API is the right starting point, but the proposal should address loading transitions, staleness, cancellation, and query association before implementation.

---

## 4. Layer Caching: Not Worth It

### How expensive is the current approach?

`buildCombinedLayers` does:
```typescript
const layers = [...state.scopeLayers, ...Object.values(state.dynamicLayers)]
layers.reduce((acc, layer) => Layer.merge(acc, layer))
```

`Layer.merge` is a pure data structure operation — it builds a merge node, not a runtime. It does zero I/O, zero service construction. The actual layer construction happens at `Effect.provide` time, which only runs once per execution (not per keystroke).

`scopeLayers` is typically 0-3 layers (one per AppMap depth level). `dynamicLayers` is typically 0-2 (consumer-provided context). So `reduce` iterates over 0-5 items.

### How often is it called?

Once per keystroke (inside `buildCombinedResolution`). At typing speed, that's ~10-15 calls/second. Reducing 3-5 items 10x/second is negligible.

### What does caching cost?

- A `layersDirty` flag
- A `cachedLayers` variable
- An invalidation call in `setDynamicLayers`
- A **missing** invalidation: `scopeLayers` are set at construction and never change, but if they ever do (e.g., path-based scope rebuild), the cache is silently stale

The dirty flag is simple, but it solves a non-problem. You're caching a sub-microsecond operation and adding a stale-cache risk.

**Recommendation**: Skip caching. Profile first. If the perf gate catches it, add caching then.

---

## 5. Test Impact

The proposal claims:

> "All existing tests continue to pass"
> "All session tests should pass without modification — if they don't, the rewrite has a bug"

This is **optimistic but plausible**, with caveats:

### Tests that use `getPhase()`

Four tests call `session.getPhase()` and assert `'command'` or `'slot'`. If the phase becomes a DU, `getPhase()` must still return the string. The proposal's API sketch doesn't show this mapping. If skipping the DU (as recommended), this is moot.

### Tests that use `getResolvedCommand()`

Two tests call `session.getResolvedCommand()`. If the command moves into the DU, this method either stays (returning `phase._tag === 'slot' ? phase.command : null`) or goes away. The proposal doesn't specify.

### Tests that bypass the transition

`codex-review-regressions-2.test.ts` tests fuzzy slot loading on phase transition. These tests exercise exactly the path the proposal rewrites. They'll keep passing only if the rewrite correctly calls `eagerLoadFuzzyCandidates` (or equivalent) during transition. This is the highest-risk test area.

### Missing test coverage

The proposal adds "3-5 new tests" but doesn't specify them. The real gaps:
- **No test for layer wrapping on no-slot execution** (the primary bug)
- **No test for matcher consistency** (slot matcher vs command matcher)
- **No test for Search source lifecycle** (never triggered currently)

These tests should be written **before** the rewrite, as failing tests that document the bugs. Then the rewrite makes them pass.

**Recommendation**: Write the new tests first. They should fail against current code. Then fix (not rewrite) until they pass.

---

## 6. Simpler Approaches the Proposal Missed

### Approach A: Surgical fixes (recommended)

| Bug | Fix | Lines Changed |
|---|---|---|
| Layer dropping | `maybeTransitionToSlots` returns through `buildCombinedResolution` | 1 |
| Matcher forking | Pass `state.matcher` to `SlotResolver.create` (store matcher in state) | 3 |
| Eager load without layers | Pass combined layers to `eagerLoadFuzzyCandidates`, use `Effect.provide` | 5 |
| Search never triggered | Add `getSearchSource` + `setSearchResults` to session API | ~30 |
| **Total** | | ~40 lines |

This fixes all 5 bugs without touching the phase model, the resolution flow, or the state shape. No existing test breaks. New tests can be added incrementally.

### Approach B: Extract a `SessionResolutionBuilder`

If the concern is "too many ways to build a resolution," extract the resolution-building logic into a pure function that takes `(commandResolution, slotResolver?, layers?)` and returns `Resolution`. This is lighter than a full rewrite and makes the funnel explicit without changing the state machine.

### Approach C: The proposed rewrite

~200 lines rewritten, DU, funnel, caching. Addresses the bugs but also restructures code that isn't broken. Higher risk, higher review cost, same end result.

**The proposal conflates "fix 5 bugs" with "restructure the module."** These are independent goals. Fix the bugs first. Restructure later if the module grows.

---

## 7. Biggest Risk

**Undo-across-phases regression.**

The `queryUndo` flow is the most complex path in session.ts. It handles:
1. Undo within slot query (remove last char)
2. Undo past slot boundary (go back to previous slot, restore preTakeQuery)
3. Undo past first slot (transition back to command phase)
4. Undo in command phase (delegate to CommandResolver)

Steps 2 and 3 interact with `choiceUndo` in SlotResolver, which itself handles "past the end" (all slots filled) vs "mid-slot" undo. This is the trickiest state transition in the module.

A rewrite that changes the state shape (DU phase, new resolver lifecycle) must reimplement this entire flow correctly. One subtle bug — e.g., failing to restore `preTakeQuery` when transitioning back, or clearing the wrong slot's value — breaks the palette UX in ways that are hard to test automatically (the user's cursor position and visible query become desynced from internal state).

The current undo tests cover the happy path (undo at first slot returns to command phase) but not the edge cases (undo from "all slots filled" state, undo with optional slots skipped, undo with mixed Text/Enum/Fuzzy slots). **A rewrite without comprehensive undo tests is playing with fire.**

**Second risk**: The proposal changes SlotResolver's constructor signature (removing the default matcher). This is correct in isolation, but every test that creates a SlotResolver without a matcher argument will break. `codex-review-regressions-2.test.ts` doesn't create SlotResolvers directly, but future tests or consumers might. The proposal should note this as a breaking change to SlotResolver's public API.

---

## Summary

| Proposal Element | Verdict | Recommendation |
|---|---|---|
| Phase discriminated union | Overengineered | Skip — solves a non-existent bug class |
| Single resolution funnel | Correct diagnosis | Fix the 1 missed call site, don't add abstraction |
| Matcher forwarding | Correct | 3-line fix, do it |
| Search slot lifecycle | Right direction, underspecified | Design the lifecycle separately, then implement |
| Layer caching | Premature optimization | Skip — sub-microsecond operation, profile first |
| Full rewrite | Overscoped | Surgical fixes (~40 lines) achieve the same correctness |

**Bottom line**: The proposal correctly identifies 5 real bugs but prescribes a structural rewrite when targeted fixes suffice. The phase DU and layer caching add complexity without addressing the bugs they're adjacent to. The Search lifecycle is the only piece that genuinely needs design work, and it deserves its own proposal.

Write failing tests for the 5 bugs. Fix them with minimal changes. If session.ts still feels structurally unsound after the fixes, *then* propose a rewrite with the benefit of comprehensive test coverage to catch regressions.
