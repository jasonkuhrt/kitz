# Effect v4 Arbitrary Derivation — Verified Semantics

Verified against `effect@4.0.0-rc.117` on 2026-09-23 by reading the installed
source (`node_modules/effect/src/unstable/arbitrary/Arbitrary.ts` and
`src/internal/arbitrary/{schema,regexp,model,runner}.ts`) and by empirical
probes; claims marked ✅ were executed against the installed package. The module
is `unstable`, so re-verify with the probes at the bottom before relying on
these semantics at another version.

## The mental model

**A schema defines a set; its derived arbitrary picks a distribution over that
set.** `Arbitrary.schema(schema)` derives from the schema's decoded `Type` side
(`SchemaAST.toType`). For a codec such as `Path.FileName` (string ⇄ class
value), generation builds the class value directly and never touches the
string decoder. So the Type side has to encode every invariant of the domain:
native derivation reads only the schema, and there is no hook that can patch a
generated value into validity.

## How derivation works

`compile` in `internal/arbitrary/schema.ts` folds over the Type AST:

- **Checks.** Each check's `arbitraryConstraint` annotation (bounds, lengths,
  patterns, order) merges into the node's generation constraint, which the base
  generator consumes. Every `Filter` check then runs on each generated value
  and discards failures. Generation therefore never yields a value that fails a
  check ✅, but heavy rejection exhausts the run (`maxDiscards` defaults to
  `max(100, 10 × runs)`).
- **Strings with patterns.** A regexp generator (`internal/arbitrary/regexp.ts`)
  builds matching strings. When several patterns merge, each value uses one of
  them and the filters enforce the rest. Patterns with the `i`, `m`, or `v`
  flag are ignored for generation, which falls back to unpatterned strings.
  - Without the `u` flag, character classes are restricted to the BMP: no
    astral characters ever appear ✅.
  - With the `u` flag, classes span every code point, so astral characters
    appear ✅.
  - Either way the generator never emits a lone surrogate ✅, and preferred
    code points (printable ASCII, tab through carriage return, NUL, U+0080,
    `é`, `Ω`, `😀`, each only when the class allows it) are picked with
    probability `1 / biasFactor`, where
    `biasFactor = 2 + floor(log10(attempt + 1))`.
- **Strings without patterns.** Printable ASCII (U+0020–U+007E), plus an edge
  case corpus picked with probability `1 / biasFactor`: `""`, whitespace,
  `"\0"`, numeric strings, `"__proto__"`-style keys, the lone surrogates
  `"\uD800"` and `"\uDC00"`, and `"😀"` ✅.
- **Integers.** With both bounds given, the whole range is reachable ✅.
- **Unions.** Members are chosen uniformly ✅. There is no weighted choice:
  Effect's design notes say to use a Schema union for static choice, and to
  write a focused property whose input already contains a rare situation
  instead of weighting generation toward it ("Use Schema Union for Static
  Choice", "Prefer Targeted Scenarios to Weighted Choice" in
  `packages/effect/ARBITRARY.md` at the `effect@4.0.0-rc.117` tag).
- **Declarations** (classes, `Option`, …). Effect looks for a generatable
  representation in this order: a `toCodecArbitrary` annotation (which returns
  a `SchemaAST.Link`), a built-in representation (`BigDecimal`, `Date`, `URL`,
  `RegExp`, `Json`, `ReadonlyMap`, `ReadonlySet`, `Uint8Array`, …), then the
  declaration's `toCodecJson` or `toCodec` link. The link's source is
  generated, converted through the link, and re-validated against the
  declaration. A class therefore generates its fields struct, including
  struct-level checks, and constructs through its constructor. `Option` links
  to a union of `Some`/`None` structs, so about half the values are `None` ✅.
- **Failure mode.** `Arbitrary.schema` compiles immediately and throws when it
  cannot support a schema, rather than returning a generator that fails later.
- **Size.** `checkEffect` grows the size from 0 to `size` (default 10) across
  its runs (default 100); `sampleEffect` uses a fixed size (default 10) and
  count (default 10). Size scales unconstrained string, collection, and object
  lengths; explicit schema bounds still apply.

## Customization points

