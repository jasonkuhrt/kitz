# Experimental Oxlint Custom Rules (Effect-First)

This repo uses Oxlint experimental JS plugins to enforce Effect-first conventions.

- Plugin file: `tools/oxlint-custom-rules/plugin.mjs`
- Plugin alias: `kitz`
- Base severity: `warn`
- Strict custom-rule severity: `error` via `.oxlintrc.custom-strict.json`

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

## `kitz/no-type-assertion`

### Checks
Flags TypeScript assertion syntax:
- `value as T`
- `<T>value`

### Fail
```ts
const user = input as User
const name = <string>value
```

### Pass
```ts
const user = Schema.decodeUnknownSync(UserSchema)(input)
```

### Rationale
Assertion casts hide unsound assumptions and skip validation.

### Migration Guidance
Replace assertion casts with schema decode, parsing helpers, or explicit typed constructors.

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

## `kitz/no-throw`

### Checks
Flags `throw` in non-boundary modules.

### Allowed
- tests (`*.test.*`, `*.spec.*`, `__tests__`)
- boundary adapter/entrypoint paths (`src/cli`, `src/app`, `src/entrypoint`, `src/adapters`, `src/adaptors`, `src/live`, `bin`, `main.ts`, `cli.ts`, `entrypoint.ts`)

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
const now = yield* Clock.currentTimeMillis
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
const value = yield* Random.next
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
yield* Effect.logInfo('debug payload')
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
type Program = Effect.Effect<string, { _tag: 'ParseError'; message: string }, never>
```

### Rationale
Tagged errors improve narrowing, pattern matching, and explicit error algebra.

### Migration Guidance
Define error types with `_tag` discriminants (or named `*Error` types that follow tagged conventions).

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
