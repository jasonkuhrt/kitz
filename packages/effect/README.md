# @kitz/effect

A typed path ADT and Effect-native utilities for the [Effect](https://effect.website) ecosystem.

`@kitz/effect` layers kitz enhancements on top of Effect, exposed under Effect's own
domain terms:

- **`Path`** — a typed path ADT (`AbsFile` | `AbsDir` | `RelFile` | `RelDir`) with
  schema-backed parsing. Values carry instance getters (`.name`, `.stem`,
  `.extension`, `.dir` on files, `.parent` on dirs, `.ancestors`,
  `.asDir`/`.asFile`, `.atRoot`, `.fileUrl`, …); multi-path operations are flat
  functions (`join`, `relativeTo`,
  `ensureAbs`, `isDescendantOf`, `getSharedBase`, `withExtension`, `order`, …);
  `fromLiteral` infers the precise variant from string literals at the type level.
- **`Schema`** — small additions to Effect Schema (e.g. `NaturalInt`).
- **`String`** — string utilities.

```ts
import { Path } from '@kitz/effect'
import { Schema } from 'effect'

const config = Path.fromLiteral('/home/user/config.json') // typed AbsFile
const cwd = Path.AbsDir.fromLiteral('/home/user') // dir targets accept no trailing slash

Path.join(cwd, Path.fromLiteral('./notes/todo.md')) // AbsFile /home/user/notes/todo.md
config.dir.toString() // '/home/user/' — a file's tree parent is its containing dir
Schema.decodeSync(Path.Any)(process.argv[2] ?? '.') // runtime strings decode to the union
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
import { Path, Schema, String } from '@kitz/effect' // all namespaces
import { Path } from '@kitz/effect/Path' // just Path
```

## Property testing

Every model schema derives a fast-check arbitrary on demand — the canonical
one covers the model's whole domain, and each model carries a `Realistic`
variant schema biased toward readable real-world values:

```ts
import { Schema } from 'effect'

Schema.toArbitrary(Path.AbsFile) // full domain — use for laws
Schema.toArbitrary(Path.AbsFile.Realistic) // readable 20:1 mix — use for shrink output
```

Vitest matchers for path values (`toBeAbs`, `toEncodeTo`, `toBeWithinPath`, …)
live in the companion package `@kitz/vitest`.

## License

MIT
