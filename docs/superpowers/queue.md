# Path work queue

Living tracker for OPEN threads on the path module. One section per item; each
carries status, context links, the open question, and the current
recommendation. Done items are deleted outright — their decisions live in the
`packages/effect/CONTRIBUTING.md` ledger and git history; reports live in
`docs/superpowers/reports/`.

Statuses: `design-open` (needs a decision), `decided` (awaiting
implementation), `mechanical` (spec-able now), `parked` (explicitly deferred).

## 1. Literal duality across path APIs — `design-open`

Shipped:

- `6d9d6914` — `Path.fromLiteral` and per-model `.fromLiteral` became
  `Path.mk` / `Model.mk`; plain `string` is rejected at the parameter as a
  `StaticError`, so mk is total.

The remaining program is kitz-wide literal duality: operation signatures fork
on literal detection across the whole path bounded context, not just at the
entry constructor. Literal inputs get type-level parsing and precise outputs;
runtime strings stay in explicit Schema decode channels or already-decoded
value parameters.

Evidence: round-1 D2 (604 `join` sites pay decode ceremony:
`Path.join(S.decodeSync(Path.AbsDir)(cwd), Path.mk('./.env'))`), round-2 P1
(`setParts({ name })` takes `FileName`, not string — the obvious user input is
a string because `.name` reads as string). Deferred as Future in the pre-merge
report; both stress rounds independently rank it #1.

This must be all-or-nothing within the bounded context: partial literal
overloads would make call-site affordances inconsistent. Spike on `join` first
because it has the largest adoption tax and exercises cross-variant return
inference. Open questions: exact literal/runtime split per operation
(`join` RHS, `setParts` name/stem/extension, `ensureAbs` base), whether any
operation accepts runtime strings through a Result/Effect channel, and how far
the god `Path.mk` parser utility should be reused internally.

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
