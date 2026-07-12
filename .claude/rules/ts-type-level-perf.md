---
paths:
  - 'packages/**/*.ts'
---

# Type-Level Performance

Empirically verified rules for type-level TypeScript in this repo. Every entry
below was measured on this repo's compiler (tsgo). Full measurements, harness
recipe, and counterexamples: [ts-type-level-perf.refs.md](./ts-type-level-perf.refs.md).

Each rule is written as a detectable code pattern so it can graduate into a
custom oxlint rule later.

## 1. Lookup tables over conditional chains — only past the threshold

**Pattern:** a conditional chain of ≥5 branches whose scrutinee is a
string/number literal key (e.g. a `_tag`) → rewrite as an indexed lookup table
(`{ k1: A; k2: B }[T['_tag']]`).

- Measured (8 branches): chain ~10 instantiations/use, lookup flat ~5/use. The
  gap grows with depth; lookup cost is flat.
- **Below ~5 branches the chain wins** — lookup's fixed overhead (indexed
  access + constraint check) loses at 4 branches (4 vs 7 inst/use), and any
  key conversion (`` `${boolean}` ``) adds more.
- **Disqualifiers:** non-keyable discriminants (type-identity checks like
  `IsExactly`, supertype checks like `X extends $Target`, template-literal
  matching, recursion), and sites needing exact-union identity — indexed
  access distributes over union keys, so a union scrutinee yields a union of
  answers, never a whole-union answer.
- In-repo exemplar: `packages/effect/src/path/core/group.ts`.

## 2. Bind repeated recursive subexpressions with `extends infer`

**Pattern:** the same *recursive* type expression mentioned 2+ times inside
one type's branches → bind it once via `Expr extends infer $X ? … : never`.

- Measured (recursive subexpression mentioned 3×): ~40% fewer instantiations
  (73 vs 124 inst/use). Re-mention of recursive conditionals is not free.
- **Scope limit:** small mapped-type re-mentions ARE cache-deduped (measured
  ~2 inst/use for 3 mentions) — binding those buys nothing. Apply to
  recursive/expensive expressions only.

## 3. Choose distribution by semantics, never as a perf trick

`[T] extends [X]` tuple-wrapping suppresses distribution. Measured over a
12-member union it cuts instantiations 8× (8 vs 64 inst/use) **but check time
was ~20% slower** — instantiation count and wall-clock diverge here. Pick
naked vs wrapped by whether you need per-member or whole-type behavior; do not
convert one to the other citing performance.

## 4. Rebuild fixed-shape type state by listing keys — never `Omit & patch`

**Pattern:** a type-level state record transformed across steps (parser
state, builder state) → write each transition by re-listing every key
(`{ a: $X; b: $S['b']; … }`, optionally through a constrained-identity
`from<$S extends St> = $S` wrapper, ArkType's pattern) instead of
`Omit<$S, 'a'> & { a: $X }`.

- Measured (6-key state, 5-step chains): rebuild ~1.4 inst/step vs
  `Omit &` ~10 inst/step — 7×.

## 5. Identical instantiations are free — vary only what must vary

Measured: 1000 repetitions of the same generic application cost ~82
instantiations total vs ~66,000 for unique arguments. Cache hits don't
increment the counter. Corollaries: repeated identical top-level uses cost
nothing; benchmarks MUST use distinct inputs; and sub-recursion sharing
across *distinct* parents does NOT happen on tsgo (measured — see refs), so
don't contort signatures chasing cross-call cache reuse.

## 6. Meta-rule: measure before adopting any TS-perf folklore

TS5-era lore does not transfer to tsgo untested. Five measured
counterexamples in the refs: shallow lookup tables, tuple-wrap wall-clock,
built-in pattern-match cost, stored-view property lookups, method-free
generic bounds — each a respected source's claim that failed to reproduce
here. Before applying a new type-perf technique, run the ~5-minute harness in
the refs: cache-defeating distinct inputs, **forced evaluation** (unused
top-level conditional aliases are skipped entirely), `tsc --noEmit
--ignoreConfig --extendedDiagnostics`, baseline-subtracted instantiations,
check time ×3.

Interpretation guard: **instantiations are a budget** (TS2589
depth/complexity limits, memory), not a wall-clock proxy. At benchmark scale
almost no instantiation delta moved check time — and one moved it the wrong
way.

## Enforcement pathway

Near-term: entries above are written as detectable patterns for custom oxlint
rules. Stronger: `@ark/attest`-style CI instantiation budgets on hot exported
types (assert absolute counts, fail on >20% regression) — see refs for how
ArkType wires this.
