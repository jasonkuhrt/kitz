import { Err } from '#err'
import { Assert } from '#kitz/assert'
import { Test } from '#kitz/test'
import { describe, expect, test } from 'vitest'
import { tryAllOrRethrow, tryOr, tryOrRethrow } from './try.js'
import { wrapWith } from './wrap.js'

const A = Assert.Type

const e = new Error('test error')
const v = 1

const fn = (throwValue?: unknown) => () => {
  if (throwValue) throw throwValue
  return v
}

const fnAsync = (throwValue?: unknown) => async () => {
  if (throwValue) throw throwValue
  return v
}

// Test sync variations
Test.describe('sync tryCatch')
  .on(Err.tryCatch)
  .cases(
    [[fn(e)], e],
    [[fn()], v],
  )
  .test()

// Test async variations
Test.describe('async tryCatch')
  .inputType<() => Promise<any>>()
  .outputType<any>()
  .cases(
    [fnAsync(e), e],
    [fnAsync(), v],
  )
  .test(async ({ input, output }) => {
    const result = await Err.tryCatch(input)
    expect(result).toBe(output)
  })

// Type-level test for async tryCatch
test('async tryCatch type inference', () => {
  const result = Err.tryCatch(fnAsync())
  A.exact.ofAs<Promise<number | Error>>().on(result)
})

// Success cases
Test.describe('tryOrRethrow success cases')
  .inputType<{ fn: () => any; wrapper: any }>()
  .outputType<any>()
  .contextType<{
    isAsync?: boolean
  }>()
  .cases(
    { input: { fn: () => 42, wrapper: 'Should not throw' }, output: 42, isAsync: false },
    {
      input: { fn: async () => 42, wrapper: 'Should not throw' },
      output: 42,
      isAsync: true,
    },
  )
  .test(async ({ input, output, isAsync }) => {
    const result = isAsync
      ? await tryOrRethrow(input.fn, input.wrapper)
      : tryOrRethrow(input.fn, input.wrapper)
    expect(result).toBe(output)
  })

// Error wrapping cases
Test.describe('tryOrRethrow error wrapping')
  .inputType<{ fn: () => any; wrapper: any }>()
  .outputType<void>()
  .contextType<{
    expectedMessage: string
    expectedCauseMessage?: string
    checkContext?: { id: number }
    checkCustomError?: boolean
  }>()
  .cases(
    {
      input: {
        fn: () => {
          throw new Error('Original')
        },
        wrapper: 'Operation failed',
      },
      output: undefined,
      expectedMessage: 'Operation failed',
      expectedCauseMessage: 'Original',
    },
    {
      input: {
        fn: () => {
          throw new Error('Original')
        },
        wrapper: { message: 'Operation failed', context: { id: 123 } },
      },
      output: undefined,
      expectedMessage: 'Operation failed',
      checkContext: { id: 123 },
    },
  )
  .test(({ input, expectedMessage, expectedCauseMessage, checkContext }) => {
    try {
      tryOrRethrow(input.fn, input.wrapper)
      throw new Error('Should have thrown')
    } catch (error: any) {
      expect(error.message).toBe(expectedMessage)
      if (expectedCauseMessage) {
        expect(error.cause.message).toBe(expectedCauseMessage)
      }
      if (checkContext) {
        expect(error.context).toEqual(checkContext)
      }
    }
  })

// Custom wrapper function test (kept as individual test due to unique CustomError class)
describe('tryOrRethrow custom wrapper', () => {
  test('wraps with custom wrapper function', () => {
    class CustomError extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'CustomError'
      }
    }

    try {
      tryOrRethrow(
        () => {
          throw new Error('Original')
        },
        (cause) => new CustomError('Custom wrapper', { cause }),
      )
    } catch (error: any) {
      expect(error).toBeInstanceOf(CustomError)
      expect(error.message).toBe('Custom wrapper')
    }
  })
})

// Async error tests
Test.describe('async tryOrRethrow errors')
  .inputType<{ fn: () => Promise<any>; wrapper: any }>()
  .outputType<void>()
  .contextType<{
    expectedMessage: string
    expectedCauseMessage?: string
  }>()
  .cases(
    {
      input: {
        fn: async () => {
          throw new Error('Async error')
        },
        wrapper: 'Async operation failed',
      },
      output: undefined,
      expectedMessage: 'Async operation failed',
      expectedCauseMessage: 'Async error',
    },
    {
      input: {
        fn: async () => {
          throw new Error('Network timeout')
        },
        wrapper: wrapWith('Failed to fetch data'),
      },
      output: undefined,
      expectedMessage: 'Failed to fetch data',
    },
  )
  .test(async ({ input, expectedMessage, expectedCauseMessage }) => {
    await expect(tryOrRethrow(input.fn, input.wrapper)).rejects.toThrow(expectedMessage)

    if (expectedCauseMessage) {
      try {
        await tryOrRethrow(input.fn, input.wrapper)
      } catch (error: any) {
        expect(error.cause.message).toBe(expectedCauseMessage)
      }
    }
  })

