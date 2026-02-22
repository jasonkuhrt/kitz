---
name: writing-tests
description: This skill should be used when the user asks to "write tests", "add tests", "create test file", or needs guidance on @kitz/test table-driven tests, snapshot mode, type assertions, or test file organization.
---

# Writing Tests

## File Organization

| File          | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `_.test.ts`   | Module tests (public API, uses `Ns.export` pattern) |
| `_.test-d.ts` | Type-level tests                                    |

**Always use `_.test.ts`** - tests mirror the namespace file and test the public API as consumers would use it.

## Core Principles

| Principle                    | Rule                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Test public interface**    | Test exports, not internals. Internal schemas/helpers get covered indirectly. |
| **Always `.on(fn)`**         | Type inference is the default. `.inputType<T>()` is escape hatch.             |
| **Prefer snapshots**         | `.casesInput()` / `.describeInputs()` for auto-generated expected values.     |
| **1:1 export coverage**      | One `Test.on(export)` per module export. Test file mirrors module structure.  |
| **One chain, one `.test()`** | Never separate blocks for related behaviors of one export.                    |
| **Public API style**         | In `_.test.ts`, use `Ns.export` pattern to mirror consumer usage.             |

## Choosing `.on()` Strategy

| Situation                                        | Strategy                                  |
| ------------------------------------------------ | ----------------------------------------- |
| `.on(fn)` gives good type inference              | Use directly                              |
| Minor issue (optional params, complex inference) | `.on((x) => fn(x))` anon wrapper          |
| Types still broken                               | `.inputType<T>().outputType<U>()`         |
| No function, custom logic                        | `.describe()` chain with custom `.test()` |

## Choosing Case Format

| Situation                         | Method                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| Default (snapshots)               | `.casesInput(x, y, z)`                                          |
| Need grouping                     | `.describeInputs('name', [x, y])` or `.describe('name', [...])` |
| Trivial pure fn (math/string ops) | `.cases([[input], expected], ...)`                              |
| Transform result before snapshot  | `.test(({ result }) => transform(result))`                      |

## What to Test

**Test the public API, not internal machinery.** If `Pattern` is an internal schema used by `addPattern()`, don't test `Pattern` directly — test that `addPattern()` normalizes patterns correctly.

```typescript
// Wrong - testing internal schema directly
Test.on((s: string) => Schema.decodeSync(Pattern)(s))
  .casesInput('  foo  ', './bar')
  .test()

// Right - testing public API that uses the internal
Test.on((p: string) => Gitignore.addPattern(Gitignore.empty, p).patterns)
  .cases(
    [['./node_modules/'], ['node_modules/']], // normalization covered
    [['  foo  '], ['foo']], // trimming covered
  )
  .test()
```

**Guideline:** If it's not exported, it shouldn't have its own `Test.on()` block.

## Examples

### Grouped snapshots (preferred for multiple scenarios)

```typescript
Test.on(parseVersion)
  .describeInputs('valid semver', ['1.2.3', '0.0.1', '10.20.30'])
  .describeInputs('with prerelease', ['1.0.0-alpha', '1.0.0-beta.1'])
  .describeInputs('invalid', ['bad', ''])
  .test()
```

### Flat snapshots

```typescript
Test.on(Str.Visual.pad)
  // dprint-ignore
  .casesInput(
    ['hi', 5, 'right'],
    ['hi', 5, 'left'],
    ['hello', 3, 'left'], // already wider
    ['x', 5, 'right', '-'], // custom char
  )
  .test()
```

### Explicit outputs (trivial pure functions only)

```typescript
Test.on(add)
  // dprint-ignore
  .cases(
    [[2, 3], 5],
    [[0, 0], 0],
    [[-1, 1], 0],
  )
  .test()
```

### Anon wrapper for type issues

When `.on(fn)` almost works but needs a tweak:

```typescript
const decode = Schema.decodeSync(MySchema) // (input, options?) => T

// Anon wrapper forwards just the arg we care about
Test.describe('decode')
  .on((input: string) => decode(input))
  .casesInput('valid', 'invalid', '')
  .test()
```

### Transform before snapshot

Transform in `.on()` lambda or `.test()` callback:

