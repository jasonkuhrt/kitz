# Experimental Oxlint Custom Rules (Effect-First)

This repo uses two custom-rule paths:

- Oxlint experimental JS plugin rules (`kitz/*`) for Effect-first conventions.
- Official Oxlint type-aware rules (`typescript/*`) via `oxlint-tsgolint`.

- Plugin file: `tools/oxlint-custom-rules/plugin.mjs`
- Plugin alias: `kitz`
- Type-aware backend: `oxlint-tsgolint`
- Base severity: `warn`
- Strict custom-rule severity: `error` via `.oxlintrc.custom-strict.json`

Run type-aware rules with `--type-aware`:

```bash
pnpm exec oxlint --type-aware --import-plugin packages
```

## `kitz/no-json-parse`

### Checks

Flags `JSON.parse(...)` calls.

### Fail

```ts
const payload = JSON.parse(input)
```

### Pass

```ts
const decode = Schema.decodeUnknownSync(UserSchema)
const user = decode(input)
```

### Rationale

`JSON.parse` creates unchecked values and pushes validation errors downstream.

### Migration Guidance

Use Effect Schema decode/codec APIs at IO boundaries (HTTP, file, env, CLI input).

## `kitz/no-try-catch`

### Checks

Flags every `try {}` / `catch` / `finally` `TryStatement`.

### Fail

```ts
try {
  return read()
} catch {
  return fallback
}
```

### Pass

```ts
const program = Effect.try({
  try: () => read(),
  catch: (cause) => new ReadError({ cause }),
})
```

### Rationale

Native exceptions are untyped and bypass Effect error channels.

### Migration Guidance

Use `Effect.try`, `Effect.tryPromise`, `Either`, or `Option` depending on the failure model.

## `kitz/no-native-promise-construction`

### Checks

Flags `new Promise(...)` and `new globalThis.Promise(...)`.

### Fail

```ts
const task = new Promise((resolve) => resolve(1))
```

### Pass

```ts
const task = Effect.promise(() => fetch(url))
```

### Rationale

Manual Promise construction is untyped and does not compose with Effect interruption/supervision semantics.

### Migration Guidance

Use Effect constructors/combinators (`Effect.promise`, `Effect.async`, `Effect.tryPromise`, etc.).

## `typescript/no-unsafe-type-assertion`

### Checks

Flags TypeScript assertion syntax:

- `value as T`
- `<T>value`

This rule is available through official Oxlint type-aware mode, but it is currently disabled in this repo because it produces false positives for the repo's allowed function-body typing patterns.

Legacy JS plugin rule `kitz/no-type-assertion` is also disabled.

### Status

Disabled until we have a rule with near-zero false positives for complex implementation bodies.

### Rationale

Assertion casts hide unsound assumptions and skip validation.

### Migration Guidance

Prefer schema decode, parsing helpers, or explicit typed constructors where practical. For now, assertion cleanup is handled as targeted source work, not by an active blanket lint rule.

## `kitz/no-native-map-set-in-effect-modules`

### Checks

Only in `packages/release/src/**`:

- Flags `new Map()` / `new Set()`
- Flags `Map` / `Set` type annotations (e.g. `Map<K, V>`, `Set<T>`)

### Fail

```ts
const index: Map<string, number> = new Map()
const tags = new Set<string>()
```

### Pass

```ts
const index = HashMap.empty<string, number>()
const tags = HashSet.empty<string>()
```

### Rationale

Release module data structures should default to Effect collection primitives for compositional consistency.

### Migration Guidance

Prefer `HashMap` / `HashSet`; only use mutable variants when there is a measured and documented justification.

## `kitz/no-nodejs-builtin-imports`

### Checks

By default, flags:

- Node.js built-ins (`node:*` and bare built-ins like `fs`, `path`, `fs/promises`)
- `fs-extra`
- `pathe` (including subpaths)

Node built-ins have one explicit exception policy:

1. Resolve the linted file’s nearest `package.json`.
2. Decode `package.json` with Effect Schema (no `JSON.parse`).
3. Recursively walk `exports` and `imports` condition trees.
4. Build an allow-set of targets under Node-compatible condition keys:
   - `node`
   - `bun`
5. Allow Node built-ins only when the current file maps to one of those Node-compatible targets.
6. Fail closed when metadata is missing/unreadable/invalid, or when mapping cannot be established.

Notes:

