# Effect v4 Arbitrary Derivation — Verified Semantics

Verified against `effect@4.0.0-beta.85` on 2026-07-07 by empirical probes (all
claims below marked ✅ were executed against the installed package, not read
from docs). File/line references point into `node_modules/effect/dist/` at that
version and will drift across releases — re-verify with the probes at the
bottom before relying on them at a different version.

## The mental model

**A schema defines a set; a generator picks a distribution over that set.**
One set, many possible distributions. In v4 the schema *value* carries its
distribution: `S.toArbitrary(schema)` is deterministic per schema value and
takes no generation options — its only option is `{ report: true }`
(diagnostics). There is no per-call override. To get a different distribution
over the same set, you derive a **variant schema value** (same Type, different
annotations) and call `toArbitrary` on that.

This is the effect-native analog of QuickCheck's newtype modifiers
(`ASCIIString`, `Positive Int` — distribution encoded in a *type*): effect
encodes the distribution in a *schema value* instead. Hedgehog/fast-check-style
loose generator values remain available on top, since `toArbitrary` returns a
plain fast-check `Arbitrary` — but loose values do not compose through schema
derivation, variant schemas do (see "Composition" below).

## How derivation works internally

The deriver (`internal/schema/arbitrary.js`, `recur()`) is a fold over the AST
with a **constraint context**:

1. If the node has a `toArbitrary` annotation → use it as the node's **base
   generator** (replacement), then wrap in `filterLayer`.
2. Else if the node has checks → recur on the check-less node for the base,
   then wrap in `filterLayer`.
3. Else → structural `base()` per AST tag. `Declaration` nodes **throw** here —
   opaque declared types cannot be derived without a hook.

`filterLayer` does three jobs: merges the checks' `constraint` hints into the
context (which base generators consume — e.g. the `String` case switches from
`fc.string(lengthConstraints)` to `fc.stringMatching(pattern)` when the context
carries `patterns`), mixes in the checks' weighted `candidate` sources, and
**predicate-filters every generated value against every check**.

Consequence: generated values satisfy the schema *by construction*. Invalid
candidates or invalid override output cost efficiency (rejection), never
validity. ✅

## The three extension points

| Extension point | Where it attaches | Semantics | Validity guarantee |
|---|---|---|---|
| `toArbitrary` annotation | any node, via `S.annotate({ toArbitrary: () => (fc, ctx) => arb })` (`Annotations.Bottom`) | **replaces** the node's base generator | node's checks still filter the output ✅ |
| `arbitrary: { constraint?, candidate? }` | a filter, via `S.makeFilter(pred, { arbitrary })` / built-ins like `S.isPattern` | **cooperates**: `constraint` refines the base generator; `candidate` adds a weighted alternative source | all checks still filter ✅ |
| `toArbitrary` declaration hook | `S.declare` annotations (`Annotations.Declaration`) | **mandatory** — structural derivation of opaque types is impossible; hook receives derived type-parameter arbitraries | checks still filter |

Key facts about each, probe-verified:

- **Candidates bias, never replace.** The base generator is pinned at weight 1;
  candidates add weighted sources (`cumulatedWeights: [1, N]` visible in the
  report dump). A weight-20 candidate yields ~20/21 ≈ 0.95 of samples. ✅
- **Candidate weights compound across ALL candidates on the schema.** A new
  candidate's share is `w / (1 + Σ existing candidate weights + w)`, not
  `w / (1 + w)`. Adding a weight-20 candidate to a schema that already carries
  a weight-8 candidate (e.g. an efficiency candidate on a canonical schema's
  filter) yields 20/29 ≈ 0.69, not 0.95. ✅ (observed on the path `Segment`
  schema). To express "N:1 over the canonical distribution", multiply by the
  canonical schema's total generation weight.
- **Node override replaces the base but not the checks.** An override emitting
  values that violate a check has those values filtered out; pipe order
  (`annotate` before or after `check`) does not matter — both live on the node. ✅
- **The override receives the merged constraint context (`ctx`) but is free to
  ignore it** — replacement shifts distribution-correctness (not validity)
  responsibility to the author.
- **`terminal`**: declaration hooks (and overrides) may return
  `{ arbitrary, terminal }`; `terminal` is the finite branch used to cap
  recursive schemas. A bare arbitrary is shorthand when no recursion is
  involved.

## The "vacuous carrier filter" pattern (variant schemas)

To attach arbitrary hints to a schema *after the fact* without changing
validation, append an always-pass filter that exists only to carry the
annotation:

```ts
const Variant = Base.pipe(
  S.check(
    S.makeFilter(() => true, {
      arbitrary: { candidate: { weight: 20, make: (fc) => /* ... */ } },
    }),
  ),
)
```

Probe-verified properties of this pattern (all ✅):

- Bias observed at the expected weight ratio; decode/encode behavior identical
  to `Base` (same set).
