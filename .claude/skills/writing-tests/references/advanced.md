# Advanced Test Patterns

## Hide Arguments in Snapshots

When arguments are verbose or redundant in snapshot output:

```typescript
Test.on(Tex.render)
  .snapshots({ arguments: false })
  .casesInput(complexBuilder1, complexBuilder2)
  .test()
```

## Function-Based Cases with Setup Context

Use `.onSetup()` when test cases need shared fixtures or expensive setup:

```typescript
Test.on(transform)
  .onSetup(() => ({ data: createTestData() }))
  .cases(
    (ctx) => [[ctx.data.input], ctx.data.expected],
    (ctx) => [[ctx.data.other], ctx.data.otherExpected],
  )
  .test()
```

**Key behaviors:**

- Factory runs once per test case (fresh fixture per case)
- Multiple `.onSetup()` calls merge contexts: `{ ...ctx1, ...ctx2 }`
- Cases can be functions `(ctx) => [input, output]` or static tuples
- Mix static and function-based cases in same `.cases()` call

## Effect Schema Encoding in Snapshots

```typescript
Test.on(extractPaths)
  .snapshotSchemas([FsLoc.FsLoc]) // Encode schema instances to primitives
  .casesInput(input1, input2)
  .test()
// Snapshots show './src/index.ts' instead of { _tag: 'RelFile', path: [...] }
```

## Describe Callback Form

For complex child configuration or deep nesting:

```typescript
Test.on(parse)
  .describe('valid', (t) =>
    t
      .snapshots({ arguments: false })
      .casesInput('1.2.3', '0.0.1'))
  .describe('invalid', (t) =>
    t
      .casesInput('bad', 'worse'))
  .test()
```

## Nested Describe Strategies

**Simple nesting** — Use `>` syntax for shallow hierarchies:

```typescript
Test.on(parse)
  .describe('valid > basic', [...])
  .describe('valid > edge cases', [...])
  .test()
// Creates: describe('parse', () => describe('valid', () => { describe('basic', ...); describe('edge cases', ...) }))
```

**Deep nesting** — Use callback form:

```typescript
Test.on(parse)
  .describe('valid', (t) =>
    t
      .describe('basic', (t) => t.casesInput('1.2.3', '0.0.1'))
      .describe('edge cases', (t) => t.casesInput('0.0.0', '999.999.999')))
  .test()
```

The `>` syntax is sugar for simple/shallow nesting. For complex hierarchies with per-group configuration, prefer the callback form.

## When Raw Vitest is Acceptable

Not everything needs `Test.on()`. Use raw vitest `test()`/`describe()` for:

- **Property-based tests** with fast-check `property()`
- **Custom assertions** that don't fit table-driven format
- **Regression tests** with specific reproduction scenarios