- `fs-extra` and `pathe` remain disallowed (no condition-based exception).
- Only nearest `package.json` is considered.
- Matching is against relative package targets (for example `./build/*.js`, `./src/*.ts`).

### Fail

```ts
import fsExtra from 'fs-extra'
const pathUtils = await import('pathe/runtime')
import { readFileSync } from 'node:fs' // file not covered by node/bun conditions
```

### Pass

```ts
// package.json
// {
//   "exports": { ".": { "node": "./build/feature.js", "default": "./build/feature.js" } }
// }
import { readFileSync } from 'node:fs' // file maps from ./src/feature.ts -> ./build/feature.js
```

### Rationale

Switching `node:fs` to `fs` is a cosmetic alias change, not an architectural fix.

### Migration Guidance

Use Effect and `@kitz/*` abstractions instead of Node built-ins, `fs-extra`, and `pathe` in package code.

### Anti-Pattern Replacements

- Removed: ad hoc `JSON.parse` package metadata gate.
- Replaced with: schema-driven decode (`Schema.parseJson` + `Option`/`Either` pipeline).
- Removed: manual per-file allowlists.
- Replaced with: package condition-derived allow-set from `exports`/`imports`.

## `kitz/no-throw`

### Checks

Flags `throw` in non-boundary modules.

### Allowed

- tests (`*.test.*`, `*.spec.*`, `__tests__`)
- boundary adapter/entrypoint paths (`src/cli`, `src/app`, `src/entrypoint`, `src/adapters`, `src/adaptors`, `src/live`, `scripts`, `bin`, `main.ts`, `cli.ts`, `entrypoint.ts`)

### Fail

```ts
throw new Error('boom')
```

### Pass

```ts
return Effect.fail(new DomainError())
```

### Rationale

Thrown exceptions bypass typed failure channels and make composition less explicit.

### Migration Guidance

Model expected failures as typed `Effect.fail` / `Either` / `Option`; reserve `throw` for explicit adapter boundaries.

## `kitz/no-promise-then-chain`

### Checks

Flags `promise.then(...)`, `promise.catch(...)`, and `promise.finally(...)`.

### Fail

```ts
Promise.resolve(1).then((n) => n + 1)
```

### Pass

```ts
Effect.succeed(1).pipe(Effect.map((n) => n + 1))
```

### Rationale

Promise chain APIs encourage mixed async styles and reduce consistency in Effect-first code.

### Migration Guidance

Use Effect combinators for composition. If you must stay in async/await locally, avoid chain-style Promise operators.

## `kitz/no-effect-run-in-library-code`

### Checks

Flags `Effect.run*` calls in library modules.

### Allowed

- tests
- app/CLI entrypoint paths (same allow-list as `kitz/no-throw`)

### Fail

```ts
const value = Effect.runPromise(program)
```

### Pass

```ts
export const run = () => program
```

### Rationale

Library code should return Effects; runtime execution belongs at process boundaries.

### Migration Guidance

Return `Effect` values from libraries and run them only at app/CLI edges.

## `kitz/require-typed-effect-errors`

### Checks

Flags `Effect` type references whose error slot is `any` or `unknown`.

### Fail

```ts
type Program = Effect.Effect<string, any, never>
```

### Pass

```ts
type Program = Effect.Effect<string, DomainError, never>
```

### Rationale

`any`/`unknown` in error channels weakens exhaustiveness and erodes typed failure contracts.

### Migration Guidance

Define explicit domain error types (single class/union/tagged type) for Effect error channels.

## `kitz/require-schema-decode-at-boundary`

### Checks

For boundary-like modules (`env/http/file/fs/cli/request/handler/route/server` paths), if the file reads boundary input (`process.env`, `request.json/text/formData`, `readFile/readFileSync`) but does not call `Schema.decode*`, it is flagged.

### Fail

```ts
const payload = await request.json()
return payload
```

### Pass

```ts
const payload = await request.json()
return Schema.decodeUnknown(PayloadSchema)(payload)
```

### Rationale

Boundary input should be validated and typed as close to ingress as possible.

### Migration Guidance

Define local boundary schemas and decode immediately after reading env/HTTP/file inputs.

## `kitz/no-process-env-outside-config-modules`

### Checks

Flags `process.env` usage outside config/env modules.

### Allowed

- modules in `config/`, `configuration/`, or `env/`
- files named like `*.config.ts`, `config.ts`, `env.ts`
- tests

