# Heartbeat path stress test — round 2

Target: `/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress`
on branch `kitz-path-stress`. Library source:
`/Users/jasonkuhrt/projects/jasonkuhrt/kitz-path-operations` on
`feat/restore-path-operations`.

This was a throwaway stress pass, not a migration. Probe edits were made in
Heartbeat source long enough to typecheck/runtime-check the evolved API, then
restored. The existing Heartbeat dependency wiring for `@kitz/effect` as
`file:/tmp/kitz-effect-stress` was left in place.

## Verdict

The evolved path API is materially better than round 1 at real Heartbeat sites:
`isWithin` cleanly replaces the `relative + startsWith('..') + isAbsolute`
containment guard, `relativeTo` removes manual `./` prefixing for config-file
imports, nested files make `.dir` composition natural, and the anchor statics
make walk-up loops easier to state.

The hardest blockers now are smaller but sharper: `setParts({ name })` is not a
string-facing rename API, URL-derived directories need explicit union narrowing,
`commonAncestor` drops the absolute anchor when `/` is the only common base, and
path values need an explicit equality-map story at native JS map boundaries.

Fixture refresh succeeded:

```text
$ vp run build
$ tsc -b tsconfig.production.json ◉ cache hit, replaying
---
vp run: cache hit, 174ms saved.
```

```text
$ pnpm install
Scope: all 96 workspace projects
[WARN] There are cyclic workspace dependencies: .../libs/effect-prisma-projector, .../tools/prisma-enricher
Lockfile is up to date, resolution step is skipped
Packages: +98 -33
Done in 9.7s using pnpm v11.8.0
```

Smoke from `tools/dev` against the reinstalled fixture:

```json
{
  "hasIsWithin": "function",
  "hasCommonAncestor": "function",
  "hasSetParts": "function",
  "hasRelSetParts": "function",
  "anchor": "/",
  "decoded": "/tmp/kitz/source.txt",
  "isWithin": true,
  "renamed": "/tmp/kitz/result.ts",
  "commonAncestor": "/tmp/kitz/"
}
```

The valid throwaway source edits in `tools/dev/src/reclaim.ts`,
`tools/dev/src/chrome-extension/source-paths.ts`, and
`tools/dev/src/repo/services.ts` typechecked:

```text
$ pnpm --dir /Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev run check:types:development
$ tsc --build ./tsconfig.development.json --pretty false --checkers 2 --builders 1
```

## New findings

### P1 — `setParts({ name })` is type-safe but too value-centric for rename sites

Heartbeat evidence:
`tools/prisma-linter/src/engine/enricher.ts:399` uses the basename-as-stem
idiom (`path.basename(params.file.path, '.ts')`), and file construction sites
such as `tools/dev/src/chrome-extension/source-paths.ts:23-25` naturally start
from string filenames.

The new `setParts` shape works, but the whole-name branch takes a `FileName`
value, not a string. That is precise, but it turns a common rename/re-extension
operation into `FileName.make` ceremony or pushes users to the
`stem`/`extension` branch.

Compiler probe:

```text
src/path-stress-round2-type-probe.ts(5,31): error TS2322: Type 'string' is not assignable to type 'FileName__'.
```

Runtime probe:

```json
{
  "original": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/manifest.template.json",
  "viaName": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/manifest.generated.json",
  "viaStemExtension": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/manifest.generated.json",
  "stringNameError": "Expected object, got \"manifest.generated.json\" |   at [\"fileName\"]"
}
```

Why it matters: this is not unsafe, but it is a DX trap in the exact API delta
round 2 is meant to validate. The obvious user input for `name` is a string
because `.name` reads as a string.

Ideation trigger: sites like this want either a string-friendly whole-name
branch or a very obvious filename constructor shortcut adjacent to `setParts`.

### P1 — `commonAncestor` cannot return the absolute anchor

Heartbeat evidence: the only real `path.parse` root-splitting site is
`tools/prisma-enricher/src/artifacts/emitRuntimeExtension.ts:69-74`; it slices
the POSIX root before segment analysis. Common-prefix/root logic has to handle
the filesystem anchor explicitly.

`AbsDir.anchor` exists and `isWithin(file, AbsDir.anchor)` is true, but
`commonAncestor('/apps/app.ts', '/libs/lib.ts')` returns `None` instead of
`Some('/')` when the only shared base is the anchor.

Probe:

```json
{
  "rootOnly": "None",
  "repoRoot": "Some(/repo/)",
  "rootAnchor": "/",
  "bothWithinRoot": [
    true,
    true
  ]
}
```

