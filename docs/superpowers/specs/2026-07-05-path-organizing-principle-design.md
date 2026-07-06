# Path Module Organizing Principle

Design for where operations live in `@kitz/effect`'s `path` module.

## Context

The path module models paths as a lattice of schema types: four leaf value
classes (`AbsFile`, `AbsDir`, `RelFile`, `RelDir`), three pairwise unions
(`Abs`, `Rel`, `Dir`, `File`), and the full union (`Any`). Operations were
first standalone files under `operators/`, then statics on the union schema
classes. Both layouts hit the same wall: __8 of 15 operations are
polymorphic/mixed-domain__ (`join: Dir × Rel`, `isAncestorOf: Dir × Any`,
`relativeTo: Abs × AbsDir`, …), so filing them under a single type's
namespace requires an arbitrary per-operation ruling. A principle that needs
a judgment call for the majority case is a queue of future debates, not a
principle.

## Principle

One mechanical rule, three tiers. Classification is by arity alone — no
per-operation judgment.

1. __Unary → instance getter on the leaf classes.__ An operation over a
   single path (takes only `this`) is a getter, implemented per leaf with a
   precise return type. Shared computation is factored into `core/`
   functions over raw path data (`ascent`, `segments`, `fileName`); getters
   are thin per-variant adapters. OO dispatch replaces
   `Match.tagsExhaustive`; the `ToDir`/`ToAbs` conditional-type helpers and
   `Any.up`'s `as P` cast are deleted.

2. __N-ary → flat function on `Path`.__ An operation taking a second
   path/argument is a flat `Fn.dual` function exported from the module
   barrel. Signatures — not namespaces — carry the domain constraints.

3. __Union classes are pure schemas.__ `Any`/`Dir`/`File`/`Abs`/`Rel` keep
   codec + `is` + member re-exports and hold zero operation statics. Shared
   instance members surface on unions automatically via TypeScript union
   member access (a member exists on a union when every variant has it).
   Each union is additionally piped through `S.toTaggedUnion('_tag')`,
   which augments the schema with structure-derived utilities — `cases`,
   `guards`, `isAnyOf`, and exhaustive `match` — without changing the
   codec. (`S.TaggedUnion` proper is inapplicable: it builds members from
   field sets via `TaggedStruct` and cannot take existing codec classes.)

## Surface

### Leaf instance getters

| Getter       | `AbsFile`           | `RelFile`           | `AbsDir`          | `RelDir`          |
| ------------ | ------------------- | ------------------- | ----------------- | ----------------- |
| `.name`      | `string`            | `string`            | `Option<Segment>` | `Option<Segment>` |
| `.stem`      | `string`            | `string`            | —                 | —                 |
| `.extension` | `Option<Extension>` | `Option<Extension>` | —                 | —                 |
| `.dir`       | `AbsDir`            | `RelDir`            | —                 | —                 |
| `.parent`    | `AbsFile`           | `RelFile`           | `AbsDir`          | `RelDir`          |
| `.atRoot`    | —                   | `AbsFile`           | —                 | `AbsDir`          |
| `.fileUrl`   | `URL`               | —                   | `URL`             | —                 |

Renames from the static era: `getName → .name`, `getStem → .stem`,
`getExtension → .extension`, `toDir → .dir`, `up → .parent`,
`toAbs → .atRoot`, `toFileUrl → .fileUrl`.

Derived union availability (automatic): `File.stem`/`.extension`/`.dir`,
`Dir.name: Option<Segment>`, `Abs.fileUrl`, `Rel.atRoot`,
`Any.parent` (variant-preserving), `Any.name: string | Option<Segment>`.

### Flat `Path` functions

`join`, `relativeTo`, `ensureAbs`, `isDescendantOf`, `isAncestorOf`,
`getRelativeSegments`, `getSharedBase`. All keep `Fn.dual`
data-first/data-last forms. `ensureAbs` keeps its `EnsureAbs<P>` conditional
type (still a function over the union).

`isSameSegments` was cut during implementation: it compared only
`ascent` + `segments` — ignoring the variant and the filename, so a file
always "equalled" its own directory — had zero call sites, and is subsumed
by effect v4's structural `Equal.equals`. Its private backing
(`segmentsEquivalence`) went with it.

## Semantics decisions

