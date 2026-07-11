# Heartbeat path street test — round 3

Date: 2026-07-11

## Executive verdict

On the **Path API alone**, Heartbeat cannot yet adopt `@kitz/effect/Path` as its
only path algebra. The two decisive gaps are host-native/Windows path
expressiveness and the absence of Node-compatible `resolve` semantics. On
POSIX, the common typed operations are credible and several are better than
`node:path`, but exact consumer behavior still needs a Node-compatible display
form and more ergonomic dynamic/iterable composition.

That verdict intentionally excludes filesystem/process integration ceremony.
String conversion at Node fs calls, decoding external strings, Effect runtime
wiring, and the Effect beta mismatch are listed separately as integration-layer
requirements. They are not counted against the path algebra.

This was a **partial forced migration**, not a completed repository conversion.
The permanent evidence fixture is Heartbeat commit `42dd9258f4` on
`street/kitz-path-street-test`. Work stopped after 12 source files across five
packages because the useful API signal had plateaued.

## Test setup and scope

- Kitz source: commit `77a3fca971c3653b7d4ff633502e54a4af5d6b32`.
- Package fixture: `@kitz/effect@0.1.0`, packed with the production prepack
  clean/emit path. Tarball SHA-256:
  `c535e2961b9985afeaceca744a04dd739a2096df50bc2c2ce565c0b1917f777b`.
- Heartbeat fixture:
  `/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat-kitz-path-street`, branch
  `street/kitz-path-street-test`, commit `42dd9258f4`.
- Heartbeat catalog at test start: `effect@4.0.0-beta.78`.
- Kitz peer requirement: `effect@^4.0.0-beta.97`.

The completed migration slices were:

| Slice | Completed files | Surface exercised |
|---|---:|---|
| `apps/sandbox` | 4 | cwd/env boundaries, literal joins, dynamic segment arrays, dynamic filenames, relative display, home expansion |
| `tools/prisma-linter-plugins` | 3 | module URL conversion, dirname, resolve-shaped ascent, relative display, temp paths, dynamic nested filenames |
| `apps/e2e` | 3 | resolve-shaped config paths, absolute-or-relative env input, cwd-relative telemetry names |
| `apps/heartbeat` codemod | 1 | module URL conversion, dirname, ascent join |
| `tools/persona` | 1 | replacement of Effect's `Path.Path` service in an Effect program, typed File/Dir targets |

The sweep was interrupted before converting the rest of Heartbeat. In
particular, the audit inspected but did not migrate the high-value remaining
surfaces in `libs/effect-pnpm`, `libs/tool`, `libs/generator`, and the hundreds
of other call sites. Those inspected sites still inform the inventory and hard
gap findings; they are not claimed as migrated proof.

Within each completed source file, the forced rule held: no `node:path`, bare
`path`, `pathe`, `node:url` path helper, or Effect `Path.Path` use remains.

## Phase A — whole-repository API inventory

### Counting method

The inventory scanned 7,316 tracked JS/TS-family files with lexical binding
resolution rather than text-only matching. It counted a named path import or a
statically named member access once, distinguished host-native `path.*` from
`path.posix.*`, and counted Effect service methods only when the receiver was
proven to come from `Path.Path`. Generated tracked sources remain in the totals:
122 of 1,489 accesses are generated. Six parser-recovery files were grep-checked
and contained no relevant imports.

Provider abbreviations below are:

- **Node** — host-native `node:path` / `path`.
- **POSIX** — `path.posix.*`.
- **Effect** — methods on the Effect platform `Path.Path` service.

Verdicts are:

- **A — direct**: kitz has the path-algebra operation.
- **B — clumsier/different**: expressible, but the consumer must dispatch,
  adapt a display form, or compose lower-level operations.
- **C — gap**: exact semantics are not expressible through the current public
  Path API without rebuilding the missing operation in consumer code.

