# Path work queue

Living tracker for OPEN threads on the path module. One section per item; each
carries status, context links, the open question, and the current
recommendation. Done items are deleted outright — their decisions live in the
`packages/effect/CONTRIBUTING.md` ledger and git history; reports live in
`docs/superpowers/reports/`.

Statuses: `design-open` (needs a decision), `decided` (awaiting
implementation), `mechanical` (spec-able now), `parked` (explicitly deferred).

## 1. Literal duality across path APIs — `mechanical`

Shipped:

- `6d9d6914` — `Path.fromLiteral` and per-model `.fromLiteral` became
  `Path.mk` / `Model.mk`; plain `string` is rejected at the parameter as a
  `StaticError`, so mk is total.
- `c9c713de` — rung 1, literal duality on `isWithin`; established the inference
  and error-shaping recipe across data-first/data-last calls.
- `39d7eaf0` — rung 2, literal duality on `ensureAbs`; proved that literal
  normalization composes with a variant-computed return without losing
  precision.

Proven recipe for the `join` rung and subsequent rollout:

- Use one inline generic signature per dual form. Do not use overload matrices:
  TypeScript's last-overload diagnostic points at the wrong argument for mixed
  literal/value failures.
- Keep signature scaffolding inline; share only the parser and its existing
  `LiteralInput` / `LiteralGuard` / `ErrorPathValidation` machinery.
- Normalize each literal generic through `FromLiteral<S>` before feeding it to
  an existing computed-return type. Normalizing later violates the computation's
  value constraint; `Extract<S, Value>` instead erases literal inputs to `never`.
- Classify directory literals strictly with `FromLiteral<S> extends DirTarget`.
  Do not use a target `LiteralGuard<S, AbsDir | RelDir>` for operation positions:
  target constructors intentionally allow file-shaped text to be interpreted as
  an explicitly requested directory.
- `Fn.dual` needs no special literal handling. The public inline signature carries
  both the outer and returned-function inference; runtime still branches only on
  arity and normalizes literal arguments through the same `Any` decode channel as
  `Path.mk`.
- Conformance is mechanical: desugar-law checks for every literal position and
  both dual forms, precise acceptance cells for every literal/value mix, and
  parameter-local `StaticError` rejection cells for runtime strings, invalid
  literals, wrong variants, and group mismatches.

Rung 3 is `join`: variadic data-first parts plus binary data-last form. Infer one
`const` tuple, validate/map every element in place, normalize the base and each
part before `JoinMany`, and preserve the focused argument diagnostics established
by rungs 1–2.

Evidence: round-1 D2 (604 `join` sites pay decode ceremony:
`Path.join(S.decodeSync(Path.AbsDir)(cwd), Path.mk('./.env'))`), round-2 P1
(`setParts({ name })` takes `FileName`, not string — the obvious user input is
a string because `.name` reads as string). Deferred as Future in the pre-merge
report; both stress rounds independently rank it #1.

The remaining program is kitz-wide literal duality across the bounded context;
partial adoption would leave call-site affordances inconsistent. Runtime strings
stay in explicit Schema decode channels or arrive as already-decoded values.

The per-model `make` overload option remains live-not-rejected for later; the
mk decision only settles the static-literal constructor world.

## 2. `Any`/union decode classification rules — `design-open` (deferred by user 2026-07-09)

Round-1 D3 + round-2 confirmation: `'../lib'` (intended dir) classifies as
RelFile via `Path.Rel`. Needs: a documented rule table in README/JSDoc for
union decode; consider simplifying the heuristic. Target-schema decode
(`Path.RelDir`) already gives intent — the gap is predictability of the union.
The README `Any`-decode rule table (from the docs-callouts batch) lands with
this item.

## 3. Strict-genealogy companion matcher — `design-open` (small; deferred by user 2026-07-09)

`@kitz/vitest` has inclusive `toBeWithinPath` only; strict `isDescendantOf`
test blocks fall back to bare boolean assertions. Name TBD
(`toBeDescendantOfPath`?), then mechanical.

## 4. Peer floor — `mechanical` (deferred by user 2026-07-09)

Heartbeat runs effect beta.78; kitz requires `^4.0.0-beta.85`. Round-1
presence-probed compatible. Widen the floor after a beta.78 CI check, or
document the true minimum.

## 5. `basename(f, suffix)` multi-suffix strip — `design-open` (small; deferred by user 2026-07-09)

`.stem` strips only the last extension; the `basename(f, '.test.ts')` idiom
has no equivalent. Decide: op, recipe docs, or wontfix.

## 6. `path.sep` / `path.posix` sites — `design-open` (small/doc)

30 + 75 sites; heartbeat already POSIX-normalized. `sep`-splitting wants
`.segments` redesign per site — guidance doc, not API.

## Parked

- #287 schema-derived optics engine.
- #288 strict decode mode (Result instead of clamping) — post-stable-core.
- #289 symlink-aware paths / Fs-level resolution — blocked on Fs era.
- Union JSON Schema emission — upstream effect beta.85 gap.
- Instance `.pipe` typing: runtime `pipe` exists on decoded values but the
  type omits it (upstream runtime/type mismatch; top-level `pipe` works;
  user deprioritized). Option: declare `pipe` on value classes; or file
  upstream.
- Instance-method sugar for `setParts` (delegates to statics; deferred).
- Heartbeat full conversion — delegable labor once the design items land.
