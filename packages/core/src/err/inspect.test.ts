import { describe, expect, test } from 'vitest'
import { inspect } from './inspect.js'

describe('inspect', () => {
  describe('basic error rendering', () => {
    test('simple error', () => {
      const error = new Error('Something went wrong')
      error.stack = `Error: Something went wrong
    at Function.execute (/app/src/index.ts:10:15)
    at process (/app/src/main.ts:20:10)
    at Object.<anonymous> (/app/index.js:5:1)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('error with no stack', () => {
      const error = new Error('No stack available')
      delete error.stack
      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('error with empty message', () => {
      const error = new Error('')
      error.stack = `Error
    at Function.execute (/app/src/index.ts:10:15)`
      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })
  })

  describe('error with context', () => {
    test('simple context object', () => {
      const error = new Error('API failed')
      ;(error as any).context = { userId: 123, endpoint: '/api/users' }
      error.stack = `Error: API failed
    at apiCall (/app/src/api.ts:45:10)
    at handleRequest (/app/src/server.ts:100:15)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('nested context object', () => {
      const error = new Error('Complex failure')
      ;(error as any).context = {
        request: {
          method: 'POST',
          url: '/api/data',
          headers: { 'content-type': 'application/json' },
        },
        timestamp: '2024-01-15T10:30:00Z',
        traceId: '123-456-789',
      }
      error.stack = `Error: Complex failure
    at process (/app/src/handler.ts:30:8)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })
  })

  describe('error with cause', () => {
    test('single level cause', () => {
      const cause = new Error('Database connection failed')
      cause.stack = `Error: Database connection failed
    at connect (/app/src/db.ts:15:10)`

      const error = new Error('Failed to fetch user', { cause })
      error.stack = `Error: Failed to fetch user
    at fetchUser (/app/src/user.ts:30:15)
    at handleRequest (/app/src/api.ts:50:20)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('nested causes', () => {
      const rootCause = new Error('Network timeout')
      rootCause.stack = `Error: Network timeout
    at socket (/app/src/net.ts:5:5)`

      const middleCause = new Error('Redis connection failed', { cause: rootCause })
      middleCause.stack = `Error: Redis connection failed
    at redis.connect (/app/src/cache.ts:10:10)`

      const error = new Error('Session creation failed', { cause: middleCause })
      error.stack = `Error: Session creation failed
    at createSession (/app/src/session.ts:25:15)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })
  })

  describe('AggregateError', () => {
    test('simple aggregate error', () => {
      const error1 = new Error('Service A failed')
      error1.stack = `Error: Service A failed
    at serviceA (/app/src/services/a.ts:10:5)`

      const error2 = new Error('Service B timeout')
      error2.stack = `Error: Service B timeout
    at serviceB (/app/src/services/b.ts:20:10)`

      const aggregate = new AggregateError([error1, error2], 'Multiple services failed')
      aggregate.stack = `AggregateError: Multiple services failed
    at coordinator (/app/src/coordinator.ts:50:15)`

      const result = inspect(aggregate, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('aggregate error with context', () => {
      const error1 = new Error('Database error')
      error1.stack = `Error: Database error
    at query (/app/src/db.ts:30:10)`
      ;(error1 as any).context = { table: 'users', operation: 'INSERT' }

      const error2 = new Error('Cache error')
      error2.stack = `Error: Cache error
    at cache.set (/app/src/cache.ts:15:5)`
      ;(error2 as any).context = { key: 'user:123', ttl: 3600 }

      const aggregate = new AggregateError([error1, error2], 'Data layer failures')
      ;(aggregate as any).context = { transactionId: 'tx-456', timestamp: 1234567890 }
      aggregate.stack = `AggregateError: Data layer failures
    at transaction (/app/src/transaction.ts:100:20)`

      const result = inspect(aggregate, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })

    test('nested aggregate errors', () => {
      const innerError = new Error('Inner failure')
      innerError.stack = `Error: Inner failure
    at inner (/app/src/inner.ts:5:5)`

      const innerAggregate = new AggregateError([innerError], 'Inner aggregate')
      innerAggregate.stack = `AggregateError: Inner aggregate
    at processInner (/app/src/process.ts:20:10)`

      const outerError = new Error('Outer failure')
      outerError.stack = `Error: Outer failure
    at outer (/app/src/outer.ts:10:10)`

      const outerAggregate = new AggregateError([innerAggregate, outerError], 'Outer aggregate')
      outerAggregate.stack = `AggregateError: Outer aggregate
    at main (/app/src/main.ts:50:15)`

      const result = inspect(outerAggregate, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
    })
  })

  describe('stack trace filtering', () => {
    test('filters node_modules frames', () => {
      const error = new Error('Test error')
      error.stack = `Error: Test error
    at userCode (/app/src/user.ts:10:5)
    at node_modules/lib/index.js:100:20
    at node_modules/other/file.js:50:10
    at moreUserCode (/app/src/main.ts:30:15)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
      expect(result).toContain('elided')
      expect(result).not.toContain('node_modules/lib')
    })

    test('shows all frames filtered message', () => {
      const error = new Error('All filtered')
      error.stack = `Error: All filtered
    at node_modules/lib1/index.js:10:5
    at node_modules/lib2/index.js:20:10
    at node_modules/lib3/index.js:30:15`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).toMatchSnapshot()
      expect(result).toContain('all 3 frames elided')
    })
  })

  // Table-driven tests for comprehensive scenarios
  describe('comprehensive error scenarios', () => {
    // oxfmt-ignore
    const cases: {
      name: string
      createError: () => Error
      options?: Parameters<typeof inspect>[1]
      expectations?: {
        contains?: string[]
        notContains?: string[]
      }
    }[] = [
    {
      name: 'custom error class',
      createError: () => {
        class CustomError extends Error {
          constructor(message: string, public code: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('Custom failure', 'ERR_CUSTOM')
        error.stack = `CustomError: Custom failure\n    at test (/app/test.ts:10:5)`
        return error
      },
      options: { showHelp: false, color: false },
      expectations: {
        contains: ['CustomError', 'Custom failure'],
      },
    },
    {
      name: 'error with very long message',
      createError: () => {
        const longMessage = 'This is a very long error message that '.repeat(10) + 'ends here'
        const error = new Error(longMessage)
        error.stack = `Error: ${longMessage}\n    at test (/app/test.ts:10:5)`
        return error
      },
      options: { showHelp: false, color: false, stackTraceColumns: 80 },
      expectations: {
        contains: ['very long error message'],
      },
    },
    {
      name: 'error with special characters in context',
      createError: () => {
        const error = new Error('Special chars')
        ;(error as any).context = {
          'special-key': 'value',
          'key with spaces': true,
          'emoji🎉': 'test',
          nested: { 'more-special': 123 },
        }
        error.stack = `Error: Special chars\n    at test (/app/test.ts:10:5)`
        return error
      },
      options: { showHelp: false, color: false },
      expectations: {
        contains: ['special-key', 'key with spaces', 'emoji🎉'],
      },
    },
    {
      name: 'error with circular reference in context',
      createError: () => {
        const error = new Error('Circular ref')
        const circular: any = { a: 1 }
        circular.self = circular
        ;(error as any).context = circular
        error.stack = `Error: Circular ref\n    at test (/app/test.ts:10:5)`
        return error
      },
      options: { showHelp: false, color: false },
      expectations: {
        contains: ['Circular ref'],
      },
    },
    ]

    for (const { name, createError, options, expectations } of cases) {
      test(name, () => {
        const error = createError()
        const result = inspect(error, options)

        // Use snapshot for full output
        expect(result).toMatchSnapshot()

        // Additional assertions
        if (expectations?.contains) {
          for (const text of expectations.contains) {
            expect(result).toContain(text)
          }
        }
        if (expectations?.notContains) {
          for (const text of expectations.notContains) {
            expect(result).not.toContain(text)
          }
        }
      })
    }
  })

  describe('environment variable configuration', () => {
    test('shows help section by default', () => {
      const error = new Error('Test')
      error.stack = `Error: Test\n    at test (/app/test.ts:10:5)`

      const result = inspect(error, { color: false })
      expect(result).toContain('Environment Variable Configuration')
      expect(result).toContain('ERROR_DISPLAY_COLOR')
      expect(result).toContain('ERROR_DISPLAY_SHOW_HELP')
    })

    test('hides help section when disabled', () => {
      const error = new Error('Test')
      error.stack = `Error: Test\n    at test (/app/test.ts:10:5)`

      const result = inspect(error, { showHelp: false, color: false })
      expect(result).not.toContain('Environment Variable Configuration')
      expect(result).not.toContain('ERROR_DISPLAY_COLOR')
    })
  })

  describe('visual guides (with color)', () => {
    test('shows tree characters for nested errors', () => {
      const cause = new Error('Cause')
      cause.stack = `Error: Cause\n    at cause (/app/cause.ts:5:5)`

      const error = new Error('Main', { cause })
      error.stack = `Error: Main\n    at main (/app/main.ts:10:10)`

      // Note: We're not testing actual colors here, just structure
      const result = inspect(error, { showHelp: false, color: true })
      expect(result).toMatchSnapshot()
    })

    test('shows proper indentation for aggregate errors', () => {
      const errors = [new Error('First'), new Error('Second'), new Error('Third')]
      errors[0]!.stack = `Error: First\n    at first (/app/first.ts:1:1)`
      errors[1]!.stack = `Error: Second\n    at second (/app/second.ts:2:2)`
      errors[2]!.stack = `Error: Third\n    at third (/app/third.ts:3:3)`

      const aggregate = new AggregateError(errors, 'Multiple')
      aggregate.stack = `AggregateError: Multiple\n    at main (/app/main.ts:10:10)`

      const result = inspect(aggregate, { showHelp: false, color: true })
      expect(result).toMatchSnapshot()
    })
  })
})