### Fail

```ts
const token = process.env.KITZ_TOKEN
```

### Pass

```ts
// src/config/env.ts
const token = process.env.KITZ_TOKEN
```

### Rationale

Scattered env reads create implicit dependencies and bypass centralized schema validation.

### Migration Guidance

Read env once in typed config modules, decode there, and pass typed config values downstream.

## `kitz/no-date-now-in-domain`

### Checks

Flags `Date.now()` and `globalThis.Date.now()` in non-boundary modules.

### Fail

```ts
const now = Date.now()
```

### Pass

```ts
const now = yield * Clock.currentTimeMillis
```

### Rationale

Direct wall-clock reads reduce determinism and testability in domain logic.

### Migration Guidance

Use Effect `Clock` service for time in libraries/domain modules; keep direct Date usage at boundaries only.

## `kitz/no-math-random-in-domain`

### Checks

Flags `Math.random()` and `globalThis.Math.random()` in non-boundary modules.

### Fail

```ts
const pick = Math.random()
```

### Pass

```ts
const value = yield * Random.next
```

### Rationale

Global randomness is hard to control in tests and weakens reproducibility.

### Migration Guidance

Use Effect `Random` service (or injected deterministic randomness) for domain/library logic.

## `kitz/no-console-in-effect-modules`

### Checks

In package source modules (`packages/*/src/**`, excluding tests/boundaries), flags `console.log/error/warn/info/debug/trace`.

### Fail

```ts
console.log('debug payload', payload)
```

### Pass

```ts
yield * Effect.logInfo('debug payload')
```

### Rationale

Console usage fragments observability and bypasses structured logging conventions.

### Migration Guidance

Prefer `Effect.log*` or explicit logging adapters/services.

## `kitz/require-tagged-error-types`

### Checks

Flags `Effect` error-channel type arguments that are not tagged (missing `_tag` semantics).

### Fail

```ts
type Program = Effect.Effect<string, { message: string }, never>
```

### Pass

```ts
type Program = Effect.Effect<
  string,
  { _tag: 'ParseError'; message: string },
  never
>
```

### Rationale

Tagged errors improve narrowing, pattern matching, and explicit error algebra.

### Migration Guidance

Define error types with `_tag` discriminants (or named `*Error` types that follow tagged conventions).

## `kitz/namespace-file-conventions`

### Checks

For `packages/*/src/**/_.ts`:

- requires exactly one value namespace export: `export * as Name from './...'`
- permits additional type-only exports (`export type ...`, `export type * from ...`)
- if a type is declared and exported directly in `_.ts`, its name must exactly match `Name`
- requires one exported JSDoc target for the ESM namespace export:
  - `export namespace Name {}`
  - or a matching in-file type target such as `export type Name = ...`
    `/** ... */ export namespace Name {}`
- requires `Name` to match:
  - PascalCase derivation from package/module path, or
  - explicit core anti-circular convention from `packages/core/package.json#imports` (`#*/core` → `Core*`)
- requires target path to match:
  - `./__.js` for explicit core anti-circular convention files
  - `./__.js` or `./<module>.js` otherwise

### Options

None.

### Fail

```ts
export * as Foo from './__.js'
```

```ts
export * as Foo from './__.js'
export namespace Foo {}
```

```ts
export * as Foo from './__.js'
export type Bar = string

/** JSDoc target for the Foo namespace export. */
export namespace Foo {}
```

### Pass

```ts
export * as GroupBy from './group-by.js'
export type { GroupByInput } from './group-by.types.js'
export type GroupBy = typeof import('./group-by.js')

/** JSDoc target for the GroupBy namespace export. */
export namespace GroupBy {}
```

### Rationale

Keeps namespace entrypoints uniform and predictable across packages/modules.

### Migration Guidance

Use one namespace export, keep extra exports type-only, and add a matching JSDoc target: either an empty namespace declaration or an in-file exported type with the same name.
If defining a type directly in `_.ts`, use the same name as the namespace export; define or re-export other type names from sibling files.
For `packages/core/src/*/core/_.ts`, align names with `packages/core/package.json#imports` (`#err/core` → `CoreErr`, etc.). The rule reads the imports entry as source of truth whether it points at source targets like `./src/err/core/_.ts` or build targets like `./build/err/core/_.js`.

## `kitz/barrel-file-conventions`

