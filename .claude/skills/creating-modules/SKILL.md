---
name: creating-modules
description: Add a namespace/module to a @kitz package — including extending the @kitz/effect namespaces. Covers the _.ts/__.ts barrel pattern, the package exports map, and import conventions.
---

# Creating Modules

A module is a PascalCase namespace inside a package. Two common cases:

- **Extend `@kitz/effect`** — add a new namespace (a concept) alongside
  `FileSystem` and `Path`. The lightweight alternative to a whole new package
  (`creating-packages`).
- **Add a module to any `@kitz/*` package** — the same mechanics anywhere.

Read `packages/effect/src/_.ts` (the root namespace bundle) and
`packages/effect/src/path/` (a submodule namespace) as the canonical examples.

## Structure

```
# Single source file (__.ts elided):
src/<module>/
├── _.ts              # namespace: export * as <Name> from './<module>.js'
├── _.test.ts
└── <module>.ts       # implementation

# Multiple source files:
src/<module>/
├── _.ts              # namespace: export * as <Name> from './__.js'
├── _.test.ts
├── __.ts             # barrel: export * from './impl.js'
└── *.ts
```

- Directory: kebab-case. Namespace export: PascalCase. Functions: camelCase, no
  namespace prefix (`by`, not `groupBy`).
- Prefer `export * from` in barrels; use named re-exports only to rename or exclude.
- **Elision**: when `__.ts` would re-export a single file, skip it and have `_.ts`
  export the implementation directly.

## Wire the namespace into the package

1. **Re-export from the package root** `src/_.ts`:

   ```ts
   export { <Name> } from './<module>/_.js'
   ```

2. **Add the package.json exports entry** — live-types, mirroring the existing
   entries (dev → `src`, publish → `build`):

   ```jsonc
   // exports
   "./<Name>": "./src/<module>/_.ts",
   // publishConfig.exports
   "./<Name>": { "types": "./build/<module>/_.d.ts", "default": "./build/<module>/_.js" }
   ```

3. **Verify**: `pnpm exec vp run check` and (if exported) `pnpm exec vp run check:package`.

## Imports

- **No `#` imports.** That convention was removed; packages no longer declare an
  `imports` map. Within a package, use relative imports (`./other/_.js`).
- **Cross-package**: import the namespace by package name and access members
  through it — `import { FileSystem, Path } from '@kitz/effect'`, then
  `Path.AbsFile`, `FileSystem.readString`.
