# Effect v4 API Reference

## Source Location

Read the source of the exact installed version first: the `effect` package ships
its TypeScript source under `node_modules/effect/src/`. For history, changelogs,
and neighboring versions, the Effect monorepo is cloned at
`~/repo-references/effect` (v4 is its `main` line; releases are tagged
`effect@<version>`, e.g. `git show effect@4.0.0-rc.117:packages/effect/src/Schema.ts`).
Always read the source before using Effect APIs — v4 moved fast through its
beta and release-candidate lines, and docs or memory from an earlier release are
often wrong.

## Critical: Effect v4 API Differences

This repo uses `effect@4.0.0-rc.117` (peer dependency of `@kitz/effect`). Many
patterns from v3 docs, and from early v4 betas, are wrong now. Every claim below
was re-verified against rc.117's source and runtime on 2026-09-23.

### Service Tags

`ServiceMap` is **removed**, and `Context.Service` is the constructor. `Effect.Tag`
and `Context.Tag` do not exist.

```typescript
// ❌ WRONG — ServiceMap was removed in beta.85 (earlier betas used it)
import { ServiceMap } from 'effect'
class Foo extends ServiceMap.Service<Foo, Shape>()('Foo') {}

// ❌ WRONG — Effect.Tag / Context.Tag do not exist
class Foo extends Effect.Tag('Foo')<Foo, Shape>() {}

// ✅ CORRECT — Context.Service, two-stage class form
import { Context } from 'effect'
class Foo extends Context.Service<Foo, Shape>()('Foo') {}

// ✅ also valid — function-style key (no class)
const Bar = Context.Service<Shape>()('Bar')
```

Always re-verify against the installed version: `node -e "const e=require('effect'); console.log(Object.keys(e).filter(k=>/Service|Context/i.test(k)))"`.

### Layer.succeed

Both forms are valid — `Layer.succeed` is dual:

```typescript
Layer.succeed(Tag, value) // data-first
Layer.succeed(Tag)(value) // curried
```

### Schema.Literal (one literal per call)

`Schema.Literal` is typed with a single parameter, so passing more is a type
error; at runtime the extra arguments are silently ignored. Use
`Schema.Literals` for several literals:

```typescript
// ❌ WRONG — type error; at runtime only 'json' is accepted
const format = S.Literal('json', 'yaml')

// ✅ CORRECT
const format = S.Literals(['json', 'yaml'])
```

### Schema.Union (array, not variadic)

```typescript
// ❌ WRONG — variadic args (type error; throws at runtime)
S.Union(S.Literal('a'), S.Literal('b'))

// ✅ CORRECT — array of schemas
S.Union([S.Literal('a'), S.Literal('b')])
```

### Schemas are directly extendable (no `Schema.asClass`)

`Schema.asClass` was removed in beta.102: every schema has a class-compatible
`new` signature, so a class extends the schema itself.

```typescript
// ❌ WRONG — removed
class Name extends S.asClass(S.String) {}

// ✅ CORRECT
class Name extends S.String {}
class Segment_ extends withStatics(S.String.pipe(S.brand('Segment'))) {}
```

### Renamed Schema APIs

- `Schema.TaggedErrorClass` → `Schema.TaggedError`; `Schema.ErrorClass` → `Schema.Error` (beta.104).
- `SchemaGetter.transformOrFail` → `SchemaGetter.transformEffect` (rc.113).
- `SchemaIssue` variants no longer carry the actual value (beta.103):
  `new SchemaIssue.InvalidValue(annotations?, input?, options?)` keeps `input`
  only when parse options set `reportInput: true`.

### Property testing (no fast-check)

Since rc.113 the `effect` package no longer depends on fast-check:
`Schema.toArbitrary`, `effect/testing`'s `FastCheck`, and the legacy
`Schema.Annotations.ToArbitrary` callback contract are gone. Use the native,
experimental `effect/unstable/arbitrary/Arbitrary` module — `Arbitrary.schema`
derives from a schema's decoded type, and `Arbitrary.checkEffect` runs a
property. Choose among fixed alternatives with a `Schema.Union` (there is no
`oneOf`). Derivation reads only the schema's decoded Type side, so a model whose
generated values must be valid has to encode every invariant there; patterns
need the `u` flag to generate astral characters. In this repo, tests use
`@kitz/vitest`'s `it.effect.prop` and `assertProperty`, which run the native
checker. Verified semantics: `docs/learnings/effect-arbitrary.md`.

## How to Verify

When unsure about an API, read the installed source:
```
Read node_modules/effect/src/<Module>.ts
```

To compare against another release, read it at its tag in the cloned repo:
```
git -C ~/repo-references/effect show effect@4.0.0-rc.117:packages/effect/src/Context.ts
```