| API | Count and providers | Representative Heartbeat sites | Verdict | Kitz expression or gap |
|---|---:|---|---|---|
| `join` | **777** — Node 635, POSIX 55, Effect 87 | `apps/api-sso-proxy/__scripts__/generate-docs.ts:473`; `libs/generator/src/Generator.ts:212` | **A** | `Path.join(dir, rel)` is direct and precisely typed. Dynamic iterable parts and directory intent are a separate friction finding below. |
| `resolve` | **235** — Node 214, Effect 21 | `apps/api-sso-proxy/__tests__/e2e/proxy.test.ts:21`; `libs/tool/src/config-file.ts:99` | **C** | `ensureAbs` handles one already-decoded target against an explicit base. It does not provide zero-argument cwd, variadic resolution, or Node's rightmost-absolute reset. |
| `dirname` | **166** — Node 127, POSIX 11, Effect 28 | `.github/actions/pw-run/run.mjs:91`; `libs/generator/src/Generator.ts:169` | **B** | Known File: `.dir`. Known Dir: `.parent`. `Any` requires variant dispatch; there is no one generic `dirname` operation. |
| `relative` | **97** — Node 92, Effect 5 | `apps/e2e/src/_fixtures/fixture.ts:393`; `libs/generator/src/Generator.ts:243` | **B** | `Path.relativeTo(target, base)` computes the relation directly, but argument order differs and the only encoder emits canonical `./` / trailing `/`, not Node's display. |
| `sep` | **46** — Node 39, POSIX 6, Effect 1 | `.github/actions/pw-run/pass-reporter.mjs:38`; `tools/dev/src/repo/services.ts:44` | **C** | No native separator surface. More importantly, the algebra cannot represent drive, UNC, or host-native Windows paths. |
| `basename` | **38** — Node 26, POSIX 8, Effect 4 | `libs/clef/src/builtins/completionInstall.ts:93`; `libs/tool/src/config-file.ts:39` | **B** | File `.name`; Dir `.name` is `Option`. Generic paths require dispatch, and `basename(path, suffix)` has no equivalent. |
| `isAbsolute` | **23** — Node 15, Effect 8 | `libs/oxlint-plugins/src/effect/model/module/docs.ts:142`; `tools/persona/src/emit.ts:284` | **C** | `Path.Abs.is` works after decoding, but there is no total predicate over arbitrary native strings. Malformed and Windows inputs cannot reproduce Node's boolean contract. |
| `extname` | **17** — Node 13, Effect 4 | `libs/oxlint-plugins/src/heartbeat/default-export-name.ts:19`; `libs/tool/src/config-file.ts:38` | **B** | File `.extension` is a more precise `Option<Extension>`, but generic strings/paths need decoding, narrowing, and Option folding. |
| `normalize` | **8** — Node 5, POSIX 2, Effect 1 | `libs/effect-pnpm/src/path.ts:4`; `tools/dev/src/doctor/checks/agent.ts:216` | **B** | Target-schema decode performs lexical normalization for valid POSIX paths. It is not Node's total host-string normalizer and needs a File/Dir target. |
| `parse` | **3** — Node 3 | `libs/effect-pnpm/src/path.ts:13`; `tools/prisma-enricher/src/artifacts/emitRuntimeExtension.ts:69` | **B** | Variant getters and `.segments` expose the modeled parts, but there is no single Node-shaped `{ root, dir, base, ext, name }` facade. |
| `toNamespacedPath` | **2** — Node 2, both generated | `parts/prisma/src/__generated__/client/runtime/library.js:114`; `tools/prisma-enricher/__tests__/e2e/fixture/__generated__/runtime/library.js:114` | **C** | Windows namespace paths are outside the POSIX algebra. |
| URL → path (`fileURLToPath` / `fromFileUrl`) | **66** — Node 63, Effect 3 | `apps/api-sso-proxy/__scripts__/generate-docs.ts:16`; `libs/effect-typescript/__scripts__/generate-diagnostic-code-manifest.ts:73` | **B** | `S.decodeSync(Path.AbsFile.FromUrl)(url)` or `AbsDir.FromUrl` is target-safe. Callers must choose File versus Dir; no `Any.FromUrl` exists. |
| path → URL (`pathToFileURL` / `toFileUrl`) | **11** — Node 10, Effect 1 | `libs/effect-plus/src/lib/terminal/hyperlink.ts:37`; `libs/tool/src/config-file.ts:157` | **B** | A decoded absolute value's `.fileUrl` is direct and total. Arbitrary or relative inputs first need path-algebra resolution. |

