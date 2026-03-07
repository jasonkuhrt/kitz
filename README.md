# Kitz

A TypeScript standard library.

## About

- Accumulated value across various utility functions across various projects over years.
- Work in progress, breaking changes daily/weekly.

## Goals

- Maximum type safety
- Maximum tree shakability
- Maximum inline JSDoc
- Functional interface
- High performance (close to native as practical)
- Organized by data structure with consistent base interfaces (e.g. `Arr.is`, `Obj.is`, `Str.is`, ...)

## Documentation

For now read the code, things are very self contained.
I will focus on JSDoc before writing here.

## Installation

```sh
# Main package (includes all modules)
pnpm add kitz

# Or install individual packages
pnpm add @kitz/core
pnpm add @kitz/fs
pnpm add @kitz/cli
# ... etc
```

## Package Organization

Each regular scoped package can be imported as a namespace or barrel:

```ts
import { X } from '@kitz/x'
import * as X from '@kitz/x/__'
```

There are two non-regular special pacakges. The scoped core package and the unscoped metapackage.

The scoped core package has multiple modules and each can be imported as a namespace or barrel:

```ts
import { A, B, C /* ... */ } from '@kitz/core'
import * as A from '@kitz/core/a'
import * as B from '@kitz/core/b'
import * as C from '@kitz/core/c'
```

The metapackage re-exports all modules from all packages. The regular package re-exports the consumption pattern is:

```ts
import { X } from 'kitz'
import * as X from 'kitz/x'
```

For re-export of the special core package the consumption pattern is:

```ts
import { A, B, C /* ... */ } from 'kitz'
import * as A from 'kitz/a'
import * as B from 'kitz/b'
import * as C from 'kitz/c'
```

Notice that the core package has been flattened into the metapackage.

1. Its main entrypoint is a barrel of all scoped package main entrypoint exports (one namespace) and all core package main entrypoint exports (multiple namespaes).
2. Its additional entrypoints are one per scoped package (their barrel entrypoint) and one per scsoped core package's own additional entrypoints.

You will also find these conventions:

- Regular scoped packages: The exported namespace is pascal case of the package name (kebab case).
- Core scoped package: The exported namespaces are pascal case of each entrypoint name (kebaba case).

## Package Index

<!-- PACKAGES_TABLE_START -->

| Package                                               | Description                        |
| ----------------------------------------------------- | ---------------------------------- |
| [`@kitz/assert`](./packages/assert)                   | Assertion utilities                |
| [`@kitz/bldr`](./packages/bldr)                       | Builder pattern utilities          |
| [`@kitz/cli`](./packages/cli)                         | CLI framework                      |
| [`@kitz/color`](./packages/color)                     | Color manipulation utilities       |
| [`@kitz/config-manager`](./packages/config-manager)   | Configuration file management      |
| [`@kitz/configurator`](./packages/configurator)       | Configurator pattern utilities     |
| [`@kitz/core`](./packages/core)                       | Core data structures and utilities |
| [`@kitz/env`](./packages/env)                         | Environment variable utilities     |
| [`@kitz/fs`](./packages/fs)                           | Filesystem utilities               |
| [`@kitz/group`](./packages/group)                     | Grouping utilities                 |
| [`@kitz/html`](./packages/html)                       | HTML utilities                     |
| [`@kitz/http`](./packages/http)                       | HTTP utilities                     |
| [`@kitz/idx`](./packages/idx)                         | Index data structure               |
| [`@kitz/json`](./packages/json)                       | JSON utilities                     |
| [`@kitz/jsonc`](./packages/jsonc)                     | JSON with comments utilities       |
| [`kitz`](./packages/kitz)                             | A TypeScript standard library      |
| [`@kitz/log`](./packages/log)                         | Logging utilities                  |
| [`@kitz/manifest`](./packages/manifest)               | Manifest file utilities            |
| [`@kitz/mask`](./packages/mask)                       | Data masking utilities             |
| [`@kitz/mod`](./packages/mod)                         | Module utilities                   |
| [`@kitz/name`](./packages/name)                       | Naming convention utilities        |
| [`@kitz/num`](./packages/num)                         | Extended number utilities          |
| [`@kitz/oak`](./packages/oak)                         | CLI argument parsing               |
| [`@kitz/package-manager`](./packages/package-manager) | Package manager utilities          |
| [`@kitz/paka`](./packages/paka)                       | Package utilities                  |
| [`@kitz/prox`](./packages/prox)                       | Extended proxy utilities           |
| [`@kitz/ref`](./packages/ref)                         | Reference utilities                |
| [`@kitz/resource`](./packages/resource)               | Resource management utilities      |
| [`@kitz/sch`](./packages/sch)                         | Schema utilities                   |
| [`@kitz/semver`](./packages/semver)                   | Semantic versioning utilities      |
| [`@kitz/syn`](./packages/syn)                         | Syntax utilities                   |
| [`@kitz/test`](./packages/test)                       | Testing utilities                  |
| [`@kitz/tex`](./packages/tex)                         | Text and box formatting utilities  |
| [`@kitz/tree`](./packages/tree)                       | Tree data structure utilities      |
| [`@kitz/url`](./packages/url)                         | URL utilities                      |
| [`@kitz/ware`](./packages/ware)                       | Middleware utilities               |

