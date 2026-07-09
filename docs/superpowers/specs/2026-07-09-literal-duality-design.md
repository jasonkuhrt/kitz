# Literal Duality — staged design spec

Status: DRAFT — built for incremental steering. Each layer ends in decision
boxes; a layer is locked only when its boxes are confirmed. Do not implement
past the last locked layer.

Foundation (already shipped, not up for review): `Path.mk` / `Model.mk` —
the static-literal constructor world; plain `string` is a parameter-side
`StaticError`; the type-level parser (`FromLiteral` in `core/literal.ts`) is
the validation authority (`6d9d6914`).

## The paradigm in one sentence

Like `Fn.dual` makes every operation fork on call shape (data-first /
data-last), literal duality makes every operation fork on input world
(static literal / runtime value) — all-or-nothing across the bounded
context, governed by one law:

> **Desugar law.** For every op `f` and every literal-accepting parameter
> position `i`: `f(..., lit, ...)` ≡ `f(..., mk(lit), ...)` — identical
> return type and value.

The law makes conformance mechanical: each op gets type cells
(acceptance/rejection per position) plus a runtime property block asserting
the equivalence.

## Historical baseline (mining ground, not gospel)

Old kitz shipped a full solution; recover with:

- `git show 41a2d191^:src/utils/fs-loc/inputs.ts` — `Input<$FsLoc> =
  $FsLoc | string`, per-target aliases (`Input.AbsFile`, …), `Guard`,
  `normalize`.
- `git show 41a2d191^:src/utils/fs-loc/operations/ensure-optional-absolute-with-cwd.ts`
  — an op consuming `Inputs.Guard.Any` + type-level `Inputs.normalize`.
- The overloaded `.make` accepting string literals alongside structured
  input (same tree).

Critical divergence from that baseline: old `Input` accepted **runtime
strings too**, validated at runtime — every op carried a hidden throw
channel. Layer 1 decides whether we keep or reject that.

---

## Layer 1 — scope doctrine (CONFIRM FIRST)

### D1. What may enter an op signature as a string?

PROPOSED: **literals only.** `string` at an op position is a `StaticError`,
exactly like `mk`. Runtime strings stay in the explicit codec channels
(`S.decode*`) or arrive as already-decoded values. Consequence: ops remain
total — no hidden throw channel (the old `Input`'s runtime-string arm is the
rejected alternative).

- [ ] confirmed / steer:

### D2. Which types get a literal form?

PROPOSED: **paths AND components.** The evidence demands components:
round-2 P1 is `setParts({ name: 'manifest.json' })` — a `FileName` literal,
not a path literal. Component grammars (Segment, FileName, Extension) are
trivial next to the path parser. Scope: `Segment`, `FileName`, `Extension`
literals join the four path variants in the literal world.

- [ ] confirmed / steer:

### D3. The inventory (all-or-nothing boundary)

PROPOSED: every path/component-typed parameter position of every public op,
both dual forms:

| op | positions accepting literals |
| --- | --- |
| `join(dir, ...rels)` | all — dir and every rel |
| `relativeTo(path, base)` | both |
| `ensureAbs(rel, base)` | both |
| `isWithin` / `isDescendantOf` / `isAncestorOf` | both |
| `Abs.commonAncestor` / `Rel.commonAncestor` | both |
| `withName(dir, segment)` | both (segment = Segment literal) |
| `AbsFile.setParts` / `RelFile.setParts` | `dir` axis (path literal); `name` (FileName literal); `stem` (already string); `extension` (Extension literal) |

Out of scope: `make` (Type-side world), the codecs (encoded world),
`Path.Cwd`. `mk` remains the explicit reification gate and the law's
right-hand side.

- [ ] confirmed / steer:

### D4. Paradigm name

PROPOSED: **literal duality** (parallel to `dual`; names the second axis).
It will appear in docs, ledger, and conformance-test block titles.

- [ ] confirmed / steer:

---

## Layer 2 — signature doctrine (confirm after Layer 1)

- **Factor parsers, inline scaffolding.** Type-level parsers
  (`FromLiteral`, future component parsers) are computation on bound type
  params — shared and unit-tested. Inference scaffolding (`<const S>`
  params, overload order, conditional returns, dual-curried interplay) is
  NOT factored — inlined per op; the repetition is load-bearing because
  factoring converts inference sites into checking sites.
- **Rejection shape:** invalid literal or plain `string` produces the
  existing `StaticError` brand at the offending argument.
- **Return typing:** literal args normalize (type-level) to their
  `FromLiteral` variant before the op's existing return computation —
  precision equals the value form, no more (types are variant-indexed, not
  value-indexed).
- **Runtime:** `typeof arg === 'string'` → internal decode (safe: build
  gate makes the throw path unreachable), mirroring `mk`.

- [ ] doctrine confirmed / steer:

## Layer 3 — the `join` spike (confirm criteria, then build)

`join` is the maximal case: variadic × dual × mixed positions. Acceptance
criteria before any other op is touched:

1. `join(cwd, 'src', 'index.ts')`, `join('/home/u', lit, value, lit)` —
   mixed static/dynamic at every position, correct variant returns.
2. Data-last form accepts literals: `join('.env')(cwd)` (or documented,
   confirmed impossibility with rationale — this box is where dual×const
   may bite).
3. A wrong literal (`join(cwd, '/abs')`) errors AT the argument with the
   readable `StaticError`, not a smeared overload dump.
4. tsc check-time delta measured on a 600-call synthetic file (heartbeat
   scale) and judged acceptable.
5. Desugar-law property block + full type-cell block pass.

- [ ] criteria confirmed / steer:

## Layer 4 — rollout (mechanical once 1–3 lock)

Inventory ops converted one commit each, each with its conformance blocks;
ledger row; README paradigm section; heartbeat round 3 validates the tax
actually dropped. Codex (gpt-5.6-sol) mechanizes from the proven join
pattern; the join spike itself is hand-designed.

## Open questions (parked until relevant layer)

- Per-model `make` overload (literal | struct) — live-not-rejected; decide
  after rollout, with usage evidence.
- Component-literal grammars: does `Extension` literal accept `'gz'` or
  require `'.gz'`? (Propose: require the dot — matches the model.)
- Whether `Path.mk` itself gains component targets (`Segment.mk`,
  `FileName.mk`) as part of D2.