Total: **1,489 API accesses**.

Import-surface checks found 165 `node:path`, 50 bare `path`, 49 `node:url`,
five bare `url`, and 38 files importing named `Path` from `effect`. No `pathe`,
`path.win32`, `delimiter`, `format`, or `matchesGlob` use was found. POSIX calls
appear as `path.posix.*`; there is no `node:path/posix` import.

## Phase B — forced migration evidence

### 1. Typed literal joins were concise

The simple sandbox boundary changed from:

```ts
applyEnvFile(path.join(cwd, '.env'))
```

to:

```ts
const cwdPath = S.decodeSync(Path.AbsDir)(cwd)
applyEnvFile(Path.join(cwdPath, './.env').toString())
```

Only `Path.join(cwdPath, './.env')` is Path-algebra evidence: the literal RHS is
accepted directly and the result is precisely `AbsFile`. The decode and
`.toString()` calls are integration boundaries and are not Path findings.

### 2. Dynamic iterable composition exposed real algebra friction

Heartbeat's scenario renderer used the ordinary variadic shape:

```ts
const outDir = path.join(EMIT_ROOT, ...args.commandPath)
const filePath = path.join(outDir, sanitizeFileName(artifact.name))
```

The forced typed form became:

```ts
const commandDir = Path.RelDir.make({
  segments: args.commandPath.map((part) => Path.Segment.make(part)),
})
const outDir = Path.join(EMIT_ROOT, commandDir)

const artifactPath = Path.RelFile.make({
  fileName: Path.FileName.make(sanitizeFileName(artifact.name)),
})
const filePath = Path.join(outDir, artifactPath)
```

This is within the algebra, not fs integration. There is no iterable/dynamic
join producer that states “all these runtime strings are directory segments,
then this runtime string is the filename.” The component schemas validate the
right invariants, but the consumer must manually construct the intermediate
ADT values.

### 3. URL-derived paths were safer

The Prisma docs generator replaced:

```ts
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const RULES_PATH = path.resolve(SCRIPT_DIR, '../..', 'RULES.md')
```

with:

```ts
const SCRIPT_DIR = S.decodeSync(Path.AbsFile.FromUrl)(
  new URL(import.meta.url),
).dir
const RULES_PATH = Path.join(SCRIPT_DIR, '../../', './RULES.md')
```

The target codec proves that a module URL became an absolute file, `.dir` has
one meaning, and the ascent join has a precise `AbsFile` result. This was a
genuine Path win.

### 4. Replacing the Effect Path service made target intent explicit

Persona previously accepted arbitrary strings through `isAbsolute` +
`resolve`. The migrated file separately decoded:

- `projectRoot` and `outputDir` as `Dir`;
- `apiReferencePath` as `File`;
- then used `ensureAbs` against a proven absolute base.

That separation caught a real distinction the string API hid. The Path API
benefit is target precision. Changes to the Effect environment, error channel,
and child-process string boundary are integration work and are excluded from
the Path verdict.

### Verification captured before the sweep stopped

| Slice | Check | Result |
|---|---|---|
| sandbox | `vpr @heartbeat/sandbox#check:types` | passed |
| Prisma plugins | `vpr @heartbeat/prisma-linter-plugins#check:types:development` | passed |
| E2E | `vpr @heartbeat/e2e#check:types` | passed |
| heartbeat app | `vpr @heartbeat/heartbeat#check:types` | passed, but the migrated `.mts` codemod is excluded by that package tsconfig |
| Persona | `vpr @heartbeat/persona#check:types` | passed |
| Prisma migrated tests | targeted `catalog.test.ts` + `docs-rules.test.ts` | 2 files, **30 tests passed** |
| Prisma docs runtime | `vpr @heartbeat/prisma-linter-plugins#check:docs` | passed |
| Persona unit/e2e-in-Vitest suite | `vpr @heartbeat/persona#test:unit` | 18 files, **91 tests passed** |
| E2E config smoke | direct Playwright `--list` | **39 tests in 31 files listed**, exit 0 |
| migrated-file lint | `vp lint` on all 12 files | passed |
| migrated-file format | `vp format --check` on all 12 files | passed |

