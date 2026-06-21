# Effect v4 API Reference

## Source Location

Effect v4 source is available at `~/repo-references/effect-v4/`. Always read the source before using Effect APIs — the docs may not match the beta version used in this repo.

## Critical: Effect v4 Beta API Differences

This repo uses `effect@4.0.0-beta.85` (peer dependency of `@kitz/effect`). Many patterns from v3 docs are wrong at runtime.

### Service Tags

The service API has churned across v4 betas. As of `effect@4.0.0-beta.85`
(verified 2026-06): `ServiceMap` is **removed**, and `Context.Service` is the
constructor. (Earlier betas used `ServiceMap.Service`; that no longer resolves.)

```typescript
// ❌ WRONG — ServiceMap was removed in beta.85 (this was correct in earlier betas)
import { ServiceMap } from 'effect'
class Foo extends ServiceMap.Service<Foo, Shape>()('Foo') {}

// ❌ WRONG — Effect.Tag / Context.Tag are not the constructor
class Foo extends Effect.Tag('Foo')<Foo, Shape>() {}

// ✅ CORRECT (beta.85) — Context.Service, two-stage class form
import { Context } from 'effect'
class Foo extends Context.Service<Foo, Shape>()('Foo') {}

// ✅ also valid — function-style key (no class)
const Bar = Context.Service<Shape>()('Bar')
```

Always re-verify against the installed version: `node -e "const e=require('effect'); console.log(Object.keys(e).filter(k=>/Service|Context/i.test(k)))"`.

### Layer.succeed

```typescript
// ❌ WRONG — two-arg form removed
Layer.succeed(Tag, value)

// ✅ CORRECT — curried form
Layer.succeed(Tag)(value)
```

### Schema.Literal (multi-arg broken in beta31)

```typescript
// ❌ WRONG — multi-arg Literal silently drops all but the first value
// S.Literal('json', 'yaml') only accepts 'json' — 'yaml' is ignored!
// No type error, no runtime error. Silent data loss.
const format = S.Literal('json', 'yaml')

// ✅ CORRECT — use S.Union with an array of single Literals
const format = S.Union([S.Literal('json'), S.Literal('yaml')])
```

The v4 source (`getDefaultLiteralAST`) checks `AST.isMembers(literals)` which requires 2+ elements, but beta31's `S.Literal` function signature only accepts one argument (`Literal.length === 1`). TypeScript types accept multiple args but only the first is used at runtime.

### Schema.Union (array, not variadic)

```typescript
// ❌ WRONG — variadic args
S.Union(S.Literal('a'), S.Literal('b'))

// ✅ CORRECT — array of schemas
S.Union([S.Literal('a'), S.Literal('b')])
```

## How to Verify

When unsure about an API, check the source:
```
Read ~/repo-references/effect-v4/packages/effect/src/<Module>.ts
```

For example, to check Context APIs:
```
Read ~/repo-references/effect-v4/packages/effect/src/Context.ts
```
