# @kitz/effect

Filesystem operations and a typed path ADT for the [Effect](https://effect.website) ecosystem.

`@kitz/effect` layers kitz enhancements on top of Effect, exposed under Effect's own
domain terms:

- **`FileSystem`** — higher-level filesystem operations built on Effect's `FileSystem`
  service (read/write/copy/remove with typed paths, glob, an in-memory layer, a
  directory builder).
- **`Path`** — a typed path ADT (`AbsFile` | `AbsDir` | `RelFile` | `RelDir`) with
  schema-backed parsing, joining, and relationship queries.

```ts
import { Effect } from 'effect'
import { FileSystem, Path } from '@kitz/effect'

const file = Path.AbsFile.fromString('/home/user/config.json')

const program = Effect.gen(function* () {
  const text = yield* FileSystem.readString(file)
  return text
})
```

## Install

```sh
pnpm add @kitz/effect effect
```

`effect` is a **peer dependency** — you install it yourself, so your app and this
package share a single Effect instance (Effect relies on module-level singletons;
two copies break Context/Schema identity).

> **Pre-release:** this package targets Effect v4 (`effect@^4.0.0-beta.85`), which is
> still in beta. Pin accordingly.

## Runtime-agnostic by design

All filesystem I/O flows through Effect's `FileSystem` service. `@kitz/effect` does not
import `node:fs` for its core operations — you provide a platform layer, so the same
code runs on Node, Bun, or an in-memory filesystem.

```ts
import { Effect } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { FileSystem, Path } from '@kitz/effect'

const program = Effect.gen(function* () {
  const dir = Path.AbsDir.fromString('/tmp/out/')
  yield* FileSystem.write(Path.AbsFile.fromString('/tmp/out/hello.txt'), 'hi')
})

// Node:
program.pipe(Effect.provide(NodeContext.layer), Effect.runPromise)
```

For tests, provide the in-memory layer instead — no disk, no mocking:

```ts
import { FileSystem } from '@kitz/effect'

const testFs = FileSystem.Memory.layer({
  '/config.json': '{"name":"test"}',
})
```

> **Known limitation:** `FileSystem.glob` currently uses
> [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby) and reads the real
> filesystem directly (`node:fs`) rather than the injected `FileSystem` layer. Glob
> therefore works on Node/Bun but not the in-memory layer, and not on Deno. A
> layer-aware reimplementation is planned.

## Naming: kitz `FileSystem`/`Path` supersede Effect's

`@kitz/effect` deliberately names its namespaces `FileSystem` and `Path` to match
Effect's own modules. They are different things:

- kitz `Path` is a typed value ADT; Effect's `Path` is a string service.
- kitz `FileSystem` is a namespace of operations; Effect's `FileSystem` is the service tag.

`@kitz/effect` does **not** re-export Effect's same-named modules. If you need both in
one file, alias the Effect import:

```ts
import { FileSystem as EffectFS } from 'effect'
import { FileSystem, Path } from '@kitz/effect'

// EffectFS.FileSystem  -> the Effect service tag
// FileSystem.readString -> kitz operation
```

## Subpath exports

```ts
import { FileSystem, Path } from '@kitz/effect' // both namespaces
import { FileSystem } from '@kitz/effect/FileSystem' // just FileSystem
import { Path } from '@kitz/effect/Path' // just Path
```

## License

MIT