- The carrier adds **no derivation warnings** — a hint-carrying filter is not
  an `OpaqueFilter`. Note the flip side: any plain predicate filter *without*
  hints anywhere on the schema IS reported as `OpaqueFilter` (`{ _tag:
  'OpaqueFilter', path }`), so compare warnings before/after adding the
  carrier rather than asserting an empty list.
- `S.toJsonSchemaDocument(Variant)` is **byte-identical** to `Base`'s — the
  carrier does not leak into JSON Schema.
- Works at `TaggedClass` nodes: a whole-value candidate can build class
  instances (`new P({...})` / `P.make({...})`); sampled values remain
  `instanceof` the class.

## Composition — the reason variants beat loose generators

A biased **leaf** schema flows through struct derivation compositionally:
`S.Struct({ items: S.Array(BiasedLeaf) })` samples the leaf's biased
distribution inside the container (~0.98 observed for a weight-50 candidate). ✅
A loose fast-check value can't do this — you must hand-wire
`FastCheck.record({...})` mirroring the struct shape (which is exactly what
`packages/effect/src/path/testing.ts` does for its `Realistic` generators,
because our model classes are fixed `TaggedClass` structs whose fields can't be
swapped for variant leaves after the fact).

## v3 → v4

| | v3 | v4 (beta.85) |
|---|---|---|
| Deriver | separate module: `Arbitrary.make(schema)` | integrated: `S.toArbitrary` / `S.toArbitraryLazy`, memoized |
| Customization | single `arbitrary` annotation, **total replacement** — derivation stops at the annotated node | three stratified points (table above); replacement is per-node **base only**, checks always layer on top |
| Validity | user's responsibility (docs warned explicitly); an override could silently violate refinements below it | guaranteed by construction — `filterLayer` always applies |
| Filter → generator communication | none; refinements fell back to generate-then-reject | `constraint` hints merge into a context consumed by base generators (patterns, lengths, integer/ordered bounds) |
| Diagnostics | none | `{ report: true }` (e.g. `OpaqueFilter` warnings); fail-fast on impossible constraints / underivable nodes |
| Architecture | ad-hoc per-module annotation IDs (`Arbitrary`, `Equivalence`, `Pretty`) | uniform `to*` pairs: every deriver (`toArbitrary`, `toEquivalence`, `toFormatter`, `toCodec`, JSON Schema) has a matching annotation hook |

## Organizing distributions (API-design guidance)

- The **canonical** schema keeps the full-space distribution — property/law
  tests rely on sampling the whole set (a realistic-biased canonical arb
  silently weakens every law; a full-space arb is what caught the path
  `fileUrl` `%`/`?`/`#` bug).
- Filter-level `arbitrary` hints on the canonical schema are for making
  full-space generation *efficient and correct* (pattern-based instead of
  reject-sampled), not for biasing toward "nice" values.
- Alternate distributions (realistic/bounded/readable) are **named variant
  schema values** or loose generators in a testing module, never mutations of
  the canonical schema. Ecosystem precedents: Hedgehog exports `Gen.alpha` /
  `Gen.ascii` / `Gen.unicode` side by side over the same `Char` set; QuickCheck
  ships newtype modifiers; proptest parameterizes with `arbitrary_with`.
- A named preset graduates to a parameterized factory only when consumers have
  real knobs to turn — presets are saved invocations of the factory.

## Re-verification probes

Run from `packages/effect/` (adjust nothing else; hooks may delete stray
`.mjs` files in the repo, so use `node --input-type=module -e "..."`):

```js
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'

// candidate bias + base pinned at weight 1
const Biased = S.String.pipe(
  S.check(S.makeFilter(() => true, {
    arbitrary: { candidate: { weight: 20, make: (fc) => fc.constantFrom('a', 'b') } },
  })),
)
const s1 = FastCheck.sample(S.toArbitrary(Biased), 2000)
console.log('bias ~0.95:', s1.filter((x) => x === 'a' || x === 'b').length / s1.length)

// node override replaced base; checks still filter its invalid output
const MinThree = S.String.pipe(
  S.check(S.makeFilter((s) => s.length >= 3)),
  S.annotate({ toArbitrary: () => (fc) => fc.constantFrom('hello', 'x') }),
)
console.log('only hello:', FastCheck.sample(S.toArbitrary(MinThree), 300).every((s) => s === 'hello'))

// no JSON Schema leak from the carrier filter
const Base = S.String
const Carrier = Base.pipe(S.check(S.makeFilter(() => true, {
  arbitrary: { candidate: { weight: 5, make: (fc) => fc.constant('z') } },
})))
console.log('doc identical:',
  JSON.stringify(S.toJsonSchemaDocument(Base)) === JSON.stringify(S.toJsonSchemaDocument(Carrier)))
```

Expected: `bias ~0.95` ≈ 0.95, `only hello: true`, `doc identical: true`.
