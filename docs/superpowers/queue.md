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

## 3. cwd story — `done`

Round-1 D1: 167 `path.resolve` sites; no cwd concept (deferred to the Fs era).
Round-2 confirms (`install-state.ts:367-372` wants "realpath else resolve
against cwd"). Interacts with `ensureAbs` naming (see report round 1) — design
them together.

Done:

- `68bf5a02` — `Path.Cwd` is an Effect service whose Shape is the `AbsDir`
  value, with a snapshot process layer and direct `Layer.succeed(Path.Cwd)`
  test override.

Settled decision: **cwd is `Path.Cwd`, an Effect service; the yield ceremony
is a deliberate forcing function.**

- `process.cwd()` is ambient mutable process state (`chdir` mutates mid-run);
  a service puts the dependency in the R channel — visible, mockable (tests
  swap cwd without `chdir`), and Effect-native (an ambient global read is
  exactly the Node-ish design the effect-alignment principle rejects).
- The 167 sites conflate distinct bases (invocation dir, repo root, config
  dir). Deep code should take an explicit `AbsDir` base parameter — the
  service ceremony at the edge forces each site to name its true base.
- NO blessed sync escape in kitz: `process.cwd()` +
  `S.decodeSync(Path.AbsDir)` already exists for the one line at `main()`;
  blessing a sync form would undo the forcing function.
- History evidence FOR this stance: the old fs-loc impl inlined `Pro.cwd()`
  directly inside a pure path operation (`ensureOptionalAbsoluteWithCwd`,
  see `git show 41a2d191^:src/utils/fs-loc/operations/ensure-optional-absolute-with-cwd.ts`)
  — cwd coupling leaked into the pure layer, plus optional-input polymorphism
  on top. The service design exists to prevent exactly that.
- Service home: `Path.Cwd`. Relationship to path ops: callers `yield* Cwd` at
  the edge, then pass the resulting `AbsDir` to pure path operations.

## 4. `Any`/union decode classification rules — `design-open` (deferred by user 2026-07-09)

Round-1 D3 + round-2 confirmation: `'../lib'` (intended dir) classifies as
RelFile via `Path.Rel`. Needs: a documented rule table in README/JSDoc for
union decode; consider simplifying the heuristic. Target-schema decode
(`Path.RelDir`) already gives intent — the gap is predictability of the union.

## 5. File URLs — `done`

Supersedes the narrower "fromFileUrl dir form" item (round-2 P2: the ESM
`new URL('.', import.meta.url)` directory idiom returns the file/dir union →
hand-narrowing at every site). User musing: a thin reified `FileUrl` /
`Url.File.*` extending effect's built-in Url module.

Facts (probed 2026-07-09 against installed effect@4.0.0-beta.85):

- effect has NO stable `Url` module — nothing top-level, `effect/Url` does not
  resolve. Only `effect/unstable/http/Url` exists: immutable helper fns over
  native `URL` (`setHost`/`setPathname`/`mutate`/…), http-flavored, unstable.
  There is no stable foundation to extend.

Done:

- `02c064a2` — `AbsFile.FromUrl` / `AbsDir.FromUrl` target-typed native-URL
  codecs, flat primitive `*.FromStruct` codecs on all four models, and removal
  of the flat `fromFileUrl` operation.

Settled decision: **no reified FileUrl type; file URLs are codec variants on
the existing models.** A file URL is an alternate ENCODING of an absolute path
(RFC 8089) — no consumer computes on file-URLs; every site immediately
converts to a path. By the membrane litmus ("will unknown data need to BECOME
and LIVE as this type?") the answer is no — it becomes a path. A reified
FileUrl would be a value type with zero operations of its own.

Implemented shape: per-model alternate codec statics. `AbsFile.FromUrl` /
`AbsDir.FromUrl` use native `URL` on the encoded side; `*.FromStruct` uses flat
primitive structs for JSON transport. The `.fileUrl` getter stays as the
instance-read convenience for the URL encode direction; the old union-returning
`fromFileUrl` operation was deleted.

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
  — the only open decision in the batch. (Deferred by user 2026-07-09, with
  item 8 peer floor and item 10 suffix-strip.)
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
