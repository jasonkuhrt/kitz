# Kitz

A TypeScript standard library organized as namespace modules, each wrapping a data structure or domain with a consistent API surface.

## Overview

Kitz provides typed utility functions and type-level programming tools for everyday TypeScript development. Each package exports a pascal-case namespace (`Str`, `Arr`, `Fs`, `Cli`, ...) that groups related operations under a single import. The core package bundles the fundamental data-structure modules; scoped packages cover higher-level domains like filesystems, HTTP, and CLI argument parsing. A metapackage, `kitz`, re-exports every namespace from a single dependency.

TypeScript's standard library is thin. Third-party utility packages exist, but they fragment the import graph and rarely compose. Kitz consolidates these into one workspace with shared conventions: consistent naming, uniform export shapes, and a global settings system that lets consumers tune type-level behavior through declaration merging.

Use Kitz when you want a single source for data-structure utilities, type-level helpers, and domain modules that share a namespace convention. If you need only one narrow utility and want zero transitive dependencies, a standalone package is a better fit.

Design goals:

- **Namespace-per-module** -- every package exposes one pascal-case namespace (or, in core's case, many), keeping the import graph flat and predictable.
- **Type-level power** -- modules like `Ts`, `Optic`, and `Pat` operate at the type level with configurable performance trade-offs.
- **Incremental adoption** -- install the metapackage for everything, or pick individual `@kitz/*` packages.

## Setup

```bash
# Metapackage -- all library namespaces from one dependency
pnpm add kitz

# Or install individual packages
pnpm add @kitz/core @kitz/fs @kitz/cli
```

Optional peer dependency: `effect@^3.17` (required only if you use Effect integration points in `@kitz/core`).

## Terminology

| Term             | Meaning                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Namespace        | The pascal-case export that a package provides (e.g., `Fs`, `Cli`, `Arr`)                                   |
| Core package     | `@kitz/core` -- bundles the fundamental data-structure namespaces (`Arr`, `Str`, `Obj`, `Ts`, and others)   |
| Scoped package   | Any `@kitz/*` package that exports a single namespace                                                       |
| Metapackage      | The unscoped `kitz` package that re-exports every namespace from every scoped package                       |
| Barrel import    | Importing from the package root (`@kitz/fs`) to get a named export                                          |
| Namespace import | Importing from the `__` subpath (`@kitz/fs/__`) to get a star-importable module                             |
| Global settings  | The `KITZ` global namespace that consumers augment via declaration merging to configure type-level behavior |

## Core Concepts

### Import conventions

You need a namespace in scope. There are two ways to get it, depending on whether you want a named export or a star import.

The barrel import pulls a named export from the package root:

```typescript
import { Fs } from '@kitz/fs'
```

The namespace import star-imports the `__` subpath, which is useful when you want the namespace itself as the module binding:

```typescript
import * as Fs from '@kitz/fs/__'
```

The core package exports multiple namespaces, so its barrel gives you several named exports at once:

```typescript
import { Arr, Str, Obj } from '@kitz/core'
```

Each core namespace also has its own subpath for star imports:

```typescript
import * as Arr from '@kitz/core/arr'
```

The metapackage flattens everything. Core namespaces and scoped-package namespaces sit side by side:

```typescript
import { Arr, Str, Fs, Cli } from 'kitz'
import * as Arr from 'kitz/arr'
import * as Fs from 'kitz/fs'
```

Namespace naming follows a simple rule: pascal-case the kebab-case package name. `@kitz/fs` becomes `Fs`, `@kitz/cli` becomes `Cli`. One exception: `@kitz/num` exports as `ExtNum` through the metapackage to avoid colliding with core's `Num`.

### Global settings

Some type-level operations -- simplification depth, slow-path opt-in, error rendering -- need project-wide configuration that can't live in function arguments. Kitz solves this with a `KITZ` global namespace that you augment via TypeScript declaration merging.

Create a `.d.ts` file in your project and extend the relevant interface:

```typescript
// types/kitz-settings.d.ts
declare global {
  namespace KITZ {
    namespace Perf {
      interface Settings {
        allowSlow: true
      }
    }
  }
}
export {}
```

The available settings interfaces:

**`KITZ.Assert`** -- controls type assertion behavior.

| Setting                      | Type      | Default | Effect                                                                    |
| ---------------------------- | --------- | ------- | ------------------------------------------------------------------------- |
| `lintBidForExactPossibility` | `boolean` | `false` | Errors when `bid` is used where `exact` would suffice                     |
| `showDiff`                   | `boolean` | `false` | Includes structured diffs (missing, excess, mismatch) in assertion errors |

**`KITZ.Perf.Settings`** -- performance trade-offs for type-level computation.

| Setting     | Type      | Default | Effect                                                                             |
| ----------- | --------- | ------- | ---------------------------------------------------------------------------------- |
| `allowSlow` | `boolean` | `false` | Enables recursive slow paths for operations like `Str.Length` beyond 20 characters |
| `depth`     | `number`  | `10`    | Maximum recursion depth for `Simplify.Auto`                                        |

**`KITZ.Simplify.Traversables`** -- registers custom container types for `Simplify` traversal. Each entry specifies a type pattern to match and an HKT to apply:

```typescript
interface Traversables {
  _effect: {
    extends: Effect.Effect<any, any, any>
    traverse: EffectTraverser // HKT receiving [$T, $DepthNext, $SeenNext]
  }
}
```

**`KITZ.Ts.PreserveTypes`** -- types added here are never expanded during simplification or display (they appear as-is in IDE hovers):

```typescript
interface PreserveTypes {
  _myBrand: MyBrandedType
}
```

**`KITZ.Ts.Error`** -- error rendering in IDE hovers.

| Setting          | Type      | Default | Effect                                                                    |
| ---------------- | --------- | ------- | ------------------------------------------------------------------------- |
| `errorKeyLength` | `number`  | `14`    | Minimum key width for underscore-padded alignment in error objects        |
| `renderErrors`   | `boolean` | `true`  | `true` shows the full error object; `false` shows only the message string |

**`KITZ.Traits.Display.Handlers`** -- registers custom type-to-string renderers. Built-in handlers cover `Array`, `ReadonlyArray`, `Promise`, `Date`, `RegExp`, `Function`, and `symbol`:

```typescript
interface Handlers<$Type> {
  _effect: $Type extends Effect.Effect<infer A, infer E, infer R>
    ? `Effect<${Ts.Display<A>}, ${Ts.Display<E>}, ${Ts.Display<R>}>`
    : never
}
```

## Package Index

Packages fall into two groups: library packages re-exported through the metapackage, and tooling packages used internally for release and code generation.

### Library Packages

<!-- PACKAGES_TABLE_START -->

| Package                                 | Namespace    | Description                                                                            |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| [`@kitz/assert`](./packages/assert)     | `Assert`     | Type-level and runtime assertion builder with configurable diff output                 |
| [`@kitz/bldr`](./packages/bldr)         | `Bldr`       | Fluent builder-pattern constructor with callable and mutable variants                  |
| [`@kitz/cli`](./packages/cli)           | `Cli`        | CLI framework: argument parsing, parameter definitions, and command dispatch           |
| [`@kitz/color`](./packages/color)       | `Color`      | Color parsing, conversion, and named-color lookup                                      |
| [`@kitz/conf`](./packages/conf)         | `Conf`       | Configuration file discovery, loading, and validation                                  |
| [`@kitz/core`](./packages/core)         | _(multiple)_ | Fundamental data-structure namespaces (see Core Namespace Index below)                 |
| [`@kitz/env`](./packages/env)           | `Env`        | Cross-runtime environment variable access (Node, Bun, Deno, browser)                   |
| [`@kitz/fs`](./packages/fs)             | `Fs`         | Filesystem operations, glob matching, and path analysis                                |
| [`@kitz/group`](./packages/group)       | `Group`      | Partition collections into named groups                                                |
| [`@kitz/html`](./packages/html)         | `Html`       | HTML string construction                                                               |
| [`@kitz/http`](./packages/http)         | `Http`       | HTTP primitives: methods, status codes, headers, MIME types, request/response builders |
| [`@kitz/idx`](./packages/idx)           | `Idx`        | Indexed key-value collection with order-preserving operations                          |
| [`@kitz/json`](./packages/json)         | `Json`       | JSON parse/stringify with typed error handling                                         |
| [`@kitz/jsonc`](./packages/jsonc)       | `Jsonc`      | JSON-with-comments parse/stringify                                                     |
| [`@kitz/log`](./packages/log)           | `Log`        | Structured logger with levels, filters, and pluggable renderers                        |
| [`@kitz/mod`](./packages/mod)           | `Mod`        | Dynamic module import with error normalization                                         |
| [`@kitz/monorepo`](./packages/monorepo) | `Monorepo`   | pnpm workspace introspection and package discovery                                     |
| [`@kitz/name`](./packages/name)         | `Name`       | Case conversion between camel, pascal, kebab, snake, and other naming conventions      |
| [`@kitz/num`](./packages/num)           | `ExtNum`     | Branded numeric types: integers, floats, fractions, complex numbers, even/odd, degrees |
| [`@kitz/oak`](./packages/oak)           | `Oak`        | Declarative CLI argument parser with typed command trees                               |
| [`@kitz/paka`](./packages/paka)         | `Paka`       | Package metadata extraction and JSDoc generation from Markdown                         |
| [`@kitz/pkg`](./packages/pkg)           | `Pkg`        | package.json schema, version pin types, and package-manager detection                  |
| [`@kitz/resource`](./packages/resource) | `Resource`   | JSONC-backed resource files with typed read/write                                      |
| [`@kitz/sch`](./packages/sch)           | `Sch`        | Schema AST, struct definitions, tagged unions, and hashable types                      |
| [`@kitz/semver`](./packages/semver)     | `Semver`     | Semver parsing, comparison, and pre-release identifier handling                        |
| [`@kitz/syn`](./packages/syn)           | `Syn`        | Syntax utilities for Markdown, TypeScript AST, and TSDoc                               |
| [`@kitz/test`](./packages/test)         | `Test`       | Custom matchers, property-based test helpers, and table-driven test scaffolding        |
| [`@kitz/tex`](./packages/tex)           | `Tex`        | Text box layout, glyph rendering, and chainable string formatting                      |
| [`@kitz/tree`](./packages/tree)         | `Tree`       | Generic tree data structure with traversal, conversion, and query operations           |
| [`@kitz/url`](./packages/url)           | `Url`        | URL construction and manipulation                                                      |
| [`@kitz/ware`](./packages/ware)         | `Ware`       | Typed middleware pipelines with extensions, interceptors, and overloads                |
| [`kitz`](./packages/kitz)               | _(all)_      | Metapackage re-exporting every library namespace                                       |

<!-- PACKAGES_TABLE_END -->

### Tooling Packages

These support the release pipeline and code generation. They are not re-exported through the metapackage.

| Package                                                         | Description                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@kitz/conventional-commits`](./packages/conventional-commits) | Conventional-commit message parser                                    |
| [`@kitz/doc-inject`](./packages/doc-inject)                     | Injects generated content into Markdown files between marker comments |
| [`@kitz/flo`](./packages/flo)                                   | Composable async pipeline runner for build and release steps          |
| [`@kitz/git`](./packages/git)                                   | Typed wrappers around Git CLI operations                              |
| [`@kitz/github`](./packages/github)                             | GitHub REST API client for releases and pull requests                 |
| [`@kitz/npm-registry`](./packages/npm-registry)                 | npm registry HTTP client for version queries and publishing           |
| [`@kitz/release`](./packages/release)                           | Monorepo release automation: changelog, version bump, publish         |

### Core Namespace Index

The core package bundles these namespaces. Each is also available as a subpath import (`@kitz/core/arr`, `@kitz/core/str`, etc.).

<!-- CORE_NAMESPACE_INDEX_START -->

| Namespace   | Description                                                                       |
| ----------- | --------------------------------------------------------------------------------- |
| `Arr`       | Typed array operations for readonly and mutable arrays                            |
| `Bool`      | Logical combinators and predicate composition                                     |
| `Date`      | Date arithmetic and duration types                                                |
| `Err`       | Static error types with structured fields for type-level error reporting          |
| `Fn`        | Function composition, HKT (higher-kinded type) encoding, and kind application     |
| `Lang`      | Runtime type inspection, pretty-printing, and built-in type detection             |
| `Mask`      | Data masking: binary show/hide and property-level pick/omit filters               |
| `Null`      | Nullable-type narrowing and fallback combinators                                  |
| `Num`       | Numeric type guards, literal types, and arithmetic constraints                    |
| `Obj`       | Plain-object manipulation: pick, omit, merge, deep access                         |
| `Optic`     | Type-safe lenses for nested data access and transformation                        |
| `Pat`       | Declarative pattern matching with exhaustiveness checking                         |
| `Prom`      | Promise combinators and typed async error handling                                |
| `Prox`      | Proxy-based dynamic object behaviors                                              |
| `Rec`       | Record (dictionary) operations: map, filter, invert, group                        |
| `Ref`       | Mutable reference cell                                                            |
| `Str`       | String manipulation, template-literal types, and text analysis                    |
| `Ts`        | Type-level programming: simplification, display traits, variance, error rendering |
| `Tup`       | Fixed-length tuple operations: head, tail, zip, concat                            |
| `Undefined` | Optional-type narrowing and default-value combinators                             |

<!-- CORE_NAMESPACE_INDEX_END -->

## Development

```bash
pnpm install               # bootstrap workspace
turbo build                 # build all packages
turbo run check:types       # typecheck all packages
pnpm run check:lint         # lint with oxlint
pnpm run format             # format with oxfmt
```
