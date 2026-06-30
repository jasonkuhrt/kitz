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
import { FileSystem, Path } from '@kitz/effect'
import { Effect } from 'effect'

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

## Subpath exports

```ts
import { FileSystem, Path } from '@kitz/effect' // both namespaces
import { FileSystem } from '@kitz/effect/FileSystem' // just FileSystem
import { Path } from '@kitz/effect/Path' // just Path
```

## License

MIT
