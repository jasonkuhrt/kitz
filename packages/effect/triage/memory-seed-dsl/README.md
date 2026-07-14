# Triage: memory-seed-dsl (parked, not deleted)

Parked on 2026-07-13. This directory is **outside** `src/`, so nothing here is
compiled, tested, linted, or packed. It is a holding area, not a module.

## What this is

The original `MemoryFileSystem` module bundled two separate concerns:

1. **The in-memory `FileSystem` layer** — the inode graph + `access` primitive.
2. **A declarative seed DSL** — `directory()`, `file()`, an `entries` layer
   option, `Entry`/`DirectoryEntry`/`FileEntry` types, and an
   `InitializationError` for tree construction.

Concern (1) was reshaped into the standard, boring form and now lives at
`src/file-system/memory.ts` as `FileSystem.layerMemory()` — an empty-start
layer, mirroring Effect's own `layerMemory` convention
(`KeyValueStore.layerMemory`, `FileSystem.layerNoop`). No construction DSL.

Concern (2) — the seed DSL — is parked here. It has no business living inside
the memory backend: seeding an initial tree is just running write operations
(`makeDirectory` / `writeString`), which is **backend-agnostic** (it works
against the Node layer too). Baking it into the memory layer both couples an
orthogonal feature to one backend and reimplements what the filesystem
operations already do.

## Files

- `entry.ts` — the `directory()` / `file()` seed constructors + `Entry` types.
- `InitializationError.ts` — the tree-construction error.
- `internal/state.ts` — the original graph; its `initialize`/`insert`/
  `entryAddress`/`locate` seed logic is what belongs to this feature (the
  graph core `emptyState`/`walk`/`Inode` was kept and lives in
  `src/file-system/internal/memory-graph.ts`).
- `layer.ts` — the original options-taking layer (`cwd` + `entries`).
- `exists-full.parked.ts` — the original `exists` test suite, including the
  seeded memory `exists` law and raw-relative-path semantics that need a
  populated fixture.

## Re-triage (when picked up)

Rebuild the seed capability as a **backend-agnostic** helper over the public
`FileSystem` write operations — e.g. `FileSystem.makeTree(entries)` that runs
against any layer — not as a memory-only DSL. At that point the seeded `exists`
law in `exists-full.parked.ts` can return and run against **both** Node and
memory. Relative imports in these files were left as-is and need fixups on
restore.
