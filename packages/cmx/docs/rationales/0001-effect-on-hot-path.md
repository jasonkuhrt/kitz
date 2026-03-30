# 0001 Effect on the Resolver Hot Path

## Context

The cmx Resolver receives individual characters on every keystroke. Should every operation go through Effect's `yield*`, or should pure synchronous operations (append a character, fuzzy-filter an array) bypass Effect and return plain values?

Two API shapes were considered:

- **Uniform Effect API** — every operation returns `Effect<ResolutionState>`. Consistent, but pays Effect overhead per keystroke for pure operations.
- **Split sync/async** — pure operations return `ResolutionState` synchronously; effectful operations (`Resolver.at`, slot source fetching) return `Effect<ResolutionState>`. Faster hot path, split API.

## Decision

Uniform Effect API. Every Resolver operation returns `Effect<ResolutionState>`.

Benchmarked on Effect v4 beta 31, Bun 1.3.11, Apple Silicon (100,000 iterations, 10,000 warmup):

| Approach | Time per op | Frame budget at 120Hz |
| --- | --- | --- |
| Plain function (fuzzy-filter 200 items) | ~1.9 us | 0.021% |
| Effect.sync + runSync | ~2.3 us | 0.028% |
| Effect.gen (2 yield*) + runSync | ~3.2 us | 0.038% |

Effect overhead per keystroke: ~0.9-1.3 us (0.01-0.02% of frame budget). The fuzzy-filter computation itself dominates. `runSync` for pure effects is a synchronous trampoline — no fiber pool, no microtask queue.

The one caveat: do not `yield*` inside a loop over large collections. Score all candidates in a single `Effect.sync(() => candidates.map(score))`.

## Result

All Resolver operations (`query.push`, `query.undo`, `choice.takeTop`, `choice.take`, `choice.undo`, `handoff`, `reset`, `resolveKey`, `activeKeybindings`) return `Effect<ResolutionState>`. No sync/async split. If a performance wall is ever hit, the fuzzy-filter algorithm is the optimization target, not Effect.