```typescript
// Transform in .on()
Test.describe('roundtrip')
  .on((content: string) => encode(decode(content)))
  .casesInput('node_modules/\n*.log\n', '')
  .test()

// Transform in .test() callback
Test.describe('addPattern')
  .on(Gitignore.addPattern)
  .casesInput(
    [Gitignore.empty, 'node_modules/'],
    [decode('foo/\n'), 'bar/'],
  )
  .test(({ result }) => encode(result))
```

### Chained describes with case tuples

```typescript
Test.on(analyzeFunction)
  .describe('parameters - named', [
    [(a: number) => a],
    [(a: number, b: string) => [a, b]],
  ])
  .describe('parameters - destructured', [
    [({ a, b }: { a: number; b: string }) => [a, b]],
  ])
  .test()
```

## dprint-ignore

**Use when ALL conditions met:**

1. 3+ cases
2. Single-line cases
3. Actual column alignment exists

**Place directly before the method with aligned content:**

```typescript
// Correct - alignment exists, comment preserves it
Test.on(add)
  // dprint-ignore
  .cases(
    [[2, 3], 5],
    [[0, 0], 0],
    [[-1, 1], 0],
  )
  .test()

// Wrong - comment but no alignment (pointless)
Test.on(parse)
  // dprint-ignore
  .casesInput(
    '1.2.3',
    '0.0.1',
  )
  .test()
```

## Case Format Reference

**Snapshot methods** (cleaner syntax):

```typescript
.casesInput(
  [arg1, arg2],           // binary+ fn: tuple of args
  'value',                // unary fn: can pass directly
)

.describeInputs('group', [input1, input2])
```

**Full case methods** (with expected output):

```typescript
.cases(
  [[arg1, arg2], expected],
  [[arg1, arg2]],                                  // snapshot (no output)
  [[arg1, arg2], expected, { comment: 'name' }],   // with context
)

.describe('group', [
  [[arg1, arg2], expected],
])
```

## Test File Structure

### 1:1 Export Coverage

Test files mirror module structure. One `Test.on()` block per module export:

```typescript
// Module: math/_.ts exports { add, subtract, multiply }
// Test: math/_.test.ts

Test.on(Math.add).casesInput([1, 2], [0, 0]).test()
Test.on(Math.subtract).casesInput([5, 3], [0, 0]).test()
Test.on(Math.multiply).casesInput([2, 3], [0, 1]).test()
```

Use `.describe()` / `.describeInputs()` when a single export has **multiple behavioral dimensions**.

### Reference Point Pattern

When testing wrappers, derive expected from the main function:

```typescript
// Test main function thoroughly
Test.on(Str.Visual.take).casesInput(['hello world', 5], ['hi', 10]).test()

// Verify wrappers match reference (DRY)
test('takeOn/takeWith match take', () => {
  const expected = Str.Visual.take('hello world', 5) // Derive from reference
  expect(Str.Visual.takeOn('hello world')(5)).toBe(expected)
  expect(Str.Visual.takeWith(5)('hello world')).toBe(expected)
})
```

## Config Methods

**Test control:** `.only()` · `.skip()` · `.skip('reason')` · `.skipIf(() => bool)` · `.concurrent()` · `.tags(['tag'])`

**Snapshot control:** `.snapshots({ arguments: false })` · `.snapshotSchemas([Schema])` · `.snapshotSerializer((v, ctx) => str)`

## Type Assertions

```typescript
import { Assert } from '@kitz/assert'

Assert.exact.ofAs<string>().on(value) // Value-level (preferred)

// In .test-d.ts files
type _pass = Assert.exact.of<string, string>
// @ts-expect-error
type _fail = Assert.exact.of<string, number>
```

## Don'ts

- **Don't** use separate `Test.on().test()` blocks — chain them
- **Don't** use `.cases([[x]], [[y]])` for snapshot-only — use `.casesInput(x, y)`
- **Don't** pass `undefined` as input — spreads as `fn(undefined)`, wrong for no-arg functions
- **Don't** wrap `Test.on()` in vitest `describe` — the builder creates its own

## Advanced Patterns

For `.onSetup()`, `.snapshotSchemas()`, `.snapshots()`, describe callback form, nested describe strategies, and when raw vitest is acceptable, see `references/advanced.md`.
