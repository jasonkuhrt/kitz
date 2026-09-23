---
name: kitz-functions
description: This skill should be used when implementing functions, designing function APIs, adding currying variants (*On/*With), choosing parameter order, naming operations, or working with type-level transformations for return types.
---

# Implementing Functions

## Steps

1. **Data first**: Accept data as the first parameter
2. **Curry when sensible**: Typically for 2-parameter functions
3. **Provide both curried variants** for most functions

## Reference

### Currying Pattern

```typescript
// Base function - data first
export const split = (value: string, separator: string): string[] => { ... }

// *On variant - data first, returns function waiting for second arg
export const splitOn = Fn.curry(split)
// Usage: splitOn(data)(separator)

// *With variant - flipped, returns function waiting for data
export const splitWith = Fn.flipCurried(Fn.curry(split))
// Usage: splitWith(separator)(data)
```

### When to Use Each Variant

**`*On`** - When you have data and want to try different operations:

```typescript
const data = 'name,age,city'
const splitData = splitOn(data)
splitData(',') // ['name', 'age', 'city']
splitData('') // individual chars
```

**`*With`** - When you have an operation and want to apply to different data:

```typescript
const splitByComma = splitWith(',')
splitByComma('john,25') // ['john', '25']
splitByComma('laptop,999') // ['laptop', '999']
```

### Universal Operations

Keep one name per concept across namespaces. For example, every schema that
goes through `Schema.withStatics` exposes the same `is` guard
(`Path.AbsDir.is`, `Path.Segment.is`), never a namespace-specific spelling.

### Namespace Name Elision

Do NOT repeat the namespace name in function names:

```typescript
// Correct
Path.join(base, part)
Path.AbsDir.is(value)

// Incorrect
Path.joinPath(base, part)
Path.AbsDir.isAbsDir(value)
```

### Type-Level Transformations

Prefer conditional types over function overloads for type mappings:

```typescript
// ✅ Good - Type-level transformation
type Abs<T extends number> =
  T extends Negative ? Positive :
  T extends NonPositive ? NonNegative :
  NonNegative

const abs = <T extends number>(value: T): Abs<T> => ...

// ❌ Avoid - Function overloads
function abs(value: Negative): Positive
function abs(value: NonPositive): NonNegative
function abs(value: number): NonNegative
```

Benefits: Cleaner API, better type inference, easier to maintain.

## Notes

- Some functions have only data parameters → only `*On` variant needed
- Functions with >2 parameters: currying less common, use judgment
- Data-first enables natural left-to-right composition
