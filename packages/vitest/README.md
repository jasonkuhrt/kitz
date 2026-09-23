# @kitz/vitest

Internal, private test helper package for this workspace. It is not part of
the published `@kitz/effect` API; it centralizes the Vite+-backed Vitest
surface and kitz-specific matchers used by repo tests.

## Source Exports

The package exports point at `src`:

```json
{
  ".": "./src/index.ts",
  "./setup": "./src/setup.ts"
}
```

That is intentional for the workspace toolchain. Vite+ consumes TypeScript
source directly during tests, and keeping the exports on `src` avoids a build
step before running local or CI test suites.

## Property Tests

Property tests run on Effect's native `Arbitrary` runner
(`effect/unstable/arbitrary`). Inputs are Schemas, derived with
`Arbitrary.schema`, or native `Arbitrary` values, given as a tuple or a record;
the body receives values of the same shape.

```ts
import { Path } from '@kitz/effect'
import { assertProperty, expect, it } from '@kitz/vitest'
import { Effect } from 'effect'

// A synchronous law.
it('join onto an absolute dir yields an absolute path', () => {
  assertProperty([Path.AbsDir, Path.RelFile], ([dir, file]) => {
    expect(Path.join(dir, file)._tag).toBe('AbsFile')
  })
})

// An effectful law. Each run gets a fresh Scope, TestClock and TestConsole.
it.effect.prop('AbsDir round-trips through its codec', { dir: Path.AbsDir }, ({ dir }) =>
  Effect.sync(() => {
    expect(Path.AbsDir.decodeSync(Path.AbsDir.encodeSync(dir))).toEqual(dir)
  }),
)
```

Falsification works as in `@effect/vitest`: a failing run reports the shrunk
input and a replay token. Pass native check options (runs, seed, …) through the
test options' `arbitrary` field. `it.prop` remains as an alias of
`it.effect.prop`.

## Dependencies

Runtime dependencies:

- `effect` — used by the Effect-native test helpers and equality tester.
- `vite-plus` — resolved from the workspace catalog (`pnpm-workspace.yaml`),
  the same pin the root uses, so the exported test surface matches the runner
  used by `vp test`.

Workspace dependency topology:

- `@kitz/effect` is a peer dependency because the path matchers assert against
  its path value types.
- `@kitz/effect` is also a dev dependency so this private workspace package can
  type-check and test locally.

The companion direction is intentional: production code does not depend on
`@kitz/vitest`; tests import the Vitest API from this package so they get one
Vite+-owned Vitest instance plus the kitz matcher layer.

## Matcher Types

Vite+ documents upstream Vitest augmentation as the general target for custom
matcher types. Test code in this repo never imports `vitest` or `@vitest/*`:
Vite+ owns the single Vitest copy, and tests reach it through `vite-plus/test`
(re-exported here). The only direct `vitest` declaration is the peer that
`@vitest/coverage-v8` requires, pinned to the version Vite+ bundles. The path
matcher declarations therefore augment `vite-plus/test`, the shim identity
test code actually resolves. They follow Vitest 5's `Matchers<R, T>` shape
(`R`: assertion return, `T`: received type).

Revisit this if Vite+ ships a types-only augmentation entry point that preserves
the same single-copy dependency rule.
