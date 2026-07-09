# Path work queue

Living tracker for open threads on the path module. One section per item;
each carries status, context links, the open question, and the current
recommendation. Tackle items here instead of losing them in chat. Reports
referenced live in `docs/superpowers/reports/`.

Statuses: `design-open` (needs a decision), `decided` (awaiting
implementation), `mechanical` (spec-able now), `done` (landed), `parked`
(explicitly deferred).

## 1. commonAncestor totality + locality — `done`

Round-2 stress P1: `commonAncestor('/apps/a.ts', '/libs/l.ts')` → `None`,
though `/` is a real common ancestor and `AbsDir.anchor` now names it.

Done:

- `fc33f225` — `isWithin` recognizes pure-ascent containers; `isDescendantOf`
  keeps strictness by comparing ascent as well as segment length.
- `6a7ed2bb` — `commonAncestor` is total and Option-free on
  `Abs.commonAncestor` / `Rel.commonAncestor`; the flat operation was removed.

Two premise corrections that shape the space:

- Mixed abs/rel is ALREADY a type error in the flat op (`MatchingTypeGroup`),
  so no "weaker mixed form" is needed — the only same-group cases are Abs×Abs
  and Rel×Rel.
- Rel×Rel partiality is CONDITIONAL, not inherent. Under the current
  equal-ascent-only containment semantics, unequal-ascent pairs have no
  recognized common ancestor → `Option` is genuine. But under full tree
  semantics, `(m,xs)` and `(n,ys)` with `m ≠ n` always share the pure-ascent
  dir `(max(m,n), [])` — e.g. `../` contains `./a` (the anchor's parent
  contains the anchor contains `a`). If `isWithin` were extended to recognize
  pure-ascent parents (`within(child, parent) ⇐ parent.segments = [] ∧
  parent.ascent ≥ child.ascent`, alongside the existing equal-ascent prefix
  rule), Rel×Rel `commonAncestor` becomes TOTAL: `m = n` → `(m, commonPrefix)`;
  `m ≠ n` → `(max(m,n), [])`.

Settled decisions:

1. Containment semantics: adopt pure-ascent-parent containment (sound in the
   tree model; makes `isWithin` truthful and `commonAncestor` total for both
   groups; containment laws updated in tests).
2. Locality: statics on the GROUP unions — `Abs.commonAncestor(a, b): AbsDir`
   and `Rel.commonAncestor(a, b): RelDir` — since inputs span file/dir within a
   group, the union schema is the domain-constraining home (same logic as
   `setParts` locality, one level up).
3. Flat `commonAncestor` fate: dropped; group-generic callers narrow first.

## 2. String `Input` polymorphism (Tier-3) — `design-open` (top priority after #1)

The dominant adoption tax. Evidence: round-1 D2 (604 `join` sites pay
decode ceremony: `Path.join(S.decodeSync(Path.AbsDir)(cwd), Path.fromLiteral('./.env'))`),
round-2 P1 (`setParts({ name })` takes `FileName`, not string — the obvious
user input is a string because `.name` reads as string). Deferred as Future in
the pre-merge report; both stress rounds independently rank it #1.

Open questions: which ops accept literal/string inputs (join RHS, setParts
name/stem/extension, ensureAbs base?); literal-vs-runtime-string split
(fromLiteral type-level inference exists for literals — does Input accept
only literals, or runtime strings with a throw/Result channel?); one blessed
boundary-decode helper for dynamic LHS (cwd).

## 3. cwd/`resolve` story — `design-open`

Round-1 D1: 167 `path.resolve` sites; no cwd concept (deferred to the Fs era).
Round-2 confirms (`install-state.ts:367-372` wants "realpath else resolve
against cwd"). Minimal candidate: `Path.cwd(): Effect<AbsDir>` or an Fs-owned
equivalent. Interacts with `ensureAbs` naming (see report round 1) — design
them together.

## 4. `Any`/union decode classification rules — `design-open` (small)

Round-1 D3 + round-2 confirmation: `'../lib'` (intended dir) classifies as
RelFile via `Path.Rel`. Needs: a documented rule table in README/JSDoc for
union decode; consider simplifying the heuristic. Target-schema decode
(`Path.RelDir`) already gives intent — the gap is predictability of the union.

## 5. `fromFileUrl` dir form — `design-open` (small)

Round-2 P2: ESM `new URL('.', import.meta.url)` directory idiom returns the
file/dir union → hand-narrowing at every site. Candidates: `fromDirUrl`, a
target-typed overload, or documenting `S.decodeSync`-style target decode for
URLs. Decide alongside item 2 (same "typed target" flavor).

## 6. Vitest package batch — `mechanical` (one name decision inside)

From the audit report (2026-07-09-vitest-package-audit.md):

- [x] P2: matcher type augmentation resolved as a documented constraint in
  `25948a40`: keep `'vite-plus/test'` because the repo forbids direct
  `vitest`/`@vitest/*` dependencies and Vite+ owns the single Vitest copy.
- [x] P2: `toBeRoot` → `toBeAnchor` (impl already checks `isAnchor`); updated
  messages + the one call site in `25948a40`.
- [x] P2: add a first-party matcher test suite (positive/negative/invalid/message
  branches) in `25948a40`.
- [ ] P3: strict-genealogy companion matcher (name TBD: `toBeDescendantOfPath`?)
  — the only open decision in the batch.
- [x] P3: package README documenting lifecycle (`private`, src exports, dep
  topology vs the ledger row) in `25948a40`.

## 7. Docs callouts batch — `done`

Docs callouts landed in `2aa31465`.

- [x] Native `Map`/`Set` keys miss structural equality — document "use Effect
  HashMap/HashSet or encode a string key" (round-2 P2; PrimaryKey impl already
  supports the Effect side).
- [x] `AbsFile.make`/`RelFile.make` anchor defaults can silently create root
  files — steer application construction toward `join(dir, relFile)` (round-2
  P3).
- [ ] `Any`-decode rule table stays open, blocked on item 4.

## 8. Peer floor — `mechanical`

Heartbeat runs effect beta.78; kitz requires `^4.0.0-beta.85`. Round-1
presence-probed compatible. Widen the floor after a beta.78 CI check, or
document the true minimum.

## 9. Drop dead `@platformatic/vfs` dependency — `done`

Done in `f4034989`: verified no imports under `packages/effect/src` or
`packages/effect/build`, then removed the package dependency, catalog entry,
and lockfile records.

## 10. `basename(f, suffix)` multi-suffix strip — `design-open` (small)

`.stem` strips only the last extension; the `basename(f, '.test.ts')` idiom
has no equivalent. Decide: op, recipe docs, or wontfix.

## 11. `path.sep` / `path.posix` sites — `design-open` (small/doc)

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
- Heartbeat full conversion — delegable labor once items 1–4 land.
- PR merge of `feat/restore-path-operations` — user inclined pre-stress;
  re-confirm after the current queue burns down.
