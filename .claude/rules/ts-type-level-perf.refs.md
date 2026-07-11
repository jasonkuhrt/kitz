# Type-Level Performance — Measurements & Harness

Not auto-loaded; companion to [ts-type-level-perf.md](./ts-type-level-perf.md).

## Provenance

- Compiler: tsgo `7.0.1-rc` (`node_modules/.bin/tsc`), the repo's real toolchain.
- Date: 2026-07-10.
- Method: 3000 distinct input types per variant (unique literal member per
  input to defeat the instantiation cache), separate tsc invocation per file,
  `--noEmit --strict --ignoreConfig --extendedDiagnostics`. Baseline file
  (inputs only, no type applications) subtracted: 34,231 instantiations,
  ~0.09-0.10s check. Instantiation counts are deterministic; check time
  re-run ×3.

## Results

### Lookup table vs conditional chain

| Shape | Chain inst/use | Lookup inst/use | Check time |
|---|---|---|---|
| 4-branch, `_tag` × boolean (lookup needs `` `${bool}` `` key) | **4.0** | 7.0 | wash (~0.09s both) |
| 8-branch, direct string tag | 10.0 | **5.0** | wash (~0.09s both) |

Chain cost scales with match position (later branches pay every miss above
them); lookup is flat. Break-even ≈5 directly-keyable branches.

Counterexample #1 to the folklore ("always prefer lookups"): the shallow /
key-converted shape loses.

### `extends infer` binding vs recomputation

Recursive `Split` of a 5-segment string mentioned 3× in branches vs bound once:

| Variant | inst/use | Check time (×3) |
|---|---|---|
| Recompute ×3 | 124 | 0.111-0.119s |
| Bind via `extends infer` | **73** | 0.112-0.115s |

### Distribution vs tuple-wrap (12-member union)

| Variant | inst/use | Check time (×3) |
|---|---|---|
| Naked param (distributes) | 64 | 0.115-0.130s |
| `[T] extends [X]` (wrapped) | **8** | **0.145-0.149s** |

Counterexample #2: 8× fewer instantiations, ~20% *slower* wall-clock on tsgo.
Instantiations ≠ time. (Plausibly tuple relation checks cost more per-op than
many small cached conditional instantiations — unverified explanation.)

## Round 2 — upstream claims verified (2026-07-11, same method)

Claims mined from ArkType 2.2.3 source (`~/repo-references/arktype`), Effect
v4 source (`~/repo-references/effect-v4-references/effect-smol`, cross-checked
against installed beta.97), and the `@ark/attest` docs referenced by the old
`ts-tooling` skill in dotfiles.

### CONFIRMED on tsgo

**Hand-rebuilt fixed-shape state vs `Omit & patch`** (ArkType
`parser/reduce/static.ts` — every transition re-lists all keys through a
constrained-identity `from<s> = s`):

| Variant (6-key state, 5-step chain, 1000 inputs) | inst/use | per step |
|---|---|---|
| Rebuild, keys listed | **7** | ~1.4 |
| `Omit<S,'a'> & {a: X}` | 49 | ~10 |

