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

## Dependencies

Runtime dependencies:

- `effect` — used by the Effect-native test helpers and equality tester.
- `vite-plus` — pinned at `0.2.1` so the exported test surface matches the
  runner used by `vp test`.

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
matcher types. This repo deliberately does not depend on `vitest` or
`@vitest/*` directly: Vite+ owns the single Vitest copy so tests remain safe
under global virtual store installs. The path matcher declarations therefore
augment `vite-plus/test`, the shim identity this repo actually resolves.

Revisit this if Vite+ ships a types-only augmentation entry point that preserves
the same single-copy dependency rule.
