# Heartbeat node:path Replacement — Stress-Test Findings

Setup: worktree `Heartbeat.kitz-path-stress` off `origin/develop`; `@kitz/effect`
built, publish-shaped, installed into `tools/dev` as `file:/tmp/kitz-effect-stress`
(pnpm auto-registered it in the workspace catalog). All probes ran against
heartbeat's real runtime (`effect@4.0.0-beta.78`, pnpm 11.8.0). No mass
conversion performed — analysis-first; every claim below was executed, not
predicted (several predictions were wrong and are corrected here).

Scale of the target: **141 files, ~1,141 call sites**:

| API | sites | | API | sites |
|---|---|---|---|---|
| `path.join` | 604 | | `path.sep` | 30 |
| `path.resolve` | 167 | | `path.basename` | 29 |
| `path.dirname` | 133 | | `path.isAbsolute` | 20 |
| `path.posix` | 75 | | `path.extname` | 17 |
| `path.relative` | 59 | | `path.normalize` / `path.parse` | 5 / 1 |

## Verdict

Runtime-compatible today (every API kitz's compiled output calls exists and
works on beta.78 — smoke + all probes pass). But two findings are **semantic
traps** that would silently corrupt paths under mechanical conversion, and
three are **adoption-gating DX taxes**. Fix those in kitz before pointing any
agent at the 141 files.

## Semantic traps (fix before any conversion)

### T1 — `file.parent` is a `dirname` false friend

`path.dirname` (133 sites) has no same-named equivalent, and the name-nearest
getter does something else:

```
Path.fromLiteral('/a/b/c.txt').parent  →  /a/c.txt   // relocates the FILE one dir up
node path.dirname('/a/b/c.txt')        →  /a/b       // the containing dir
```

The correct mapping is `.dir` for files, `.parent` for dirs — a variant-aware
dispatch. Any converter (human or agent) reaching for `.parent` by name
produces wrong paths that still typecheck. Evidence of exposure:
`tools/dev/src/main.ts:31` (`path.dirname(configPath)` on a runtime string).

**RESOLVED**: `.parent` no longer exists on file variants — the mistake is now
a compile error. Files answer "up the tree" with `.dir` (a file's tree parent
IS its containing directory). No relocation surface ships: zero of the 1,141
audited call sites express "keep filename, move up", and the general form —
`withDir(file, dir)`, completing the `with*` read/replace table against the
`.dir` getter — is the landing spot if demand ever appears. Ledger row added
in `packages/effect/CONTRIBUTING.md`.

### T2 — canonical form diverges from node's at every string boundary

kitz canonicalizes dirs with trailing `/` and relatives with `./`:

```
decode('/a/b/').toString()   →  /a/b/     (node: /a/b)
decode('src/x/').toString()  →  ./src/x/  (node: src/x)
```

Correct by design — but every encoded string that leaves the library (map
keys, CLI args, env values, snapshots, string `===` against node-produced
paths) differs from what the surrounding half-migrated code produces.
Consequence: migration must be **atomic per string domain**, and the report
of record for the migration needs a string-boundary audit step. Not a kitz
bug; a required migration protocol.

## Adoption-gating DX taxes

### D1 — no `resolve`/cwd story (167 sites)

`path.resolve(x)` resolves against cwd. kitz's `ensureAbs` needs an explicit
`AbsDir` base, and there is no cwd helper (deliberately deferred to the
FileSystem era). Every one of the 167 sites pays
`S.decodeSync(Path.AbsDir)(process.cwd())` ceremony, or blocks on the cwd
service. Evidence: `tools/dev/src/chrome-extension/install-state.ts:371`
(`path.resolve(value)`), `src/namespace.ts:66` (resolve-equality check).
This single gap gates ~15% of all call sites.

### D2 — string-boundary ceremony: the Tier-3 `Input` deferral is the bill

The modal call site is one line:

```ts
path.join(cwd, '.env')                                             // before
Path.join(S.decodeSync(Path.AbsDir)(cwd), Path.fromLiteral('./.env')).toString()  // after
```