Why it matters: for absolute paths, `/` is a real ancestor and the new anchor
vocabulary makes it visible. Returning `None` here creates a special case at the
one place the model now has a named value for.

Ideation trigger: `commonAncestor` should probably return `AbsDir.anchor` for
absolute pairs whose common segment prefix is empty.

### P2 — `fromFileUrl` makes directory URL sites narrow a union by hand

Heartbeat evidence:
`tools/dev/src/chrome-extension/source-paths.ts:18-27` derives directories and
files from module-relative `file:` URLs. The source edit replacing
`fileURLToPath(new URL('.', moduleUrl))` had to decode with `fromFileUrl`, then
guard with `AbsDir.is` before `join`.

Runtime probe of the converted function:

```json
{
  "extensionRoot": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/",
  "extensionSrc": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/src/",
  "manifestTemplate": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/manifest.template.json",
  "nativeHostLauncherTemplate": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/native-host.sh",
  "repoRoot": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/",
  "viteConfig": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/chrome-extension/vite.config.mts",
  "_tag": "SourcePaths"
}
```

Why it matters: this is a common ESM `__dirname` replacement shape. The URL
expression itself carries the clue (`new URL('.', moduleUrl)` is a directory),
but the API returns `AbsFile | AbsDir`, so every such site pays a guard or
throws after decode.

Ideation trigger: URL sites want a typed `fromDirUrl` / `fromFileUrlAs` split or
a target-schema overload that mirrors `Schema.decodeSync(Path.AbsDir)(string)`.

### P2 — Path objects are equality-aware, but native `Map` keys still miss

Heartbeat evidence:
`tools/dev/src/repo/source-graph/consumers.ts:678`,
`tools/dev/src/repo/source-graph/consumers.ts:801-808`, and
`tools/dev/src/repo/typescript/analyzer.ts:748-755` key graph state by path
strings in Effect mutable maps.

Kitz path values compare structurally with Effect equality, but native `Map`
does not use that equality. A string-keyed path map cannot be mechanically
changed to `Map<Path.AbsFile, ...>` without changing the map implementation or
key boundary.

Probe:

```json
{
  "rawA": "/repo/tools/dev/../dev/tsconfig.json",
  "rawB": "/repo/tools/dev/tsconfig.json",
  "pathA": "/repo/tools/dev/tsconfig.json",
  "pathB": "/repo/tools/dev/tsconfig.json",
  "equal": true,
  "jsMapGetWithEqualPath": null,
  "effectHashMapGetWithEqualPath": "Some"
}
```

Why it matters: Heartbeat already uses Effect maps in the source-graph code, so
the good path is available. The migration trap is specifically native JS map or
set boundaries.

Ideation trigger: docs should call out "use Effect HashMap/HashSet or encode a
string key" for path-value keys.

### P3 — `AbsFile.make`'s anchor default is convenient but can hide an omitted dir

Heartbeat evidence:
`tools/dev/src/chrome-extension/native-host.ts:40-43` builds several files under
a computed dev-home directory. That construction pattern wants the containing
directory to be mandatory in application code, even though the model default is
valid for root files.

Probe:

```json
{
  "nodeDevHome": "/tmp/heartbeat-state/dev",
  "kitzDevHome": "/tmp/heartbeat-state/dev/",
  "socket": "/tmp/heartbeat-state/dev/native-host.sock",
  "anchor": "/",
  "makeDefaultDir": "/native-host.sock"
}
```

Why it matters: the default is algebraically valid and useful for literals, but
programmatic construction sites can accidentally create root files if `dir` is
forgotten. The type system permits that omission.

Ideation trigger: keep the model default, but consider whether public
constructor docs should steer application code toward `join(dir, relFile)` for
non-root files.

## What improved since round 1

`isWithin` is the right replacement for Heartbeat's containment guard at
`tools/dev/src/reclaim.ts:100-106`.

```json
[
  {
    "relative": "",
    "nodeGuard": true,
    "kitzGuard": true
  },
  {
    "relative": "tools/dev",
    "nodeGuard": true,
    "kitzGuard": true
  },
  {
    "relative": "../Heartbeat.other/tools/dev",
    "nodeGuard": false,
    "kitzGuard": false
  }
]
```

`relativeTo` cleanly replaces `dirname + relative + prefix './'` at
`tools/dev/src/repo/services.ts:49-53`.

```json
[
  {
    "fromConfig": "/repo/packages/app/tsconfig.json",
    "targetConfig": "/repo/packages/app/src/tsconfig.json",
    "nodeService": "./src/tsconfig.json",
    "kitz": "./src/tsconfig.json"
  },
  {
    "fromConfig": "/repo/packages/app/tsconfig.json",
    "targetConfig": "/repo/packages/lib/tsconfig.json",
    "nodeService": "../lib/tsconfig.json",
    "kitz": "../lib/tsconfig.json"
  }
]
```