**Identical instantiations are cached and free; counter counts real
instantiations only** (validates attest's baseline-caching doctrine):

| 1000 uses of `RecFix<S>` (8-segment recursion) | total inst over baseline |
|---|---|
| Same argument every use | **82** |
| Unique argument every use | 66,016 |

### NOT REPRODUCED on tsgo (their claim, our measurement)

| Claim | Source | Measured on tsgo |
|---|---|---|
| Built-in pattern matches (`Map extends Map<infer,infer>`) cost ~1800+ inst | attest docs | ~12/use vs ~10 for equivalent custom interface (~20% premium). Their number likely includes one-time lib first-touch and/or is TS5. |
| Stored phantom-property views (`S["View"]`) beat re-derivation | Effect `Schema.ts` `this["Rebuild"]` pattern (inference, not their explicit claim) | Re-derive 2/use vs stored-view 7/use for a small 5-key mapped view — stored view LOST. Small mapped re-mentions are cache-deduped. Plausibly still wins at Effect's 15-param `Bottom` scale — unverified. |
| Method-free generic bounds cut call-site cost | Effect `Constraint` vs `Top` (Schema.ts:671, their doc says "avoids the full Bottom protocol") | 1-prop bound 5/use vs 8-method bound 4/use — no win, thin slightly worse. Caveat: concrete types `extends`-inherited the bound; fully structural args untested. |
| Invariant recursive type args preserve cache reuse ("tested, significant repo-wide impact") | ArkType `validate.ts:42-49`, their strongest claim | Threading a unique context param cost +1/use total (101,264 vs 100,264). Root cause: tsgo showed NO cross-parent reuse of shared sub-recursion in this shape (shared 7-segment suffix cost the same as fully unique strings), so there was no cache benefit for invariance to protect. TS5 repo-scale behavior may differ. |

### Upstream techniques inventoried but not (yet) benchmarked

Their claims, kept for future verification — do not apply citing performance
without measuring first (rule 6):

- Effect `BottomLazy` (Schema.ts:276): erase expensive type views to
  `unknown` in the base interface, redeclare per concrete schema — their
  explicit perf claim for wide schemas.
- Effect explicit variance annotations (`out`/`in out`) on every core generic;
  phantom variance markers nested under one symbol key.
- Effect narrow public interfaces (`Schema<T>` 1-param) hiding the 15-param
  `Bottom`; `revealBottom` to opt in.
- ArkType `Extract<U, M>` over distributive conditionals to collapse
  duplicate union branches (attributes.ts:288, "as of TS5.6").
- ArkType spare `undistributed = t` default param to keep the
  pre-distribution union reachable inside a distributive conditional
  (attributes.ts:277).
- ArkType compute-in-type-param-default + `r extends infer _ ? _ : never`
  return to dodge return-type inference (variants/base.ts:487).

### tsgo recursion limits (verified 2026-07-11)

- Tail-recursive conditional types: exactly 1000 iterations — 999 passes,
  1001 → TS2589. tsgo preserves the TS 4.5+ tail-call-elimination limit.
- Recursion through deferred positions (object-property `{ v: … }` nesting)
  passed at 120 without error — deferral resets the depth budget, the
  mechanism behind susisu's `{ __rec }` technique.
- **`& {}` counter-reset — VERIFIED on tsgo, with a new ceiling.** Appending
  `& {}` to the recursive branch every 500 steps (the technique from
  [herringtondarkholme's "Into the Chamber of Secrets"](https://herringtondarkholme.github.io/2023/04/30/typescript-magic/),
  a rewrite of fightingcat's Zhihu original) breaks tail position at the
  reset point and restarts the depth budget: 1001 and 2000 iterations pass
  where plain tail recursion dies at 1001. It has its own ceiling on tsgo —
  5000 → TS2589 — and real cost: 2000 iterations ≈ 2.06M instantiations /
  ~2.0s check (the tuple accumulator's O(n) spread per step makes the fold
  quadratic; the reset doesn't remove that).
- Historical lineage: the 2019 type-level trampoline (`Bounce`/`Trampoline`,
  DefinitelyTyped#34528, mulias/unnatural-ts) targeted the pre-TS4.5 depth-50
  limit with continuation objects; TS4.5 tail-call elimination (limit 1000)
  superseded it for fold shapes, and the depth-reset idea survives as the
  `& {}` counter-reset above and susisu's `{ __rec }` deferral. Nothing in
  this repo's path types approaches these limits (path literals are tens of
  segments, not hundreds).

### attest infrastructure notes (the enforcement endgame)

- attest reads `ts.TypeChecker.getInstantiationCount()` — an undocumented
  tsc internal; tsgo doesn't expose it. The portable method is attest's
  differential-file approach: compile without the expression, compile with
  it, subtract — which is exactly this harness's baseline subtraction via
  `--extendedDiagnostics`.
- CI gate: stored per-bench baselines, `benchPercentThreshold: 20`, hard
  fail on regression, nag-only on improvement (`ark/attest/bench/baseline.ts:46-90`).
- Budgets are version-stamped — several ArkType comments say "as of TS5.6",
  and their measurement path broke across TS 5.5→5.6. Any budget we adopt
  must be stamped with the tsgo version (as this file is).

## Harness recipe

```bash
# 1. Generate: one file per variant + a baseline (inputs only).
#    Inputs must be distinct types (unique literal member) — identical
#    instantiations are cached and cost ~nothing (measured: 82 vs 66,016).
# 2. FORCE evaluation: tsgo skips unused top-level conditional-type aliases
#    entirely (measured: zero instantiations). Use `declare const x: T<...>`
#    or a generic application, never a bare `type X = A extends B ? ... : ...`.
# 3. Measure each file separately:
node_modules/.bin/tsc --noEmit --strict --ignoreConfig --extendedDiagnostics <file>
# 4. Subtract the baseline's Instantiations; divide by N uses.
# 5. Re-run check time ×3; treat <±10% as noise at this scale.
```

Generator scripts from the original session live in the session scratchpad
(`bench*.ts` / the inline `node -e` generators); the shapes are small enough
to regenerate from the tables above.

## Audit of this repo (2026-07-10)

- `path/core/group.ts` — already lookup tables (correct; keyable, would be
  3-4 branch chains otherwise, but no conversion cost and reads better).
- `path/core/literal.ts` `TargetDescription`/`ValidationHint` — 8-deep
  `IsExactly` chains: NOT convertible (type-identity on union schemas is not
  keyable; tag-lookup would distribute and lose exact-union identity) and
  cold-path (instantiated only at already-erroring call sites). Leave.
- `FromLiteralAnalysis` — 4-branch tag×bool: the measured-losing lookup shape. Leave.
- `Join` (join.ts) — 2×2: below threshold. Leave.
- Hot cost is the recursive literal parsers (`Split`, `NormalizeSegments`):
  O(path length) per literal; lookups structurally inapplicable.

## Lint-rule pathway

Each rule is phrased as a syntactic pattern (chain depth + keyable scrutinee;
repeated identical subexpression in branches; tuple-wrap present/absent).
Custom oxlint rules would follow the repo's existing custom-rule structure
(see CONTRIBUTING "Linting (Custom Rules)"). Detection sketch:

- Rule 1: conditional-type chain depth ≥5 where every branch tests
  `{ readonly <k>: <literal> }` on the same property → suggest table.
- Rule 2: identical type-expression AST subtree appearing ≥2× within one
  conditional type → suggest `extends infer` binding.
- Rule 3: informational only — flag `[T] extends [X]` introduced in a diff
  that cites performance (not mechanically detectable; review guidance).