One op becomes three (+ a throw channel). At 604 join sites this is the
dominant cost, and it is exactly what the deferred Tier-3 literal `Input`
polymorphism (`join(dir, './.env')`) would eliminate for the literal-RHS
majority. This stress test is the evidence for prioritizing it. The dynamic-
LHS decode (`cwd`) additionally wants a blessed one-call boundary helper.

### D3 — union classification is not predictable without reading source

Probed through `Path.Any`: `/etc/hostname` → **AbsFile**, `.git` → **RelFile**,
`node_modules/.bin` → **RelFile**, but `'x.'` → RelDir and `''` → `./`.
(Union member decoders run with their own kind hints, so the extension
heuristic documented for bare `analyze` mostly never fires through `Any`.)
The library's own author-agent mispredicted three of these. Needs: a
documented, small rule table in the README/JSDoc for `Any` decode; consider
simplifying the rule.

## Papercuts

- **`path.sep` (30) / `path.posix` (75)**: no separator export. `posix.*`
  sites confirm heartbeat already normalizes to POSIX (good for kitz), but
  `sep`-splitting sites need per-site redesign onto `.segments` — not
  mechanical.
- **`path.basename(f, '.test.ts')`** suffix-strip form: `.stem` strips only
  the last extension (`archive.test.ts` → `archive.test`); the multi-suffix
  idiom has no kitz equivalent.
- **`isDescendantOf(d, d) === true`** — self-inclusive, i.e. *within*
  semantics under a *descendant* name (the @kitz/vitest matcher is honestly
  named `toBeWithinPath`). Either strictify the genealogy or rename; a
  strict/inclusive pair is the clean cut. (Upside: the containment idiom at
  `tools/dev/src/reclaim.ts:100-106` — `relative` + `startsWith('..')` +
  `isAbsolute` — collapses to one call.)
- **Peer range excludes a working consumer**: heartbeat pins
  `effect@4.0.0-beta.78`; kitz requires `^4.0.0-beta.85`. Presence-probed:
  every API the compiled output uses exists on beta.78 and all smoke/probes
  pass. Widen the floor or document the true minimum.
- **Dead production dependency**: `@kitz/effect`'s publish shape carries
  `@platformatic/vfs` in `dependencies`; `build/` never imports it. Drop it.

## What worked better than node:path (confirmed wins)

- `join` is variadic and typed end-to-end: 3-path join produced the right
  result; junk joins (dir on the right of a file, abs on the right) are
  compile errors.
- Ascent literals infer precisely: `fromLiteral('../..')` → `RelDir ../../`.
- `fromFileUrl(import.meta.url)` → `Result<AbsFile>` composes into the
  `__dirname` idiom: `Result.getOrThrow(r).dir` + ascent join reproduced
  `path.resolve(__dirname, '../../../../..')` exactly
  (`tools/dev/src/chrome-extension/e2e/extension-fixture.ts:40`).
- Canonicalization makes all 5 `path.normalize` sites free.
- Decode-time validation rejects the malformed-path class (`//`, NUL,
  traversal weirdness) that node:path silently passes through.

## Recommended kitz work queue (from this evidence, ranked)

1. Resolve T1 (`parent`/`dirname` naming) — blocks safe conversion of 133 sites.
2. Tier-3 literal `Input` polymorphism on `join`/ops — un-taxes ~604 sites (D2).
3. cwd/`resolve` story (even a minimal `Path.cwd(): Effect<AbsDir>` in the
   future FileSystem package) — unblocks 167 sites (D1).
4. `Any`-decode rule table in docs (D3).
5. Widen the effect peer floor after a beta.78-CI check (or document floor).
6. Drop `@platformatic/vfs`; decide `isDescendantOf` naming; consider a
   suffix-strip op.

## Worktree state

`/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress`, branch
`kitz-path-stress`, uncommitted: catalog entry + `tools/dev` dep on the
file-installed package. Rebuild + re-assemble `/tmp/kitz-effect-stress` (see
session) to pick up kitz changes; conversions themselves are delegable labor
once the queue above lands.
