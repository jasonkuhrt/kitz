# @kitz/effect

A typed path ADT and Effect-native utilities for the [Effect](https://effect.website) ecosystem.

`@kitz/effect` layers kitz enhancements on top of Effect, exposed under Effect's own
domain terms:

- **`Path`** — a typed path ADT (`AbsFile` | `AbsDir` | `RelFile` | `RelDir`) with
  schema-backed parsing. Values carry instance getters (`.name`, `.stem`,
  `.extension`, `.dir` on files, `.parent` on dirs, `.ancestors`,
  `.asDir`/`.asFile`, `.atRoot`, `.fileUrl`, …); multi-path operations are flat
  functions (`join`, `relativeTo`, `ensureAbs`, `isDescendantOf`, `isWithin`,
  `order`, …); common ancestors are group statics (`Abs.commonAncestor`,
  `Rel.commonAncestor`); file component writes are per-model statics
  (`AbsFile.setParts`, `RelFile.setParts`);
  `fromLiteral` infers the precise variant from string literals at the type level.
- **`Schema`** — small additions to Effect Schema (e.g. `NaturalInt`).
- **`String`** — string utilities.

```ts
import { Path } from '@kitz/effect'
import { Option, pipe, Schema } from 'effect'

const config = Path.fromLiteral('/home/user/config.json') // typed AbsFile
const cwd = Path.AbsDir.fromLiteral('/home/user') // dir targets accept no trailing slash

Path.join(cwd, Path.fromLiteral('./notes/todo.md')) // AbsFile /home/user/notes/todo.md
config.dir.toString() // '/home/user/' — a file's tree parent is its containing dir
Path.AbsFile.setParts(config, { extension: Option.none() }) // /home/user/config
pipe(config, Path.AbsFile.setParts({ stem: 'config.local' })) // /home/user/config.local.json
Schema.decodeSync(Path.Any)(process.argv[2] ?? '.') // runtime strings decode to the union
```

## Paths as keys

Path values implement Effect `Equal`, `Hash`, and `PrimaryKey`, so structurally
equal values work as keys in Effect `HashMap`/`HashSet`. Native JavaScript
`Map`/`Set` use object reference identity instead: two separately decoded path
values can encode to the same canonical string but still miss each other as
native keys. For native collections, key by `path.toString()` or another stored
canonical string.

## File constructor defaults

`AbsFile.make` and `RelFile.make` default an omitted `dir` to the matching
anchor. That default is useful for literals and schema construction, but
application code that is building a non-root file should pass `dir` explicitly
or prefer `join(dir, relFile)`. Accidentally omitting `dir` silently constructs
an anchor-rooted file.

## node:path migrator notes

These are the most common false friends when moving from `node:path` strings to
typed `Path` values:

| node:path       | @kitz/effect              | note                                                           |
| --------------- | ------------------------- | -------------------------------------------------------------- |
| `basename(p)`   | `file.name`               |                                                                |
| `parse(p).name` | `file.stem`               | node is the industry outlier — Python/Rust/C++ call this stem  |
| `extname(p)`    | `file.extension`          | `Option`; includes the dot (like node/C++/.NET; Rust omits it) |
| `dirname(p)`    | `file.dir` / `dir.parent` | files and dirs answer "up" with different words by design      |
| `parse(p).dir`  | `file.dir`                |                                                                |

## Install

```sh
pnpm add @kitz/effect effect
```

`effect` is a **peer dependency** — you install it yourself, so your app and this
package share a single Effect instance (Effect relies on module-level singletons;
two copies break Context/Schema identity).

> **Pre-release:** this package targets Effect v4 (`effect@^4.0.0-beta.85`), which is
> still in beta. Pin accordingly.

## Subpath exports

```ts
import { Path, Schema, String } from '@kitz/effect' // all namespaces
import { Path } from '@kitz/effect/Path' // just Path
```

## Property testing

Every model schema derives a fast-check arbitrary on demand — the canonical
one covers the model's whole domain, and each model carries a `Realistic`
variant schema biased toward readable real-world values:

```ts
import { Schema } from 'effect'

Schema.toArbitrary(Path.AbsFile) // full domain — use for laws
Schema.toArbitrary(Path.AbsFile.Realistic) // readable 20:1 mix — use for shrink output
```

Vitest matchers for path values (`toBeAbs`, `toEncodeTo`, `toBeWithinPath`, …)
live in the companion package `@kitz/vitest`.

## Design notes — path vocabulary

### Design principle — Effect alignment, not Node

Kitz aligns with the Effect ecosystem's idioms and vocabulary, not Node's.
Effect is a categorical rejection of Node/JS standard-library design, and kitz
inherits that stance: where this library matches `node:path` behavior (lexical
`..` folding, `/..` clamping) that is a migration convenience and a
compatibility observation — never the design authority. When Effect idiom and
Node idiom conflict, Effect wins (e.g. `setParts` follows `DateTime.setParts`,
not a `node:path` shape).

The vocabulary was audited against POSIX, Python `pathlib`, Rust `std::path`,
C++17 `std::filesystem`, Node `path`, Java NIO, .NET `System.IO.Path`, Go
`filepath`, and the typed-path lineage (Haskell `path`, PureScript `pathy`).

**Foundations adopted:**

- `stem` — Python `stem`, Rust `file_stem()`, C++ `stem()`. Node's
  `parse().name` meaning the stem is the industry outlier.
- `extension` (dot included) — C++/Node/.NET/Python(`suffix`) include the dot;
  Rust omits it.
- `name` (final component incl. extension) — Python `name`, Rust `file_name()`,
  .NET `GetFileName`, Go `Base`.
- `parent` (dirs) / `dir` (files) — Python/Rust/Java `parent`; Node
  `parse().dir`/`dirname`. Files and dirs deliberately answer "up" with
  different words (see the `.parent` ledger row).
- `ancestors` — Rust `ancestors()` (Rust's includes self; ours does not).
- `join`, `relativeTo` — universal; Python `relative_to()` verbatim.
- `segments` — Node's docs prose ("path segments"), RFC 3986/WHATWG.
  POSIX/Rust say "component", Python "parts", Java "name elements"; no industry
  consensus exists, and Node's prose is the most relevant anchor for a
  node:path successor.
- `AbsFile`/`RelFile`/`AbsDir`/`RelDir` — exactly Haskell `path`
  (`Path Abs File`) / PureScript `pathy` vocabulary: the typed-path niche's
  established language.
- `Abs.commonAncestor` / `Rel.commonAncestor` — "common" per
  `os.path.commonpath` and git merge-base ("best common ancestor"). The earlier
  name `getSharedBase` was rejected: "base" means the final component across
  the industry (`basename`, `filepath.Base`), the opposite end of the path.
  The operation is total and Option-free because the anchor is a genuine common
  ancestor: `/` floors absolute pairs, and the pure-ascent line floors relative
  pairs with unequal ascent. Round-2 P1 exposed the old `None` as a special
  case for exactly the value `AbsDir.anchor` now names.
- `isWithin` (inclusive) vs `isDescendantOf`/`isAncestorOf` (strict) — the
  industry reserves prefix/containment words for self-inclusive semantics
  (Python `is_relative_to`, Rust `starts_with`, Java `startsWith`) because
  genealogy words imply strictness; we honor both registers by splitting the
  ops. For relatives, equal-ascent prefix containment is extended by
  pure-ascent containers: `../` contains `./a`, while `./` does not contain
  `../../`.

**Deliberate divergences (reviewed, kept):**

- `setParts`/`Parts` — `pathlib.parts` means the segment tuple; our `Parts` is a
  component record (nearest analog: Node's `parse()` object, whose `name`/`base`
  fields we render as the better-founded `stem`/`name`). Effect-internal
  consistency (`DateTime.setParts`) outranked neighbor-language UL. The deleted
  `with_*` family (pathlib `with_name`/`with_stem`/`with_suffix`; Rust
  `with_file_name`/`with_extension`) was the cross-industry-founded alternative
  — traded knowingly.
- `ensureAbs` — fs-extra's `ensure*` means idempotent-create-on-disk, but the
  `Path` namespace structurally excludes disk semantics (a future `Fs.*` owns
  those), so the collision does not arise at call sites (`Path.ensureAbs` vs
  `Fs.ensureDir`).
- `ascent` — no ecosystem noun exists for a leading-`..` count (Python/Rust
  model `..` as components, never a count); see the ledger.

### Anchors

The start of a path's domain is its **anchor**: `/` for absolute paths, `./` for
relative ones — pathlib's term, extended (pathlib assigns relatives an empty
anchor rather than naming `./`). The canonical encodings already spell the
anchor at position zero of every path. Algebraically each domain has a
distinguished start: `/` is the minimal element of the absolute tree; `./` is
the identity of the relative-path monoid. Dirs carry `isAnchor`; files compose
the question through `.dir` (the old `file.isRoot` conflated "is the start" with
"is directly in the start"). `AbsDir.anchor` / `RelDir.anchor` are the named
values. "Root" remains in the vocabulary as the NAME of the absolute anchor
(`atRoot` correctly means it). Pure-ascent relatives (`../../`) sit above the
anchor, not at it.

## Windows is not supported

The path model is POSIX-only. Windows drive prefixes (`C:\`), UNC paths
(`\\server\share`), drive-relative paths (`C:foo`), backslash separators,
case-insensitive comparison, and reserved device names are all out of scope and
unrepresentable. In practice, modern Windows APIs and runtimes commonly accept
forward-slash paths without drive prefixes, so POSIX-shaped paths often work on
Windows — but kitz makes no Windows guarantees and performs no Windows-specific
validation. If Windows support ever became a goal, the model's anchor would grow
into a drive-bearing component (cf. pathlib's `PureWindowsPath.anchor` = drive +
root).

## Design notes — model shape

Why the decoded dir shape is `(ascent, segments)` and the decoded file shape is
`(dir, fileName)`, audited for illegal and redundant states.

**The shape is the lexical normal form.** Every POSIX relative path normalizes
to exactly `(../)ⁿ seg₁/…/segₖ` — all traversal collapses to a leading prefix —
so `(ascent: ℕ, segments: Segment[])` is a bijective representation. It is
_total_ (every inhabitant is a valid path: `(0, [])` is `./`, `(2, [])` is
`../../`) and _canonical_ (every path has exactly one value: `a/../b`, `./b`,
and `b` all decode to `(0, ['b'])` — the analyzer folds interior `..` by
pop-or-increment). Non-normal paths are not merely rejected; they are
unrepresentable.

- Absolute variants have no `ascent` field at all, so "absolute paths can't
  ascend" is enforced by field absence, not by a validation rule.
- `fileName` lives outside `segments`, so the `dirname`/`basename` off-by-one
  ambiguity ("is the last segment the filename?") cannot arise; no cross-field
  invariant exists to violate.
- The algebra confirms the shape: relative dirs form a monoid under `join`
  (ascent eats base segments from the right, overflow accumulates; identity
  `./`), absolute dirs are the action target (overflow clamps at root), files
  are the product `Dir × FileName`. `join`/`relativeTo`/`isWithin` are the
  monoid's multiplication, division, and divisibility order.

**Landscape on this axis** (none of the surveyed libraries occupy the same
cell): strings admit everything; component sequences (Rust `Components`,
pathlib `parts`, Java name elements) deliberately preserve interior `..` as
distinct values; PureScript `pathy` allows `ParentIn` nodes anywhere and ships
a separate `canonicalize`; Haskell `path` achieves normality by banning `..`
from relative paths entirely (cannot represent `../x`). Kitz alone is
normal-by-construction with full expressiveness.

**The commitment this buys into (reviewed, kept):** lexical `..` folding is
unsound under symlinks (`a/../b ≠ b` when `a` is a symlink — the classic
`normpath` caveat; the reason Rust/pathlib refuse to fold). Kitz path equality
is therefore _lexical-normal-form identity_, not filesystem-target identity,
irreversibly. Kept because `Path` models pure paths while symlink-aware
resolution requires disk access, which belongs to `Fs.*` by the namespace
charter, and because normal-form-by-construction is the model invariant. Node's
own `normalize`/`join` fold identically, so migrators get incumbent semantics as
a compatibility observation. Same family: over-ascent on absolutes
(`/a/../../b`) clamps at root (`/b`) — POSIX's own `/..` semantics.

**Files nest their directory.** `AbsFile`/`RelFile` are literally
`{ dir, fileName }` — the product `File ≅ Dir × FileName` is the stored shape,
not a derived view. Both shapes are equally total and canonical; nesting won on
composability: a file's directory is a value of a type consumers already know,
`setParts`' `dir` axis is a plain field, and `.dir` is a field read rather than
a per-access construction. `segments`/`ascent` remain as delegating getters.

## License

MIT
