# FileSystem namespace design — typed-path-native fs for `@kitz/effect`

Date: 2026-07-11
Status: DRAFT for review
Inputs: [heartbeat street round 3](../reports/2026-07-11-heartbeat-path-street-round3.md) (§ Boundary and integration requirements), installed `effect@4.0.0-beta.97` `FileSystem.ts`, Heartbeat usage inventory (1,489 path-API accesses; 165 `node:path` + 38 `effect` Path imports; fs imports not yet inventoried — needs the same Phase-A pass).

## Motivation

Street round 3 proved the half-adoption ceiling: with a string-typed fs, every
fs call site is a membrane (`.toString()` out, `S.decodeSync` in), and that
ceremony dominates consumer code no matter how good the path algebra is. The
target end state for a consumer repo (Heartbeat) is a single cut banning
`node:fs`, direct `effect/FileSystem`, `node:path`, and `effect/Path` at once,
with `@kitz/effect` as the only path/fs surface. This document designs the fs
half. The Path half's remaining gaps are the round-3 list as corrected by
owner input (`resolve`, display encoders, iterable composition, query facade —
the Windows item dissolved; see the report's correction section) and are
tracked separately.

## Principles

1. **Typed paths are the only path currency.** Every operation takes decoded
   Path values or statically validated literals (the existing literal-duality
   machinery, reused). Encoding to native strings happens inside the library,
   once, at the syscall edge.
2. **Classification by syscall, not by string shape.** fs-returned strings
   (directory listings, `realPath`, watch events) carry no trailing-slash
   directory marker, so the path grammar cannot classify them. Typed returns
   derive file/dir identity from fs truth (`stat`/dirent), never from decode
   guessing. Where the library cannot know cheaply, it returns the honest
   lesser type (e.g. `Segment`) rather than a guessed variant.
3. **Facade, not fork.** Same pattern as `Schema`/`String`/`Tuple`:
   `export * from 'effect/FileSystem'` plus the typed overlay. Effect's
   `FileSystem` service remains the sole capability provider; kitz adds no
   second service identity (see Fork A).
4. **Errors pass through.** Operations keep `PlatformError` in the failure
   channel. No wrapping layer; enrichment (typed path context on errors) is a
   later, additive decision.
5. **Temp paths get a real type.** Round 3 had to model an `mkdtemp` prefix as
   a fake `AbsFile`. The temp operations own that shape instead: callers pass
   `{ directory: Dir, prefix: Segment }`-shaped options; the incomplete-prefix
   string never appears in consumer code.

## Fork A — overlay functions vs. path-typed service

**(a) Overlay functions (recommended).** Kitz exposes typed operations as plain
functions requiring effect's `FileSystem` in `R`:

```ts
FileSystem.readString(file: File | AbsFile | RelFile | <literal>): Effect<string, PlatformError, FileSystem>
```

One service identity (effect's), drop-in layers (`NodeFileSystem.layer`,
`layerNoop`) keep working, and testing/mocking stories are unchanged. This is
the shape the old kitz aggregator used (`FileSystem.readString`).

**(b) Path-typed service.** A new kitz service whose interface is typed, with a
layer deriving from effect's. Rejected as default: it creates a second service
identity to provide/mock everywhere, and every effect-ecosystem integration
that provides `FileSystem` stops being sufficient.

## Operation surface (v1 mapping)

Effect's service has 28 members. The overlay maps them; `$P` below means "any
appropriate path value or validated literal", with target-specific narrowing
per operation. Returns marked ★ apply Principle 2.

| effect method | kitz overlay signature (sketch) | notes |
|---|---|---|
| `readFileString` | `readString(file: $File)` → `string` | flagship; encoding internal |
| `readFile` | `read(file: $File)` → `Uint8Array` | |
| `writeFileString` | `writeString(file: $File, data: string)` | |
| `writeFile` | `write(file: $File, data: Uint8Array)` | |
| `readDirectory` | `readDir(dir: $Dir)` → ★ `ReadonlyArray<DirEntry>` | see below |
| `makeDirectory` | `makeDir(dir: $Dir, opts?)` | `recursive` default TBD (Fork C) |
| `remove` | `remove(path: $Any, opts?)` | |
| `rename` | `rename(from: $Any, to: SameShape)` | type-preserving: File→File, Dir→Dir |
| `copy` / `copyFile` | `copy(from: $Dir, to: $Dir)` / `copyFile(from: $File, to: $File)` | effect's split becomes target-typed |
| `exists` | `exists(path: $Any)` → `boolean` | |
| `access` | `access(path: $Any, opts?)` | |
| `stat` | `stat(path: $Any)` → `File.Info` | passthrough type |
| `realPath` | `realPath(path: $Any)` → ★ `Abs` (stat-classified) | one extra stat; documented |
| `readLink` | `readLink(path: $Any)` → ★ `Any` (stat-classified, dangling links → Fork D) | |
| `link` / `symlink` | typed from/to | |
| `chmod` / `chown` / `truncate` / `utimes` | `(path: $Any, …)` passthrough | |
| `open` | `open(file: $File, opts?)` → `File` handle | |
| `sink` / `stream` | `(file: $File, opts?)` | |
| `watch` | `watch(path: $Any)` → `Stream<WatchEvent>` | event paths stay strings in v1 (classification cost; Fork D) |
| `makeTempDirectory(Scoped)` | `(opts?: { directory?: $Dir; prefix?: Segment })` → `AbsDir` | Principle 5 |
| `makeTempFile(Scoped)` | `(opts?: { …; suffix?: Extension })` → `AbsFile` | Principle 5 |
| `glob` | `glob(pattern, opts: { root?: $Dir; … })` → ★ entries | classification as readDir |

### `readDir` return shape (Fork B — the load-bearing decision)

Effect returns `Array<string>` (bare names). Options:

- **(i) `ReadonlyArray<Segment>`** — zero extra syscalls, fully honest, but
  callers who need file/dir classification stat manually (back to ceremony).
- **(ii) `ReadonlyArray<DirEntry>` where `DirEntry = { segment: Segment } +
  classified path (RelFile | RelDir relative to the read dir)`, via one `stat`
  per entry** — N extra syscalls; matches what consumers actually want
  (Heartbeat listings feed joins immediately); recursive listings get typed
  relative paths for free.
- **(iii) both**: `readDirNames` (cheap) + `readDir` (classified). Two names,
  no silent cost.

Recommendation: **(iii)** — the cost difference is real (large dirs) and
should be a visible choice, not a default surprise. Naming per house rules
(no abbreviation games) to be settled at implementation.

### Fork C — option defaults

Effect mirrors Node defaults (`makeDirectory` non-recursive). Kitz can keep
them (least surprise for Node refugees) or re-derive (recursive-by-default is
what consumers overwhelmingly want). Recommendation: keep effect's defaults —
the facade's contract is "effect + types", not "effect with different
opinions"; opinion changes belong in named variants if ever.

### Fork D — deferred surfaces

`watch` event path typing and `readLink` on dangling targets both require
classification of paths that may not exist (no stat possible). v1 keeps their
path payloads as strings/`Segment`s with the caveat documented, rather than
inventing a "maybe-file-maybe-dir-maybe-nothing" inhabitant. Revisit with
evidence.

## Out of scope (named, not forgotten)

- **Child-process boundary** (`cwd:`, argv paths): a future `Command`-shaped
  integration, not fs.
- **Env/CLI input decoding**: stays schema-at-the-membrane; no fs involvement.
- **Windows/native algebra**: explicitly NOT planned. Owner-confirmed: no
  Heartbeat Windows target exists; every authored `path.sep` site is
  normalize-to-POSIX insurance that kitz's POSIX-canonical paths make
  deletable (see the round-3 report correction). No consumer, no algebra
  (no-insurance-code). The fs overlay is POSIX-honest like Path itself.
- **Effect version alignment in Heartbeat** (beta.78 → 97): consumer-side
  prerequisite, tracked with the cut plan, not a library concern.

## Sequencing to the Heartbeat cut

1. Path top-4 (separate design/implementation track; display encoders,
   iterable composition, and the query facade are small; `resolve` is the one
   large item).
2. This FileSystem namespace (v1 surface above).
3. Heartbeat effect alignment to the kitz peer line.
4. The single-cut ban: `node:fs`, `effect/FileSystem` direct use, `node:path`,
   `effect/Path` — enforced by lint (import-ban rules), migrated in one
   campaign on the standing street worktree
   (`~/projects/heartbeat-chat/Heartbeat-kitz-path-street`).

## Decisions needed

- Fork A: overlay functions (recommended) vs path-typed service.
- Fork B: `readDir` shape — recommend (iii) cheap-names + classified variants.
- Fork C: option defaults — recommend keeping effect's.
- Fork D: accept v1 deferral of watch/dangling-link path typing.
- Whether the Path top-5 (esp. the two hard gaps) gate the fs work or proceed
  in parallel — they are independent code paths; parallel is viable.