The Prisma package's declared `test` script addressed a non-existent Vitest
project and failed with `No projects matched the filter`; the two migrated
files were therefore run directly. The codemod has no native semantic check:
an ad hoc strict compile found 12 AST typing errors elsewhere in that file and
none at the migrated path expression, but that is not equivalent to a green
package-owned check.

## Path-API findings, ranked by adoption impact

### Hard gap P0 — no host-native/Windows path algebra

Heartbeat has 46 separator reads, including 39 host-native `path.sep` reads,
and two generated `toNamespacedPath` calls. Authored examples such as
`libs/effect-pnpm/src/path.ts:8` and
`tools/prisma-enricher/src/core/sourceTyping.ts:36` deliberately consume OS
filesystem strings and translate separators.

Current behavior is correctly POSIX-only:

```text
S.decodeSync(Path.AbsDir)('C:\\repo')
SchemaError(Expected an absolute path, received "C:\\repo")
```

Backslash is an ordinary segment character, and drive, UNC, and namespaced
paths have no inhabitants. This is not merely missing `sep`; it makes a forced
only-library adoption impossible on Windows.

Ideal feel: native paths should have an explicit, typed algebra of their own,
including drive/UNC anchors and conversion to/from POSIX/module-specifier paths.
The current POSIX model should remain honest rather than pretending `/` is the
host separator.

### Hard gap P1 — no Node-compatible `resolve`

`resolve` is Heartbeat's second-largest operation family: 235 accesses.
`ensureAbs(path, base)` is useful but does not implement:

- zero-argument cwd resolution;
- variadic resolution;
- right-to-left evaluation;
- reset when the rightmost absolute operand is encountered.

For the one-input case this worked:

```ts
Path.ensureAbs(S.decodeSync(Path.RelFile)('../config.json'), base)
// /repo/config.json
```

But recreating full `resolve` requires consumer-owned control flow that is
itself a shadow path library. That is an algebra gap, not integration ceremony.

Ideal feel: target-owned, typed resolution such as a File/Dir-directed resolve
operation whose overloads preserve the final variant and implement the full
rightmost-absolute law.

### Friction P2 — the only relative display form is canonical, not consumer-neutral

`relativeTo` computes the right path, but its sole string form is the canonical
kitz encoding:

```text
node path.relative('/repo/app', '/repo/app/src/index.ts')  -> src/index.ts
Path.relativeTo(file, base).toString()                    -> ./src/index.ts

node path.relative('/repo/app', '/repo/app')              -> ""
Path.relativeTo(base, base).toString()                    -> ./
```

Directories also acquire a trailing `/`. Heartbeat uses relative strings as
telemetry attributes, module/config references, logs, and snapshot identities,
so the display difference is observable even when the modeled path is correct.
The fixture had to use `.replace(/^\.\//, '')` twice.

This is a Path display/encode finding, not an fs boundary finding: the algebra
needs an explicit noncanonical relative display form rather than making every
consumer rewrite encoded strings.

Ideal feel: retain canonical encoding for identity, and expose a named bare
relative display encoder with specified identity and directory-suffix rules.

### Friction P3 — dynamic join lacks an iterable/target-directed producer

`Path.join` is excellent for decoded values and literals. It becomes
substantially heavier for the real shape `readonly string[]` where every item
is known by the caller to be a segment. The sandbox excerpt above required
manual `Segment` mapping and a structured `RelDir`, then another structured
`RelFile` for the dynamic filename.

Directory literals also expose the intent tax:

