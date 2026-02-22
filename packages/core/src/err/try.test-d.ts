import { test } from 'vitest'

/**
 * Type-level tests for try.ts
 * These tests ensure that type inference works correctly for all combinations
 * of sync/async functions and fallbacks.
 */

import { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'
import { tryOr, tryOrAsync, tryOrAsyncWith, tryOrNull, tryOrUndefined, tryOrWith } from './try.js'

// tryOr type tests

// Sync function with sync fallback
test('sync function with sync fallback', () => {
  const result = tryOr(() => 42, 'fallback')
  A.sub.ofAs<number | string>().on(result)
})

// Sync function with lazy sync fallback
test('sync function with lazy sync fallback', () => {
  const result = tryOr(() => 42, () => 'fallback')
  A.sub.ofAs<number | string>().on(result)
})

// Sync function with async fallback - requires tryOrAsync
test('sync function with async fallback requires tryOrAsync', () => {
  // This should be a type error with tryOr
  // For now, we document this constraint but TypeScript's inference doesn't enforce it
  // const _errorCase = tryOr(() => 42, async () => 'fallback')

  // Use tryOrAsync instead
  const result = tryOrAsync(() => 42, async () => 'fallback')
  A.sub.ofAs<Promise<number | string>>().on(result)
})

// Async function with sync fallback
test('async function with sync fallback', () => {
  const result = tryOr(async () => 42, 'fallback')
  A.sub.ofAs<Promise<number | string>>().on(result)
})

// Async function with lazy sync fallback
test('async function with lazy sync fallback', () => {
  const result = tryOr(async () => 42, () => 'fallback')
  A.sub.ofAs<Promise<number | string>>().on(result)
})

// Async function with async fallback
test('async function with async fallback', () => {
  const result = tryOr(async () => 42, async () => 'fallback')
  A.sub.ofAs<Promise<number | string>>().on(result)
})

// Complex types
test('complex types', () => {
  interface User {
    id: string
    name: string
  }

  interface ErrorResult {
    error: true
    message: string
  }

  // Sync with object fallback
  const r1 = tryOr(
    (): User => ({ id: '1', name: 'John' }),
    { error: true, message: 'Failed' } as ErrorResult,
  )
  A.sub.ofAs<User | ErrorResult>().on(r1)

  // Async with async fallback returning different type
  const r2 = tryOr(
    async (): Promise<User> => ({ id: '1', name: 'John' }),
    async (): Promise<ErrorResult> => ({ error: true, message: 'Failed' }),
  )
  A.sub.ofAs<Promise<User | ErrorResult>>().on(r2)
})

// tryOrUndefined type tests
test('tryOrUndefined', () => {
  // Sync function
  const r1 = tryOrUndefined(() => 42)
  A.sub.ofAs<number | undefined>().on(r1)

  // Async function
  const r2 = tryOrUndefined(async () => 42)
  A.sub.ofAs<Promise<number | undefined>>().on(r2)

  // With complex type
  interface Data {
    value: string
  }
  const r3 = tryOrUndefined((): Data => ({ value: 'test' }))
  A.sub.ofAs<Data | undefined>().on(r3)
})

// tryOrNull type tests
test('tryOrNull', () => {
  // Sync function
  const r1 = tryOrNull(() => 'hello')
  A.sub.ofAs<string | null>().on(r1)

  // Async function
  const r2 = tryOrNull(async () => 'hello')
  A.sub.ofAs<Promise<string | null>>().on(r2)
})

// tryOrWith curried function type tests
test('tryOrWith curried function', () => {
  const orDefault = tryOrWith({ status: 'unknown', data: null })

  // With sync function
  const r1 = orDefault(() => ({ status: 'ok', data: 'value' }))
  A.sub.ofAs<{ status: string; data: string | null }>().on(r1)

  // With async function
  const r2 = orDefault(async () => ({ status: 'ok', data: 'value' }))
  A.sub.ofAs<Promise<{ status: string; data: string | null }>>().on(r2)

  // With async fallback - this won't work with tryOrWith
  // @ts-expect-error - tryOrWith cannot handle sync function with async fallback
  const _errorCase = tryOrWith(async () => ({ error: 'timeout' })).on()

  // Use tryOrAsyncWith instead for async fallbacks
  const orAsyncDefault = tryOrAsyncWith(async () => ({ error: 'timeout' }))

  const r3 = orAsyncDefault(() => 'success')
  A.sub.ofAs<Promise<string | { error: string }>>().on(r3)

  const r4 = orAsyncDefault(async () => 'success')
  A.sub.ofAs<Promise<string | { error: string }>>().on(r4)
})

// Edge cases

// Void functions
test('void functions', () => {
  const r1 = tryOr(() => {}, 'fallback')
  A.sub.ofAs<void | string>().on(r1)

  const r2 = tryOr(async () => {}, 'fallback')
  A.sub.ofAs<Promise<void | string>>().on(r2)
})

// Never type (functions that always throw)
test('never type', () => {
  const alwaysThrows = (): never => {
    throw new Error('Always fails')
  }

  const r1 = tryOr(alwaysThrows, 'fallback')
  A.sub.ofAs<string>().on(r1)

  // This would be an error with tryOr
  // const _errorCase2 = tryOr(alwaysThrows, async () => 'fallback')

  // Use tryOrAsync instead
  const r2 = tryOrAsync(alwaysThrows, async () => 'fallback')
  A.sub.ofAs<Promise<string>>().on(r2)
})

// Union types
test('union types', () => {
  const fn = (): string | number => Math.random() > 0.5 ? 'text' : 42

  const r1 = tryOr(fn, false)
  A.sub.ofAs<string | number | boolean>().on(r1)

  const r2 = tryOr(async () => fn(), null)
  A.sub.ofAs<Promise<string | number | null>>().on(r2)
})

// Nested promises (should be flattened)
test('nested promises', () => {
  const r1 = tryOr(
    async () => Promise.resolve(42),
    async () => Promise.resolve('fallback'),
  )
  A.sub.ofAs<Promise<number | string>>().on(r1)

  // Not Promise<Promise<number | string>>
})

// Generic function usage
test('generic function usage', () => {
  function processData<T>(data: T): T {
    return data
  }

  function safeProcess<T>(data: T, fallback: T): T {
    return tryOr(() => processData(data), fallback) as T
  }

  const r1 = safeProcess('hello', 'default')
  A.sub.ofAs<string>().on(r1)

  const r2 = safeProcess(42, 0)
  A.sub.ofAs<number>().on(r2)
})