Test
  .describe('sync tryOr variations')
  .on(tryOr)
  .cases(
    [[() => 42, 'fallback'], 42],
    [[() => {
      throw new Error('fail')
    }, 'fallback'], 'fallback'],
    [[() => {
      throw new Error('fail')
    }, () => 'lazy fallback'], 'lazy fallback'],
  )
  .test()

// Test async variations with Test.table
Test.describe('async tryOr variations')
  .inputType<{
    fn: () => Promise<any>
    fallback: any
  }>()
  .outputType<any>()
  .cases(
    [{
      fn: async () => 42,
      fallback: 'fallback',
    }, 42],
    [{
      fn: async () => {
        throw new Error('fail')
      },
      fallback: 'fallback',
    }, 'fallback'],
    [{
      fn: async () => {
        throw new Error('fail')
      },
      fallback: () => 'lazy fallback',
    }, 'lazy fallback'],
    [{
      fn: async () => {
        throw new Error('fail')
      },
      fallback: async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async fallback'
      },
    }, 'async fallback'],
  )
  .test(async ({ input, output }) => {
    const result = await tryOr(input.fn, input.fallback)
    expect(result).toBe(output)
  })

// tryOrAsync special cases (kept as individual tests since they test a different import)
describe('tryOrAsync', () => {
  test('sync function with async fallback should use tryOrAsync', async () => {
    const { tryOrAsync } = await import('./try.js')
    const result = await tryOrAsync(
      () => {
        throw new Error('fail')
      },
      async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async fallback from sync error'
      },
    )

    // Result should be the fallback value
    expect(result).toBe('async fallback from sync error')
  })

  test('tryOrAsync always returns Promise', async () => {
    const { tryOrAsync } = await import('./try.js')

    // Even when both are sync, tryOrAsync returns Promise
    const result1 = tryOrAsync(
      () => 42,
      () => 'never used',
    )
    expect(result1).toBeInstanceOf(Promise)
    expect(await result1).toBe(42)

    // Works with async fallback too
    const result2 = tryOrAsync(
      () => 42,
      async () => 'never used',
    )
    expect(result2).toBeInstanceOf(Promise)
    expect(await result2).toBe(42)
  })
})

describe('tryAllOrRethrow', () => {
  test('returns all results on success', async () => {
    const results = await tryAllOrRethrow(
      [
        () => 1,
        async () => 2,
        () => Promise.resolve(3),
      ],
      'Should not throw',
    )

    expect(results).toEqual([1, 2, 3])
  })

  test('throws AggregateError when any fail', async () => {
    await expect(
      tryAllOrRethrow(
        [
          () => 1,
          () => {
            throw new Error('Failed 1')
          },
          async () => {
            throw new Error('Failed 2')
          },
        ],
        'Multiple operations failed',
      ),
    ).rejects.toThrow(AggregateError)

    try {
      await tryAllOrRethrow(
        [
          () => 1,
          () => {
            throw new Error('Failed 1')
          },
          async () => {
            throw new Error('Failed 2')
          },
        ],
        'Operations failed',
      )
    } catch (error: any) {
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.message).toBe('Operations failed')
      expect(error.errors).toHaveLength(2)
      expect(error.errors[0].message).toBe('Operations failed')
      expect(error.errors[0].cause.message).toBe('Failed 1')
      expect(error.errors[1].message).toBe('Operations failed')
      expect(error.errors[1].cause.message).toBe('Failed 2')
    }
  })

  test('works with wrapper function', async () => {
    class DataError extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'DataError'
      }
    }

    try {
      await tryAllOrRethrow(
        [
          () => 1,
          () => {
            throw new Error('DB error')
          },
        ],
        (cause) => new DataError('Data operation failed', { cause }),
      )
    } catch (error: any) {
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors[0]).toBeInstanceOf(DataError)
    }
  })

  test('preserves result order', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    const results = await tryAllOrRethrow(
      [
        async () => {
          await delay(100)
          return 'slow'
        },
        () => 'fast',
        async () => {
          await delay(50)
          return 'medium'
        },
      ],
      'Should not fail',
    )

    expect(results).toEqual(['slow', 'fast', 'medium'])
  })
})