* __Honest `.name` types.__ Files always have a name → `string`. A dir at
  root (or segment-less rel dir) has none → `Option<Segment>`. The `''`
  fallback in the old `getName`/`getStem` conflated "root" with "empty
  name" and is removed. On `Any` the type is `string | Option<Segment>` —
  heterogeneous but truthful; narrow first.
* __`stem`/`extension` are file-only concepts.__ The old `getStem` returned
  a dir's name for dirs — a convenience conflation, removed. Dirs have only
  `.name`. `.stem` is absent from `Any`; narrow to `File`.
* __`.atRoot` names its semantics.__ It re-anchors a relative path at the
  filesystem root, dropping `ascent` traversal (`./src` → `/src`) — distinct
  from `Path.ensureAbs(path, base)`, which resolves against a real base
  directory.
* __`.parent` stays total.__ An absolute root's parent is root (current
  `up` behavior); relatives grow `ascent`. An `Option` return would poison
  chained `.parent.parent` ergonomics.
* Getters throughout (no methods): all unary derivations are parameter-less;
  values are immutable, and `Equal.equals` is structural in effect v4, so
  repeated access being referentially fresh is immaterial.

## Implementation shape

* __Flat combinators__: one file each under `path/operators/` (restored),
  importing leaves as values and unions as types. Nothing imports them but
  the barrel (and `ensureAbs → join`), so the cycle pressure that motivated
  hosting operator impls in `core/` disappears along with the union statics.
* __Shared getter logic in `core/`__, operating on raw data (below the
  leaves in the layer stack):
  * `parentOf(ascent, segments) → { ascent, segments }` in `core/segments.ts` —
    the only real duplication among getters (drop last segment, or grow
    `ascent` when segment-less). Each leaf's `.parent` calls it and wraps
    with its own `make`; abs leaves pass `ascent: 0` and ignore the returned
    `ascent`.
  * `FileName` gains a string-render getter (the `fileNameToString` helper
    currently misplaced in `Any.ts` moves home); both file leaves' `.name`
    read it.
  * The `file://` scheme + encode composition (currently in `Abs.ts`)
    becomes one shared helper; both abs leaves' `.fileUrl` delegate.
  * `.stem`/`.extension`/`.dir`/`.atRoot`/dir `.name` are field reads or a
    single `make` call — nothing to share.
* __Leaf-to-leaf imports form a DAG__: `RelFile → AbsFile/RelDir`,
  `AbsFile → AbsDir`, `RelDir → AbsDir`.
* __Breaking changes are fine__ (pre-1.0, no compat requirement).
* __Tests__: existing operator tests need relocation to the new call forms.
  Test edits are handed off as a mapping list, not made as part of
  implementation.

## Alternatives rejected

* __Pipe-subject rule (Effect idiom)__ — file every op on the module of its
  data-first argument (`Dir.join`, `Dir.isAncestorOf`). Rejected: 8 of 15
  operations have mixed-domain signatures where the subject pick is
  arbitrary; the rule was already misapplied in practice (`isAncestorOf`
  with pipe-subject `Dir` lived on `Any`).
* __Arity split with statics__ (unary stays static on union classes,
  binary goes flat). Rejected: keeps `Match`-based dispatch, conditional
  return types, and the `Path.Any.up` stutter (`Any`'s domain is the whole
  module, so its statics duplicate flat `Path`).
* __Everything flat__ — all 15 ops as flat functions. Superseded by the
  instance-getter tier: getters give variant-precise return types for free
  and eliminate the type-level mapping helpers, which flat functions over
  unions cannot.

## Post-design evolution (2026-07-06)

The surface tables above are the design as approved on 2026-07-05. The
pre-merge burndown then extended the surface under the same three-tier
principle — additional leaf getters (`.isRoot`, `.depth`, `.ancestors`,
`.asDir`/`.asFile`), instance trait methods (`toString`/`toJSON`/inspect/
`PrimaryKey` — the documented methods-not-getters exception), more flat ops
(`with*`, `addExtension`, `fromFileUrl`, `order`, variadic `join`,
Option-returning rel×rel `relativeTo`), literal constructors (`fromLiteral`),
and test arbitraries under the `@kitz/effect/Path/Testing` subpath (kept off
the production barrel). `getRelativeSegments` was retired into the
generalized `relativeTo`. The authoritative current inventory and rationale
live in `docs/superpowers/reports/2026-07-06-path-pre-merge-analysis.md`.
