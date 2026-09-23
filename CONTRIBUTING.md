# Contributing

This repository is built for Claude Code-assisted development. Agents load this
file and [AGENTS.md](./AGENTS.md) (toolchain and commands) at startup, and
common workflows are packaged as skills.

## Architecture

A pnpm workspace that publishes one package:

| Member                                       | Role                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/effect`](./packages/effect)       | `@kitz/effect`: typed paths and Effect-native utilities, exposed as namespaces (`Path`, `Schema`, `String`, `Tuple`, `Types`). `effect` is a peer dependency. |
| [`packages/vitest`](./packages/vitest)       | `@kitz/vitest` (private): Effect-aware test helpers, the native property runner, and the path matchers.                                                       |
| [`generators/package`](./generators/package) | The `vp create package` scaffolder.                                                                                                                           |

New concepts land as namespaces inside `@kitz/effect` (the `creating-modules`
skill); a new package is the exception.

## Skills

| Skill                  | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `committing-changes`   | Conventional commits and CI validation                   |
| `creating-modules`     | Add a namespace to `@kitz/effect`                        |
| `creating-rules`       | Add conventions with the right scope                     |
| `filing-issues`        | File cold-startable GitHub bug and feature issues        |
| `fp-pipeline-refactor` | Refactor imperative TypeScript to Effect-first pipelines |
| `kitz-data-modeling`   | Schema, Match, and lookup tables for domain types        |
| `kitz-functions`       | Function design and currying conventions                 |
| `kitz-services`        | Effect services with multiple implementations            |

## Package conventions

A package can carry its own conventions in
`packages/<name>/.claude/CONVENTIONS.md`; `.claude/rules/package-conventions.md`
loads them when working in that package.

## Commit hook

`pnpm install` runs the root `prepare` script, which points `core.hooksPath` at
`hooks/`. `hooks/pre-commit` runs `vp staged`: oxfmt and oxlint over the staged
files, with fixes synced back into the index. Types, tests, the build, and the
package checks run in CI (`.github/workflows/pr.yml`).

## Lint

oxlint runs through `vp lint`, configured in the `lint` block of
[`vite.config.mts`](./vite.config.mts), which also documents every disabled or
tuned rule. Warnings are blocking. Type-aware linting is not enabled yet
([#128](https://github.com/jasonkuhrt/kitz/issues/128)).

## Common Errors

### TS2742: Inferred Type Cannot Be Named

```
error TS2742: The inferred type of 'X' cannot be named without a reference to
'../node_modules/@kitz/effect/build/<module>.js'.
```

**Cause**: TypeScript declaration emit cannot do novel module resolution; it only uses specifiers resolved during program creation. When types are re-exported through ESM namespaces (`export * as X from`), TypeScript cannot discover a portable path to reference those types.

**Solution**: Fix it library-side, so no consumer action is needed:

1. Add an internal subpath export for the module in `packages/effect/package.json` (in both `exports` and `publishConfig.exports`):

```json
{
  "exports": {
    "./_internal/<module>": "./src/<module>.ts"
  }
}
```

2. In the namespace barrel, import the internal module and USE it in an exported type:

```typescript
import type * as __module from '@kitz/effect/_internal/<module>'

/**
 * @internal DO NOT USE - Forces TypeScript to include internal module references
 * in declaration output. Required for consumer type inference.
 */
export type __InternalResolution = __module.SomeType<never>
```

**Key insight**: Empty imports (`import type {} from '...'`) and unused namespace imports get elided from `.d.ts` output. You must USE the imports in an exported type to preserve them in declarations.

See [TypeScript Issue #61700](https://github.com/microsoft/TypeScript/issues/61700) for the full explanation.

### TS7056: Inferred Type Exceeds Serialization Length

```
error TS7056: The inferred type of this node exceeds the maximum length the
compiler will serialize. An explicit type annotation is needed.
```

**Cause**: Declaration emit writes a _named reference_ for a cross-file type only when that type's symbol is exported/nameable; otherwise it expands the type structurally. Declaration emit also runs with truncation disabled, so a large expansion can blow past the compiler's ~1,000,000-character serialization cap (not configurable). The classic trigger is the `_`-class "dance" — a schema class declared under a `_` name and published through a value alias:

```typescript
class FileName_ extends S.String.pipe(S.decodeTo(FileName__, { ... })) {}
export const FileName = FileName_ // value alias — does NOT make the TYPE nameable
export type FileName = typeof FileName_.Type
```

The schema's real type symbol is `FileName_`. Left un-exported, any field that embeds it (`fileName: FileName`) gets the entire schema surface — every `Pipeable.pipe` overload, the full `Bottom` structure — inlined into the consumer's `.d.ts`. Nesting (every file path embeds `FileName`; every union embeds the files) multiplies the expansion until emit overflows.

**Solution**: `export` the `_` wrapper class so its symbol is nameable across files:

```typescript
export class FileName_ extends S.String.pipe(...) {}
```

Emit then writes `fileName: typeof import("./FileName.js").FileName_` (a reference) instead of inlining the structural type. Keep these `_` classes out of the public surface by re-exporting only the public binding from the barrel (`export { FileName } from './FileName.js'`, not `export *`).

**Key insight**: Explicit type annotations also work (they hand emit a small named type), but exporting the wrapper class is free and exact — it makes the type's _existing_ symbol nameable instead of forcing you to re-describe it. A directly-exported `export class Segment extends S.String.pipe(...)` never hits this; the `_` + `export const` indirection is what hides the symbol.