| Point | Where it attaches | Semantics |
| --- | --- | --- |
| `arbitraryConstraint` | a check's annotations; built-ins such as `isPattern` and `isBetween` set it | refines the base generator; the check still filters |
| `toCodecArbitrary` | a declaration's annotations | returns a `Link` from a generatable schema; generated values are decoded and re-validated |
| `Arbitrary.map`, `filter`, `filterMap`, `flatMap`, `all`, `array`, `Constant` | loose `Arbitrary` values | composition outside schemas; it does not flow through schema derivation |

There is no weighted candidate source and no derivation report.

## Practice in this repo

- Canonical path models encode all invariants on their Type side, so
  `Arbitrary.schema(Model)` is valid by construction. `FileName` needed the
  most: its fields are a `Stem` and a `FinalExtension` (an `Extension`
  without a further dot), and a struct check admits only the canonical split of
  a valid name. `Extension` gained the well-formed Unicode check every other
  path text schema already had.
- Path text patterns carry the `u` flag so generation covers astral text. For
  these classes (`[^/\0]`) the flag does not change what validation accepts.
- Relative ascent generates across its whole valid range 0..4096, so laws meet
  the ceiling. Operations that can cross it are defined for it: `join` and
  `RelDir.parent` saturate at 4096, and `Rel.relativeTo` returns `None`.

Measured on the path models (3 seeds × 3000 samples per model, every sample
valid and round-tripping through decode∘encode, 2026-09-23 ✅):

- non-ASCII text: 81–99% of encoded values, depending on the model;
- control characters: 4–23%;
- astral characters: 57–93%;
- discards under `checkEffect`: at most 0.5%.

Distribution notes that matter for law strength:

- Relative ascents land at 8 or below only about 10% of the time, so two
  independently generated relative paths share an ascent about 0.2% of the
  time.
- Dotfiles and stems with inner dots are about 0.1–0.2% of generated names.

A law that needs these regions should build them into its input, as the
`relativeTo(join(base, r), base)` law does, rather than rely on independent
draws. That is the targeted-scenario practice Effect's design notes recommend.

## History: the fast-check bridge

Until effect 4.0.0-rc.113, `Schema.toArbitrary` returned fast-check arbitraries.
Filters carried `arbitrary: { constraint, candidate }` hints (weighted
candidate sources), and nodes could replace their base generator with a
`toArbitrary` annotation. Kitz built `Schema.withArbitraryHints` (hint-carrying
pass-through filters) and `*.Realistic` variant schemas on top.

Effect 4.0.0-rc.113 removed the bridge: "Remove the fast-check bridge from the
`effect` package, including `Schema.toArbitrary` and `effect/testing/FastCheck`.
Replace the legacy `Schema.Annotations.ToArbitrary` callback contract with the
native Schema-first types." Kitz removed `withArbitraryHints`, the `Realistic`
variants, and every generation hook with it. The verified beta-era semantics
are in this file as of commit `e5f141c6`.

## Re-verification probes

Run from `packages/effect/` with `node --input-type=module -e "..."`:

```js
import { Effect, Schema as S } from 'effect'
import { Arbitrary } from 'effect/unstable/arbitrary'

const sample = (schema) =>
  Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 3000, seed: 1 }))
const share = (values, predicate) => values.filter(predicate).length / values.length
const astral = (s) => [...s].some((c) => c.codePointAt(0) > 0xffff)

// Patterns without `u` stay in the BMP; with `u` they reach astral code points.
console.log('astral without u ~0:', share(sample(S.String.check(S.isPattern(/^[^/\0]+$/))), astral))
console.log('astral with u > 0.5:', share(sample(S.String.check(S.isPattern(/^[^/\0]+$/u))), astral))

// Filters reject; they never repair.
const even = sample(S.Int.check(S.makeFilter((n) => n % 2 === 0)))
console.log('filter respected:', even.every((n) => n % 2 === 0))

// Union members are chosen uniformly.
const union = sample(S.Union([S.Literal('a'), S.Literal('b')]))
console.log('union ~0.5:', share(union, (x) => x === 'a'))
```

Expected: `astral without u ~0` ≈ 0, `astral with u > 0.5` above 0.5,
`filter respected: true`, and `union ~0.5` ≈ 0.5.