```ts
Path.join(cwd, './apps/sandbox/src/oneTimeScripts/')
```

The trailing slash is required so the final literal is a directory; omitting it
proves a File. That grammar is internally coherent, but call sites with target
knowledge want to state the target directly rather than encode it through
punctuation.

Ideal feel: target-owned composition (`Dir.joinSegments`, `File.join`, or an
equivalent typed builder) that accepts an iterable of runtime segments and
preserves the requested result variant without fabricating encoded strings.

### Friction P4 — common query operations require variant dispatch

The ADT makes unary operations precise, but Heartbeat often starts with a
generic path:

- `dirname`: File `.dir`, Dir `.parent`;
- `basename`: File `.name`, Dir `.name: Option`;
- `extname`: File `.extension: Option`, no generic string operation;
- `parse`: distributed across variant getters, no one parsed view;
- `isAbsolute`: group guard only after a successful decode;
- `normalize`: schema decode requires target intent.

This is not inherently wrong—several distinctions are valuable—but a forced
replacement repeatedly needs the same exhaustive match. The missing layer is a
generic, typed query facade whose return types honestly represent variant
differences.

`basename(path, suffix)` is a concrete missing sub-operation. `.stem` only
models removal of the final extension; Heartbeat uses arbitrary suffix removal
at `libs/tool/src/config-file.ts:39`.

### Paper cut P5 — operation diagnostics say “constructors”

A real dynamic-string call to `Path.join` produced:

```text
error TS2345: Argument of type 'string' is not assignable to parameter of type
'"Path literal constructors require a string literal. Use a path schema codec
for dynamic strings, or decode the target schema at runtime.\u200B"'.
```

The rejection is correct; the wording is not. `join` is an operation, not a
literal constructor, so the shared guard message misidentifies the call site.

Ideal feel: literal-guard errors should name the receiving operation or use
operation-neutral wording.

### Paper cut P6 — component `make` cannot be passed directly to `Array.map`

The first dynamic-segment attempt was natural:

```ts
args.commandPath.map(Path.Segment.make)
```

TypeScript rejected it because the second callback argument (`index: number`)
collides with Schema's optional `MakeOptions` parameter:

```text
error TS2345: ... Types of parameters 'options' and 'index' are incompatible.
Type 'number' has no properties in common with type 'MakeOptions'.
```

The required wrapper was:

```ts
args.commandPath.map((part) => Path.Segment.make(part))
```

This is small, but it weakens the uniform “component producer” ergonomics at a
very common functional call site.

## Boundary and integration requirements — excluded from the Path verdict

These observations are real adoption work, but they do **not** indict the Path
algebra:

1. **Effect version alignment.** Heartbeat is on beta.78 and kitz requires
   beta.97. A scoped beta.97 install created incompatible Effect identities; a
   sandbox check reported `None<string>` missing `[NodeInspectSymbol]` against
   another `Option` copy. A workspace-wide beta.97 override made the migrated
   typechecks pass, but Heartbeat's beta.78-built Alchemy path then crashed with
   `TypeError: Schedule.either is not a function`. This is package/runtime
   compatibility work, not a Path-API finding.
2. **Filesystem value integration.** Node fs and child-process APIs take
   strings, so the fixture calls `.toString()` at those boundaries. A future
   schema-aware fs integration layer should accept path values and own native
   encoding. Repetition here is not a missing Path operation.
3. **External-input decoding.** Environment variables, CLI values, directory
   listings, module URLs, and Playwright metadata are strings/URLs. Proving them
   with schemas is the intended boundary behavior. Boilerplate belongs in the
   process/fs integration layer, not in the Path verdict.
4. **Temporary-path prefixes.** `mkdtemp` accepts an incomplete prefix that is
   neither a File nor a Dir. The fixture modeled it dishonestly as an `AbsFile`
   solely to preserve the no-trailing-slash string. This should be owned by a
   typed temp-files API, not added as a fake Path inhabitant.