### Checks

For `packages/*/src/**/__.ts`:

- always forbids default export
- when `__.ts` aggregates peer implementation files in the same directory:
  - requires at least one export
  - allows only top-level import/export declarations
- when no peer implementation files exist:
  - allows `__.ts` to act as shorthand implementation file (non-barrel statements allowed)

### Options

None.

### Fail

```ts
import { value } from './value.js'
const x = value
```

### Pass

```ts
const cache = new Map<string, number>()
export const get = (key: string) => cache.get(key)
```

```ts
import type { Thing } from './thing.js'
export * from './thing.js'
```

### Rationale

Prevents barrels from accumulating executable logic and keeps them focused on composition/re-export.

### Migration Guidance

Use strict import/export-only barrels when aggregating peers. If a directory has no peer implementation files, `__.ts` can hold implementation logic (still no default export).

## `kitz/module-structure-conventions`

### Checks

- module directories are directories containing `_.ts`
- if module has multiple implementation files, `__.ts` is required
- for multi-file modules, `_.ts` must target `./__.js`
- for single-file elision (no `__.ts`), `_.ts` must target `./<implementation>.js`
- regular package roots must define both `src/_.ts` and `src/__.ts`

### Options

None.

### Fail

```ts
// alpha/_.ts in a module with alpha.ts + extra.ts and no __.ts
export * as Alpha from './alpha.js'
```

### Pass

```ts
// gamma/_.ts in a module with __.ts barrel
export * as Gamma from './__.js'
```

### Rationale

Codifies `_.ts`/`__.ts` elision conventions and prevents module layout drift.

### Migration Guidance

Add `__.ts` for multi-file modules, point multi-file namespace entrypoints to it, and ensure regular packages keep both root entrypoints.

## `kitz/no-deep-imports-when-namespace-entrypoint-exists`

### Checks

For `packages/*/src/**/*.ts` (excluding tests), flags relative imports that bypass a namespace boundary (`_.ts` file) in an ancestor directory.

A namespace boundary is a directory containing `_.ts`. Files inside that scope are private — external consumers must import through the door (`_.ts` or `__.ts`).

### Exempt

- Test files (`*.test.ts`, `*.spec.ts`, etc.)
- Imports targeting `_.ts` or `__.ts` (going through the door)
- Peer imports within the same directory
- `__.ts` barrel files importing implementation files within their own scope

### Fail

```ts
// src/consumer.ts imports past bar/_.ts wall
import { barImpl } from './bar/impl.js'
```

### Pass

```ts
// Through the door
import { Bar } from './bar/_.js'
import { barImpl } from './bar/__.js'

// No wall (directory has no _.ts)
import { helper } from './utils/helper.js'
```

### Rationale

Enforces that namespace boundaries are respected by consumers. The definition-side rules (`namespace-file-conventions`, `barrel-file-conventions`, `module-structure-conventions`) define how modules are built; this rule enforces how they are consumed.

### Migration Guidance

Replace deep imports with imports through the namespace entrypoint (`_.ts` or `__.ts`). If the target is not re-exported, add it to the barrel.

## `kitz/prefer-subpath-imports`

### Checks

For implementation files (not `_.ts`, `__.ts`, or tests), flags relative imports to door files (`_.ts`/`__.ts`) when a matching `#` subpath import exists in the package's `package.json`.

### Exempt

- Test files
- `_.ts` and `__.ts` files (structural files that define the module tree)
- Same-directory imports (intra-module references)
- Packages without an `imports` field in `package.json`

### Fail

```ts
// packages/core/src/ref/ref.ts — #lang exists in package.json
import { Lang } from '../lang/_.js'
```

### Pass

```ts
// Use the subpath import
import { Lang } from '#lang'

// No #imports field in package.json
import { Bar } from '../bar/_.js'
```

### Rationale

Subpath imports (`#`) provide a canonical, location-independent way to reference modules within a package. When they exist, relative paths to the same doors create redundant paths that drift when files move.

### Migration Guidance

Replace relative imports to `_.ts`/`__.ts` with the corresponding `#` subpath import from `package.json`.

## Running

### Lint (custom rules as warnings)

```bash
pnpm check:lint
```

### Strict lint (custom rules as errors)

```bash
pnpm check:lint:strict-custom-rules
```

### Rule test suite

```bash
pnpm test:oxlint-custom-rules
```