`AbsDir.segments` can replace the only observed `path.parse(...).root` +
`slice(root.length).split(path.sep)` site at
`tools/prisma-enricher/src/artifacts/emitRuntimeExtension.ts:69-71`.

```json
{
  "nodeRoot": "/",
  "nodeSegments": [
    "parts",
    "prisma",
    "src",
    "__generated__",
    "client",
    "runtime"
  ],
  "kitzAnchor": "/",
  "kitzSegments": [
    "parts",
    "prisma",
    "src",
    "__generated__",
    "client",
    "runtime"
  ],
  "generatedIndexNode": 8,
  "generatedIndexKitz": 8
}
```

`Dir.parent` plus `isAnchor` makes dirname loops clearer at
`tools/dev/src/repo/source-graph/consumers.ts:107-115`.

```json
{
  "nodeWalk": [
    "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/repo/source-graph",
    "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/repo",
    "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src",
    "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev",
    "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools"
  ],
  "kitzWalk": [
    {
      "path": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/repo/source-graph/",
      "isAnchor": false
    },
    {
      "path": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/repo/",
      "isAnchor": false
    },
    {
      "path": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/src/",
      "isAnchor": false
    },
    {
      "path": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/dev/",
      "isAnchor": false
    },
    {
      "path": "/Users/jasonkuhrt/projects/heartbeat-chat/Heartbeat.kitz-path-stress/tools/",
      "isAnchor": false
    }
  ]
}
```

`AbsDir.anchor` and nested file shape both show up naturally in construction:
`join(absDir, relFile)` is clearer than `AbsFile.make` for non-root paths, and
`.dir` is the right boundary for config-file relative paths.

## Confirmations

- D1 cwd/resolve remains open: `tools/dev/src/chrome-extension/install-state.ts:367-372`
  still wants "realpath else resolve against cwd"; `ensureAbs` needs an
  explicit base and does not own cwd.
- D3 classification has a new real-site nuance:
  `tools/dev/src/repo/services.ts:55-67` intends `../lib` as a directory
  reference, but `Schema.decodeSync(Path.Rel)('../lib')` produced an `AbsFile`
  after `ensureAbs`; targeting `Path.RelDir` produced the intended
  `/repo/packages/lib/`.

```json
[
  {
    "referencePath": "../lib",
    "kitzKind": "AbsFile",
    "kitzResolved": "/repo/packages/lib",
    "kitzOut": "needs explicit reinterpretation/rejection"
  }
]
```

```json
{
  "relDir": "../lib/",
  "resolvedDir": "/repo/packages/lib/",
  "config": "/repo/packages/lib/tsconfig.json"
}
```

- String-boundary canonical forms still need local adapters:
  `tools/dev/src/repo/affected/workspace-package.ts:74-80` wants `tools/dev`,
  while `relativeTo(absDir, repoRoot)` gives `./tools/dev/`.

```json
{
  "nodeService": "tools/dev",
  "kitzRaw": "./tools/dev/",
  "kitzNodeBoundary": "tools/dev"
}
```

- `path.sep`/`path.posix` sites remain per-site redesigns, especially
  `tools/dev/src/repo/vite-plus/index.ts:125-126` and
  `tools/dev/src/repo/source-graph/consumers.ts:1849-1857`.

## Coverage note

Probed categories:

- rename/re-extension/component writes: `setParts` over a real
  `manifest.template.json` path, plus a failing type probe for string `name`.
- programmatic construction: dev-home/native-host paths and `AbsFile.make`
  default-dir behavior.
- containment: `tools/dev/src/reclaim.ts:100-106` converted to `isWithin`.
- common-prefix/root behavior: `commonAncestor` and `AbsDir.anchor`.
- root/anchor checks: `isAnchor`, `AbsDir.anchor`, and dirname-loop parent walk.
- `path.parse`/segment logic: the lone `path.parse` site in
  `tools/prisma-enricher/src/artifacts/emitRuntimeExtension.ts`.
- file-URL interop: `sourcePathsFromModuleUrl`.
- paths as map keys/comparisons: Effect equality vs native `Map`.
- relative/config-reference helpers: `configRelative`, `normalizeReferencePath`,
  and package-relative display strings.

Deliberately not probed beyond confirmation: broad cwd/`resolve` replacement,
bulk `join` conversion, `path.posix` redesign, multi-suffix
`basename(file, suffix)`, and package-wide migration. Those are either known
open items from round 1 or would require migration work rather than signal
hunting.