5. **Effect service composition.** Replacing Effect platform `Path.Path` changes
   environment and error wiring because kitz exposes modeled values and pure
   operations, not a drop-in platform service. That is integration architecture,
   not algebra expressiveness.

### Migrator error: hand-decoding cwd

The fixture contains several forms of:

```ts
S.decodeSync(Path.AbsDir)(process.cwd())
```

Kitz already provides `Path.Cwd` and `Path.Cwd.layer`. Recording this as a
missing cwd story would be wrong. The migration should have used the existing
service and composed its typed `CwdError` at the process boundary. These inline
decodes are migrator error, not an integration requirement, and contribute
**zero** negative weight to the Path verdict.

## Genuine wins

### Literal-aware operations are substantially better than round 1

`Path.join(cwd, './.env')` typechecks directly and returns a precise variant.
The former constructor/literal ceremony is gone, and malformed/dynamic strings
still fail loudly.

### File/Dir target intent catches ambiguity before filesystem calls

Persona had to distinguish output directories from an API-reference file.
Node's `resolve` erased that distinction; the kitz migration made it part of the
program type. Dynamic command segments and artifact filenames were validated
as `Segment` and `FileName`, rejecting traversal, separators, NUL, and malformed
Unicode before they reached fs.

### URL interop is safer and clearer once the target is known

`AbsFile.FromUrl(...).dir` replaces a string `fileURLToPath` + `dirname` chain
with a proven absolute file followed by an unambiguous modeled parent. The
reverse direction, absolute value `.fileUrl`, is total and direct.

### Relative group safety is real

`relativeTo` statically keeps absolute targets with absolute bases and relative
targets with relative bases. Its result variant is precise, and relative-group
non-totality is represented with `Option` rather than hidden in string behavior.

### Canonicalization and equality remain strong

Traversal folds at decode, repeated separators normalize, invalid empty/NUL/
ill-formed paths reject, and modeled equality is normal-form equality. These
properties remove entire classes of string normalization mistakes.

## Reconciliation with the first two Heartbeat rounds

The source confirms that several earlier blockers are resolved:

- files no longer expose the misleading relocation `.parent` getter;
- literal duality now covers operations and producer `.make` overloads;
- `FileName.make` and component/set-parts string inputs are validated;
- target-specific `AbsFile.FromUrl` / `AbsDir.FromUrl` codecs exist;
- absolute `commonAncestor` can return `/`;
- native `Map` identity caveats are documented;
- empty strings, NUL, ill-formed Unicode, trailing-dot files, repeated
  separators, and dot-only literals have aligned runtime/type semantics.

Still live after round 3 are the deliberate canonical-display mismatch, the
native/Windows gap, full `resolve`, arbitrary suffix basename, and dynamic
iterable composition.

## Path-only adoption decision and top five changes

**Could Heartbeat use kitz Path as its only path library today, considering only
the Path API? No.** Windows/native inputs are not representable, and recreating
Node `resolve` in every consumer would amount to maintaining a second path
algebra. On POSIX-only slices, adoption is viable now for literal/decoded joins,
targeted URL conversion, relative relations, and modeled component access, but
the display and dynamic-composition taxes remain high enough to make a
whole-repository cut risky.

The five Path changes that would move that answer most are:

1. Add an honest native/Windows path algebra and explicit conversion to/from
   POSIX/module-specifier paths.
2. Add target-directed `resolve` with the full variadic/rightmost-absolute law.
3. Add named noncanonical display encoders for bare relative and
   no-directory-suffix consumer strings while retaining canonical identity.
4. Add iterable/target-owned composition for dynamic segments and dynamic final
   File/Dir intent.
5. Add a generic typed query facade for dirname/basename/extname/parse/
   isAbsolute use cases, including arbitrary basename-suffix removal.

Effect peer alignment and a Path-aware fs/process layer remain necessary for
actual deployment, but they are deliberately outside this Path-only decision.

## Fixture state

The Heartbeat evidence is permanent and committed at `42dd9258f4`; no further
migration is proposed by this report. The kitz repository was not modified
during the street test other than adding this report.
