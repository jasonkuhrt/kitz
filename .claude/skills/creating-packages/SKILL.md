---
name: creating-packages
description: Creates new packages in the @kitz monorepo with proper structure, configuration, and workspace integration. Handles package.json, tsconfigs, source files, and runs necessary sync scripts.
---

# Creating Packages

Create new packages in the monorepo with full scaffolding.

## Steps

1. Run the script at `.claude/skills/creating-packages/scripts/create-package.ts` with the package name as argument
2. Run `pnpm install` to link the new package in the workspace
3. Verify the package was created in `packages/<name>/`

## Reference

The script creates:

```
packages/<name>/
├── src/
│   ├── _.ts              # Namespace (export * as Name from './__.js')
│   └── __.ts             # Barrel (exports implementation)
├── package.json          # @kitz/<name> with workspace deps
├── tsconfig.json         # Development config
└── tsconfig.build.json   # Build config
```

Note: Packages always use `__.ts` for consistency, even when starting with a single implementation. Module elision (skipping `__.ts`) only applies within modules inside packages—see `creating-modules` skill.

Package naming:

- Input: `foo-bar` → Package: `@kitz/foo-bar`
- Input: `core` → Package: `@kitz/core`

## Notes

- Use `creating-modules` skill to add modules within the package
- The `kitz` aggregator package is separate and exports from all other packages
- After creating, you may want to add the new package to `kitz/src/` exports
