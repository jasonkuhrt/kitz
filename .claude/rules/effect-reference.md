# Effect v4 API Reference

## Source Location

Effect v4 source is available at `~/repo-references/effect-v4/`. Always read the source before using Effect APIs — the docs may not match the beta version used in this repo.

## Critical: Effect v4 Beta API Differences

This repo uses `effect@4.0.0-beta.31`. Many patterns from v3 docs are wrong at runtime.

### Service Tags

```typescript
// ❌ WRONG — Effect.Tag and Context.Tag do not exist in v4 beta
import { Effect } from 'effect'
class Foo extends Effect.Tag('Foo')<Foo, Shape>() {}

// ❌ WRONG — Context is not a named export from 'effect'
import { Context } from 'effect'
class Foo extends Context.Tag('Foo')<Foo, Shape>() {}

// ✅ CORRECT — use ServiceMap.Service
import { ServiceMap } from 'effect'
class Foo extends ServiceMap.Service<Foo, Shape>()('cmx/Foo') {}
```

### Layer.succeed

```typescript
// ❌ WRONG — two-arg form removed
Layer.succeed(Tag, value)

// ✅ CORRECT — curried form
Layer.succeed(Tag)(value)
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
