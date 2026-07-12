# FileSystem restoration plan — salvage the pre-strip `filesystem/` module

Date: 2026-07-11
Status: TEED UP — execution starts after the `feat/restore-path-operations` PR merges.
Companion: [filesystem-namespace-design.md](../specs/2026-07-11-filesystem-namespace-design.md) (the from-scratch design; this plan replaces "build" with "salvage + adapt" where old code already solves it).

## Salvage source — this branch's own history

The canonical source is **`c54c4f6c^`** — the tree immediately before this
branch's "only path" commit stripped the fs modules to focus the path
restoration. It is the most evolved fs implementation in kitz history,
superseding the older `@kitz/fs@1d9ac141` layout on every count:

```
packages/effect/src/filesystem/   (at c54c4f6c^)
├── filesystem.ts     1025 lines  — typed overlay over every effect FileSystem op
├── fs.ts               75 lines  — higher-level ops (findFirstUnderDir, …)
├── layers/memory.ts   359 lines  — in-memory FileSystem layer on @platformatic/vfs
└── service.ts          99 lines  — derived FileSystemService (R discharged)
```

Key commits: `c01d7dc7` (vfs-backed memory layer — hermetic, vfs used directly,
never mounted, node:fs never patched; typed via a local vfs.ts surface because
the package ships no types; swaps to `node:vfs` when Node releases it) and
`48e8421d` (layer-aware picomatch glob — walks through the FileSystem service,
so it works against ANY layer including memory).

NOT the source: `@kitz/fs@1d9ac141` (older layout; hand-rolled memory,
tinyglobby glob) and Heartbeat's `libs/effect-typescript/virtual-project/vfs.ts`
(a TypeScript compiler-host adapter over @platformatic/vfs — different concern,
not the fs service layer).

## What the salvage already solves (vs the design doc)

- **Fork A and then some**: free overlay functions AND a derived service —
  `service.ts` type-transforms every op to discharge the platform FileSystem
  requirement (`Discharge<T>`), documenting that overloaded dispatchers
  (read/write/rename) collapse to broad signatures in the service form while
  the free functions keep their overloads. The design doc's either/or was a
  false choice; the salvage ships the hybrid.
- **Fork B**: directory `read` already stat-classifies entries into typed
  locations (design option ii). The cheap-names variant still needs adding
  per Fork B's resolution (iii).
- **Memory testing layer**: `layers/memory.ts` — the real prim effect v4
  lacks (only layerNoop upstream). Built with `FileSystem.make` so derived
  ops (exists/readFileString/stream/sink) come from the primitives.
- **`InferFileContent`** (in filesystem.ts): extension→content-type inference
  on read/write (`.json`→Json object type, text→string, binary→Uint8Array).
  Bonus beyond the design doc.

## Adaptation map (salvage → current API)

1. **Path surface drift**: the salvage predates this PR's finalization —
   update to: `make` overloads (mk is gone), codec statics
   (`AbsDir.decodeSync` etc. from the path-final round), `join`/`joinAll`
   reshape, `format(options)`, group names as they now stand.
2. **Literal duality**: op signatures gain literal acceptance per the house
   machinery (didn't exist when the salvage was written).
3. **Design-doc reconciliations** (spec wins where they differ): typed temp
   options (`{ directory?: Dir; prefix?: Segment }`); readDirNames cheap
   variant; PlatformError passthrough (salvage already agrees).
4. **effect beta drift**: verify against beta.97 (option-type inlining,
   PlatformError constructors, FileSystem.make shape).
5. **Namespace wiring**: `FileSystem` namespace facade
   (`export * from 'effect/FileSystem'` + overlay), flattened subpath export
   per the new convention, README, creating-modules conventions.

## Dropped in that era — confirm intent at port time

`glob.ts`, `builder/`, `json-types.ts` existed at `c01d7dc7` but are absent at
`c54c4f6c^`. Check whether their removal was deliberate curation or strip
prep:

- glob: the `48e8421d` layer-aware picomatch version is strong (works against
  the memory layer); lean REVIVE.
- builder/ (scoped base-dir/temp DSL): lean DROP unless the port's tests want
  it (no-insurance-code).
- json-types.ts (15 lines): revive iff `InferFileContent` is kept.

## Execution steps (post-merge)

1. `git show c54c4f6c^:…` the four modules into
   `packages/effect/src/filesystem/`; adapt per the map; wire namespace +
   exports + docs.
2. Port/revive the memory layer and its vfs typing surface
   (`@platformatic/vfs` returns as a dependency — it was dropped as unused in
   `f4034989` only because the strip orphaned it).
3. Glob decision + revival if kept.
4. Tests: op coverage against the memory layer + real-fs smoke; type pins for
   literal duality, service Discharge, InferFileContent if kept.
5. Street round 4 on the standing Heartbeat worktree: forced
   `node:fs` + direct `effect/FileSystem` replacement over the migrated
   slices — the fs half of the four-way ban; measure whether the
   `.toString()` tax disappears.

## Open decisions for review before execution

- `InferFileContent`: keep or drop (lean keep — shipped, typed, real DX).
- glob revival (lean yes, the layer-aware picomatch version).
- builder/ (lean drop).
- Design Forks C (option defaults — lean keep effect's) and D (watch/dangling
  readLink typing — lean defer) — unchanged from the design doc.
- Service form naming and whether both free functions AND the service ship in
  v1 (salvage shipped both; lean both — the Discharge caveat is documented).
