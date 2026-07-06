# Path Module — Pre-Merge Forward Analysis

Exhaustive analysis of what to do before merging `feat/restore-path-operations`,
drawing on three sources: (1) the pre-reset rich implementation at
`@kitz/fs@1d9ac141` (restored verbatim by `7c06c037`, then reworked on this
branch), (2) typed-path SOTA from other languages, (3) direct inspection of the
current code and the installed `effect@4.0.0-beta.85`. Scope: POSIX only, per
decision. PR scope is not a factor.

SOTA references used throughout: Python `pathlib.PurePosixPath`, Rust
`std::path::Path`, Haskell `path` (Chris Done — the typed Abs/Rel × File/Dir
ancestor of this design), PureScript `pathy`, Node `path`/`pathe`.

---

## 0. Executive summary — recommended sequencing

| Priority | Item | Area | Status |
| --- | --- | --- | --- |
| Must | Property + type-level test suite (codec laws, op laws) | §5 | Run 3 |
| Must | Curated arbitraries (fixes the unbounded-ascent encode blowup) | §4 | Run 3 |
| Must | Lenient explicit dir decode | §8.4 | ✅ `0f43aa0a` |
| Must | `fileUrl` percent-encoding + `fromFileUrl` | T8, §8.4 | ✅ `fb0dd76c` |
| Must | Reinterpretation getters (`asDir` / `asFile`) | §8.4 | ✅ `c02eee1e` |
| Must | `withExtension` / `withStem` / `withName` file-transform family | §2.1, §8.1 | ✅ `c6b4f81c` |
| Should | Generalize `relativeTo` to same-group Rel×RelDir (subsumes `getRelativeSegments`) | §2.2 | ✅ `0302a3e9` |
| Should | Move `States` predicates onto instances (`.isRoot` etc.) + restore narrowing; add `.depth` | §2.3 | ✅ `497cd35b` |
| Should | `.ancestors` getter | §2.4 | ✅ `0527f161` |
| Must | `toString()` + node inspect on leaves | §2.5, §8.2 | ✅ `15cc7262` |
| Could | `Order` instance | §2.6 | ✅ `412c1019` |
| Could | Variadic `join` | §2.7 | ✅ `68adf7cd` |
| Could | Multi-extension JSDoc pin | §2.8 | ✅ `1ebea54e` |
| Should | JSON Schema + schema annotations | §8.3 | Skipped: beta.85 cannot make tagged unions emit one string schema without dropping `toTaggedUnion` utilities |
| Should | Formatter integration | §8.2 | ✅ `4b4346ed` |
| Should | Tech-debt T1 | §6 | ✅ `ede431cc` |
| Should | Tech-debt T7 | §6 | ✅ `8d1d086c` |
| Could | Tech-debt T10 module docs | §6 | ✅ `bac6e80b` |
| Should | `fromLiteral` with runtime-matching type-level string parsing | §3.1 | ✅ `8a45a34a` |
| Should | Per-target `fromLiteral` constructors with static errors | §3.2 | ✅ `3cef3dd8` |
| Could | Full `Input<P> = P \| string` polymorphic arguments (old trunk's crown jewel) | §3.3 | Future |
| Defer | Glob matching, non-POSIX/URL anchors | §7 | Deferred |

---

## 1. Inventory — current vs old trunk vs SOTA

### 1.1 Current surface (this branch)

- Leaf getters: `.name`, `.stem`, `.extension`, `.dir`, `.parent`, `.atRoot`, `.fileUrl`
- Flat ops (6, all `Fn.dual`): `join`, `relativeTo`, `ensureAbs`, `isDescendantOf`, `isAncestorOf`, `getSharedBase`
- Unions: pure schemas + `toTaggedUnion` utilities (`cases`, `guards`, `isAnyOf`, `match`)
- Instance states: `.isRoot`, `.depth` on all four leaves (`States` deleted by `497cd35b`)
- `Analyzer` (public string parse/format), `Extension`, `Protocol`, constants
  (`absDirRoot`, `relDirCurrent`, `relDirParent`)
- Zero tests anywhere in the package.

### 1.2 What the old trunk (`@kitz/fs@1d9ac141`) had that this branch lacks

| Old feature | Status now | Verdict |
| --- | --- | --- |
| `Input<P> = P \| string` on every op, with type-level literal validation (`Guard<>`, `ErrorStringNotLiteral`, `ErrorPathValidation` static errors) | gone | §3 — the single biggest DX differentiator the project has already proven out |
| `fromLiteral` / `fromString` with type-level analyzer (`Analyzer.Analyze<$input>` infers `AbsFile` from `'/x/y.txt'`) | gone | §3 |
| Per-type `fromString` constructors (`RelFile.fromString('./.gitignore')` beats inference limits) | gone | §3.2 |
| `isRoot`/`isTop`/`isSub` as **narrowing** type guards (`path is T & { segments: readonly [] }`) | degraded to booleans | §2.3 |
| Test suite: codec tests, constructor tests, op/relationship tests, snapshot tests, `fromString.test-d.ts` type-level tests | gone | §5 |
| Custom expect matchers (`toBeAbs`, `toBeDir`, `toBeWithinPath`, `toEncodeTo`) | gone | §5.4 |
| `toString` convenience op | gone (only `S.encodeSync(Schema)`) | §2.5 |
| Named data-last variants (`isDescendantOfPath`, …) | subsumed by `Fn.dual` | correctly dropped |
| `equivalence` op | subsumed by structural `Equal.equals` | correctly dropped |
| `isSameSegments` | deliberately cut this branch | correctly dropped |

### 1.3 SOTA op-gap matrix (POSIX-relevant only)

| Operation | pathlib | Rust | Haskell `path` | Here | Gap? |
| --- | --- | --- | --- | --- | --- |
| join typed | `/` | `join` | `</>` (typed!) | `join` (typed) | — |
| parent | `.parent` | `parent()` | `parent` | `.parent` | — |
| parents/ancestors chain | `.parents` | `ancestors()` | manual | — | §2.4 |
| name / stem / extension | `name`/`stem`/`suffix` | `file_name`/`file_stem`/`extension` | `filename`/`fileExtension` | ✓ | — |
| multi-extension | `.suffixes` | `file_prefix` | `splitExtension` chains | — | §2.8 |
| replace name/stem/ext | `with_name`/`with_stem`/`with_suffix` | `with_file_name`/`with_extension` | `replaceExtension`/`addExtension` | **none** | §2.1 — biggest op gap |
| relative-to | `relative_to(walk_up=)` | `strip_prefix` | `stripProperPrefix` | `relativeTo` (Abs only) + `getRelativeSegments` (segments, not a path) | §2.2 |
| is-descendant | `is_relative_to` | `starts_with` | `isProperPrefixOf` | ✓ | — |
| depth | `len(parts)` | `components().count()` | — | — | §2.3 |
| ordering | natural `Ord` | `Ord` | `Ord` | only `Equal` | §2.6 |
| display/print | `str()` | `display()` | `toFilePath` | `S.encodeSync` only | §2.5 |
| literal constructors | n/a | n/a | `mkAbsFile` (TH = compile-time parse) | old trunk had it | §3 |
| glob match | `match`/`full_match` | — | — | — | §7, defer |

---

## 2. Operations — missing ops and improvements

### 2.1 The `with*` transform family (biggest op gap)

No way today to change a file's extension, stem, or name without hand-rolling
`make` from fields. Every SOTA library has this. All are unary-with-parameter →
by the organizing principle they are **flat `Fn.dual` ops** (they take a second
argument), not getters:

- `withExtension(file, ext: Extension | Option<Extension>)` → same file variant.
  `Option.none()` drops the extension (pathlib `with_suffix('')`).
- `withStem(file, stem: string)` → same variant.
- `withName(file, name: FileName | string-decoded)` → same variant. Doubles as
  pathlib's `with_name` (sibling file).
- `addExtension(file, ext)` → appends (`archive.tar` + `.gz` → `archive.tar.gz`);
  Haskell `addExtension`. Distinct from `withExtension` which replaces.
- Type-level: preserve the variant — `<F extends File>(f: F, …) => F` — trivial
  since these never change abs/rel or file/dir nature. No conditional types needed.
- Dir counterpart: `withName(dir, segment)` renames the last segment (pathlib
  `with_name` works on dirs too). Option-returning or root-total — decide;
  recommend total-on-root-no-op is wrong here, prefer `Option` (renaming root is
  meaningless, unlike `.parent` chaining there is no ergonomic chain to poison).

### 2.2 Generalize `relativeTo`; retire `getRelativeSegments`

- Current `relativeTo: Abs × AbsDir → Rel` walks up with ascent. The rel-side
  story is split across `getRelativeSegments` (descendant-only, returns naked
  segments — even after typing them, a *path* op returning a segment array is a
  model leak) and `getSharedBase`.
- The math generalizes for same-anchor relative paths, with one non-expressible
  case. `relativeTo(target: Rel, base: RelDir)` returns `Option.none()` exactly
  when `target.ascent < base.ascent`: joining from a relative base can keep or
  increase ascent, but cannot move to a shallower unknown anchor without names
  the model does not have. Equal ascent uses the shared known segment prefix.
  Greater target ascent walks out of every base segment and then up the ascent
  difference. Verified by randomized script before `0302a3e9`:
  `join(base, relativeTo(p, base)) ≡ p` for all abs pairs and every successful
  rel×rel pair; rel×rel returns `None` for the impossible shallower-ascent case.
- End state: one `relativeTo` op; abs×abs stays total and rel×rel returns
  `Option<Rel-variant-of-A>` for the non-expressible shallower-ascent case.
  `getRelativeSegments` is deleted (consumers who want the segments take
  `.segments` off the returned Rel when the result is present). Rust
  `strip_prefix` returns a path, not components, for the same reason.

### 2.3 `States` violate the organizing principle; narrowing regressed

- `isRoot`/`isTop`/`isSub` are unary (take only the path) → per the arity rule
  they belong on instances: `path.isRoot`, `path.isTop`, `path.isSub` (or drop
  isTop/isSub — see below). The `States` namespace is a fossil of the pre-
  principle layout.
- Old trunk narrowed: `isTop(p): p is T & { segments: readonly [string] }`.
  Current booleans narrow nothing. Getters can't narrow `this` — so either keep
  these three as flat narrowing guards (argument: they're *type guards*, a
  schema-adjacent concern like `is`) or accept boolean getters. Recommendation:
  `.isRoot` boolean getter (commonly chained), and **delete** `isTop`/`isSub` —
  both are `depth === 1` / `depth > 1` sugar with near-zero call-site value once
  `.depth` exists.
- Add `.depth` getter: `segments.length` (files: directory depth, excludes the
  filename — document). For rels, ascent complicates "depth"; either document
  depth = segment count only, or expose signed depth `segments.length − ascent`.
  Recommend plain segment count + the docs note.

### 2.4 `.ancestors` getter

- Rust `ancestors()` / pathlib `.parents`. With `.parent` total at root, naive
  `while` loops over `.parent` never terminate on abs paths (root fixpoint) and
  never terminate on rels (ascent grows forever) — an attractive-nuisance
  footgun that an explicit `ancestors` neutralizes.
- Semantics: abs → chain up to and including root (`/a/b/` → `[/a/, /]`);
  rel → chain of segment-drops down to the anchor (`./a/b/` → `[./a/, ./]`),
  **not** past it (no infinite `../` chain). Files start at `.dir`.
- Typed: `AbsFile.ancestors: readonly AbsDir[]`, `RelDir.ancestors: readonly RelDir[]`, etc.
  Unary → getter, per the principle.

### 2.5 `toString()` + node inspect on leaves (debugging DX)

- Today printing a path in a log means `S.encodeSync(Path.AbsFile)(p)` — the
  old trunk had `Path.toString`. Better than both: override `toString()` on the
  four leaves (delegating to the same `format` call the codecs use — mirror of
  `fileUrlOf`) plus `[Symbol.for('nodejs.util.inspect.custom')]` so
  `console.log(path)` prints `AbsFile(/home/user/file.txt)` instead of a field
  dump. Template-literal interpolation (`` `${path}` ``) then works everywhere.
- These are unary → instance members; `toString` is a method by JS contract
  (not a getter) — a deliberate, documented exception to getters-throughout.
- Verify `S.TaggedClass` doesn't already claim `toString` in beta.85 before
  overriding (it carries `Equal`/`Hash`; inspectability unverified).

### 2.6 `Order` instance

- Rust/Haskell paths are `Ord`; pathlib sorts naturally. Deterministic ordering
  matters for stable dir listings, snapshot tests, and set-like operations.
- Ship `Path.order: Order.Order<Any>`: compare group (abs < rel), then ascent,
  then segments lexicographically, then dir-before-file, then fileName.
  Trivial to property-test (total order laws).

### 2.7 Variadic / chainable `join`

- pathlib joins many parts at once. `join(dir, rel1, rel2)` = reduce; cheap
  overload, real call-site win for deep construction. Keep the binary dual as
  the core; add a rest-args data-first overload only.

### 2.8 Multi-extension awareness (decide, then document)

- Current split matches pathlib exactly: `archive.tar.gz` → stem `archive.tar`,
  extension `.gz`. Rust adds `file_prefix` (`archive`). pathlib adds `.suffixes`
  (`['.tar', '.gz']`).
- Cheap additions if wanted: `.extensions: readonly Extension[]` getter and/or
  `.stemBase: string`. Low priority; the current single-split is defensible —
  but write the property test pinning the `archive.tar.gz` behavior either way.

### 2.9 Currying / FP review (what's already right, what to adjust)

- All 7 flat ops use `Fn.dual` with correct pipe-subject data-last forms — no
  gaps found. The old repo's hand-named curried variants are correctly subsumed.
- `ensureAbs` and `join` now dispatch via `Match.tagsExhaustive`; no remaining
  `as` casts in operators (checked). The only production casts left are
  T1/T2/T3 below.
- Getters are not pipeable by nature; that is the accepted trade of the
  organizing principle (use `.map(p => p.name)` at call sites). Do **not** add
  parallel flat duplicates of getters — one way per operation.
- Consider `Path.decode` / `Path.decodeSync` sugar re-exports only if §3's
  `fromLiteral` doesn't land; otherwise `fromLiteral` covers the edge-decode
  ergonomics.

---

## 3. Literal & input ergonomics (the old trunk's crown jewel)

The old implementation let every op take `Path | string`, validating string
*literals* at the type level via a type-level analyzer
(`Analyzer.Analyze<'/x/y.txt'>` → `AbsFile`), with rich static errors
(`ErrorStringNotLiteral`, `ErrorPathValidation` with per-variant hints). It was
fully working, with type-level tests (`fromString.test-d.ts`).

Three adoption tiers, independent:

### 3.1 Tier 1 — `fromLiteral` (recommended now)

- One function: `fromLiteral<const S extends string>(s: S): normalize<S>` —
  decode with the concrete variant type inferred from the literal shape.
  `fromLiteral('/home/u/f.txt') : AbsFile`, `fromLiteral('./src/') : RelDir`.
- Requires porting the type-level analyzer shape (`analyzer.types.ts` from
  `1d9ac141:packages/fs/src/path-analyzer/codec-string/`) while replacing the
  old extension heuristic with this branch's current union-decode behavior:
  dotfiles such as `./.gitignore` infer as files, not dirs.
- Non-literal `string` input degrades to the `Any` union — same function
  handles both.

### 3.2 Tier 2 — per-variant literal constructors

- `AbsFile.fromLiteral('/x/y.txt')`, `RelFile.fromLiteral('./.gitignore')` —
  target type is explicit so no shape inference needed; the type-level check is
  a `Guard<>` that rejects mismatched literals with a static error at the call
  site instead of a runtime throw. Old trunk had exactly this.
- Attach via `withStatics` (extend it beyond `is`) or per-class statics.

### 3.3 Tier 3 — `Input<P>` polymorphism on ops (defer, decide consciously)

- Old trunk: every op accepted `Input<AbsDir>` etc., normalizing internally.
  Maximal ergonomics (`join(dir, './src/index.ts')`), but: every op's
  implementation grows a normalize step; error surfaces move into type-land
  (needs the `StaticError` machinery the old repo took from `@kitz/core`'s
  `Ts.Err`, which no longer exists here — would need a local port); and the
  signature complexity interacts with the `Fn.dual` overloads.
- Recommendation: land Tiers 1–2 first; only extend to op arguments if literal
  call sites dominate in real consumers. The tiers compose — nothing is wasted.
- Run 2 landed Tiers 1–2; Tier 3 remains future.

---

## 4. Arbitraries

### 4.1 Empirical status (verified against the built package)

- `S.toArbitrary` (beta.85; memoized, `{ report: true }` diagnostics available)
  **derives successfully for all four leaves and the unions** — the
  `decodeTo`-transform class dance does not block derivation, and Segment's
  regex filter produces valid gnarly segments (spaces, quotes, backticks — all
  legal POSIX).
- **Found bug-class: generated `Rel*` values can be un-encodable.**
  `ascent` is an unbounded `NaturalInt`; fast-check produces huge integers, and
  `format`'s `'../'.repeat(ascent)` throws `RangeError: Invalid string length`.
  Sampled `RelDir` failed to encode 3/3 times; `Any` intermittently.
  This is simultaneously (a) an arbitrary-tuning need and (b) a documented
  model fact: encode is partial in the extreme (a legal value of `ascent ≈ 1e9`
  implies a multi-GB string). Bound the *arbitrary*, not the model.

### 4.2 Plan

- Add `path/testing.ts` (exported as `Path.Testing` or from a package `/testing`
  subpath — decide against the package's export conventions): curated
  arbitraries for `Segment`, `FileName`, each leaf, `Any`, built on
  `S.toArbitrary` for the field types but overriding: `ascent` ∈ [0, 8],
  segment count ∈ [0, 6], segment length ≤ 32. Realistic-name weighting
  (letters/dots/dashes) alongside the raw-schema generator — keep a small
  percentage of fully-wild segments for stress.
- Alternative mechanism: attach arbitrary constraints as schema *annotations*
  on the models themselves (v4 supports arbitrary metadata on checks) so plain
  `S.toArbitrary(Path.Any)` is well-behaved for every consumer, not just our
  tests. Preferable if it works — consumers get good generators for free; the
  curated module then shrinks to the realistic-name distributions. Needs a
  spike against beta.85's annotation API.
- Run `S.toArbitrary(schema, { report: true })` once in the test suite and
  assert no `OpaqueFilter` warnings — catches silent filter-only derivations
  (which degrade to generate-and-reject).

---

## 5. Testing (value + type, fast-check based)

Package has **zero test files** — this is the largest single gap before merge.
Infrastructure exists and is verified: `vite-plus/test` (vitest), fast-check
re-exported at `effect/testing` (`FastCheck`), `S.toArbitrary`, and
`effect/testing/TestSchema` (`Asserts`/`Decoding`/`Encoding` helpers), plus the
Effect-`Equal`-aware expect tester already registered in `vitest.setup.ts`.

### 5.1 Codec laws (per leaf + per union)

- decode ∘ encode = id (roundtrip from arbitrary *values*)
- encode ∘ decode = canonicalize (idempotent on already-canonical strings;
  snapshot a table of gnarly inputs: `'a/../b'`, `'./x/./y/'`, `'//'`, `'.'`,
  `'..'`, `''`, `'./.env.local'`, `'/a/b'` no-trailing-slash dir/file ambiguity)
- union decode picks the right variant (string → `_tag` table)
- `Equal.equals` ⇔ encoded-string equality (the canonicalization guarantee from
  `5df885ec` — this is THE regression test the FileName fix deserved)

### 5.2 Operation laws (property tests, using §4 arbitraries)

- `join(base, relativeTo(p, base)) ≡ p` (inverse law; extend to rel×rel when §2.2 lands)
- `relativeTo(join(base, r), base) ≡ r` (other direction, ascent-0 `r`)
- `isDescendantOf(join(d, r), d)` for ascent-0 non-empty `r`; `isAncestorOf(a, b) ≡ isDescendantOf(b, a)`
- `getSharedBase` symmetric; result `isAncestorOf` both inputs; agrees with `isDescendantOf` (cross-API consistency per the repo's test-correctness rule)
- `ensureAbs` idempotent; `ensureAbs(abs, b) === abs` (reference-preserving pass-through)
- `.parent` totality: `root.parent ≡ root`; rel: segment-less parent increments ascent by exactly 1
- `.dir`/`.name`/`.stem`/`.extension` consistency: `file.name === stem + extension`; `file.dir.isAncestorOf`-ish containment; `atRoot` strips ascent and preserves segments/fileName
- `.fileUrl` roundtrip vs `new URL(...).pathname` decode — this property FAILS today (verified): `%` in a segment yields a URI-malformed pathname; `?`/`#` silently truncate into query/fragment. It is the regression test for the confirmed T8 bug.
- union utilities: `Any.match` arm-hit equals `_tag`; `guards` agree with `S.is`

### 5.3 Type-level tests (`*.test-d.ts`)

- Getter return types per leaf (the spec's table, mechanically asserted)
- Union member availability: `File.stem` exists; `Any` has **no** `.stem`; `Dir.name: Option<Segment>`; `Any.parent` variant-preserving
- `Join<AbsDir, RelFile> = AbsFile` (all 4 cells), `RelativeTo`, `EnsureAbs` mappings
- Dual forms: data-first and data-last overloads infer identically
- If §3 lands: the old `fromString.test-d.ts` ports nearly verbatim
- Mechanics: vitest ships `expectTypeOf`; confirm `vite-plus/test` re-exports it
  (unverified) — otherwise use bare type-level assertion helpers in-file.

### 5.4 Matchers (optional DX)

- Port the old custom matchers to vitest `expect.extend`: `toBeAbs`, `toBeRel`,
  `toBeFile`, `toBeDir`, `toBeRoot`, `toBeWithinPath`, `toEncodeTo` — the old
  file is a direct template (`1d9ac141:packages/fs/src/path/_.test-matchers.ts`).

Note: per standing instruction, test files are owner-written; this section is
the specification to execute once you green-light who writes them.

---

## 6. Tech debt (itemized, current code)

| # | Item | Location | Fix |
| --- | --- | --- | --- |
| T1 | `full.slice(dot) as Extension.Extension` — cast bypasses the Extension schema on the decode path | `models/FileName.ts:56` | validate via `S.decodeSync(Extension)`/make, or prove the analyzer guarantees the invariant and document why the cast is safe |
| T2 | `Object.assign(...) as Self & Guard<Self>` | `core/statics.ts:22` | acceptable (documented); revisit only if `withStatics` grows (e.g. Tier-2 literal constructors) |
| T3 | `analysis as Extract<Analysis, { _tag: K }>` | `analyzer.ts:174` | acceptable narrow; a `Match`-based refactor removes it if analyzer is touched anyway |
| T4 | Duplication: union member statics (`Any.AbsFile`) now coexist with `toTaggedUnion`'s `Any.cases.AbsFile` | all 5 union models | decide one canonical access path; recommendation: keep the statics (namespace ergonomics: `Path.Any.AbsFile`), treat `cases` as the tagged-union utility it is — but write the decision down |
| T5 | `States` namespace violates the arity principle; lost old narrowing | `states.ts` | §2.3 |
| T6 | `getRelativeSegments` returns a segment array — model leak | `operators/getRelativeSegments.ts` | §2.2 |
| T7 | `Protocol` is public surface (`Path.Protocol`) but exists solely to render `file://` | `models/Protocol.ts` | either document as intentional URL-interop seam (§7) or fold into `core/fileUrl.ts` and unexport |
| T8 | **Confirmed bug**: `fileUrlOf` does no percent-encoding. Verified against the built package: spaces auto-escape fine, but `/x/100%.txt` yields a URI-malformed pathname, and `?`/`#` in a filename **silently truncate** the URL (`/q/a?b.txt` → pathname `/q/a`, remainder shunted to query/fragment — data loss) | `core/fileUrl.ts` | percent-encode each segment (`encodeURIComponent`, then un-escape the chars `file:` paths permit) before URL construction; add the §5.2 roundtrip property as the regression test |
| T9 | `Segment` type is an unbranded `string` alias — semantic only, no nominal enforcement | `models/segment.ts` | open decision (no branding precedent in package); branding would make T1-class bugs unrepresentable |
| T10 | No module-level docs/README for the path module; the organizing principle lives only in the spec | `path/__.ts` | add a module JSDoc header summarizing the three-tier principle + link to spec |
| T11 | Zero runtime tests (tracked as §5, listed here for completeness) | — | §5 |

---

## 7. Beyond POSIX / URL interop (observation only, per scope decision)

- The decoded model (`ascent` + `segments` + `fileName`) is already
  anchor-agnostic; every POSIX-ism lives in exactly two string-boundary spots:
  `analyzer.ts` (parse/format, `/` separator, `.`/`..` tokens) and
  `core/fileUrl.ts`. That concentration is the extensibility story: a future
  dialect (URL path, Windows) is a second analyzer/format pair over the same
  model — no model or operator changes.
- URL pathnames are already POSIX-shaped (RFC 3986 path segments use `/` and
  dot-segments), so `S.decodeSync(Path.Any)(new URL(u).pathname)` mostly works
  today modulo percent-decoding (T8's mirror image).
- Recommendation: do nothing now except (a) keep the analyzer as the *only*
  string boundary (already true — preserve it), and (b) resolve T8 so the one
  existing interop point (`.fileUrl`) is actually correct.

---

## 8. Effect-citizen integrations (all verified against `effect@4.0.0-beta.85`)

### 8.1 `effect/Optic` — yes, v4 ships a core optics module

- Surface: `Iso`/`Lens`/`Prism`/`Optional`/`Traversal`, constructors
  (`makeLens(get, replace)`, `makePrism`, `makeIso`, `fromChecks` — Prism from
  schema checks), composition via `.compose` / `.key(…)` / `.modify(f)`,
  prebuilt `Optic.some()` / `Optic.success()` prisms. No automatic
  Schema→Optic derivation observed — optics are hand-built.
- What Path ships (`Path.Optic` or `path/optic.ts`):
  - Lenses per file leaf: `fileName`, `stem`, `extension` (as
    `Optional` composed through `Optic.some()`), `segments`.
  - Prisms for union variants: `absFile: Prism<Any, AbsFile>` etc., built from
    the existing `is` guards via `makePrism`.
  - Convergence with §2.1: the `with*` family IS these lenses —
    `withStem = stemLens.replace`, `withExtension` the `Optional` replace.
    Implement `with*` on the lenses and export both; consumers then compose
    path-optics into larger app-state optics
    (`configLens.key('cacheDir').compose(…)`).
  - Caveat to verify at implementation time: `.key()` composition over class
    instances may rebuild plain objects (dropping the TaggedClass prototype and
    with it `Equal`); prefer `makeLens` with explicit `Leaf.make` in `replace`.

### 8.2 Trait/interface implementations

| Trait | Status | Action |
| --- | --- | --- |
| `Equal` + `Hash` | ✓ structural via `S.TaggedClass` (verified by the Equal-tester setup + canonicalization work) | — |
| `Pipeable` | ✓ instances already have `.pipe` (verified) | document; pairs with dual ops: `p.pipe(Path.ensureAbs(base))` |
| `toString` | present but prints a JSON field dump (`AbsFile({"_tag":…})`) | override to the encoded path string (report §2.5) |
| `Inspectable` (`toJSON` + `NodeInspectSymbol`) | ✗ absent (verified) | implement on leaves: `toJSON` → encoded string; inspect → `AbsFile(/home/u/f.txt)` |
| `PrimaryKey` | ✗ absent (verified) | implement (encoded string) — makes paths first-class keys for `Request`, `RcMap`, caches |
| `Order` / `Equivalence` | ✗ none exported | §2.6 `Path.order`; `Equivalence` is `Equal.equals` (documented) |
| `Formatter` | not attached | `Schema.overrideToFormatter` so schema issues/formatters print paths as strings, not field dumps |

### 8.3 Ecosystem integration points

- __`Config` — works today, zero code__ (verified):
  `Config.schema(Path.AbsDir, 'CACHE_DIR')` decodes an env var to a typed
  `AbsDir`. Document it and pin with a test — typed path config is a headline
  consumer feature the models already earn.
- __JSON Schema — broken today__ (verified):
  `Schema.toJsonSchemaDocument(Path.AbsFile)` emits an **empty schema** `{}` —
  the `decodeTo` transform erases the string side, so OpenAPI/JSON-Schema
  consumers see "anything" instead of `{ type: 'string', pattern, examples }`.
  Fix: annotate the codec classes (identifier, title, description, examples)
  and attach a string-side representation (checks on the encoded `S.String` or
  a JSON-Schema override annotation — spike the v4 mechanism). Same annotation
  pass improves schema error messages and pairs with §4.2's arbitrary
  annotations — do them together.
  Run 1 update: the installed beta.85 now emits leaf transforms as
  `{ type: 'string' }`, and `Schema.annotateEncoded` preserves leaf title /
  description / examples. Stable leaf identifiers also fix duplicate `$ref`
  definitions in union JSON Schema. However, the five union schemas still emit
  `anyOf` over leaf refs, not a single string schema. Wrapping a union in a
  top-level `S.String.decodeTo(...)` emits a string schema but loses
  `S.toTaggedUnion('_tag')` utilities; applying `S.toTaggedUnion('_tag')` after
  the transform fails because the transform AST has no literal tag. beta.85 has
  no `overrideToJsonSchema` / representation override annotation for this case,
  so the source item was skipped rather than replacing the pure union schemas
  with a custom wrapper.
- __effect's own `Path` module__ (v4) is the *platform service* — string-based
  join/normalize/resolve behind a Context tag with a built-in POSIX layer. Not
  a collision (different layer: strings + Effect env vs typed values + pure
  data). Optional interop later: an adapter layer implementing effect's `Path`
  service on the kitz analyzer, and/or documented conversions at the boundary.
  No action needed pre-merge beyond a docs note disambiguating the two.
- Correctly absent: no Effect *service* for kitz Path — it is pure data; the
  effectful side (FileSystem) already lives elsewhere in `@kitz/effect`.

### 8.4 Replacing effect's `Path` service (stated goal) — gap analysis

Goal: kitz Path replaces effect's `Path` service wherever effect uses it, with
kitz FileSystem to follow. Verified findings, ordered by severity:

- __BLOCKER — explicit dir decode rejects the strings the real world produces.__
  Verified: `S.decodeSync(Path.AbsDir)('/releases/v1.2')` and `('/a/file.txt')`
  both FAIL ("Expected a directory path") — the dir codecs require a trailing
  slash even when the target type already resolves the ambiguity. But dir
  strings at the fs boundary almost never carry trailing slashes:
  `process.cwd()`, env vars, CLI args, `readdir` names, other tools' output.
  Every dir-typed API would force consumers to string-munge (`s + '/'`) before
  decode — which is the model failing its own boundary.
  Contrast the file side: `S.decodeSync(Path.AbsFile)('/etc/hostname')` and
  `('/u/.gitignore')` both work (extensionless, dotfile — stem/extension split
  correct), because the explicit target is allowed to resolve what the string
  leaves ambiguous. Fix: make explicit-target dir decode symmetrically lenient —
  strictness (trailing-slash disambiguation) belongs ONLY to the `Any`/union
  decode where nothing else can break the tie. Canonical *encode* keeps the
  trailing slash regardless.
- __The union heuristic must not be the fs layer's type source.__ Current `Any`
  heuristic (verified): trailing slash → dir, otherwise → file (`/etc/hostname`,
  `/home/u/.config`, `/releases/v1.2` all decode `AbsFile`). Fine as a
  documented convention for literals/config — but file-vs-dir truth at the fs
  boundary comes from `stat`/`dirent`, so kitz FileSystem must construct typed
  paths from that metadata, never by re-inferring from string shape. This is
  where the typed model beats effect's string service — but only if the
  construction path exists cheaply, which needs:
- __Missing reinterpretation ops__: `dir.asFile` (last segment becomes the
  `FileName`) and `file.asDir` (fileName folds back into segments) — required
  to flip a value when `stat` contradicts the assumed variant, without
  re-encoding through strings. Unary → getters per the principle.
- __Service parity gaps__ (vs the verified `Path` service surface: `sep`,
  `basename(path, suffix?)`, `dirname`, `extname`, `format`, `fromFileUrl`,
  `isAbsolute`, `join(...)`, `normalize`, `parse`, `relative`, `resolve(...)`,
  `toFileUrl`, `toNamespacedPath`):
  - `fromFileUrl` — missing entirely; the inverse of `.fileUrl`, and both
    directions depend on fixing T8 (percent-encoding). Must-have.
  - `resolve(...segments)` — effect's is implicitly cwd-relative. Kitz's
    `ensureAbs(path, base)` is deliberately explicit; the replacement needs a
    cwd source (a `Cwd` accessor on kitz FileSystem returning `AbsDir`, or an
    explicit-base convention). Design decision, not code gap — write it down.
  - variadic `join` — already §2.7; the service's join is variadic.
  - covered: `normalize` (canonical decode), `parse`/`format` (Analyzer),
    `basename`/`dirname`/`extname` (`.name`/`.dir`/`.extension`),
    `isAbsolute` (`Abs.is`), `sep` (constant), `toNamespacedPath` (win32-only,
    n/a under POSIX).
- __Accepted consequences to state explicitly__:
  - POSIX-only becomes load-bearing: everything downstream of kitz
    Path/FileSystem forecloses win32 until the §7 dialect seam is exercised.
  - Eager `..` collapse at decode matches `node:path.normalize` but differs
    from `realpath` under symlinks (`/a/link/../b` ≠ `/a/b` when `link` points
    elsewhere) — keep `FileSystem.realPath` as the truth op and document that
    decode-normalization is lexical, not resolved.
  - Per-op typed decode/encode allocates (segment arrays, class instances)
    where effect's service does string concatenation. Unmeasured; add a
    micro-benchmark (deep-tree walk: join/parent/encode loop) before wiring
    kitz FileSystem hot paths.

## 9. What NOT to do (considered and rejected)

- **Flat function duplicates of getters** — violates one-way-per-operation.
- **`endsWith`/path-suffix matching** (Rust) — no motivating consumer; niche.
- **Glob matching** (`pathlib.match`) — needs a glob engine; separate concern,
  likely its own module/package if ever.
- **Bounding `ascent` in the model** — the model is honest; bound the
  arbitraries (§4), document encode partiality at the extreme.
- **Windows/drive support** — out of scope by decision; the §7 seam keeps it
  possible without pre-architecture.