<!-- PACKAGES_TABLE_END -->

## Core Package Namespace Index

<!-- CORE_NAMESPACE_INDEX_START -->

| Module      | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `Arr`       | Array utilities for working with readonly and mutable arrays.               |
| `Bool`      | Boolean utilities for logical operations and predicates.                    |
| `Err`       | Error handling utilities for robust error management.                       |
| `Fn`        | Function utilities for functional programming patterns.                     |
| `Lang`      | Language utilities for type inspection and formatting.                      |
| `Null`      | Null utilities for nullable type handling.                                  |
| `Num`       | Number utilities for numeric operations and type guards.                    |
| `Obj`       | Object utilities for working with plain JavaScript objects.                 |
| `Optic`     | Optic utilities for type-safe data access and transformation.               |
| `Pat`       | Pattern matching utilities for declarative value matching.                  |
| `Prom`      | Promise utilities for asynchronous operations.                              |
| `Prox`      | Proxy utilities for dynamic object behavior.                                |
| `Rec`       | Record utilities for working with plain JavaScript objects as dictionaries. |
| `Str`       | String utilities for text manipulation and analysis.                        |
| `Ts`        | TypeScript type utilities and type-level programming helpers.               |
| `Tup`       | Tuple utilities for fixed-length array operations.                          |
| `Undefined` | Undefined utilities for optional type handling.                             |

<!-- CORE_NAMESPACE_INDEX_END -->

## Global Settings

Kitz provides extensible global namespaces that you can augment via TypeScript declaration merging. This allows you to customize library behavior and extend type-level features for your project.

### How to Extend

Create a `.d.ts` file in your project (e.g., `types/kitz-settings.d.ts`) and augment the global namespace:

```typescript
// types/kitz-settings.d.ts
declare global {
  namespace KITZ {
    // Your augmentations here
  }
}
export {}
```

### `KITZ`

Library configuration settings.

#### `KITZ.Assert`

Type assertion behavior settings.

| Setting                      | Type      | Default | Description                                       |
| ---------------------------- | --------- | ------- | ------------------------------------------------- |
| `lintBidForExactPossibility` | `boolean` | `false` | Error when `bid` is used where `exact` would work |
| `showDiff`                   | `boolean` | `false` | Show detailed diff in type assertion errors       |

```typescript
declare global {
  namespace KITZ {
    interface Assert {
      showDiff: true
    }
  }
}
```

#### `KITZ.Perf.Settings`

Performance trade-off settings for type-level operations.

| Setting     | Type      | Default | Description                                                 |
| ----------- | --------- | ------- | ----------------------------------------------------------- |
| `allowSlow` | `boolean` | `false` | Enable slow type operations (e.g., `Str.Length` > 20 chars) |
| `depth`     | `number`  | `10`    | Default depth for `Simplify.Auto` recursion                 |

```typescript
declare global {
  namespace KITZ {
    namespace Perf {
      interface Settings {
        allowSlow: true
        depth: 5
      }
    }
  }
}
```

#### `KITZ.Simplify.Traversables`

Register custom container types for `Simplify` traversal.

```typescript
import type { Effect } from 'effect'
import type { Kind, Simplify } from 'kitz'

interface EffectTraverser extends Kind.Kind {
  return: this['parameters'] extends [infer $T, infer $DN, infer $SN]
    ? $T extends Effect.Effect<infer S, infer E, infer R>
      ? Effect.Effect<Simplify.To<$DN, S, $SN>, Simplify.To<$DN, E, $SN>, Simplify.To<$DN, R, $SN>>
      : never
    : never
}

declare global {
  namespace KITZ {
    namespace Simplify {
      interface Traversables {
        _effect: {
          extends: Effect.Effect<any, any, any>
          traverse: EffectTraverser
        }
      }
    }
  }
}
```

#### `KITZ.Ts.PreserveTypes`

Types to preserve during simplification (not expanded in IDE hovers).

```typescript
import type { MyBrandedType } from './my-types'

declare global {
  namespace KITZ {
    namespace Ts {
      interface PreserveTypes {
        _myBrand: MyBrandedType
      }
    }
  }
}
```

#### `KITZ.Ts.Error`

Error rendering settings.

| Setting          | Type      | Default | Description                                             |
| ---------------- | --------- | ------- | ------------------------------------------------------- |
| `errorKeyLength` | `number`  | `14`    | Min key length for error alignment (underscore padding) |
| `renderErrors`   | `boolean` | `true`  | Show full error object vs. message string only          |

### `KITZ.Traits.Display`

Type-level string representation trait. Add custom display handlers for your types.

```typescript
import type { Effect } from 'effect'
import type { Ts } from 'kitz'

declare global {
  namespace KITZ.Traits.Display {
    interface Handlers<$Type> {
      _effect: $Type extends Effect.Effect<infer A, infer E, infer R>
        ? `Effect<${Ts.Display<A>}, ${Ts.Display<E>}, ${Ts.Display<R>}>`
        : never
    }
  }
}
```

Built-in handlers include: `Array`, `ReadonlyArray`, `Promise`, `Date`, `RegExp`, `Function`, `symbol`.
