# Contributing

This project is designed for Claude Code-assisted development. Common workflows are automated through skills.

## Skills

| Skill                      | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `creating-packages`        | Create new packages with full scaffolding      |
| `creating-modules`         | Add modules to existing packages               |
| `creating-rules`           | Add conventions with correct scoping           |
| `writing-tests`            | Test patterns and organization                 |
| `committing-changes`       | Conventional commits and CI validation         |
| `authoring-global-scripts` | Manage `_:*` template scripts                  |
| `syncing-tsconfig-paths`   | Keep tsconfig paths in sync with imports       |
| `refreshing-docs`          | Update README tables                           |
| `auditing-project`         | Check for out-of-band inconsistencies          |
| `kitz-cli-output`          | CLI output with Str.Builder and Effect Console |
| `kitz-data-modeling`       | Schema, Match, lookup tables for domain types  |
| `kitz-fs`                  | Filesystem and path operations with @kitz/fs   |
| `kitz-functions`           | Function design with currying patterns         |
| `kitz-services`            | Effect services with multiple implementations  |

Just describe what you need and Claude Code will handle it.

## Package Conventions

Some packages have their own conventions in `packages/<name>/.claude/CONVENTIONS.md`. These are auto-loaded via `.claude/rules/package-conventions.md` when working on that package.

## Architecture

Kitz is a Bun workspace monorepo with packages under `packages/`. All packages are scoped under `@kitz/` except the `kitz` aggregator-package.

**Build system**: Bun workspaces + tsgo (TypeScript Go port)

```bash
bun run build:packages                       # All packages
bun run --filter @kitz/core build            # Single package
```

**Cross-package dependencies**: Use `workspace:*` and import by package name. Note that `#` imports are scoped per-package - cross-package `#` imports are not valid.

## Commit Hook

`hooks/pre-commit` is tracked in the repo and installed by `bun run prepare`.

Run it manually with:

```bash
bun run pre-commit
```

The hook:

- formats and lints the staged snapshot, then syncs fixes back to the index
- blocks conflict markers and repo-local artifacts such as `.claude/*.local.md`, `.serena/cache/`, `.claude/worktrees/`, `.release/`, and `.DS_Store`
- requires tracked `hooks/*` scripts to stay executable and use a shell shebang
- runs `shellcheck` for staged shell scripts and `bun run check:ci` for staged GitHub workflow files
- runs `bun run check:types` when staged changes can affect TypeScript
- runs `bun run check:cov:packages` on every commit

## Linting (Custom Rules)

Custom Oxlint rules use two paths:

- Published Kitz rules package and presets: `packages/oxlint-rules/`
- Official Oxlint type-aware rules via the `oxlint-tsgolint` package

`kitz/ts/no-type-assertion` remains disabled. `typescript/no-unsafe-type-assertion` is also disabled for now because it is currently too noisy for this repo's function-body typing policy. `typescript/no-explicit-any` and `eslint-plugin-promise/prefer-await-to-then` are also temporarily disabled while the warning backlog is reduced. `kitz/error/no-throw` is temporarily disabled in repo lint configs while the remaining throw sites are migrated back onto typed failure channels; keep the rule implementation and fixture coverage intact so it can be restored once that backlog is cleared.

```bash
bun run check:lint                        # Lint (custom rules as warnings)
bun run check:lint:type-aware             # Lint with checker-backed rules enabled
bun run check:lint:strict-custom-rules    # Lint (custom rules as errors)
bun run check:lint:strict-custom-rules:type-aware
bun run test:oxlint-custom-rules          # Fixture tests for custom rules
bun run test:oxlint-rules                 # Fixtures + package preset surface
```

Rule details and migration guidance: `docs/oxlint-custom-rules.md`.

Recent convention refinements:

- `_.ts` namespace files now require a matching JSDoc `export namespace Name {}` declaration and may include type-only exports.
- `packages/core/src/*/core/_.ts` namespace names are validated from `packages/core/package.json#imports` (`#*/core`).
- `__.ts` files are strict barrels only when peer implementation files exist; otherwise shorthand implementation is allowed (default exports still forbidden).
- Convention rules run without per-file allowlists or package-root exceptions; fix violations in source.

## Common Errors

### TS2742: Inferred Type Cannot Be Named

```
error TS2742: The inferred type of 'X' cannot be named without a reference to
'../node_modules/@kitz/core/build/optic/lenses/returned.js'.
```

**Cause**: TypeScript declaration emit cannot do novel module resolution - it only uses specifiers resolved during program creation. When types are re-exported through ESM namespaces (`export * as X from`), TypeScript cannot discover a portable path to reference those types.

**Solution**: Library-side fix in `@kitz/core` (no consumer action needed):

1. Add internal subpath exports to `package.json`:

```json
{
  "exports": {
    "./_internal/optic-lenses/returned": "./build/optic/lenses/returned.js"
  }
}
```

2. In the library's barrel file, import and USE the internal modules in an exported type:

```typescript
// In @kitz/core/src/optic/__.ts
import type * as __returned from '@kitz/core/_internal/optic-lenses/returned'

/**
 * @internal DO NOT USE - Forces TypeScript to include internal module references
 * in declaration output. Required for consumer type inference.
 */
export type __InternalLensResolution = __returned.Get<never> | ...
```

**Key insight**: Empty imports (`import type {} from '...'`) and unused namespace imports get elided from `.d.ts` output. You must USE the imports in an exported type to preserve them in declarations.

See [TypeScript Issue #61700](https://github.com/microsoft/TypeScript/issues/61700) for full explanation.
